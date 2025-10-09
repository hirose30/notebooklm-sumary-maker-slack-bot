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

    // T010: Generate Audio Overview
    logger.info('\n=== Test 3: Generate Audio Overview ===');
    logger.info('⚠️  This may take several minutes...');
    await automation.generateAudioOverview();
    logger.info('✓ Audio Overview generated');

    // T011: Generate Video Overview
    logger.info('\n=== Test 4: Generate Video Overview ===');
    logger.info('⚠️  This may take several minutes...');
    await automation.generateVideoOverview();
    logger.info('✓ Video Overview generated');

    // Test download (optional)
    logger.info('\n=== Test 5: Download Media (Optional) ===');
    try {
      const audioBuffer = await automation.downloadMedia('audio');
      logger.info('✓ Audio downloaded', { size: audioBuffer.length });
    } catch (error) {
      logger.warn('Audio download skipped or failed', { error });
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
