/**
 * Inspect artifact metadata from NotebookLM page
 * Check if creation time or other metadata is available
 */

import { chromium } from 'playwright';

async function inspectArtifacts(notebookUrl: string) {
  const context = await chromium.launchPersistentContext('./user-data', {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log(`Navigating to: ${notebookUrl}`);
    await page.goto(notebookUrl);
    await page.waitForTimeout(3000);

    // Extract artifact information
    const artifacts = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('button.artifact-button-content')
      );

      return cards.map((card) => {
        const button = card as HTMLElement;

        // Get icon type
        const blueIcon = button.querySelector('mat-icon.artifact-icon.blue');
        const greenIcon = button.querySelector('mat-icon.artifact-icon.green');
        const type = blueIcon ? 'audio' : greenIcon ? 'video' : 'unknown';

        // Get title
        const titleElement = button.querySelector('.artifact-labels');
        const title = titleElement?.textContent?.trim() || '';

        // Get time information
        const timeElement = button.querySelector('.artifact-metadata');
        const timeText = timeElement?.textContent?.trim() || '';

        // Try to find any data attributes
        const dataAttrs: Record<string, string> = {};
        for (const attr of button.attributes) {
          if (attr.name.startsWith('data-')) {
            dataAttrs[attr.name] = attr.value;
          }
        }

        // Get all text content to find metadata
        const allText = button.textContent || '';

        // Parse time ago text (e.g., "9 分前", "23 分前")
        const timeMatch = allText.match(/(\d+)\s*分前/);
        const minutesAgo = timeMatch ? parseInt(timeMatch[1]) : null;

        // Calculate approximate creation time
        let estimatedCreationTime = null;
        if (minutesAgo !== null) {
          const now = new Date();
          const creationTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
          estimatedCreationTime = creationTime.toISOString();
        }

        return {
          type,
          title: title.substring(0, 100),
          timeText,
          minutesAgo,
          estimatedCreationTime,
          dataAttributes: dataAttrs,
          buttonClasses: button.className,
        };
      });
    });

    console.log('\n=== Artifacts Found ===');
    artifacts.forEach((artifact, index) => {
      console.log(`\n--- Artifact ${index + 1} ---`);
      console.log(`Type: ${artifact.type}`);
      console.log(`Title: ${artifact.title}`);
      console.log(`Time Text: ${artifact.timeText}`);
      console.log(`Minutes Ago: ${artifact.minutesAgo}`);
      if (artifact.estimatedCreationTime) {
        console.log(`Estimated Creation Time: ${artifact.estimatedCreationTime}`);
        console.log(
          `  Local: ${new Date(artifact.estimatedCreationTime).toLocaleString()}`
        );
      }
      if (Object.keys(artifact.dataAttributes).length > 0) {
        console.log(`Data Attributes:`, artifact.dataAttributes);
      }
    });

    console.log('\n=== Summary ===');
    console.log(`Total artifacts: ${artifacts.length}`);
    console.log(
      `Audio: ${artifacts.filter((a) => a.type === 'audio').length}`
    );
    console.log(
      `Video: ${artifacts.filter((a) => a.type === 'video').length}`
    );

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

console.log('=== NotebookLM Artifact Metadata Inspector ===');
console.log(`Notebook: ${notebookUrl}\n`);

inspectArtifacts(notebookUrl).catch(console.error);
