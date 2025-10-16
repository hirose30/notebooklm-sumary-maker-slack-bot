/**
 * SQLite database connection and helpers
 */

import Database from 'better-sqlite3';
import { logger } from './logger.js';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './data/bot.db') {
    logger.info('Initializing database', { dbPath });

    // Ensure the parent directory exists
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      logger.info('Creating database directory', { dbDir });
      mkdirSync(dbDir, { recursive: true });
    }

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
      // Create schema_version table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get current version
      const currentVersion = this.db
        .prepare('SELECT MAX(version) as version FROM schema_version')
        .get() as { version: number | null };

      const appliedVersion = currentVersion?.version || 0;

      // Define all migrations
      const migrations = [
        { version: 1, file: '001_initial.sql' },
        { version: 2, file: '002_add_ack_message_ts.sql' },
        { version: 3, file: '003_multi_workspace.sql' }
      ];

      // Apply pending migrations
      for (const migration of migrations) {
        if (migration.version > appliedVersion) {
          const migrationPath = join(__dirname, `../db/migrations/${migration.file}`);
          const sql = readFileSync(migrationPath, 'utf8');

          this.db.exec(sql);

          this.db
            .prepare('INSERT INTO schema_version (version) VALUES (?)')
            .run(migration.version);

          logger.info('Applied migration', { version: migration.version, file: migration.file });
        }
      }

      logger.info('Migrations completed successfully', {
        currentVersion: migrations[migrations.length - 1].version
      });

      // Validate database integrity after migrations
      this.validateDatabase();
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  /**
   * Validate database integrity for workspace support (T012)
   * Checks for duplicate team_id and orphaned requests
   */
  private validateDatabase(): void {
    try {
      // Check for duplicate team_id in slack_installations (where enterprise_id IS NULL)
      const duplicates = this.db
        .prepare(`
          SELECT team_id, COUNT(*) as count
          FROM slack_installations
          WHERE enterprise_id IS NULL
          GROUP BY team_id
          HAVING count > 1
        `)
        .all() as Array<{ team_id: string; count: number }>;

      if (duplicates.length > 0) {
        const teamIds = duplicates.map((d) => d.team_id).join(', ');
        logger.error('Database validation failed: Duplicate team_id found', {
          duplicates,
        });
        throw new Error(
          `Database integrity error: Duplicate team_id found for standard workspaces: ${teamIds}. ` +
          'Each workspace must have exactly one installation record.'
        );
      }

      // Check for orphaned requests (workspace_id not in slack_installations)
      const orphanedRequests = this.db
        .prepare(`
          SELECT COUNT(*) as count
          FROM requests
          WHERE workspace_id NOT IN (SELECT id FROM slack_installations)
        `)
        .get() as { count: number };

      if (orphanedRequests.count > 0) {
        logger.warn('Orphaned requests found', {
          count: orphanedRequests.count,
          message: 'Some requests reference non-existent workspaces. This may occur after workspace uninstallation.',
        });
      }

      logger.info('Database validation completed successfully');
    } catch (error) {
      // Re-throw if it's our custom error
      if (error instanceof Error && error.message.includes('Database integrity error')) {
        throw error;
      }
      logger.error('Database validation failed', { error });
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

// Export singleton instance with optional DB_PATH from environment
const dbPath = process.env.DB_PATH || './data/bot.db';
export const database = new DatabaseService(dbPath);
export const db: Database.Database = database.getDb();
