/**
 * Simple console logger with timestamps
 * Can be upgraded to winston/pino later
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
  }

  info(message: string, meta?: any): void {
    console.info(this.formatMessage(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, meta));
  }

  error(message: string, meta?: any): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, meta));
  }
}

export const logger = new Logger();

/**
 * Workspace-aware logger wrapper
 * Automatically includes workspace context (teamId, teamName) in log metadata
 * Uses AsyncLocalStorage to get current workspace context
 */
import { workspaceContext } from '../services/workspace-context.js';

export const workspaceLogger = {
  debug(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    logger.debug(message, {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    });
  },

  info(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    logger.info(message, {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    });
  },

  warn(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    logger.warn(message, {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    });
  },

  error(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    logger.error(message, {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
      // Never log botToken (security requirement)
    });
  },
};
