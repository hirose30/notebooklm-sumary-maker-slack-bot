/**
 * Workspace Context Setup with AsyncLocalStorage
 * Provides workspace-scoped context throughout request processing
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { WorkspaceContext } from '../models/workspace.js';

/**
 * AsyncLocalStorage instance for workspace context
 * Stores workspace information (teamId, teamName, botToken, etc.) for the duration of a request
 */
export const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();

/**
 * Get the current workspace context
 * @throws Error if called outside of workspaceContext.run()
 * @returns Current workspace context
 */
export function getWorkspaceContext(): WorkspaceContext {
  const context = workspaceContext.getStore();

  if (!context) {
    throw new Error(
      'No workspace context available. ' +
      'getWorkspaceContext() must be called within workspaceContext.run() block.'
    );
  }

  return context;
}
