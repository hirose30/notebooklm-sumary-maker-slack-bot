/**
 * Log transport layer for file-based logging
 * Handles log file writing, rotation, and error handling
 */

import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { LogLevel } from './logger.js';

// T006: LogTransport interface
export interface ILogTransport {
  /**
   * Write a log entry to file
   * @param level - Log level for filtering
   * @param formattedMessage - Pre-formatted log message
   * @param workspaceId - Workspace identifier or null for system logs
   */
  write(level: LogLevel, formattedMessage: string, workspaceId: string | null): Promise<void>;

  /**
   * Ensure log directory exists, create if needed
   */
  ensureLogDirectory(): Promise<void>;

  /**
   * Get current log file path for workspace context
   * @param workspaceId - Workspace identifier or null for system
   */
  getLogFilePath(workspaceId: string | null): string;

  /**
   * Close all open resources (for graceful shutdown)
   */
  close(): Promise<void>;
}

// T017: LogTransport implementation
export class LogTransport implements ILogTransport {
  private fileLoggingEnabled = true;
  private currentDate = '';
  private readonly logDirectory = './logs';
  private directoryEnsured = false;

  // T018: ensureLogDirectory() implementation
  async ensureLogDirectory(): Promise<void> {
    if (this.directoryEnsured) return;

    try {
      if (!existsSync(this.logDirectory)) {
        await mkdir(this.logDirectory, { recursive: true });
      }
      this.directoryEnsured = true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      console.error(`[ERROR] Failed to create log directory: ${err.message}`);
      this.fileLoggingEnabled = false;
    }
  }

  // T019: getLogFilePath() implementation
  getLogFilePath(workspaceId: string | null): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Use workspace-specific system log if WORKSPACE_ID env var is set
    if (!workspaceId && process.env.WORKSPACE_ID) {
      const wsId = `system-${process.env.WORKSPACE_ID}`;
      return join(this.logDirectory, `${wsId}-${today}.log`);
    }

    const wsId = workspaceId || 'system';
    return join(this.logDirectory, `${wsId}-${today}.log`);
  }

  // T020: write() method with async file writes
  // T021: Daily rotation logic
  // T022: Error handling for ENOSPC, EACCES, ENOENT
  async write(level: LogLevel, formattedMessage: string, workspaceId: string | null): Promise<void> {
    if (!this.fileLoggingEnabled) return;

    try {
      // Ensure directory exists
      await this.ensureLogDirectory();

      // T021: Check for date change (daily rotation)
      const today = new Date().toISOString().split('T')[0];
      if (this.currentDate !== today) {
        this.currentDate = today;
      }

      // Get log file path for this workspace
      const logFilePath = this.getLogFilePath(workspaceId);

      // T020: Write to file using appendFile (atomic operation)
      await appendFile(logFilePath, formattedMessage + '\n', 'utf-8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      // T022: Error handling
      if (err.code === 'ENOSPC') {
        console.error(`[ERROR] Log file write failed (disk full): ${err.message}`);
        console.error('[ERROR] Disabling file logging for this session');
        this.fileLoggingEnabled = false;
      } else if (err.code === 'EACCES') {
        console.error(`[ERROR] Log file write failed (permission denied): ${err.message}`);
        console.error('[ERROR] Disabling file logging for this session');
        this.fileLoggingEnabled = false;
      } else if (err.code === 'ENOENT') {
        // Try to ensure directory one more time
        this.directoryEnsured = false;
        await this.ensureLogDirectory();
      } else {
        console.error(`[ERROR] Unexpected log write error: ${err.message}`);
        this.fileLoggingEnabled = false;
      }
    }
  }

  // T023: close() method (currently no-op, future-proofing)
  async close(): Promise<void> {
    // No resources to close with appendFile approach
    // Future: If we switch to WriteStream, close streams here
  }
}
