/**
 * SQLite InstallationStore Implementation
 * Implements @slack/oauth InstallationStore interface for multi-workspace support
 */

import type { Database } from 'better-sqlite3';
import type {
  SlackInstallation,
  SlackInstallationRow,
  InstallQuery,
  Installation,
} from '../models/workspace.js';

/**
 * Logger interface (compatible with @slack/logger)
 */
export interface Logger {
  debug(...msg: any[]): void;
  info(...msg: any[]): void;
  warn(...msg: any[]): void;
  error(...msg: any[]): void;
  setLevel?(level: string): void;
  getLevel?(): string;
  setName?(name: string): void;
}

/**
 * SQLite-based InstallationStore for Slack OAuth
 * Stores and retrieves workspace installation data
 */
export class SQLiteInstallationStore {
  constructor(private db: Database) {}

  /**
   * Store an installation (T007)
   * UPSERT pattern - update if exists, insert if not
   */
  async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
    installation: Installation,
    logger?: Logger
  ): Promise<void> {
    try {
      if (!installation.team) {
        throw new Error('Team information is required for installation');
      }

      const teamId = installation.team.id;
      const teamName = installation.team.name || 'Unknown';
      const enterpriseId = installation.enterprise?.id || null;
      const enterpriseName = installation.enterprise?.name || null;

      // Bot information (required for this use case)
      if (!installation.bot) {
        throw new Error('Bot installation data is required');
      }

      const botToken = installation.bot.token;
      const botId = installation.bot.id;
      const botUserId = installation.bot.userId;
      const botScopes = JSON.stringify(installation.bot.scopes || []);

      // User information (optional)
      const userToken = installation.user?.token || null;
      const userId = installation.user?.id || null;
      const userScopes = installation.user?.scopes
        ? JSON.stringify(installation.user.scopes)
        : null;

      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO slack_installations (
          team_id,
          team_name,
          enterprise_id,
          enterprise_name,
          bot_token,
          bot_id,
          bot_user_id,
          bot_scopes,
          user_token,
          user_id,
          user_scopes,
          installed_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_id, COALESCE(enterprise_id, ''))
        DO UPDATE SET
          team_name = excluded.team_name,
          enterprise_name = excluded.enterprise_name,
          bot_token = excluded.bot_token,
          bot_id = excluded.bot_id,
          bot_user_id = excluded.bot_user_id,
          bot_scopes = excluded.bot_scopes,
          user_token = excluded.user_token,
          user_id = excluded.user_id,
          user_scopes = excluded.user_scopes,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        teamId,
        teamName,
        enterpriseId,
        enterpriseName,
        botToken,
        botId,
        botUserId,
        botScopes,
        userToken,
        userId,
        userScopes,
        now,
        now
      );

      logger?.info?.('Installation stored successfully', {
        teamId,
        teamName,
        enterpriseId,
      });
    } catch (error) {
      logger?.error?.('Failed to store installation', {
        teamId: installation.team?.id,
        enterpriseId: installation.enterprise?.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Fetch an installation (T008)
   * Throws if not found (as per Slack Bolt SDK expectations)
   */
  async fetchInstallation<AuthVersion extends 'v1' | 'v2'>(
    query: InstallQuery,
    logger?: Logger
  ): Promise<Installation> {
    try {
      const { teamId, enterpriseId } = query;

      if (!teamId) {
        logger?.warn?.('fetchInstallation called without teamId', { query });
        throw new Error('teamId is required for installation lookup');
      }

      // Query by teamId and enterpriseId (null for standard workspaces)
      const stmt = this.db.prepare(`
        SELECT * FROM slack_installations
        WHERE team_id = ?
          AND (
            (enterprise_id IS NULL AND ? IS NULL)
            OR enterprise_id = ?
          )
      `);

      const row = stmt.get(
        teamId,
        enterpriseId || null,
        enterpriseId || null
      ) as SlackInstallationRow | undefined;

      if (!row) {
        logger?.debug?.('Installation not found', { teamId, enterpriseId });
        throw new Error(`Installation not found for teamId: ${teamId}`);
      }

      // Parse JSON scopes
      const botScopes = JSON.parse(row.bot_scopes) as string[];
      const userScopes = row.user_scopes
        ? (JSON.parse(row.user_scopes) as string[])
        : undefined;

      // Convert to Installation format
      const installation: Installation = {
        team: {
          id: row.team_id,
          name: row.team_name || 'Unknown',
        },
        bot: {
          token: row.bot_token,
          scopes: botScopes,
          id: row.bot_id,
          userId: row.bot_user_id,
        },
        installedAt: new Date(row.installed_at),
      };

      // Add enterprise if present
      if (row.enterprise_id) {
        installation.enterprise = {
          id: row.enterprise_id,
          name: row.enterprise_name || 'Unknown',
        };
      }

      // Add user if present
      if (row.user_id) {
        installation.user = {
          id: row.user_id,
          token: row.user_token || undefined,
          scopes: userScopes,
        };
      }

      logger?.debug?.('Installation fetched successfully', {
        teamId,
        enterpriseId,
      });

      return installation;
    } catch (error) {
      logger?.error?.('Failed to fetch installation', {
        teamId: query.teamId,
        enterpriseId: query.enterpriseId,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete an installation (T009)
   * Idempotent - succeeds even if installation doesn't exist
   */
  async deleteInstallation(
    query: InstallQuery,
    logger?: Logger
  ): Promise<void> {
    try {
      const { teamId, enterpriseId } = query;

      if (!teamId) {
        logger?.warn?.('deleteInstallation called without teamId', { query });
        return;
      }

      const stmt = this.db.prepare(`
        DELETE FROM slack_installations
        WHERE team_id = ?
          AND (
            (enterprise_id IS NULL AND ? IS NULL)
            OR enterprise_id = ?
          )
      `);

      const result = stmt.run(
        teamId,
        enterpriseId || null,
        enterpriseId || null
      );

      if (result.changes > 0) {
        logger?.info?.('Installation deleted', { teamId, enterpriseId });
      } else {
        logger?.debug?.('Installation not found (already deleted)', {
          teamId,
          enterpriseId,
        });
      }
    } catch (error) {
      logger?.error?.('Failed to delete installation', {
        teamId: query.teamId,
        enterpriseId: query.enterpriseId,
        error,
      });
      throw error;
    }
  }
}
