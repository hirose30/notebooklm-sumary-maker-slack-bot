/**
 * End-to-end test script
 * Tests the complete flow: Queue → NotebookLM → R2 → Output
 */

import { RequestProcessor } from '../src/services/request-processor.js';
import { SimpleQueue } from '../src/services/simple-queue.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  logger.info('=== Starting End-to-End Test ===');
  logger.info('This test simulates the complete workflow:');
  logger.info('1. Add job to queue');
  logger.info('2. Process with NotebookLM automation');
  logger.info('3. Upload to R2');
  logger.info('4. Verify results');
  logger.info('');

  const testUrl = process.env.TEST_URL || 'https://example.com/article';
  logger.info('Test URL:', testUrl);
  logger.info('');

  // Initialize services
  const queue = new SimpleQueue();
  const processor = new RequestProcessor(async (job) => {
    logger.info('Job completed callback triggered', { jobId: job.id });
  });

  try {
    // Step 1: Add job to queue
    logger.info('Step 1: Adding job to queue...');
    const jobId = queue.addJob(
      testUrl,
      'test-channel',
      Date.now().toString(),
      'test-user'
    );
    logger.info(`✓ Job added: ${jobId}`);

    // Step 2: Process the job
    logger.info('\nStep 2: Processing job (this will take several minutes)...');
    const job = queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await processor.processRequest(job);

    // Step 3: Verify results
    logger.info('\nStep 3: Verifying results...');
    const updatedJob = queue.getJob(jobId);
    if (!updatedJob) {
      throw new Error('Job not found after processing');
    }

    logger.info('Job status:', updatedJob.status);
    logger.info('Progress:', updatedJob.progress + '%');

    const media = queue.getMediaForRequest(jobId);
    logger.info('Media files:', media.length);

    media.forEach((m) => {
      logger.info(`\n${m.mediaType.toUpperCase()}:`);
      logger.info(`  Filename: ${m.filename}`);
      logger.info(`  Size: ${(m.fileSize / 1024 / 1024).toFixed(2)} MB`);
      logger.info(`  R2 URL: ${m.r2PublicUrl}`);
      logger.info(`  Expires: ${m.expiresAt}`);
    });

    // Step 4: Check queue stats
    logger.info('\nQueue statistics:');
    const stats = queue.getStats();
    logger.info('  Pending:', stats.pending);
    logger.info('  Processing:', stats.processing);
    logger.info('  Completed:', stats.completed);
    logger.info('  Failed:', stats.failed);

    logger.info('\n=== End-to-End Test Passed! ===');
  } catch (error) {
    logger.error('End-to-End test failed', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
