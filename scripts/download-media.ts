/**
 * Standalone script to download audio/video from existing NotebookLM page
 * with response header inspection
 */

import { chromium } from 'playwright';

interface DownloadInfo {
  filename: string;
  size: number;
  buffer: Buffer;
  url: string;
  headers: Record<string, string>;
  lastModified?: string;
  contentType?: string;
}

async function downloadMedia(
  notebookUrl: string,
  type: 'audio' | 'video'
): Promise<DownloadInfo> {
  const context = await chromium.launchPersistentContext('./user-data', {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to the notebook
    console.log(`Navigating to: ${notebookUrl}`);
    await page.goto(notebookUrl);
    await page.waitForTimeout(3000);

    // Setup network monitoring to capture response headers
    let downloadUrl: string | undefined;
    let responseHeaders: Record<string, string> = {};

    page.on('response', async (response) => {
      const url = response.url();
      // Look for media download URLs (m4a for audio, mp4 for video)
      if (
        (type === 'audio' && url.includes('.m4a')) ||
        (type === 'video' && url.includes('.mp4'))
      ) {
        console.log(`Captured ${type} download URL: ${url}`);
        downloadUrl = url;

        // Get all response headers
        const headers = await response.allHeaders();
        responseHeaders = headers;

        console.log('\n=== Response Headers ===');
        for (const [key, value] of Object.entries(headers)) {
          console.log(`${key}: ${value}`);
        }

        // Extract specific headers of interest
        const lastModified = headers['last-modified'];
        const contentType = headers['content-type'];
        const contentLength = headers['content-length'];
        const date = headers['date'];

        console.log('\n=== Key Information ===');
        if (lastModified) {
          console.log(`Last-Modified: ${lastModified}`);
          console.log(`  Parsed: ${new Date(lastModified).toLocaleString()}`);
        }
        if (date) {
          console.log(`Date: ${date}`);
          console.log(`  Parsed: ${new Date(date).toLocaleString()}`);
        }
        if (contentType) {
          console.log(`Content-Type: ${contentType}`);
        }
        if (contentLength) {
          console.log(`Content-Length: ${contentLength} bytes`);
        }
      }
    });

    // Find the correct artifact card based on type
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

    // Save to buffer
    const path = await download.path();
    if (!path) {
      throw new Error('Download failed - no file path');
    }

    const fs = await import('fs/promises');
    const buffer = await fs.readFile(path);

    console.log(`✓ Downloaded successfully: ${buffer.length} bytes`);

    const result: DownloadInfo = {
      filename,
      size: buffer.length,
      buffer,
      url: downloadUrl || download.url() || '',
      headers: responseHeaders,
      lastModified: responseHeaders['last-modified'],
      contentType: responseHeaders['content-type'],
    };

    return result;
  } finally {
    await page.waitForTimeout(1000);
    await context.close();
  }
}

// Main execution
async function main() {
  const notebookUrl =
    process.env.NOTEBOOK_URL ||
    'https://notebooklm.google.com/notebook/c1982665-5d8c-4076-a035-b54f8374ced2';
  const type = (process.env.TYPE || 'audio') as 'audio' | 'video';

  console.log('=== NotebookLM Media Downloader ===');
  console.log(`Notebook: ${notebookUrl}`);
  console.log(`Type: ${type}\n`);

  try {
    const info = await downloadMedia(notebookUrl, type);

    console.log('\n=== Download Summary ===');
    console.log(`Filename: ${info.filename}`);
    console.log(`Size: ${info.size.toLocaleString()} bytes`);
    console.log(`URL: ${info.url}`);
    if (info.lastModified) {
      console.log(`Last Modified: ${info.lastModified}`);
      console.log(`  => ${new Date(info.lastModified).toLocaleString()}`);
    }
    if (info.contentType) {
      console.log(`Content Type: ${info.contentType}`);
    }

    // Optionally save to file
    if (process.env.SAVE_PATH) {
      const fs = await import('fs/promises');
      await fs.writeFile(process.env.SAVE_PATH, info.buffer);
      console.log(`\n✓ Saved to: ${process.env.SAVE_PATH}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Usage:
// TYPE=audio NOTEBOOK_URL=https://... npx tsx scripts/download-media.ts
// TYPE=video NOTEBOOK_URL=https://... SAVE_PATH=./output.mp4 npx tsx scripts/download-media.ts
main().catch(console.error);
