/**
 * Test if audio and video generation can run in parallel
 */

import { NotebookLMAutomation } from '../src/services/notebooklm-automation.js';
import { logger } from '../src/lib/logger.js';

async function testParallelGeneration() {
  const automation = new NotebookLMAutomation();

  try {
    logger.info('=== Starting Parallel Generation Test ===');
    await automation.initialize();

    // Create notebook and add source
    logger.info('\n=== Setup: Create Notebook and Add Source ===');
    await automation.createNotebook();
    logger.info('✓ Notebook created');

    const testUrl = process.env.TEST_URL || 'https://example.com';
    logger.info('Using test URL:', testUrl);
    await automation.addUrlSource(testUrl);
    logger.info('✓ URL source added');

    // Wait for source processing
    logger.info('\nWaiting 10 seconds for source processing...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Use the new parallel generation method
    logger.info('\n=== Test: Parallel Audio and Video Generation ===');
    logger.info('Using generateBothOverviews() method...');

    const startTime = Date.now();

    try {
      await automation.generateBothOverviews();

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;

      logger.info('\n=== Results ===');
      logger.info(`✓✓ Parallel generation SUCCESS!`);
      logger.info(`Total time: ${totalTime.toFixed(2)} seconds`);
      logger.info(`  (Compare to ~16 minutes for sequential generation)`);
    } catch (error) {
      logger.error('Parallel generation error', { error });
      throw error;
    }

    logger.info('\n=== Test Complete ===');
  } catch (error) {
    logger.error('Test failed', { error });
    throw error;
  } finally {
    logger.info('\nCleaning up...');
    await automation.cleanup();
  }
}

// Run test
testParallelGeneration().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
