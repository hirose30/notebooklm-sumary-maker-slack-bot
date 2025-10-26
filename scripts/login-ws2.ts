#!/usr/bin/env tsx

/**
 * Manual login helper for NotebookLM (Workspace 2)
 * Opens browser for user to login manually
 * Session is saved to user-data-ws2 directory
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  // Use workspace-specific user-data directory
  const automation = new NotebookLMAutomation('./user-data-ws2');

  try {
    logger.info('Starting manual login helper for Workspace 2 (ws2)...');
    logger.info('A browser window will open. Please log in to your Google account for WS2.');

    await automation.initialize();
    const page = automation.getPage();

    // Navigate to NotebookLM
    await page.goto('https://notebooklm.google.com');

    logger.info('Waiting for login... (Press Ctrl+C when done)');
    logger.info('Make sure you are logged in before closing this window.');
    logger.info('Session will be saved to: ./user-data-ws2');

    // Wait for user to login (wait indefinitely)
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        logger.info('Login completed. Session saved to user-data-ws2 directory.');
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
