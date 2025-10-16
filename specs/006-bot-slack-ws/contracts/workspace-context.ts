/**
 * Workspace Context Contract
 *
 * Defines the workspace context that flows through request processing
 * Used with AsyncLocalStorage for workspace-scoped logging and data access
 */

/**
 * Workspace context available throughout request processing
 * Stored in AsyncLocalStorage, accessible via workspaceContext.getStore()
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

/**
 * Example Usage:
 *
 * ```typescript
 * import { AsyncLocalStorage } from 'async_hooks';
 * import type { WorkspaceContext } from '../contracts/workspace-context';
 *
 * const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();
 *
 * // Set context in event handler
 * this.app.event('app_mention', async ({ event, client, context }) => {
 *   const workspace: WorkspaceContext = {
 *     teamId: context.teamId,
 *     teamName: context.teamName || 'Unknown',
 *     botToken: context.botToken,
 *     botUserId: context.botUserId,
 *     enterpriseId: context.enterpriseId || null,
 *   };
 *
 *   await workspaceContext.run(workspace, async () => {
 *     try {
 *       await this.handleMention(event, client);
 *     } catch (error) {
 *       logger.error('Error in workspace event', {
 *         teamId: workspace.teamId,
 *         error,
 *       });
 *     }
 *   });
 * });
 *
 * // Access context in nested functions
 * private async handleMention(event: any, client: any): Promise<void> {
 *   const workspace = workspaceContext.getStore();
 *   if (!workspace) {
 *     throw new Error('No workspace context available');
 *   }
 *
 *   logger.info('Processing mention', {
 *     teamId: workspace.teamId,
 *     teamName: workspace.teamName,
 *     channel: event.channel,
 *   });
 *
 *   // Add to queue with workspace ID
 *   const jobId = this.queue.addJob(
 *     url,
 *     event.channel,
 *     threadTs,
 *     userId,
 *     workspace.teamId // Pass workspace ID
 *   );
 * }
 * ```
 */

/**
 * Workspace-aware logger interface
 * Automatically includes workspace context in all log entries
 */
export interface WorkspaceLogger {
  /**
   * Log with automatic workspace context injection
   */
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

/**
 * Example Workspace-Aware Logger Implementation:
 *
 * ```typescript
 * import { workspaceContext } from './workspace-context';
 * import { logger as baseLogger } from './logger';
 *
 * export const workspaceLogger: WorkspaceLogger = {
 *   debug(message: string, meta?: Record<string, any>): void {
 *     const workspace = workspaceContext.getStore();
 *     baseLogger.debug(message, {
 *       ...meta,
 *       teamId: workspace?.teamId,
 *       teamName: workspace?.teamName,
 *     });
 *   },
 *
 *   info(message: string, meta?: Record<string, any>): void {
 *     const workspace = workspaceContext.getStore();
 *     baseLogger.info(message, {
 *       ...meta,
 *       teamId: workspace?.teamId,
 *       teamName: workspace?.teamName,
 *     });
 *   },
 *
 *   warn(message: string, meta?: Record<string, any>): void {
 *     const workspace = workspaceContext.getStore();
 *     baseLogger.warn(message, {
 *       ...meta,
 *       teamId: workspace?.teamId,
 *       teamName: workspace?.teamName,
 *     });
 *   },
 *
 *   error(message: string, meta?: Record<string, any>): void {
 *     const workspace = workspaceContext.getStore();
 *     baseLogger.error(message, {
 *       ...meta,
 *       teamId: workspace?.teamId,
 *       teamName: workspace?.teamName,
 *       // Never log botToken
 *     });
 *   },
 * };
 * ```
 */

/**
 * Workspace context contract rules:
 *
 * 1. Context MUST be set at the event handler boundary (app.event, app.action, etc.)
 * 2. Context is request-scoped (exists only for the duration of event processing)
 * 3. Context MUST include teamId for database queries and logging
 * 4. Context SHOULD include teamName for human-readable logs
 * 5. Context MUST NEVER log botToken (security requirement)
 * 6. Context is read-only (immutable after creation)
 * 7. If context.getStore() returns undefined, code MUST throw error (programming error)
 */
