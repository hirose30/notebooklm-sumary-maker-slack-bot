/**
 * UI inspection script for NotebookLM
 * Opens NotebookLM and allows manual exploration to find selectors
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    await automation.initialize();
    const page = automation.getPage();

    // Navigate to NotebookLM
    logger.info('Navigating to NotebookLM...');
    await page.goto('https://notebooklm.google.com');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    logger.info('NotebookLM loaded. Inspecting UI...');
    logger.info('Page title:', await page.title());
    logger.info('URL:', page.url());

    // Try to find "新しいノートブック" button
    logger.info('\n=== Looking for "Create Notebook" button ===');
    const possibleSelectors = [
      'button:has-text("新しいノートブック")',
      'button:has-text("Create")',
      '[aria-label*="新しい"]',
      '[aria-label*="Create"]',
      'button[class*="create"]',
      'a:has-text("新しいノートブック")',
    ];

    for (const selector of possibleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          logger.info(`✓ Found: ${selector}`, { text });
        }
      } catch (error) {
        // Ignore
      }
    }

    // Print HTML structure of main content
    logger.info('\n=== Main content structure ===');
    const bodyHTML = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main.innerHTML.substring(0, 1000); // First 1000 chars
    });
    logger.info('Body HTML (first 1000 chars):', bodyHTML);

    // Keep browser open for manual inspection
    logger.info('\n=== Browser will stay open for manual inspection ===');
    logger.info('Press Ctrl+C when done inspecting');

    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        logger.info('Inspection completed');
        resolve(undefined);
      });
    });

  } catch (error) {
    logger.error('Error during inspection', { error });
    throw error;
  } finally {
    await automation.cleanup();
  }
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
