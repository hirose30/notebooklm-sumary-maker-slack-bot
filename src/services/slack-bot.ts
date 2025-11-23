/**
 * Slack bot service
 * Handles Slack events and manages bot interactions
 */

import { App, LogLevel, AuthorizeSourceData } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config } from '../lib/config.js';
import { logger, workspaceLogger } from '../lib/logger.js';
import { formatFileSize } from '../lib/format-utils.js';
import { extractUrlFromThread } from './url-extractor.js';
import { SimpleQueue } from './simple-queue.js';
import { RequestProcessor } from './request-processor.js';
import { db } from '../lib/database.js';
import { workspaceContext, getWorkspaceContext } from './workspace-context.js';
import type { SlackInstallationRow } from '../models/workspace.js';

export class SlackBot {
  private app: App;
  private isRunning: boolean = false;
  private queue: SimpleQueue;
  private processor: RequestProcessor;
  private workspaceKeyMap: Map<string, string>; // T025: Store workspace key mapping

  constructor(workspaceKeyMap: Map<string, string>) { // T025: Accept workspace key mapping
    this.workspaceKeyMap = workspaceKeyMap;
    this.queue = new SimpleQueue();

    // Initialize processor with workspace key map and callbacks
    this.processor = new RequestProcessor(
      workspaceKeyMap, // Pass workspace key mapping for user-data directory routing
      // onJobComplete callback
      async (job, infographicBuffer, errors) => {
        await this.postCompletionResults(job.slackChannel, job.slackThreadTs, job.id, infographicBuffer, errors);
      },
      // onJobError callback
      async (job, error) => {
        await this.postErrorMessage(job.slackChannel, job.slackThreadTs, job.id);
      }
    );

    // Initialize Slack App with custom authorize function (env-based workspaces)
    // Workspaces are loaded from environment variables and synced to DB at startup
    this.app = new App({
      signingSecret: config.slackSigningSecret,
      authorize: async (source) => {
        // Fetch workspace installation from database
        const teamId = source.teamId;

        if (!teamId) {
          throw new Error('No team ID in authorization source');
        }

        const installation = db.prepare<[string], SlackInstallationRow>(`
          SELECT * FROM slack_installations
          WHERE team_id = ? AND enterprise_id IS NULL
        `).get(teamId);

        if (!installation) {
          throw new Error(`No installation found for team ${teamId}`);
        }

        logger.debug('Authorize: Found installation', {
          teamId: installation.team_id,
          teamName: installation.team_name,
          hasBotToken: !!installation.bot_token,
        });

        // Return authorization result in format expected by Bolt SDK
        // See: https://slack.dev/bolt-js/concepts#authorization
        return {
          botToken: installation.bot_token,
          botId: installation.bot_id,
          botUserId: installation.bot_user_id,
          teamId: installation.team_id,
          enterpriseId: installation.enterprise_id || undefined,
        };
      },
      socketMode: true, // Socket Mode for development (no public endpoints needed)
      appToken: process.env.SLACK_WS1_APP_TOKEN || config.slackAppToken, // Primary workspace app token for Socket Mode
      logLevel: LogLevel.INFO,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event listeners
   */
  private setupEventHandlers(): void {
    // Handle app mentions
    this.app.event('app_mention', async ({ event, client, context }) => {
      // T025: Extract workspace context from Bolt context with workspaceKey
      const teamId = context.teamId!;
      const workspace = {
        teamId,
        teamName: (context as any).teamName || 'Unknown',
        botToken: context.botToken!,
        botUserId: context.botUserId!,
        enterpriseId: (context as any).enterpriseId || null,
        workspaceKey: this.workspaceKeyMap.get(teamId) || 'unknown', // T025: Get workspace key from mapping
      };

      // Run the handler within workspace context
      await workspaceContext.run(workspace, async () => {
        try {
          workspaceLogger.info('Received app mention', {
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
            workspaceLogger.debug('Parent thread fetched', { parentText: parentText?.substring(0, 100) });
          } catch (parentError) {
            workspaceLogger.warn('Failed to fetch parent thread', { error: parentError });
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
        const currentWorkspace = getWorkspaceContext();
        const jobId = this.queue.addJob(url, event.channel, threadTs, userId, currentWorkspace.teamId);

        // Send acknowledgment and capture timestamp
        try {
          const ackResponse = await client.chat.postMessage({
            channel: event.channel,
            thread_ts: event.ts,
            text: `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
          });

          // Store timestamp for later deletion
          this.queue.updateAckMessageTs(jobId, ackResponse.ts!);
          workspaceLogger.info('Posted and stored acknowledgment', { jobId, ackTs: ackResponse.ts });
        } catch (ackError) {
          workspaceLogger.error('Failed to post acknowledgment', { error: ackError, jobId });
          // Continue processing - acknowledgment is nice-to-have
          // ack_message_ts will remain NULL, deletion will be skipped
        }

          workspaceLogger.info('Job added to queue', { jobId, url });
        } catch (error) {
          workspaceLogger.error('Error handling app mention', { error });

          try {
            await this.replyToThread(
              client,
              event.channel,
              event.ts,
              '❌ エラーが発生しました。後でもう一度お試しください。'
            );
          } catch (replyError) {
            workspaceLogger.error('Error sending error reply', { error: replyError });
          }
        }
      });
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
   * Get Slack WebClient for a specific workspace
   * Uses workspace_id to fetch the correct bot token
   */
  private getClientForWorkspace(workspaceId: string): WebClient {
    const installation = db.prepare<[string], SlackInstallationRow>(`
      SELECT * FROM slack_installations
      WHERE team_id = ? AND enterprise_id IS NULL
    `).get(workspaceId);

    if (!installation) {
      throw new Error(`No installation found for workspace ${workspaceId}`);
    }

    return new WebClient(installation.bot_token);
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

    // In OAuth mode, the client automatically uses the correct workspace token
    // based on the current context. No need to pass token explicitly.
    await this.app.client.chat.postMessage({
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
      const request = this.queue.getRequest(jobId);
      if (!request || !request.workspaceId) {
        logger.error('Cannot post error message: no workspace_id', { jobId });
        return;
      }

      const client = this.getClientForWorkspace(request.workspaceId);

      // Step 1: Delete acknowledgment (same as completion)
      try {
        if (request.ack_message_ts) {
          await client.chat.delete({
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

      await client.chat.postMessage({
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
    jobId: number,
    infographicBuffer?: Buffer,
    errors?: string[]
  ): Promise<void> {
    try {
      const request = this.queue.getRequest(jobId);
      if (!request || !request.workspaceId) {
        logger.error('Cannot post completion results: no workspace_id', { jobId });
        throw new Error('No workspace_id for request');
      }

      const client = this.getClientForWorkspace(request.workspaceId);

      // Step 1: Delete acknowledgment message (if exists)
      try {
        if (request.ack_message_ts) {
          await client.chat.delete({
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

      // Build completion message text
      let message = '✅ 処理が完了しました！\n\n';

      if (audioMedia) {
        const audioSize = formatFileSize(audioMedia.fileSize);
        message += `<${audioMedia.r2PublicUrl}|🎵 音声要約> (${audioSize})\n`;
      }

      if (videoMedia) {
        const videoSize = formatFileSize(videoMedia.fileSize);
        message += `<${videoMedia.r2PublicUrl}|🎬 動画要約> (${videoSize})\n`;
      }

      // FR-008: Add errors section if any artifact failed
      if (errors && errors.length > 0) {
        message += `\n⚠️ 一部の生成でエラーが発生しました:\n`;
        errors.forEach(error => {
          message += `• ${error}\n`;
        });
      }

      message += `\n⏰ リンクは7日間有効です`;

      // If infographic is available, post everything together via files.uploadV2
      if (infographicBuffer) {
        try {
          logger.info('Uploading infographic with completion message to Slack', { jobId, size: infographicBuffer.length });

          const infographicFilename = `infographic-${jobId}.png`;

          // Upload file with completion message as initial_comment
          const result = await client.files.uploadV2({
            channel_id: channel,
            thread_ts: threadTs,
            file: infographicBuffer,
            filename: infographicFilename,
            title: 'NotebookLM インフォグラフィック',
            initial_comment: message,
          });

          if (!result.ok) {
            throw new Error('Slack file upload failed');
          }

          // files.uploadV2 returns { ok: true, files: [...] } not { file: {...} }
          const files = (result as any).files;
          if (files && files.length > 0) {
            const fileData = files[0];
            logger.info('Infographic uploaded to thread successfully', {
              fileId: fileData.id,
              size: infographicBuffer.length,
            });

            // Get thread permalink by finding the file message (with retry)
            let fileMessage: any = null;
            const maxRetries = 3;
            const retryDelay = 3000; // 3 seconds

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              logger.info('Searching for file message in thread', {
                jobId,
                attempt,
                maxRetries,
              });

              const repliesResult = await client.conversations.replies({
                channel,
                ts: threadTs,
              });

              const messages = (repliesResult as any).messages || [];
              fileMessage = messages.find((m: any) => m.files && m.files.length > 0);

              if (fileMessage) {
                logger.info('File message found in thread', {
                  jobId,
                  attempt,
                  messageTs: fileMessage.ts,
                });
                break;
              }

              if (attempt < maxRetries) {
                logger.info('File message not found, retrying...', {
                  jobId,
                  attempt,
                  nextRetryIn: `${retryDelay / 1000}s`,
                });
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }

            if (fileMessage) {
              const permalinkResult = await client.chat.getPermalink({
                channel,
                message_ts: fileMessage.ts,
              });

              const threadUrl = permalinkResult.permalink!;
              logger.info('Thread permalink obtained', { threadUrl, jobId });

              // T014: Save Slack file metadata to database
              this.queue.updateMediaSlackInfo(
                jobId,
                'infographic',
                fileData.id,
                threadUrl
              );

              // Post channel message with thread link
              await client.chat.postMessage({
                channel,
                text: `<${threadUrl}|要約>`,
              });

              logger.info('Channel message with thread link posted', { jobId });
            } else {
              logger.warn('Could not find file message for permalink after retries', {
                jobId,
                maxRetries,
              });
            }
          }
        } catch (slackUploadError) {
          // FR-007: Slack upload failure should not block completion
          logger.warn('Failed to upload infographic to Slack, posting message without it', {
            jobId,
            error: slackUploadError,
          });

          // Fallback: Post message without infographic (thread only)
          await client.chat.postMessage({
            channel,
            thread_ts: threadTs,
            text: message,
          });
        }
      } else {
        // No infographic: Post message to thread only
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: message,
        });
      }

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
