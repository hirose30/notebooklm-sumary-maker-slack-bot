/**
 * Test clicking both audio and video generation buttons simultaneously
 * to see if NotebookLM supports parallel generation
 */

import { chromium } from 'playwright';

async function testClickBothButtons(notebookUrl: string) {
  const context = await chromium.launchPersistentContext('./user-data', {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`Navigating to: ${notebookUrl}`);
    await page.goto(notebookUrl);
    await page.waitForTimeout(3000);

    console.log('\n=== Clicking both buttons simultaneously ===');

    // Find both buttons
    const audioButton = page.locator(
      'div.blue.create-artifact-button-container:has-text("音声解説")'
    );
    const videoButton = page.locator(
      'div.green.create-artifact-button-container:has-text("動画解説")'
    );

    // Check if both exist
    const audioCount = await audioButton.count();
    const videoCount = await videoButton.count();

    console.log(`Audio buttons found: ${audioCount}`);
    console.log(`Video buttons found: ${videoCount}`);

    if (audioCount === 0 || videoCount === 0) {
      throw new Error('Generation buttons not found');
    }

    // Click both at almost the same time
    console.log('\nClicking audio button...');
    await audioButton.click();

    console.log('Clicking video button...');
    await videoButton.click();

    console.log('\n✓ Both buttons clicked');
    console.log('\nCheck the NotebookLM page to see if:');
    console.log('1. Both generations started');
    console.log('2. Only one started (second click was ignored)');
    console.log('3. Second click replaced the first');

    // Wait and observe
    console.log('\nWaiting 10 seconds to observe...');
    await page.waitForTimeout(10000);

    // Check for generation status messages
    const audioGenerating = await page
      .locator(':text("音声解説を生成しています")')
      .count();
    const videoGenerating = await page
      .locator(':text("動画解説を生成しています")')
      .count();

    console.log('\n=== Status Check ===');
    console.log(`Audio generating: ${audioGenerating > 0 ? 'YES' : 'NO'}`);
    console.log(`Video generating: ${videoGenerating > 0 ? 'YES' : 'NO'}`);

    if (audioGenerating > 0 && videoGenerating > 0) {
      console.log('\n✓✓ Both are generating in parallel!');
    } else if (audioGenerating > 0 || videoGenerating > 0) {
      console.log('\n⚠️  Only one is generating (parallel not supported)');
    } else {
      console.log('\n? Cannot determine status from UI');
    }

    console.log('\nPress Ctrl+C to exit...');
    await new Promise(() => {});
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await context.close();
  }
}

const notebookUrl =
  process.env.NOTEBOOK_URL ||
  'https://notebooklm.google.com/notebook/c1982665-5d8c-4076-a035-b54f8374ced2';

console.log('=== Test Parallel Generation Buttons ===');
console.log(`Notebook: ${notebookUrl}\n`);

testClickBothButtons(notebookUrl).catch(console.error);
