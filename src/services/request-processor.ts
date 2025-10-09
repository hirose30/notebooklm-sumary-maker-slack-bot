/**
 * Request processor orchestrator
 * Coordinates: Queue → NotebookLM → R2 → Slack
 */

import { NotebookLMAutomation } from './notebooklm-automation.js';
import { CloudflareStorage } from './cloudflare-storage.js';
import { SimpleQueue, QueueJob } from './simple-queue.js';
import { logger } from '../lib/logger.js';

export class RequestProcessor {
  private queue: SimpleQueue;
  private storage: CloudflareStorage;
  private notebooklm: NotebookLMAutomation;
  private isProcessing: boolean = false;
  private onJobComplete?: (job: QueueJob) => Promise<void>;

  constructor(onJobComplete?: (job: QueueJob) => Promise<void>) {
    this.queue = new SimpleQueue();
    this.storage = new CloudflareStorage();
    this.notebooklm = new NotebookLMAutomation();
    this.onJobComplete = onJobComplete;
  }

  /**
   * Process a single request end-to-end
   */
  async processRequest(job: QueueJob): Promise<void> {
    logger.info('Processing request', { id: job.id, url: job.url });

    try {
      // Initialize NotebookLM automation
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 10,
        currentStep: 'Initializing browser',
      });

      await this.notebooklm.initialize();

      // Create new notebook
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 20,
        currentStep: 'Creating notebook',
      });

      await this.notebooklm.createNotebook();

      // Add URL source
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 30,
        currentStep: 'Adding URL source',
      });

      await this.notebooklm.addUrlSource(job.url);

      // Wait for source processing
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Generate audio and video in parallel
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 40,
        currentStep: 'Generating audio and video',
      });

      await this.notebooklm.generateBothOverviews();

      // Download audio
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 70,
        currentStep: 'Downloading audio',
      });

      const audioBuffer = await this.notebooklm.downloadMedia('audio');

      // Download video
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 80,
        currentStep: 'Downloading video',
      });

      const videoBuffer = await this.notebooklm.downloadMedia('video');

      // Upload audio to R2
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 85,
        currentStep: 'Uploading audio to R2',
      });

      const audioFilename = `audio-${job.id}.m4a`;
      const audioKey = await this.storage.uploadMedia(
        audioBuffer,
        audioFilename,
        'audio/mp4'
      );
      const audioUrl = await this.storage.getPublicUrl(audioKey);

      this.queue.saveMedia({
        requestId: job.id,
        mediaType: 'audio',
        filename: audioFilename,
        r2Key: audioKey,
        r2PublicUrl: audioUrl,
        fileSize: audioBuffer.length,
        expiresAt: '', // Will be calculated in saveMedia
      });

      // Upload video to R2
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 95,
        currentStep: 'Uploading video to R2',
      });

      const videoFilename = `video-${job.id}.mp4`;
      const videoKey = await this.storage.uploadMedia(
        videoBuffer,
        videoFilename,
        'video/mp4'
      );
      const videoUrl = await this.storage.getPublicUrl(videoKey);

      this.queue.saveMedia({
        requestId: job.id,
        mediaType: 'video',
        filename: videoFilename,
        r2Key: videoKey,
        r2PublicUrl: videoUrl,
        fileSize: videoBuffer.length,
        expiresAt: '', // Will be calculated in saveMedia
      });

      // Mark as completed
      this.queue.updateJobStatus(job.id, 'completed', {
        progress: 100,
        currentStep: 'Completed',
      });

      logger.info('Request processed successfully', {
        id: job.id,
        audioSize: audioBuffer.length,
        videoSize: videoBuffer.length,
      });

      // Call completion callback (e.g., to notify Slack)
      if (this.onJobComplete) {
        await this.onJobComplete(job);
      }
    } catch (error) {
      logger.error('Failed to process request', { error, id: job.id });

      this.queue.updateJobStatus(job.id, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      // Cleanup
      await this.notebooklm.cleanup();
    }
  }

  /**
   * Start processing queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Already processing queue');
      return;
    }

    this.isProcessing = true;
    logger.info('Queue processor started');

    while (this.isProcessing) {
      try {
        const job = this.queue.getNextJob();

        if (!job) {
          // No pending jobs, wait and check again
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        logger.info('Found pending job', { id: job.id });

        await this.processRequest(job);
      } catch (error) {
        logger.error('Error in queue processing loop', { error });
        // Continue processing other jobs
      }

      // Small delay between jobs
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info('Queue processor stopped');
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    this.isProcessing = false;
    logger.info('Stopping queue processor...');
  }

  /**
   * Get processing status
   */
  getStatus(): { isProcessing: boolean; stats: any } {
    return {
      isProcessing: this.isProcessing,
      stats: this.queue.getStats(),
    };
  }
}
