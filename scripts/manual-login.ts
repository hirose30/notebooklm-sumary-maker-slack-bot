#!/usr/bin/env tsx

/**
 * Manual login helper for NotebookLM
 * Opens browser for user to login manually
 * Session is saved to user-data directory
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    logger.info('Starting manual login helper...');
    logger.info('A browser window will open. Please log in to your Google account.');

    await automation.initialize();
    const page = automation.getPage();

    // Navigate to NotebookLM
    await page.goto('https://notebooklm.google.com');

    logger.info('Waiting for login... (Press Ctrl+C when done)');
    logger.info('Make sure you are logged in before closing this window.');

    // Wait for user to login (wait indefinitely)
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        logger.info('Login completed. Session saved to user-data directory.');
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
