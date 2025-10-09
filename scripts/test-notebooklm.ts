/**
 * T012: Standalone test script for NotebookLM automation
 * Tests the complete workflow: create notebook, add URL, generate audio/video
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const automation = new NotebookLMAutomation();

  try {
    // Initialize browser
    logger.info('=== Starting NotebookLM Automation Test ===');
    await automation.initialize();

    // T008: Create new notebook
    logger.info('\n=== Test 1: Create Notebook ===');
    await automation.createNotebook();
    logger.info('✓ Notebook created');

    // T009: Add URL source
    logger.info('\n=== Test 2: Add URL Source ===');
    const testUrl = process.env.TEST_URL || 'https://example.com';
    logger.info('Using test URL:', testUrl);
    await automation.addUrlSource(testUrl);
    logger.info('✓ URL source added');

    // Wait for source to be processed
    logger.info('\nWaiting 10 seconds for source processing...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // T010 & T011: Generate Audio and Video Overview in parallel
    logger.info('\n=== Test 3: Generate Audio and Video Overview (Parallel) ===');
    logger.info('⚠️  This may take several minutes...');
    await automation.generateBothOverviews();
    logger.info('✓ Both Audio and Video Overviews generated');

    // Test download (optional)
    logger.info('\n=== Test 4: Download Media (Optional) ===');
    try {
      const audioBuffer = await automation.downloadMedia('audio');
      logger.info('✓ Audio downloaded', { size: audioBuffer.length });
    } catch (error) {
      logger.warn('Audio download skipped or failed', { error });
    }

    try {
      const videoBuffer = await automation.downloadMedia('video');
      logger.info('✓ Video downloaded', { size: videoBuffer.length });
    } catch (error) {
      logger.warn('Video download skipped or failed', { error });
    }

    logger.info('\n=== All Tests Passed! ===');
  } catch (error) {
    logger.error('Test failed', { error });
    throw error;
  } finally {
    logger.info('\nCleaning up...');
    await automation.cleanup();
  }
}

// Run with environment variable support
// Usage: TEST_URL=https://example.com npx tsx scripts/test-notebooklm.ts
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
