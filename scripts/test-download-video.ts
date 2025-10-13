/**
 * Test video download functionality with the new selector
 */

import { chromium } from 'playwright';

async function testVideoDownload() {
  const context = await chromium.launchPersistentContext('./user-data', {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to the test notebook
    await page.goto('https://notebooklm.google.com/notebook/c1982665-5d8c-4076-a035-b54f8374ced2');
    await page.waitForTimeout(3000);

    // Test video download
    console.log('Testing video download...');

    // Find the video artifact card (green icon)
    const videoCard = page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.green)').first();

    // Check if found
    const count = await videoCard.count();
    console.log(`Found ${count} video cards`);

    if (count === 0) {
      console.log('No video cards found!');
      return;
    }

    // Click hamburger menu
    console.log('Clicking hamburger menu...');
    await videoCard.locator('mat-icon:text("more_vert")').click();

    await page.waitForTimeout(1000);

    console.log('Menu should be open now. Check the page.');

    // Wait to see the menu
    await page.waitForTimeout(5000);

    // Try to click download
    console.log('Clicking download button...');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text="ダウンロード"'),
    ]);

    const filename = download.suggestedFilename();
    console.log(`Download started: ${filename}`);

    const path = await download.path();
    if (path) {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(path);
      console.log(`✓ Video downloaded successfully: ${buffer.length} bytes`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await page.waitForTimeout(3000);
    await context.close();
  }
}

testVideoDownload().catch(console.error);
