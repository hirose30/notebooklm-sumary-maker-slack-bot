/**
 * Inspect the "Add Source" flow to find correct selectors
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    await automation.initialize();
    const page = automation.getPage();

    // Create a new notebook first
    logger.info('Creating notebook...');
    await page.goto('https://notebooklm.google.com', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[aria-label="ノートブックを新規作成"]', { timeout: 10000 });
    await page.click('button[aria-label="ノートブックを新規作成"]');
    await page.waitForTimeout(3000);

    logger.info('\n=== Step 1: Finding "Add Source" button ===');
    const addSourceButtons = await page.evaluate(() => {
      const results: any[] = [];
      const buttons = document.querySelectorAll('button, a, .mat-mdc-button-touch-target');
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim();
        if (text && text.includes('ソース')) {
          results.push({
            index,
            tagName: btn.tagName,
            text: text.substring(0, 100),
            className: btn.className,
            ariaLabel: btn.getAttribute('aria-label'),
          });
        }
      });
      return results;
    });
    logger.info('Found "ソース" buttons:', JSON.stringify(addSourceButtons, null, 2));

    // Click the add source button
    logger.info('\nClicking add source button...');
    await page.click('.mat-mdc-button-touch-target');
    await page.waitForTimeout(3000);

    logger.info('\n=== Step 2: Finding "ウエブサイト" option ===');
    const websiteOptions = await page.evaluate(() => {
      const results: any[] = [];
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && text.includes('ウエブサイト') && el.children.length === 0) {
          results.push({
            index,
            tagName: el.tagName,
            text: text.substring(0, 100),
            className: el.className,
            id: el.id,
            ariaLabel: el.getAttribute('aria-label'),
            role: el.getAttribute('role'),
            parent: el.parentElement?.tagName + '.' + el.parentElement?.className,
            outerHTML: el.outerHTML.substring(0, 400),
          });
        }
      });
      return results;
    });
    logger.info('Found "ウエブサイト" elements:', JSON.stringify(websiteOptions, null, 2));

    // Try different selectors
    logger.info('\n=== Testing Click Selectors ===');
    const selectors = [
      'text="ウエブサイト"',
      'a:has-text("ウエブサイト")',
      'button:has-text("ウエブサイト")',
      '[role="button"]:has-text("ウエブサイト")',
      '.mat-mdc-chip:has-text("ウエブサイト")',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();
          logger.info(`✓ Found: ${selector}`, { visible: isVisible, enabled: isEnabled });
        } else {
          logger.info(`✗ Not found: ${selector}`);
        }
      } catch (error) {
        logger.info(`✗ Error: ${selector}`, { error: (error as Error).message });
      }
    }

    logger.info('\n=== Keeping browser open for manual inspection ===');
    logger.info('Press Ctrl+C when done');
    await new Promise(() => {});
  } catch (error) {
    logger.error('Error', { error });
  } finally {
    await automation.cleanup();
  }
}

main();
