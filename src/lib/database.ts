/**
 * SQLite database connection and helpers
 */

import Database from 'better-sqlite3';
import { logger } from './logger.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './data/bot.db') {
    logger.info('Initializing database', { dbPath });

    this.db = new Database(dbPath, {
      verbose: (message) => logger.debug('SQLite:', message),
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Initialize schema
    this.runMigrations();

    logger.info('Database initialized successfully');
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    try {
      const migrationPath = join(__dirname, '../db/migrations/001_initial.sql');
      const migration = readFileSync(migrationPath, 'utf8');

      this.db.exec(migration);

      logger.info('Migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  /**
   * Get the database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }
}

// Export singleton instance
export const database = new DatabaseService();
export const db = database.getDb();
