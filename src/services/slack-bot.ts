/**
 * Slack bot service
 * Handles Slack events and manages bot interactions
 */

import { App, LogLevel } from '@slack/bolt';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { extractAndValidateUrl } from './url-extractor.js';
import { SimpleQueue } from './simple-queue.js';
import { RequestProcessor } from './request-processor.js';

export class SlackBot {
  private app: App;
  private isRunning: boolean = false;
  private queue: SimpleQueue;
  private processor: RequestProcessor;

  constructor() {
    this.queue = new SimpleQueue();

    // Initialize processor with completion callback
    this.processor = new RequestProcessor(async (job) => {
      await this.postCompletionResults(job.slackChannel, job.slackThreadTs, job.id);
    });

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
        });

        // Extract URL from message
        const url = extractAndValidateUrl(event.text);

        if (!url) {
          await this.replyToThread(
            client,
            event.channel,
            event.ts,
            '❌ URLが見つかりませんでした。URLを含めてメンションしてください。\n例: `@bot https://example.com/article`'
          );
          return;
        }

        // Add to queue
        const jobId = this.queue.addJob(url, event.channel, event.ts, event.user);

        // Send acknowledgment
        await this.replyToThread(
          client,
          event.channel,
          event.ts,
          `✅ URLを受け付けました: ${url}\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
        );

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
   * Post completion results to Slack
   */
  async postCompletionResults(
    channel: string,
    threadTs: string,
    jobId: number
  ): Promise<void> {
    try {
      const media = this.queue.getMediaForRequest(jobId);

      if (media.length === 0) {
        throw new Error('No media found for completed job');
      }

      const audioMedia = media.find((m) => m.mediaType === 'audio');
      const videoMedia = media.find((m) => m.mediaType === 'video');

      let message = '✅ 処理が完了しました！\n\n';

      if (audioMedia) {
        message += `🎵 音声解説: ${audioMedia.r2PublicUrl}\n`;
        message += `   サイズ: ${(audioMedia.fileSize / 1024 / 1024).toFixed(2)} MB\n\n`;
      }

      if (videoMedia) {
        message += `🎬 動画解説: ${videoMedia.r2PublicUrl}\n`;
        message += `   サイズ: ${(videoMedia.fileSize / 1024 / 1024).toFixed(2)} MB\n\n`;
      }

      message += `⏰ リンクは7日間有効です`;

      await this.replyToThread(this.app.client, channel, threadTs, message);

      logger.info('Posted completion results', { jobId, channel });
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
