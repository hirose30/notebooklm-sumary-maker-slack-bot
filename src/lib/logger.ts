/**
 * Simple console logger with timestamps
 * Can be upgraded to winston/pino later
 */

import { LogTransport } from './log-transport.js';

// T003: LogLevel enum with numeric values for efficient filtering
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// T004: Parse log level from environment variable with validation
function parseLogLevel(envValue: string | undefined): LogLevel {
  const normalized = (envValue || 'INFO').toUpperCase();
  const validLevels: Record<string, LogLevel> = {
    'ERROR': LogLevel.ERROR,
    'WARN': LogLevel.WARN,
    'INFO': LogLevel.INFO,
    'DEBUG': LogLevel.DEBUG,
  };

  if (!(normalized in validLevels)) {
    console.error(`[WARN] Invalid LOG_LEVEL "${envValue}". Defaulting to INFO.`);
    return LogLevel.INFO;
  }

  return validLevels[normalized];
}

// Helper to get string name for log level
function getLogLevelName(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR: return 'ERROR';
    case LogLevel.WARN: return 'WARN';
    case LogLevel.INFO: return 'INFO';
    case LogLevel.DEBUG: return 'DEBUG';
    default: return 'INFO';
  }
}

class Logger {
  private configuredLevel: LogLevel;
  private transport: LogTransport; // T026: LogTransport instance

  constructor() {
    // T004: Initialize log level from LOG_LEVEL env var
    this.configuredLevel = parseLogLevel(process.env.LOG_LEVEL);
    // T026: Create LogTransport instance
    this.transport = new LogTransport();
  }

  // T005: shouldLog() method for level-based filtering
  shouldLog(level: LogLevel): boolean {
    return level <= this.configuredLevel;
  }

  formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = getLogLevelName(level);
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${levelName}: ${message}${metaStr}`;
  }

  // T027: Write to both console AND file transport
  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, meta);
      console.debug(formatted);
      // T029: Use 'system' for logs without workspace context
      this.transport.write(LogLevel.DEBUG, formatted, null).catch(() => {});
    }
  }

  // T027: Write to both console AND file transport
  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message, meta);
      console.info(formatted);
      // T029: Use 'system' for logs without workspace context
      this.transport.write(LogLevel.INFO, formatted, null).catch(() => {});
    }
  }

  // T027: Write to both console AND file transport
  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message, meta);
      console.warn(formatted);
      // T029: Use 'system' for logs without workspace context
      this.transport.write(LogLevel.WARN, formatted, null).catch(() => {});
    }
  }

  // T027: Write to both console AND file transport
  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, message, meta);
      console.error(formatted);
      // T029: Use 'system' for logs without workspace context
      this.transport.write(LogLevel.ERROR, formatted, null).catch(() => {});
    }
  }

  // Expose current log level for debugging
  getLogLevel(): LogLevel {
    return this.configuredLevel;
  }

  // T026: Expose transport for workspace logger
  getTransport(): LogTransport {
    return this.transport;
  }
}

export const logger = new Logger();

/**
 * Workspace-aware logger wrapper
 * Automatically includes workspace context (teamId, teamName) in log metadata
 * Uses AsyncLocalStorage to get current workspace context
 */
import { workspaceContext } from '../services/workspace-context.js';

// T028: Workspace logger with file transport routing
export const workspaceLogger = {
  debug(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    const enrichedMeta = {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    };

    if (logger.shouldLog(LogLevel.DEBUG)) {
      const formatted = logger.formatMessage(LogLevel.DEBUG, message, enrichedMeta);
      console.debug(formatted);
      // T028: Pass workspace key to transport for file routing
      const workspaceKey = workspace?.workspaceKey || null;
      logger.getTransport().write(LogLevel.DEBUG, formatted, workspaceKey).catch(() => {});
    }
  },

  info(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    const enrichedMeta = {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    };

    if (logger.shouldLog(LogLevel.INFO)) {
      const formatted = logger.formatMessage(LogLevel.INFO, message, enrichedMeta);
      console.info(formatted);
      // T028: Pass workspace key to transport for file routing
      const workspaceKey = workspace?.workspaceKey || null;
      logger.getTransport().write(LogLevel.INFO, formatted, workspaceKey).catch(() => {});
    }
  },

  warn(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    const enrichedMeta = {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
    };

    if (logger.shouldLog(LogLevel.WARN)) {
      const formatted = logger.formatMessage(LogLevel.WARN, message, enrichedMeta);
      console.warn(formatted);
      // T028: Pass workspace key to transport for file routing
      const workspaceKey = workspace?.workspaceKey || null;
      logger.getTransport().write(LogLevel.WARN, formatted, workspaceKey).catch(() => {});
    }
  },

  error(message: string, meta?: Record<string, any>): void {
    const workspace = workspaceContext.getStore();
    const enrichedMeta = {
      ...meta,
      teamId: workspace?.teamId,
      teamName: workspace?.teamName,
      // Never log botToken (security requirement)
    };

    if (logger.shouldLog(LogLevel.ERROR)) {
      const formatted = logger.formatMessage(LogLevel.ERROR, message, enrichedMeta);
      console.error(formatted);
      // T028: Pass workspace key to transport for file routing
      const workspaceKey = workspace?.workspaceKey || null;
      logger.getTransport().write(LogLevel.ERROR, formatted, workspaceKey).catch(() => {});
    }
  },
};
