/**
 * Workspace loader - Load workspace configurations from environment variables
 * Automatically syncs workspace configurations to database on startup
 * Fetches workspace metadata from Slack API to minimize required env vars
 */

import { db } from './database.js';
import { logger } from './logger.js';

interface WorkspaceEnvConfig {
  key: string; // e.g., "WS1", "WS2"
  teamId: string;
  teamName: string;
  botToken: string;
  appToken: string;
  botId: string;
  botUserId: string;
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
 * @returns Array of loaded workspace keys and the primary app token for Socket Mode
 */
export async function loadWorkspacesFromEnv(): Promise<{ workspaces: string[]; primaryAppToken: string | undefined }> {
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

    // Validate required fields
    if (!botToken) {
      logger.warn(`Skipping incomplete workspace configuration: ${wsKey}`, {
        reason: 'Missing BOT_TOKEN',
      });
      console.warn(`⚠️  Skipping ${wsKey}: Missing SLACK_${wsKey}_BOT_TOKEN`);
      continue;
    }

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
      installed_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(team_id, enterprise_id) DO UPDATE SET
      team_name = excluded.team_name,
      bot_token = excluded.bot_token,
      bot_id = excluded.bot_id,
      bot_user_id = excluded.bot_user_id,
      bot_scopes = excluded.bot_scopes,
      updated_at = CURRENT_TIMESTAMP
  `);

  // For standard workspaces, delete existing records first to avoid NULL conflict issues
  const deleteStmt = db.prepare(`
    DELETE FROM slack_installations
    WHERE team_id = ? AND enterprise_id IS NULL
  `);

  const loadedWorkspaces: string[] = [];

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
        JSON.stringify(['app_mentions:read', 'chat:write', 'channels:history', 'groups:history', 'im:history', 'mpim:history'])
      );

      loadedWorkspaces.push(ws.teamId);

      logger.info('Workspace synced to database', {
        key: ws.key,
        teamId: ws.teamId,
        teamName: ws.teamName,
        hasAppToken: !!ws.appToken,
      });

      console.log(`✅ Loaded workspace: ${ws.teamName} (${ws.teamId})`);
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
    primaryAppToken,
  };
}
