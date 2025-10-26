#!/usr/bin/env tsx

/**
 * Manual login helper for NotebookLM (Workspace 1)
 * Opens browser for user to login manually
 * Session is saved to user-data-ws1 directory
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  // Use workspace-specific user-data directory
  const automation = new NotebookLMAutomation('./user-data-ws1');

  try {
    logger.info('Starting manual login helper for Workspace 1 (ws1)...');
    logger.info('A browser window will open. Please log in to your Google account for WS1.');

    await automation.initialize();
    const page = automation.getPage();

    // Navigate to NotebookLM
    await page.goto('https://notebooklm.google.com');

    logger.info('Waiting for login... (Press Ctrl+C when done)');
    logger.info('Make sure you are logged in before closing this window.');
    logger.info('Session will be saved to: ./user-data-ws1');

    // Wait for user to login (wait indefinitely)
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        logger.info('Login completed. Session saved to user-data-ws1 directory.');
        resolve(undefined);
      });
    });

    await automation.cleanup();
  } catch (error) {
    logger.error('Login helper failed', { error });
    process.exit(1);
  }
}

main();
