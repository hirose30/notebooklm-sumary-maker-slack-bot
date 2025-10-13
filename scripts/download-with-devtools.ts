/**
 * Download media and inspect response headers using Chrome DevTools Protocol
 */

import { chromium } from 'playwright';

async function downloadWithHeaders(
  notebookUrl: string,
  type: 'audio' | 'video'
) {
  const context = await chromium.launchPersistentContext('./user-data', {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Enable CDP session to access network headers
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');

    console.log(`Navigating to: ${notebookUrl}`);
    await page.goto(notebookUrl);
    await page.waitForTimeout(3000);

    // Listen for network responses
    const mediaRequests: Array<{
      url: string;
      headers: Record<string, string>;
    }> = [];

    client.on('Network.responseReceived', (params) => {
      const url = params.response.url;
      // Look for media files
      if (url.includes('.m4a') || url.includes('.mp4')) {
        console.log('\n=== Media Response Detected ===');
        console.log(`URL: ${url.substring(0, 100)}...`);
        console.log('\n=== Response Headers ===');

        const headers = params.response.headers;
        for (const [key, value] of Object.entries(headers)) {
          console.log(`${key}: ${value}`);
        }

        // Extract key headers
        const lastModified = headers['last-modified'] || headers['Last-Modified'];
        const date = headers['date'] || headers['Date'];
        const contentLength = headers['content-length'] || headers['Content-Length'];
        const contentType = headers['content-type'] || headers['Content-Type'];

        console.log('\n=== Key Information ===');
        if (lastModified) {
          console.log(`Last-Modified: ${lastModified}`);
          const modDate = new Date(lastModified);
          console.log(`  Parsed: ${modDate.toLocaleString()}`);
          console.log(`  ISO: ${modDate.toISOString()}`);
        }
        if (date) {
          console.log(`Date (Response): ${date}`);
          const respDate = new Date(date);
          console.log(`  Parsed: ${respDate.toLocaleString()}`);
          console.log(`  ISO: ${respDate.toISOString()}`);
        }
        if (contentType) {
          console.log(`Content-Type: ${contentType}`);
        }
        if (contentLength) {
          console.log(`Content-Length: ${parseInt(contentLength).toLocaleString()} bytes`);
        }

        mediaRequests.push({
          url,
          headers: headers as Record<string, string>,
        });
      }
    });

    // Find and click the download button
    console.log(`\nSearching for ${type} artifact card...`);
    const iconClass = type === 'audio' ? 'blue' : 'green';
    const artifactCard = page
      .locator(
        `button.artifact-button-content:has(mat-icon.artifact-icon.${iconClass})`
      )
      .first();

    const count = await artifactCard.count();
    console.log(`Found ${count} ${type} cards`);

    if (count === 0) {
      throw new Error(`No ${type} artifact found on page`);
    }

    // Click hamburger menu
    console.log('Clicking hamburger menu...');
    await artifactCard.locator('mat-icon:text("more_vert")').click();
    await page.waitForTimeout(500);

    // Click download button
    console.log('Clicking download button...');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text="ダウンロード"'),
    ]);

    const filename = download.suggestedFilename();
    console.log(`\nDownload started: ${filename}`);

    // Wait for download to complete
    const path = await download.path();
    if (!path) {
      throw new Error('Download failed - no file path');
    }

    const fs = await import('fs/promises');
    const stats = await fs.stat(path);

    console.log(`\n=== Download Complete ===`);
    console.log(`Filename: ${filename}`);
    console.log(`Size: ${stats.size.toLocaleString()} bytes`);

    // Wait a bit for all network events to be processed
    await page.waitForTimeout(2000);

    console.log(`\n=== Summary ===`);
    console.log(`Total media requests captured: ${mediaRequests.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    console.log('\nPress Ctrl+C to close the browser...');
    // Keep browser open for manual inspection
    await new Promise(() => {});
  }
}

// Main execution
const notebookUrl =
  process.env.NOTEBOOK_URL ||
  'https://notebooklm.google.com/notebook/c1982665-5d8c-4076-a035-b54f8374ced2';
const type = (process.env.TYPE || 'video') as 'audio' | 'video';

console.log('=== NotebookLM Download with Header Inspection ===');
console.log(`Notebook: ${notebookUrl}`);
console.log(`Type: ${type}\n`);

downloadWithHeaders(notebookUrl, type).catch(console.error);
