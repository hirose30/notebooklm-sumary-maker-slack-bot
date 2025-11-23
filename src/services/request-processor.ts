/**
 * Request processor orchestrator
 * Coordinates: Queue → NotebookLM → R2 → Slack
 */

import { NotebookLMAutomation } from './notebooklm-automation.js';
import { CloudflareStorage } from './cloudflare-storage.js';
import { SimpleQueue, QueueJob } from './simple-queue.js';
import { logger, workspaceLogger } from '../lib/logger.js';
import { workspaceContext } from './workspace-context.js';
import { db } from '../lib/database.js';

export class RequestProcessor {
  private queue: SimpleQueue;
  private storage: CloudflareStorage;
  private workspaceKeyMap: Map<string, string>; // teamId -> workspaceKey mapping
  private isProcessing: boolean = false;
  private onJobComplete?: (job: QueueJob, infographicBuffer?: Buffer, errors?: string[]) => Promise<void>;
  private onJobError?: (job: QueueJob, error: Error) => Promise<void>;

  constructor(
    workspaceKeyMap: Map<string, string>,
    onJobComplete?: (job: QueueJob, infographicBuffer?: Buffer, errors?: string[]) => Promise<void>,
    onJobError?: (job: QueueJob, error: Error) => Promise<void>
  ) {
    this.queue = new SimpleQueue();
    this.storage = new CloudflareStorage();
    this.workspaceKeyMap = workspaceKeyMap;
    this.onJobComplete = onJobComplete;
    this.onJobError = onJobError;
  }

