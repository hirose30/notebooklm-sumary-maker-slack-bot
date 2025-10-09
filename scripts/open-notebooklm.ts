/**
 * Simple script to open NotebookLM for manual UI exploration
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    logger.info('Opening NotebookLM...');
    await automation.initialize();
    const page = automation.getPage();

    await page.goto('https://notebooklm.google.com');
    await page.waitForLoadState('networkidle');

    logger.info('NotebookLM opened. Browser will stay open.');
    logger.info('Use DevTools (Cmd+Option+I) to inspect elements');
    logger.info('Press Ctrl+C to close when done');

    // Keep browser open
    await new Promise(() => {}); // Never resolves, wait for Ctrl+C
  } catch (error) {
    logger.error('Error', { error });
  } finally {
    await automation.cleanup();
  }
}

main();
