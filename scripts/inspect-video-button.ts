import { chromium } from 'playwright';

async function inspectVideoButton() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();

  if (contexts.length === 0) {
    console.log('No browser contexts found');
    return;
  }

  const context = contexts[0];
  const pages = context.pages();

  if (pages.length === 0) {
    console.log('No pages found');
    return;
  }

  const page = pages[0];
  console.log('Current URL:', page.url());

  // Check for video button with different selectors
  const selectors = [
    'div.green.create-artifact-button-container:has-text("動画解説")',
    'text="動画解説"',
    'div.create-artifact-button-container:has-text("動画解説")',
    '[aria-label*="動画"]',
  ];

  console.log('\n=== Checking video button selectors ===');
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      console.log(`${selector}: ${count} elements found`);

      if (count > 0) {
        const element = page.locator(selector).first();
        const text = await element.textContent();
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();
        console.log(`  Text: "${text?.trim()}"`);
        console.log(`  Visible: ${isVisible}, Enabled: ${isEnabled}`);
      }
    } catch (error: any) {
      console.log(`${selector}: Error - ${error.message}`);
    }
  }

  // Check all create-artifact-button-container elements
  console.log('\n=== All create-artifact-button-container elements ===');
  const allButtons = await page.locator('div.create-artifact-button-container').all();
  console.log(`Found ${allButtons.length} total buttons`);

  for (let i = 0; i < allButtons.length; i++) {
    const button = allButtons[i];
    const text = await button.textContent();
    const className = await button.getAttribute('class');
    const isVisible = await button.isVisible();
    console.log(`\nButton ${i}:`);
    console.log(`  Text: "${text?.trim()}"`);
    console.log(`  Classes: ${className}`);
    console.log(`  Visible: ${isVisible}`);
  }

  await browser.close();
}

inspectVideoButton().catch(console.error);
