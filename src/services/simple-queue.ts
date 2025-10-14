/**
 * Simple queue service using SQLite
 * Handles serial processing of NotebookLM requests
 */

import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';

export interface QueueJob {
  id: number;
  url: string;
  slackChannel: string;
  slackThreadTs: string;
  slackUser: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MediaRecord {
  id?: number;
  requestId: number;
  mediaType: 'audio' | 'video';
  filename: string;
  r2Key: string;
  r2PublicUrl: string;
  fileSize: number;
  expiresAt: string;
}

export class SimpleQueue {
  /**
   * Add a new job to the queue
   */
  addJob(
    url: string,
    slackChannel: string,
    slackThreadTs: string,
    slackUser: string
  ): number {
    const stmt = db.prepare(`
      INSERT INTO requests (url, slack_channel, slack_thread_ts, slack_user, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    const result = stmt.run(url, slackChannel, slackThreadTs, slackUser);

    logger.info('Job added to queue', {
      id: result.lastInsertRowid,
      url,
      channel: slackChannel,
    });

    return Number(result.lastInsertRowid);
  }

  /**
   * Get the next pending job
   */
  getNextJob(): QueueJob | null {
    const stmt = db.prepare(`
      SELECT * FROM requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `);

    const row = stmt.get() as any;

    if (!row) {
      return null;
    }

    return this.mapRowToJob(row);
  }

  /**
   * Update job status
   */
  updateJobStatus(
    id: number,
    status: QueueJob['status'],
    options?: {
      progress?: number;
      currentStep?: string;
      errorMessage?: string;
    }
  ): void {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (options?.progress !== undefined) {
      updates.push('progress = ?');
      values.push(options.progress);
    }

    if (options?.currentStep) {
      updates.push('current_step = ?');
      values.push(options.currentStep);
    }

    if (options?.errorMessage) {
      updates.push('error_message = ?');
      values.push(options.errorMessage);
    }

    if (status === 'processing' && !options?.currentStep) {
      updates.push('started_at = CURRENT_TIMESTAMP');
    }

    if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE requests
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    logger.info('Job status updated', {
      id,
      status,
      progress: options?.progress,
      step: options?.currentStep,
    });
  }

  /**
   * Get job by ID
   */
  getJob(id: number): QueueJob | null {
    const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToJob(row);
  }

  /**
   * Save media record
   */
  saveMedia(media: MediaRecord): number {
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const stmt = db.prepare(`
      INSERT INTO media (
        request_id, media_type, filename, r2_key, r2_public_url, file_size, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      media.requestId,
      media.mediaType,
      media.filename,
      media.r2Key,
      media.r2PublicUrl,
      media.fileSize,
      expiresAt.toISOString()
    );

    logger.info('Media record saved', {
      id: result.lastInsertRowid,
      type: media.mediaType,
      requestId: media.requestId,
    });

    return Number(result.lastInsertRowid);
  }

  /**
   * Get media records for a request
   */
  getMediaForRequest(requestId: number): MediaRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM media
      WHERE request_id = ?
      ORDER BY media_type
    `);

    const rows = stmt.all(requestId) as any[];

    return rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      mediaType: row.media_type,
      filename: row.filename,
      r2Key: row.r2_key,
      r2PublicUrl: row.r2_public_url,
      fileSize: row.file_size,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Store acknowledgment message timestamp for later deletion
   */
  updateAckMessageTs(requestId: number, messageTs: string): void {
    // Validate Slack timestamp format (e.g., "1234567890.123456")
    if (!/^\d+\.\d+$/.test(messageTs)) {
      logger.error('Invalid Slack timestamp format', { messageTs, requestId });
      throw new Error(`Invalid Slack timestamp format: ${messageTs}`);
    }

    const stmt = db.prepare('UPDATE requests SET ack_message_ts = ? WHERE id = ?');
    const result = stmt.run(messageTs, requestId);

    if (result.changes === 0) {
      logger.error('Request not found when updating ack_message_ts', { requestId });
      throw new Error(`Request not found: ${requestId}`);
    }

    logger.info('Stored acknowledgment message timestamp', { requestId, messageTs });
  }

  /**
   * Get request by ID including acknowledgment message timestamp
   */
  getRequest(requestId: number): any | undefined {
    const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
    const request = stmt.get(requestId) as any;

    logger.debug('Retrieved request', { requestId, hasAckTs: !!request?.ack_message_ts });

    return request;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stmt = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM requests
    `);

    const row = stmt.get() as any;

    return {
      pending: row.pending || 0,
      processing: row.processing || 0,
      completed: row.completed || 0,
      failed: row.failed || 0,
    };
  }

  /**
   * Map database row to QueueJob
   */
  private mapRowToJob(row: any): QueueJob {
    return {
      id: row.id,
      url: row.url,
      slackChannel: row.slack_channel,
      slackThreadTs: row.slack_thread_ts,
      slackUser: row.slack_user,
      status: row.status,
      progress: row.progress,
      currentStep: row.current_step,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }
}