  /**
   * Process a single request end-to-end
   */
  async processRequest(job: QueueJob): Promise<void> {
    // Load workspace context if available
    const workspace = job.workspaceId ? await this.loadWorkspaceContext(job.workspaceId) : null;

    // Execute within workspace context if available
    const processJob = async () => {
      const jobLogger = workspace ? workspaceLogger : logger;
      jobLogger.info('Processing request', { id: job.id, url: job.url });

      // Create workspace-specific NotebookLMAutomation instance
      // Use workspace-specific user-data directory (e.g., ./user-data-ws1, ./user-data-ws2)
      const userDataDir = workspace?.workspaceKey
        ? `./user-data-${workspace.workspaceKey}`
        : './user-data';
      const uiVersion = workspace?.uiVersion || 'old'; // FR-008: Default to old UI
      const notebooklm = new NotebookLMAutomation(userDataDir, uiVersion);

      try {
      // Initialize NotebookLM automation
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 10,
        currentStep: 'Initializing browser',
      });

      await notebooklm.initialize();

      // Create new notebook
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 20,
        currentStep: 'Creating notebook',
      });

      await notebooklm.createNotebook();

      // Add URL source
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 30,
        currentStep: 'Adding URL source',
      });

      await notebooklm.addUrlSource(job.url);

      // Wait for source processing
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Generate audio and video in parallel
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 40,
        currentStep: 'Generating audio and video',
      });

      await notebooklm.generateBothOverviews();

      // FR-008: Download all artifacts with individual error handling
      // At least one artifact must succeed for the job to be considered successful
      this.queue.updateJobStatus(job.id, 'processing', {
        progress: 70,
        currentStep: 'Downloading artifacts',
      });

      let audioBuffer: Buffer | null = null;
      let videoBuffer: Buffer | null = null;
      let infographicBuffer: Buffer | null = null;

      const errors: string[] = [];

      // Download audio
      try {
        audioBuffer = await notebooklm.downloadMedia('audio');
        jobLogger.info('Audio downloaded successfully', { size: audioBuffer.length });
      } catch (audioError) {
        const errorMsg = audioError instanceof Error ? audioError.message : 'Unknown error';
        jobLogger.warn('Audio download failed', { error: audioError });
        errors.push(`音声生成エラー: ${errorMsg}`);
      }

      // Download video
      try {
        videoBuffer = await notebooklm.downloadMedia('video');
        jobLogger.info('Video downloaded successfully', { size: videoBuffer.length });
      } catch (videoError) {
        const errorMsg = videoError instanceof Error ? videoError.message : 'Unknown error';
        jobLogger.warn('Video download failed', { error: videoError });
        errors.push(`動画生成エラー: ${errorMsg}`);
      }

      // Download infographic (if available)
      try {
        const infographicResult = await notebooklm.detectInfographic();
        if (infographicResult.detected) {
          jobLogger.info('Infographic detected, downloading', { count: infographicResult.count });
          infographicBuffer = await notebooklm.downloadInfographic();
          jobLogger.info('Infographic downloaded successfully', { size: infographicBuffer.length });
        } else {
          jobLogger.info('No infographic detected');
        }
      } catch (infographicError) {
        const errorMsg = infographicError instanceof Error ? infographicError.message : 'Unknown error';
        jobLogger.warn('Infographic download failed', { error: infographicError });
        errors.push(`インフォグラフィック生成エラー: ${errorMsg}`);
      }

      // Check if at least one artifact succeeded
      if (!audioBuffer && !videoBuffer && !infographicBuffer) {
        throw new Error('All artifacts failed to generate: ' + errors.join(', '));
      }

      // Upload audio to R2 (if available)
      if (audioBuffer) {
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
      }

      // Upload video to R2 (if available)
      if (videoBuffer) {
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
      }

      // Upload infographic to R2 (if available)
      // T014: Save infographic metadata to database
      if (infographicBuffer) {
        this.queue.updateJobStatus(job.id, 'processing', {
          progress: 98,
          currentStep: 'Uploading infographic to R2',
        });

        const infographicFilename = `infographic-${job.id}.png`;
        const infographicKey = await this.storage.uploadMedia(
          infographicBuffer,
          infographicFilename,
          'image/png'
        );
        const infographicUrl = await this.storage.getPublicUrl(infographicKey);

        this.queue.saveMedia({
          requestId: job.id,
          mediaType: 'infographic',
          filename: infographicFilename,
          r2Key: infographicKey,
          r2PublicUrl: infographicUrl,
          fileSize: infographicBuffer.length,
          expiresAt: '', // Will be calculated in saveMedia
        });

        jobLogger.info('Infographic uploaded to R2 successfully', {
          size: infographicBuffer.length,
          key: infographicKey,
        });
      }

      // Mark as completed
      this.queue.updateJobStatus(job.id, 'completed', {
        progress: 100,
        currentStep: 'Completed',
      });

        jobLogger.info('Request processed successfully', {
          id: job.id,
          audioSize: audioBuffer?.length || 0,
          videoSize: videoBuffer?.length || 0,
          hasInfographic: !!infographicBuffer,
          errors: errors.length > 0 ? errors : undefined,
        });

        // Call completion callback (e.g., to notify Slack)
        // Pass errors array so Slack can display them
        if (this.onJobComplete) {
          await this.onJobComplete(job, infographicBuffer || undefined, errors);
        }
      } catch (error) {
        jobLogger.error('Failed to process request', { error, id: job.id });

        const errorObj = error instanceof Error ? error : new Error('Unknown error');

        this.queue.updateJobStatus(job.id, 'failed', {
          errorMessage: errorObj.message,
        });

        // Call error callback to notify Slack
        if (this.onJobError) {
          try {
            await this.onJobError(job, errorObj);
          } catch (callbackError) {
            jobLogger.error('Error callback failed', { callbackError, id: job.id });
            // Don't throw - we want to continue processing other jobs
          }
        }

        // Don't throw error - we want to continue processing next job
        jobLogger.info('Continuing to next job after error', { id: job.id });
      } finally {
        // Cleanup
        await notebooklm.cleanup();
      }
    };

    // Run with workspace context if available
    if (workspace) {
      await workspaceContext.run(workspace, processJob);
    } else {
      await processJob();
    }
  }

  /**
   * Load workspace context from database by workspaceId (teamId)
   */
  private async loadWorkspaceContext(workspaceId: string): Promise<any> {
    try {
      const stmt = db.prepare(`
        SELECT team_id, team_name, bot_token, bot_user_id, enterprise_id, ui_version
        FROM slack_installations
        WHERE team_id = ?
      `);

      const row = stmt.get(workspaceId) as any;

      if (!row) {
        logger.warn('Workspace not found for job', { workspaceId });
        return null;
      }

      // Get workspace key from the mapping (teamId -> workspaceKey)
      const workspaceKey = this.workspaceKeyMap.get(row.team_id) || 'unknown';

      return {
        teamId: row.team_id,
        teamName: row.team_name || 'Unknown',
        botToken: row.bot_token,
        botUserId: row.bot_user_id,
        enterpriseId: row.enterprise_id || null,
        workspaceKey,
        uiVersion: row.ui_version || 'old', // FR-008: Default to old UI
      };
    } catch (error) {
      logger.error('Failed to load workspace context', { error, workspaceId });
      return null;
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
