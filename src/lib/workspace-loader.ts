/**
 * Workspace loader - Load workspace configurations from environment variables
 * Automatically syncs workspace configurations to database on startup
 * Fetches workspace metadata from Slack API to minimize required env vars
 */

import { db } from './database.js';
import { logger } from './logger.js';
import { config } from './config.js';
import type { UIVersion } from '../models/ui-version.js';

interface WorkspaceEnvConfig {
  key: string; // e.g., "WS1", "WS2"
  teamId: string;
  teamName: string;
  botToken: string;
  appToken: string;
  botId: string;
  botUserId: string;
  uiVersion: UIVersion; // UI version for this workspace
}

interface SlackAuthTestResponse {
  ok: boolean;
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id: string;
  is_enterprise_install: boolean;
  error?: string;
}

/**
 * Fetch workspace metadata from Slack API using auth.test
 */
async function fetchWorkspaceInfo(botToken: string): Promise<{
  teamId: string;
  teamName: string;
  botId: string;
  botUserId: string;
}> {
  const response = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as SlackAuthTestResponse;

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
  }

  return {
    teamId: data.team_id,
    teamName: data.team,
    botId: data.bot_id,
    botUserId: data.user_id,
  };
}

/**
 * Load workspaces from environment variables and sync to database
 *
 * Expected environment variable format (minimal):
 * - SLACK_WS1_BOT_TOKEN=xoxb-... (required)
 * - SLACK_WS1_APP_TOKEN=xapp-... (required for Socket Mode)
 *
 * TEAM_ID, TEAM_NAME, BOT_ID, BOT_USER_ID are auto-fetched from Slack API
 *
 * @returns Array of loaded workspace keys, workspace key mapping, and the primary app token for Socket Mode
 */
