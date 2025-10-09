/**
 * NotebookLM automation using Playwright
 * Handles browser initialization, authentication persistence, and UI automation
 * T013: Includes retry logic and error handling
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000, // 2 seconds
  maxDelay: 30000, // 30 seconds
};

/**
 * Sleep utility
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting ${operationName}`, { attempt, maxRetries });
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`${operationName} failed`, {
        attempt,
        maxRetries,
        error: lastError.message,
      });

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s, etc.
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        logger.info(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

export class NotebookLMAutomation {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Initialize Playwright browser with persistent context
   * This preserves authentication state across restarts
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Playwright browser', {
        headless: config.playwrightHeadless,
        userDataDir: config.userDataDir,
      });

      // Launch persistent context - preserves cookies and auth
      this.context = await chromium.launchPersistentContext(config.userDataDir, {
        headless: config.playwrightHeadless,
        args: [
          '--disable-blink-features=AutomationControlled', // Avoid bot detection
          '--disable-features=site-per-process',
        ],
        viewport: { width: 1920, height: 1080 },
        locale: 'ja-JP',
      });

      // Set default timeout to 15 minutes for long operations
      this.context.setDefaultTimeout(15 * 60 * 1000);

      // Create new page
      this.page = await this.context.newPage();

      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser', { error });
      throw error;
    }
  }

  /**
   * Get the current page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  /**
   * Get the browser context
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser context not initialized. Call initialize() first.');
    }
    return this.context;
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.page = null;
        logger.info('Browser closed successfully');
      }
    } catch (error) {
      logger.error('Error during cleanup', { error });
      throw error;
    }
  }

  /**
   * Create a new notebook
   * T008: Navigate to NotebookLM and create new notebook
   * T013: With retry logic
   */
  async createNotebook(): Promise<void> {
    return withRetry(async () => {
      const page = this.getPage();

      logger.info('Navigating to NotebookLM home page');
      await page.goto('https://notebooklm.google.com', { waitUntil: 'domcontentloaded' });

      // Wait for create button to appear
      await page.waitForSelector('button[aria-label="ノートブックを新規作成"]', { timeout: 10000 });

      logger.info('Clicking "ノートブックを新規作成" button');
      // Click the create new notebook button by aria-label
      await page.click('button[aria-label="ノートブックを新規作成"]');

      // Wait for notebook page to load
      await page.waitForTimeout(3000);
      logger.info('New notebook created successfully');
    }, 'Create Notebook');
  }

  /**
   * Add URL source to the current notebook
   * T009: Implement URL source addition
   * T013: With retry logic
   *
   * Note: After creating a new notebook, the source dialog appears automatically
   */
  async addUrlSource(url: string): Promise<void> {
    return withRetry(async () => {
      const page = this.getPage();

      logger.info('Adding URL source', { url });

      // Wait for source dialog to appear (appears automatically after notebook creation)
      logger.info('Waiting for source dialog');
      await page.waitForSelector('text="ウェブサイト"', { timeout: 10000 });

      // Click "ウェブサイト" option
      logger.info('Selecting "ウェブサイト" option');
      await page.click('text="ウェブサイト"');

      // Wait for URL input form to appear
      await page.waitForTimeout(2000);
      await page.waitForSelector('textarea.mat-mdc-input-element', { timeout: 10000 });

      // Enter URL
      logger.info('Entering URL');
      await page.fill('textarea.mat-mdc-input-element', url);

      // Click insert button
      logger.info('Clicking "挿入" button');
      await page.click('button:has-text("挿入")');

      // Wait for source to be processed
      logger.info('Waiting for source to be processed');
      await page.waitForSelector('text="1 ソース"', { timeout: 60000 });

      logger.info('URL source added successfully', { url });
    }, `Add URL Source: ${url}`);
  }

  /**
   * Generate Audio Overview
   * T010: Implement Audio Overview generation
   * T013: With retry logic (single attempt due to long operation)
   */
  async generateAudioOverview(): Promise<void> {
    return withRetry(async () => {
      const page = this.getPage();

      logger.info('Generating Audio Overview');

      // Click "音声解説" button in Studio panel (right side)
      // Use text selector to find the Studio panel button (not chat area button)
      await page.locator('text="音声解説"').first().click();

      logger.info('Audio Overview generation started');

      // Wait for generation status message to appear (with partial match for dots/spaces)
      await page.waitForSelector(':text("音声解説を生成しています")', { timeout: 10000 });

      // Wait for generation to complete (look for download/play button or completion message)
      // This is a long-running operation (3-8 minutes typically)
      await page.waitForSelector('text="ダウンロード"', { timeout: 15 * 60 * 1000 });

      logger.info('Audio Overview generation completed');
    }, 'Generate Audio Overview', 1); // Only 1 retry for long operations
  }

  /**
   * Generate Video Overview
   * T011: Implement Video Overview generation
   * T013: With retry logic (single attempt due to long operation)
   */
  async generateVideoOverview(): Promise<void> {
    return withRetry(async () => {
      const page = this.getPage();

      logger.info('Generating Video Overview');

      // Click "動画解説" button in Studio panel (right side)
      // Use text selector to find the Studio panel button (not chat area button)
      await page.locator('text="動画解説"').first().click();

      logger.info('Video Overview generation started');

      // Wait for generation status message to appear (with partial match for dots/spaces)
      await page.waitForSelector(':text("動画解説を生成しています")', { timeout: 10000 });

      // Wait for generation to complete (5-15 minutes typically)
      await page.waitForSelector('text="ダウンロード"', { timeout: 15 * 60 * 1000 });

      logger.info('Video Overview generation completed');
    }, 'Generate Video Overview', 1); // Only 1 retry for long operations
  }

  /**
   * Download generated media (audio or video)
   * Helper method for retrieving generated content
   */
  async downloadMedia(type: 'audio' | 'video'): Promise<Buffer> {
    const page = this.getPage();

    try {
      logger.info('Downloading media', { type });

      // Wait for and click download button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('text="ダウンロード"'),
      ]);

      // Save to buffer
      const path = await download.path();
      if (!path) {
        throw new Error('Download failed - no file path');
      }

      const fs = await import('fs/promises');
      const buffer = await fs.readFile(path);

      logger.info('Media downloaded successfully', {
        type,
        size: buffer.length,
        filename: download.suggestedFilename(),
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download media', { type, error });
      throw error;
    }
  }
}
