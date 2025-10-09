/**
 * Inspect the "Create Notebook" button element
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    await automation.initialize();
    const page = automation.getPage();

    logger.info('Navigating to NotebookLM...');
    await page.goto('https://notebooklm.google.com', { waitUntil: 'domcontentloaded' });

    // Wait a few seconds for dynamic content
    await page.waitForTimeout(3000);

    logger.info('=== Inspecting Create Notebook Button ===\n');

    // Try to find all possible buttons with text
    const buttonInfo = await page.evaluate(() => {
      const results: any[] = [];

      // Find all buttons
      const buttons = document.querySelectorAll('button');
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim();
        if (text && (text.includes('新しい') || text.includes('作成') || text.includes('Create'))) {
          results.push({
            index,
            tagName: btn.tagName,
            text: text.substring(0, 100),
            className: btn.className,
            id: btn.id,
            ariaLabel: btn.getAttribute('aria-label'),
            type: btn.getAttribute('type'),
            outerHTML: btn.outerHTML.substring(0, 300),
          });
        }
      });

      // Find all links
      const links = document.querySelectorAll('a');
      links.forEach((link, index) => {
        const text = link.textContent?.trim();
        if (text && (text.includes('新しい') || text.includes('作成') || text.includes('Create'))) {
          results.push({
            index,
            tagName: link.tagName,
            text: text.substring(0, 100),
            className: link.className,
            id: link.id,
            ariaLabel: link.getAttribute('aria-label'),
            href: link.getAttribute('href'),
            outerHTML: link.outerHTML.substring(0, 300),
          });
        }
      });

      // Find elements with the icon container class
      const iconContainers = document.querySelectorAll('.create-new-action-button-icon-container');
      iconContainers.forEach((el, index) => {
        results.push({
          index,
          tagName: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          className: el.className,
          id: el.id,
          parent: el.parentElement?.tagName + '.' + el.parentElement?.className,
          outerHTML: el.outerHTML.substring(0, 300),
        });
      });

      return results;
    });

    logger.info('Found elements:', JSON.stringify(buttonInfo, null, 2));

    // Try clicking with different selectors
    logger.info('\n=== Testing Click Selectors ===');

    const selectors = [
      'button:has-text("新しいノートブック")',
      'a:has-text("新しいノートブック")',
      '.create-new-action-button-icon-container',
      'button.create-new-action-button',
      '[aria-label*="新しい"]',
      '[aria-label*="作成"]',
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();
          const boundingBox = await element.boundingBox();
          logger.info(`✓ Found: ${selector}`, {
            visible: isVisible,
            enabled: isEnabled,
            hasPosition: !!boundingBox,
          });
        } else {
          logger.info(`✗ Not found: ${selector}`);
        }
      } catch (error) {
        logger.info(`✗ Error with: ${selector}`, { error: (error as Error).message });
      }
    }

    logger.info('\n=== Keeping browser open for manual inspection ===');
    logger.info('Press Ctrl+C when done');

    await new Promise(() => {}); // Keep open
  } catch (error) {
    logger.error('Error', { error });
  } finally {
    await automation.cleanup();
  }
}

main();
