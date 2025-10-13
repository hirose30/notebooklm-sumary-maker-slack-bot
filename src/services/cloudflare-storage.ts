/**
 * Cloudflare R2 storage service
 * Handles media file upload and public URL generation
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class CloudflareStorage {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    // Initialize S3 client with R2 endpoint
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });

    this.bucketName = config.r2BucketName;

    logger.info('Cloudflare R2 client initialized', {
      bucket: this.bucketName,
      hasCredentials: !!config.r2AccessKeyId,
    });
  }

  /**
   * Upload media buffer to R2
   * @param buffer - Media file buffer
   * @param filename - Original filename
   * @param contentType - MIME type
   * @returns Object key in R2
   */
  async uploadMedia(
    buffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    // Generate unique key with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `media/${timestamp}-${sanitizedFilename}`;

    try {
      logger.info('Uploading to R2', { key, size: buffer.length, contentType });

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      logger.info('Upload successful', { key });

      return key;
    } catch (error) {
      logger.error('Failed to upload to R2', { error, key });
      throw error;
    }
  }

  /**
   * Generate public URL with 7-day expiration
   * @param key - R2 object key
   * @returns Signed URL valid for 7 days
   */
  async getPublicUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      // Generate signed URL with 7-day expiration
      const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated public URL', {
        key,
        expiresIn: '7 days',
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate public URL', { error, key });
      throw error;
    }
  }

  /**
   * Download media from URL and upload to R2
   * @param sourceUrl - URL to download from
   * @param filename - Original filename
   * @param contentType - MIME type
   * @returns Public URL for the uploaded file
   */
  async downloadAndUpload(
    sourceUrl: string,
    filename: string,
    contentType: string
  ): Promise<string> {
    try {
      logger.info('Downloading media from URL', { sourceUrl });

      // Download media file
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info('Downloaded media', { size: buffer.length });

      // Upload to R2
      const key = await this.uploadMedia(buffer, filename, contentType);

      // Generate public URL
      const publicUrl = await this.getPublicUrl(key);

      return publicUrl;
    } catch (error) {
      logger.error('Failed to download and upload media', { error, sourceUrl });
      throw error;
    }
  }
}