export async function loadWorkspacesFromEnv(): Promise<{
  workspaces: string[];
  workspaceKeyMap: Map<string, string>; // teamId -> workspaceKey (e.g., "T01ABC" -> "ws1")
  primaryAppToken: string | undefined;
}> {
  const workspaces: WorkspaceEnvConfig[] = [];

  // Find all workspace configuration keys (WS1, WS2, WS3, ...)
  const workspaceKeys = Object.keys(process.env)
    .filter(key => key.match(/^SLACK_WS\d+_BOT_TOKEN$/))
    .map(key => {
      const match = key.match(/^SLACK_(WS\d+)_/);
      return match ? match[1] : null;
    })
    .filter((key): key is string => key !== null)
    .sort(); // Sort to ensure consistent ordering (WS1, WS2, WS3...)

  logger.info('Found workspace configuration keys', { keys: workspaceKeys });

  // Load each workspace configuration
  for (const wsKey of workspaceKeys) {
    const botToken = process.env[`SLACK_${wsKey}_BOT_TOKEN`];
    const appToken = process.env[`SLACK_${wsKey}_APP_TOKEN`];
    const uiVersionEnv = process.env[`SLACK_${wsKey}_UI_VERSION`] as UIVersion | undefined;

    // Validate required fields
    if (!botToken) {
      logger.warn(`Skipping incomplete workspace configuration: ${wsKey}`, {
        reason: 'Missing BOT_TOKEN',
      });
      console.warn(`⚠️  Skipping ${wsKey}: Missing SLACK_${wsKey}_BOT_TOKEN`);
      continue;
    }

    // Validate UI version if specified
    if (uiVersionEnv && uiVersionEnv !== 'old' && uiVersionEnv !== 'new') {
      logger.error(`Invalid UI version for ${wsKey}`, { version: uiVersionEnv });
      console.error(`\n=== ❌ Invalid UI Version for ${wsKey} ===`);
      console.error(`Invalid value for SLACK_${wsKey}_UI_VERSION: "${uiVersionEnv}"`);
      console.error('Valid values are: "old" or "new"');
      console.error('==========================================\n');
      process.exit(1);
    }

    // Default to global config, or 'old' if not specified
    const uiVersion: UIVersion = uiVersionEnv || config.notebookLMUIVersion || 'old';

    try {
      // Fetch workspace metadata from Slack API
      logger.info(`Fetching workspace info from Slack API for ${wsKey}...`);
      console.log(`🔄 Fetching workspace info for ${wsKey}...`);

      const workspaceInfo = await fetchWorkspaceInfo(botToken);

      workspaces.push({
        key: wsKey,
        teamId: workspaceInfo.teamId,
        teamName: workspaceInfo.teamName,
        botToken: botToken,
        appToken: appToken || '',
        botId: workspaceInfo.botId,
        botUserId: workspaceInfo.botUserId,
        uiVersion: uiVersion,
      });

      logger.info(`Successfully fetched workspace info for ${wsKey}`, {
        teamId: workspaceInfo.teamId,
        teamName: workspaceInfo.teamName,
      });
    } catch (error) {
      logger.error(`Failed to fetch workspace info for ${wsKey}`, { error });
      console.error(`❌ Failed to fetch workspace info for ${wsKey}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  // Validate at least one workspace is configured
  if (workspaces.length === 0) {
    logger.error('No valid workspace configurations found in environment variables');
    console.error('\n=== ❌ No Workspaces Configured ===');
    console.error('Please add workspace configurations to .env file:\n');
    console.error('SLACK_WS1_BOT_TOKEN=xoxb-1234567890-1234567890123-abc...');
    console.error('SLACK_WS1_APP_TOKEN=xapp-1-A01ABCDEFG-1234567890123-def...\n');
    console.error('For additional workspaces, use WS2, WS3, etc.\n');
    console.error('Note: TEAM_ID, TEAM_NAME, BOT_ID, BOT_USER_ID are auto-fetched from Slack API\n');
    process.exit(1);
  }

  // Sync to database (UPSERT pattern)
  // Note: For standard workspaces (enterprise_id = NULL), we need to handle the conflict differently
  // because SQLite treats NULL as unique values in UNIQUE constraints
  const upsertStmt = db.prepare(`
    INSERT INTO slack_installations (
      team_id, team_name, enterprise_id,
      bot_token, bot_id, bot_user_id, bot_scopes,
      ui_version,
      installed_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(team_id, enterprise_id) DO UPDATE SET
      team_name = excluded.team_name,
      bot_token = excluded.bot_token,
      bot_id = excluded.bot_id,
      bot_user_id = excluded.bot_user_id,
      bot_scopes = excluded.bot_scopes,
      ui_version = excluded.ui_version,
      updated_at = CURRENT_TIMESTAMP
  `);

  // For standard workspaces, delete existing records first to avoid NULL conflict issues
  const deleteStmt = db.prepare(`
    DELETE FROM slack_installations
    WHERE team_id = ? AND enterprise_id IS NULL
  `);

  const loadedWorkspaces: string[] = [];
  // T024: Build workspace key mapping (teamId -> workspaceKey)
  const workspaceKeyMap = new Map<string, string>();

  for (const ws of workspaces) {
    try {
      // Delete existing record first (to handle NULL enterprise_id properly)
      deleteStmt.run(ws.teamId);

      // Then insert the new/updated record
      upsertStmt.run(
        ws.teamId,
        ws.teamName,
        ws.botToken,
        ws.botId,
        ws.botUserId,
        JSON.stringify(['app_mentions:read', 'chat:write', 'channels:history', 'groups:history', 'im:history', 'mpim:history']),
        ws.uiVersion
      );

      loadedWorkspaces.push(ws.teamId);

      // T024: Store workspace key mapping (WS1 -> ws1 lowercase)
      workspaceKeyMap.set(ws.teamId, ws.key.toLowerCase());

      logger.info('Workspace synced to database', {
        key: ws.key,
        teamId: ws.teamId,
        teamName: ws.teamName,
        workspaceKey: ws.key.toLowerCase(),
        hasAppToken: !!ws.appToken,
        uiVersion: ws.uiVersion,
      });

      console.log(`✅ Loaded workspace: ${ws.teamName} (${ws.teamId}) [${ws.key.toLowerCase()}] - UI: ${ws.uiVersion}`);
    } catch (error) {
      logger.error('Failed to sync workspace to database', {
        key: ws.key,
        teamId: ws.teamId,
        error,
      });
      console.error(`❌ Failed to load ${ws.key} (${ws.teamId}):`, error);
    }
  }

  logger.info(`Successfully loaded ${loadedWorkspaces.length} workspace(s) from environment variables`);
  console.log(`\n✅ Total workspaces loaded: ${loadedWorkspaces.length}\n`);

  // Return primary app token (first workspace with app token) for Socket Mode
  const primaryAppToken = workspaces.find(ws => ws.appToken)?.appToken;

  if (!primaryAppToken) {
    logger.warn('No APP_TOKEN found in any workspace configuration - Socket Mode will not work');
    console.warn('⚠️  Warning: No SLACK_WS*_APP_TOKEN found. Socket Mode requires at least one APP_TOKEN.\n');
  }

  return {
    workspaces: loadedWorkspaces,
    workspaceKeyMap, // T024: Return workspace key mapping
    primaryAppToken,
  };
}

/**
 * Validate UI version configuration on startup
 * FR-007: Refuse to start with error code if configuration is malformed or contains invalid UI version settings
 */
export function validateUIVersionConfig(): void {
  const version = config.notebookLMUIVersion;

  if (version && version !== 'old' && version !== 'new') {
    logger.error('Invalid NOTEBOOKLM_UI_VERSION in config', { version });
    console.error('\n=== ❌ Invalid UI Version Configuration ===');
    console.error(`Invalid value for NOTEBOOKLM_UI_VERSION: "${version}"`);
    console.error('Valid values are: "old" or "new"');
    console.error('==========================================\n');
    process.exit(1); // FR-007: 不正な設定で起動拒否
  }

  logger.info('UI version config validated', {
    version: version || 'old (default)',
    source: version ? 'explicit' : 'default',
  });

  console.log(`✅ UI Version: ${version || 'old (default)'}`);
}

/**
 * Get UI version for a workspace
 * FR-008: Default to old UI version when workspace configuration doesn't specify one
 *
 * @param workspaceId - Workspace identifier (team_id from slack_installations)
 * @returns UIVersion - 'old' or 'new'
 */
export function getUIVersion(workspaceId: string): UIVersion {
  // Query database for workspace-specific UI version
  const result = db
    .prepare('SELECT ui_version FROM slack_installations WHERE team_id = ?')
    .get(workspaceId) as { ui_version: UIVersion } | undefined;

  if (result?.ui_version) {
    return result.ui_version;
  }

  // Fallback to global config or default
  return config.notebookLMUIVersion || 'old'; // FR-008: デフォルトは旧UI
}
