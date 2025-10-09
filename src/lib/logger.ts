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
