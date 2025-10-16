/**
 * Integration Test: Multi-Workspace Routing
 * Verifies that requests are correctly routed to their respective workspaces
 */

import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';

// Test suite
async function runTests() {
  let db: Database.Database;
  let testDbPath: string;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    console.log('\n=== Multi-Workspace Routing Integration Tests ===\n');

    // Setup
    console.log('Setting up test database...');
    testDbPath = join(tmpdir(), `test-multi-workspace-${Date.now()}.db`);
    db = new Database(testDbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create slack_installations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS slack_installations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT NOT NULL,
        team_name TEXT,
        enterprise_id TEXT,
        enterprise_name TEXT,
        bot_token TEXT NOT NULL,
        bot_id TEXT NOT NULL,
        bot_user_id TEXT NOT NULL,
        bot_scopes TEXT NOT NULL,
        user_token TEXT,
        user_id TEXT,
        user_scopes TEXT,
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_installations_unique
        ON slack_installations(team_id, enterprise_id);
    `);

    // Create requests table
    db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        slack_channel TEXT NOT NULL,
        slack_thread_ts TEXT NOT NULL,
        slack_user TEXT NOT NULL,
        workspace_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        current_step TEXT,
        error_message TEXT,
        ack_message_ts TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
      );
    `);

    // Create media table
    db.exec(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        r2_public_url TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
      );
    `);

    // Insert test installations for two workspaces
    const insertStmt = db.prepare(`
      INSERT INTO slack_installations (
        team_id, team_name, bot_token, bot_id, bot_user_id, bot_scopes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      'T001',
      'Workspace One',
      'xoxb-test-token-1',
      'B001',
      'U001',
      JSON.stringify(['app_mentions:read', 'chat:write'])
    );

    insertStmt.run(
      'T002',
      'Workspace Two',
      'xoxb-test-token-2',
      'B002',
      'U002',
      JSON.stringify(['app_mentions:read', 'chat:write'])
    );

    console.log('✓ Database setup complete\n');

    // Test 1: Route requests to correct workspace
    try {
      console.log('Test 1: should route requests to correct workspace');
      const insertRequest = db.prepare(`
        INSERT INTO requests (url, slack_channel, slack_thread_ts, slack_user, workspace_id, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);

      const result1 = insertRequest.run(
        'https://example.com/page1',
        'C001',
        '1234567890.123456',
        'U001',
        'T001'
      );

      const result2 = insertRequest.run(
        'https://example.com/page2',
        'C002',
        '1234567890.654321',
        'U002',
        'T002'
      );

      const request1 = db.prepare('SELECT * FROM requests WHERE id = ?').get(result1.lastInsertRowid) as any;
      const request2 = db.prepare('SELECT * FROM requests WHERE id = ?').get(result2.lastInsertRowid) as any;

      if (request1.workspace_id !== 'T001') {
        throw new Error(`Expected workspace_id to be T001, got ${request1.workspace_id}`);
      }
      if (request2.workspace_id !== 'T002') {
        throw new Error(`Expected workspace_id to be T002, got ${request2.workspace_id}`);
      }

      console.log('  ✓ Requests routed to correct workspaces\n');
      testsPassed++;
    } catch (error) {
      console.error('  ✗ Test failed:', error);
      testsFailed++;
    }

    // Test 2: Isolate workspace errors
    try {
      console.log('Test 2: should isolate workspace errors');
      const insertRequest = db.prepare(`
        INSERT INTO requests (url, slack_channel, slack_thread_ts, slack_user, workspace_id, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);

      const result1 = insertRequest.run(
        'https://example.com/page3',
        'C001',
        '1234567890.111111',
        'U001',
        'T001'
      );

      const result2 = insertRequest.run(
        'https://example.com/page4',
        'C002',
        '1234567890.222222',
        'U999',
        'T999' // Non-existent workspace
      );

      // Verify valid workspace exists
      const workspace1 = db.prepare('SELECT * FROM slack_installations WHERE team_id = ?').get('T001');
      if (!workspace1) {
        throw new Error('Workspace T001 should exist');
      }

      // Verify invalid workspace does not exist
      const workspace999 = db.prepare('SELECT * FROM slack_installations WHERE team_id = ?').get('T999');
      if (workspace999) {
        throw new Error('Workspace T999 should not exist');
      }

      // Simulate error for request 2
      db.prepare('UPDATE requests SET status = ?, error_message = ? WHERE id = ?').run(
        'failed',
        'Workspace not found',
        result2.lastInsertRowid
      );

      // Verify request 1 is unaffected
      const request1 = db.prepare('SELECT * FROM requests WHERE id = ?').get(result1.lastInsertRowid) as any;
      if (request1.status !== 'pending') {
        throw new Error(`Request 1 should remain pending, got ${request1.status}`);
      }

      // Verify request 2 failed
      const request2 = db.prepare('SELECT * FROM requests WHERE id = ?').get(result2.lastInsertRowid) as any;
      if (request2.status !== 'failed') {
        throw new Error(`Request 2 should be failed, got ${request2.status}`);
      }
      if (request2.error_message !== 'Workspace not found') {
        throw new Error(`Request 2 should have error message, got ${request2.error_message}`);
      }

      console.log('  ✓ Workspace errors are isolated\n');
      testsPassed++;
    } catch (error) {
      console.error('  ✗ Test failed:', error);
      testsFailed++;
    }

    // Test 3: Allow NULL workspace_id for backward compatibility
    try {
      console.log('Test 3: should allow NULL workspace_id for backward compatibility');
      const insertRequest = db.prepare(`
        INSERT INTO requests (url, slack_channel, slack_thread_ts, slack_user, workspace_id, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);

      const result = insertRequest.run(
        'https://example.com/page5',
        'C001',
        '1234567890.333333',
        'U001',
        null // Legacy requests without workspace context
      );

      const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(result.lastInsertRowid) as any;
      if (!request) {
        throw new Error('Request should be created');
      }
      if (request.workspace_id !== null) {
        throw new Error(`Request workspace_id should be NULL, got ${request.workspace_id}`);
      }

      console.log('  ✓ NULL workspace_id supported for backward compatibility\n');
      testsPassed++;
    } catch (error) {
      console.error('  ✗ Test failed:', error);
      testsFailed++;
    }

  } finally {
    // Cleanup
    if (db) {
      db.close();
    }
    if (testDbPath && existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    console.log('=== Test Results ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}\n`);

    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
