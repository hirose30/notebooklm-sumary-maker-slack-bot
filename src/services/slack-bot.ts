/**
 * Slack bot service
 * Handles Slack events and manages bot interactions
 */

import { App, LogLevel } from '@slack/bolt';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { formatFileSize } from '../lib/format-utils.js';
import { extractUrlFromThread } from './url-extractor.js';
import { SimpleQueue } from './simple-queue.js';
import { RequestProcessor } from './request-processor.js';

export class SlackBot {
  private app: App;
  private isRunning: boolean = false;
  private queue: SimpleQueue;
  private processor: RequestProcessor;

  constructor() {
    this.queue = new SimpleQueue();

    // Initialize processor with completion and error callbacks
    this.processor = new RequestProcessor(
      // onJobComplete callback
      async (job) => {
        await this.postCompletionResults(job.slackChannel, job.slackThreadTs, job.id);
      },
      // onJobError callback
      async (job, error) => {
        await this.postErrorMessage(job.slackChannel, job.slackThreadTs, job.id);
      }
    );

    // Initialize Slack App with Socket Mode
    this.app = new App({
      token: config.slackBotToken,
      appToken: config.slackAppToken,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event listeners
   */
  private setupEventHandlers(): void {
    // Handle app mentions
    this.app.event('app_mention', async ({ event, client }) => {
      try {
        logger.info('Received app mention', {
          user: event.user,
          channel: event.channel,
          text: event.text,
          thread_ts: event.thread_ts,
        });

        // Fetch parent thread message if this is a threaded reply
        let parentText: string | null = null;
        if (event.thread_ts) {
          try {
            const parent = await client.conversations.history({
              channel: event.channel,
              latest: event.thread_ts,
              inclusive: true,
              limit: 1,
            });
            parentText = parent.messages?.[0]?.text || null;
            logger.debug('Parent thread fetched', { parentText: parentText?.substring(0, 100) });
          } catch (parentError) {
            logger.warn('Failed to fetch parent thread', { error: parentError });
            // Continue processing - not fatal
          }
        }

        // Extract URL from thread context (mention text or parent text)
        const url = extractUrlFromThread(event.text, parentText);

        if (!url) {
          await this.replyToThread(
            client,
            event.channel,
            event.ts,
            '❌ URLが見つかりません。スレッド内にURLを含めてください。\n例: `@bot https://example.com/article`'
          );
          return;
        }

        // Add to queue
        // Use thread_ts if available (threaded reply), otherwise use ts (top-level message)
        const threadTs = event.thread_ts || event.ts;
        const userId = event.user || 'unknown';
        const jobId = this.queue.addJob(url, event.channel, threadTs, userId);

        // Send acknowledgment and capture timestamp
        try {
          const ackResponse = await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.ts,
            text: `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
          });

          // Store timestamp for later deletion
          this.queue.updateAckMessageTs(jobId, ackResponse.ts!);
          logger.info('Posted and stored acknowledgment', { jobId, ackTs: ackResponse.ts });
        } catch (ackError) {
          logger.error('Failed to post acknowledgment', { error: ackError, jobId });
          // Continue processing - acknowledgment is nice-to-have
          // ack_message_ts will remain NULL, deletion will be skipped
        }

        logger.info('Job added to queue', { jobId, url });
      } catch (error) {
        logger.error('Error handling app mention', { error });

        try {
          await this.replyToThread(
            client,
            event.channel,
            event.ts,
            '❌ エラーが発生しました。後でもう一度お試しください。'
          );
        } catch (replyError) {
          logger.error('Error sending error reply', { error: replyError });
        }
      }
    });

    // Handle errors
    this.app.error(async (error) => {
      logger.error('Slack app error', { error });
    });
  }

  /**
   * Reply to a Slack thread
   */
  private async replyToThread(
    client: any,
    channel: string,
    threadTs: string,
    text: string
  ): Promise<void> {
    await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
    });
  }

  /**
   * Send a formatted message with blocks
   */
  async sendFormattedMessage(
    channel: string,
    threadTs: string,
    options: {
      title?: string;
      text: string;
      emoji?: string;
      color?: 'good' | 'warning' | 'danger';
    }
  ): Promise<void> {
    const blocks: any[] = [];

    if (options.title) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${options.emoji || ''} ${options.title}`.trim(),
        },
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: options.text,
      },
    });

    await this.app.client.chat.postMessage({
      token: config.slackBotToken,
      channel,
      thread_ts: threadTs,
      blocks,
    });
  }

  /**
   * Post error message to Slack when job fails
   */
  private async postErrorMessage(
    channel: string,
    threadTs: string,
    jobId: number
  ): Promise<void> {
    try {
      // Step 1: Delete acknowledgment (same as completion)
      try {
        const request = this.queue.getRequest(jobId);

        if (request?.ack_message_ts) {
          await this.app.client.chat.delete({
            channel,
            ts: request.ack_message_ts
          });
          logger.info('Deleted acknowledgment before error message', { jobId });
        }
      } catch (deleteError: any) {
        logger.warn('Failed to delete acknowledgment on error', {
          jobId,
          error: deleteError,
          errorCode: deleteError?.data?.error
        });
        // Continue - deletion failure is non-critical
      }

      // Step 2: Post error with broadcast
      const message = `❌ 処理中にエラーが発生しました（Job ID: ${jobId}）\n\nURLが正しいか、再度お試しください。`;

      await this.app.client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        reply_broadcast: true,  // Errors also broadcast to channel
        text: message
      });

      logger.info('Posted error message with broadcast', { jobId, channel });
    } catch (error) {
      logger.error('Failed to post error message', { error, jobId });
      // Don't throw - we want to continue processing
    }
  }

  /**
   * Post completion results to Slack
   */
  async postCompletionResults(
    channel: string,
    threadTs: string,
    jobId: number
  ): Promise<void> {
    try {
      // Step 1: Delete acknowledgment message (if exists)
      try {
        const request = this.queue.getRequest(jobId);

        if (request?.ack_message_ts) {
          await this.app.client.chat.delete({
            channel,
            ts: request.ack_message_ts
          });
          logger.info('Deleted acknowledgment message', { jobId, ackTs: request.ack_message_ts });
        } else {
          logger.debug('No acknowledgment to delete', { jobId });
        }
      } catch (deleteError: any) {
        // Map known errors to appropriate log levels
        const errorCode = deleteError?.data?.error;

        if (errorCode === 'message_not_found') {
          logger.info('Acknowledgment already deleted (manual user deletion)', { jobId });
        } else if (errorCode === 'cant_delete_message') {
          logger.warn('Cannot delete message (permission issue)', { jobId, error: deleteError });
        } else {
          logger.warn('Failed to delete acknowledgment message', { jobId, error: deleteError });
        }

        // CRITICAL: Don't throw - deletion failure must not prevent completion (FR-006)
      }

      // Step 2: Build and post completion message
      const media = this.queue.getMediaForRequest(jobId);

      if (media.length === 0) {
        throw new Error('No media found for completed job');
      }

      const audioMedia = media.find((m) => m.mediaType === 'audio');
      const videoMedia = media.find((m) => m.mediaType === 'video');

      let message = '✅ 処理が完了しました！\n\n';

      if (audioMedia) {
        const audioSize = formatFileSize(audioMedia.fileSize);
        message += `<${audioMedia.r2PublicUrl}|🎵 音声要約> (${audioSize})\n`;
      }

      if (videoMedia) {
        const videoSize = formatFileSize(videoMedia.fileSize);
        message += `<${videoMedia.r2PublicUrl}|🎬 動画要約> (${videoSize})\n`;
      }

      message += `\n⏰ リンクは7日間有効です`;

      // CRITICAL: Use reply_broadcast for channel visibility (FR-005)
      await this.app.client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        reply_broadcast: true,  // Always true - mandatory requirement
        text: message
      });

      logger.info('Posted completion results with broadcast', { jobId, channel });
    } catch (error) {
      logger.error('Failed to post completion results', { error, jobId });
      throw error;
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    try {
      await this.app.start();
      this.isRunning = true;
      logger.info('⚡️ Slack bot is running!');

      // Start request processor in background
      this.processor.startProcessing().catch((error) => {
        logger.error('Request processor error', { error });
      });

      logger.info('Request processor started');
    } catch (error) {
      logger.error('Failed to start Slack bot', { error });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bot is not running');
      return;
    }

    try {
      await this.app.stop();
      this.isRunning = false;
      logger.info('Slack bot stopped');
    } catch (error) {
      logger.error('Failed to stop Slack bot', { error });
      throw error;
    }
  }

  /**
   * Check if bot is running
   */
  getStatus(): { running: boolean } {
    return { running: this.isRunning };
  }
}
