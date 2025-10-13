/**
 * NotebookLM Login Test Script
 *
 * This script helps with initial NotebookLM authentication by:
 * - Opening a browser window for manual login
 * - Waiting for user to complete login (no timeout)
 * - Saving authentication to user-data directory
 *
 * Usage:
 *   PLAYWRIGHT_HEADLESS=false npx tsx scripts/test-login-only.ts
 *
 * For multi-profile setup:
 *   USER_DATA_DIR=./user-data-dev PLAYWRIGHT_HEADLESS=false npx tsx scripts/test-login-only.ts
 */

import { chromium } from 'playwright';
import { config } from '../src/lib/config.js';
import { logger } from '../src/lib/logger.js';
import * as readline from 'readline';

async function testLogin() {
  logger.info('=== NotebookLM Login Test ===');
  logger.info('');
  logger.info('This script will:');
  logger.info('1. Launch Chromium browser');
  logger.info('2. Navigate to NotebookLM');
  logger.info('3. Wait for you to manually login');
  logger.info('4. Press Enter after login to save authentication');
  logger.info('');

  let context;
  let page;

  try {
    // Launch persistent context - preserves cookies and auth
    logger.info('Launching browser...', { userDataDir: config.userDataDir });
    context = await chromium.launchPersistentContext(config.userDataDir, {
      headless: false, // Always show browser for login
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
      ],
      viewport: { width: 1920, height: 1080 },
      locale: 'ja-JP',
    });

    // Remove default timeout for manual login
    context.setDefaultTimeout(0);

    page = await context.newPage();
    logger.info('✓ Browser launched');
    logger.info('');

    // Navigate to NotebookLM
    logger.info('Navigating to NotebookLM...');
    await page.goto('https://notebooklm.google.com', { waitUntil: 'domcontentloaded' });
    logger.info('✓ Navigated to NotebookLM');
    logger.info('');

    // Instructions for manual login
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');
    logger.info('🔐 Please login manually in the browser:');
    logger.info('');
    logger.info('1. Check the browser window');
    logger.info('2. Login with your Google account');
    logger.info('3. Complete 2-factor authentication if required');
    logger.info('4. Wait for NotebookLM home page to load');
    logger.info('5. Verify you see "ノートブックを新規作成" button');
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');

    // Wait for user to press Enter
    await waitForEnter();

    // Verify login by checking for create notebook button
    logger.info('Verifying authentication...');
    const createButton = await page.locator('button[aria-label="ノートブックを新規作成"]').count();

    if (createButton > 0) {
      logger.info('✓ Login successful! "ノートブックを新規作成" button found');
    } else {
      logger.warn('⚠️  Could not find "ノートブックを新規作成" button');
      logger.warn('Please verify you are logged in and on the NotebookLM home page');
    }

    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');
    logger.info('✅ Login test completed!');
    logger.info('');
    logger.info('Authentication saved to:', { userDataDir: config.userDataDir });
    logger.info('');
    logger.info('You can now start the bot:');
    logger.info('  npm run bot:start');
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');

  } catch (error) {
    logger.error('Login test failed', { error });
    throw error;
  } finally {
    // Close browser
    if (context) {
      logger.info('Closing browser...');
      await context.close();
      logger.info('✓ Browser closed');
    }
  }
}

/**
 * Wait for user to press Enter key
 */
function waitForEnter(): Promise<void> {
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Press Enter after login is complete... ', () => {
      rl.close();
      console.log(''); // New line after input
      resolve();
    });
  });
}

// Run the test
testLogin()
  .then(() => {
    logger.info('Login test finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Login test failed', { error });
    process.exit(1);
  });
