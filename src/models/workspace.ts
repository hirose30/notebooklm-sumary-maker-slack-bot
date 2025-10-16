/**
 * Workspace models for multi-workspace Slack support
 * Defines types for SlackInstallation, InstallQuery, and Installation (OAuth response)
 */

/**
 * Slack workspace installation record (camelCase for application use)
 * Stores OAuth tokens and workspace metadata
 */
export interface SlackInstallation {
  id: number;
  teamId: string;
  teamName: string | null;
  enterpriseId: string | null;
  enterpriseName: string | null;
  botToken: string;
  botId: string;
  botUserId: string;
  botScopes: string[]; // Parsed from JSON
  userToken: string | null;
  userId: string | null;
  userScopes: string[] | null; // Parsed from JSON
  installedAt: Date;
  updatedAt: Date;
}

/**
 * Raw database row for slack_installations table (snake_case from DB)
 */
export interface SlackInstallationRow {
  id: number;
  team_id: string;
  team_name: string | null;
  enterprise_id: string | null;
  enterprise_name: string | null;
  bot_token: string;
  bot_id: string;
  bot_user_id: string;
  bot_scopes: string; // JSON string
  user_token: string | null;
  user_id: string | null;
  user_scopes: string | null; // JSON string
  installed_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Installation query parameters
 * Used to retrieve workspace-specific tokens from InstallationStore
 */
export interface InstallQuery {
  /**
   * Team (workspace) ID
   * Example: "T01ABCDEFGH"
   */
  teamId?: string;

  /**
   * Enterprise Grid ID (null for standard workspaces)
   * Example: "E01ABCDEFGH"
   */
  enterpriseId?: string;

  /**
   * User ID (for user token retrieval)
   * Example: "U01ABCDEFGH"
   */
  userId?: string;

  /**
   * Conversation ID (for org-wide app installations)
   * Example: "C01ABCDEFGH"
   */
  conversationId?: string;

  /**
   * Whether this is an Enterprise Grid installation
   */
  isEnterpriseInstall?: boolean;
}

/**
 * OAuth installation data (Slack OAuth response structure)
 * Returned by Slack OAuth flow, stored in InstallationStore
 */
export interface Installation {
  /**
   * Team information (optional in Slack Bolt types)
   */
  team?: {
    id: string; // Team ID (e.g., "T01ABCDEFGH")
    name?: string; // Team name (e.g., "Acme Corp")
  };

  /**
   * Enterprise Grid information (null for standard workspaces)
   */
  enterprise?: {
    id: string; // Enterprise ID (e.g., "E01ABCDEFGH")
    name?: string; // Enterprise name
  };

  /**
   * Bot user information (always present for bot installations)
   */
  bot?: {
    token: string; // Bot user OAuth token (xoxb-...)
    scopes: string[]; // Bot scopes (e.g., ["app_mentions:read", "chat:write"])
    id: string; // Bot ID (e.g., "B01ABCDEFGH")
    userId: string; // Bot user ID (e.g., "U01ABCDEFGH")
  };

  /**
   * Installing user information (optional)
   */
  user?: {
    token?: string; // User OAuth token (xoxp-...)
    scopes?: string[]; // User scopes
    id: string; // User ID
  };

  /**
   * App ID (always present)
   */
  appId?: string;

  /**
   * Token type (always "bot" for this use case)
   */
  tokenType?: 'bot' | 'user';

  /**
   * Whether this is an Enterprise Grid org-wide installation
   */
  isEnterpriseInstall?: boolean;

  /**
   * Installation metadata
   */
  installedAt?: Date;
}

/**
 * Workspace context for AsyncLocalStorage
 * Available throughout request processing
 */
export interface WorkspaceContext {
  /**
   * Slack team (workspace) ID
   * Example: "T01ABCDEFGH"
   */
  teamId: string;

  /**
   * Slack workspace name (for display/logging)
   * Example: "Acme Corp"
   */
  teamName: string;

  /**
   * Bot user OAuth token for this workspace
   * Example: "xoxb-YOUR-BOT-TOKEN"
   * NOTE: Never log this value
   */
  botToken: string;

  /**
   * Bot user ID in this workspace
   * Example: "U01ABCDEFGH"
   */
  botUserId: string;

  /**
   * Enterprise Grid ID (null for standard workspaces)
   * Example: "E01ABCDEFGH"
   */
  enterpriseId: string | null;
}
