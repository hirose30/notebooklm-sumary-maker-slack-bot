/**
 * NotebookLM automation using Playwright
 * Handles browser initialization, authentication persistence, and UI automation
 * T013: Includes retry logic and error handling
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { UISelectorFactory } from './ui-selector-factory.js';
import type { UIVersion } from '../models/ui-version.js';
import type { UISelector, InfographicResult } from '../lib/ui-selectors/types.js';

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
  private userDataDir: string;
  private uiVersion: UIVersion;
  private selectorFactory: UISelectorFactory;

  /**
   * Constructor
   * @param userDataDir - Optional user data directory path for browser auth persistence
   *                      Defaults to config.userDataDir if not provided
   * @param uiVersion - Optional UI version ('old' | 'new')
   *                    Defaults to 'old' if not provided (FR-008)
   */
  constructor(userDataDir?: string, uiVersion?: UIVersion) {
    this.userDataDir = userDataDir || config.userDataDir;
    this.uiVersion = uiVersion || 'old'; // FR-008: デフォルトは旧UI
    this.selectorFactory = new UISelectorFactory();

    // T017: Log UI version being used (FR-009)
    logger.info('NotebookLMAutomation initialized', {
      userDataDir: this.userDataDir,
      uiVersion: this.uiVersion,
      source: uiVersion ? 'explicit' : 'default',
    });
  }

  /**
   * Initialize Playwright browser with persistent context
   * This preserves authentication state across restarts
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Playwright browser', {
        headless: config.playwrightHeadless,
        userDataDir: this.userDataDir,
      });

      // Launch persistent context - preserves cookies and auth
      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: config.playwrightHeadless,
        args: [
          '--disable-blink-features=AutomationControlled', // Avoid bot detection
          '--disable-features=site-per-process',
        ],
        viewport: { width: 1920, height: 1080 },
        locale: 'ja-JP',
        // Additional options to avoid headless detection
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      // Set default timeout to 15 minutes for long operations
      this.context.setDefaultTimeout(30 * 60 * 1000); // 30 minutes for testing

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
   * Get UI selectors for the current UI version
   * T015: Helper method to get version-specific selectors
   */
  private getSelectors(): UISelector {
    try {
      return this.selectorFactory.getSelectors(this.uiVersion);
    } catch (error) {
      // T018: FR-010, FR-011 - エラーハンドリング
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get UI selectors', {
        uiVersion: this.uiVersion,
        error: errorMessage,
      });

      throw new Error(
        `UIバージョン '${this.uiVersion}' のセレクタ取得に失敗しました。\n` +
        `設定ファイルのNOTEBOOKLM_UI_VERSIONを確認してください。\n` +
        `エラー: ${errorMessage}`
      );
    }
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
   * T016: Uses UI version-specific selectors from getSelectors()
   */
  async createNotebook(): Promise<void> {
    // T017: Log UI version for this operation (FR-009)
    logger.info('Creating notebook', { uiVersion: this.uiVersion });

    return withRetry(async () => {
      const page = this.getPage();
      const selectors = this.getSelectors();

      try {
        logger.info('Navigating to NotebookLM home page');
        await page.goto('https://notebooklm.google.com', { waitUntil: 'domcontentloaded' });

        // T016: Use UI version-specific selector
        // Wait for create button to appear
        await page.waitForSelector(selectors.newProject, { timeout: 10000 });

        logger.info('Clicking "ノートブックを新規作成" button', {
          selector: selectors.newProject,
        });
        // Click the create new notebook button
        await page.click(selectors.newProject);

        // Wait for notebook page to load
        await page.waitForTimeout(3000);
        logger.info('New notebook created successfully', { uiVersion: this.uiVersion });
      } catch (error) {
        // T018: FR-010, FR-011 - UI操作失敗時のエラーハンドリング
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('UI interaction failed during notebook creation', {
          uiVersion: this.uiVersion,
          error: errorMessage,
        });

        throw new Error(
          `UIバージョン '${this.uiVersion}' でのノートブック作成に失敗しました。\n` +
          `設定ファイルのNOTEBOOKLM_UI_VERSIONがアカウントのUIバージョンと一致しているか確認してください。\n` +
          `エラー: ${errorMessage}`
        );
      }
    }, 'Create Notebook');
  }

  /**
   * Add URL source to the current notebook
   * T009: Implement URL source addition
   * T013: With retry logic
   * T016: Uses UI version-specific selectors from getSelectors()
   *
   * Note: After creating a new notebook, the source dialog appears automatically
   */
  async addUrlSource(url: string): Promise<void> {
    // T017: Log UI version for this operation (FR-009)
    logger.info('Adding URL source', { url, uiVersion: this.uiVersion });

    return withRetry(async () => {
      const page = this.getPage();
      const selectors = this.getSelectors();

      try {
        // Wait for source dialog to appear (appears automatically after notebook creation)
        logger.info('Waiting for source dialog');
        await page.waitForSelector(selectors.addSource, { timeout: 10000 });

        // Click "ウェブサイト" option
        logger.info('Selecting "ウェブサイト" option', {
          selector: selectors.addSource,
        });
        await page.click(selectors.addSource);

        // Wait for URL input form to appear
        await page.waitForTimeout(2000);
        // T016: Use UI version-specific selector
        await page.waitForSelector(selectors.urlInput, { timeout: 10000 });

        // Click to focus the input field first (Material Design forms need explicit focus)
        logger.info('Clicking URL input to focus', {
          selector: selectors.urlInput,
        });
        await page.click(selectors.urlInput);
        await page.waitForTimeout(500); // Wait for focus to be applied

        // Enter URL
        logger.info('Entering URL', {
          selector: selectors.urlInput,
        });
        await page.fill(selectors.urlInput, url);

        // Click insert button
        logger.info('Clicking "挿入" button', {
          selector: selectors.saveButton,
        });
        // T016: Use UI version-specific selector
        await page.click(selectors.saveButton);

        // Wait for source to be processed
        logger.info('Waiting for source to be processed', {
          selector: selectors.summaryArea,
        });
        await page.waitForSelector(selectors.summaryArea, { timeout: 60000 });

        logger.info('URL source added successfully', { url, uiVersion: this.uiVersion });
      } catch (error) {
        // T018: FR-010, FR-011 - UI操作失敗時のエラーハンドリング
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('UI interaction failed during URL source addition', {
          uiVersion: this.uiVersion,
          url,
          error: errorMessage,
        });

        throw new Error(
          `UIバージョン '${this.uiVersion}' でのURLソース追加に失敗しました。\n` +
          `設定ファイルのNOTEBOOKLM_UI_VERSIONがアカウントのUIバージョンと一致しているか確認してください。\n` +
          `URL: ${url}\n` +
          `エラー: ${errorMessage}`
        );
      }
    }, `Add URL Source: ${url}`);
  }

  /**
   * Generate Audio Overview
   * T010: Implement Audio Overview generation
   * T013: With retry logic (single attempt due to long operation)
   * T016: Uses UI version-specific selectors from getSelectors()
   */
  async generateAudioOverview(): Promise<void> {
    return withRetry(async () => {
      const page = this.getPage();
      const selectors = this.getSelectors();

      logger.info('Generating Audio Overview', { uiVersion: this.uiVersion });

      // Click "音声解説" button in Studio panel (right side)
      // T016: Use UI version-specific selector
      await page.locator(selectors.generateNotebook).click();

      logger.info('Audio Overview generation started');

      // Wait for generation status message to appear
      await page.waitForSelector(':text("音声解説を生成しています")', { timeout: 10000 });
      logger.info('Generation in progress...');

      // Wait for generation to complete by detecting when the "generating" message disappears
      // This is a long-running operation (15+ minutes typically)
      await page.waitForSelector(':text("音声解説を生成しています")', {
        state: 'hidden',
        timeout: 30 * 60 * 1000
      });
      logger.info('Generation message disappeared, waiting for artifact card...');

      // Wait a moment for the artifact card to appear
      await page.waitForTimeout(2000);

      // Verify artifact card appeared
      const audioCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.blue)').count();
      logger.info(`Audio artifact cards found: ${audioCards}`);

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
      // Use 'green' class to target Studio panel button (not chat area button)
      await page.locator('div.green.create-artifact-button-container:has-text("動画解説")').click();

      logger.info('Video Overview generation started');

      // Wait for generation status message to appear
      await page.waitForSelector(':text("動画解説を生成しています")', { timeout: 10000 });
      logger.info('Generation in progress...');

      // Wait for generation to complete by detecting when the "generating" message disappears
      // Video generation is typically faster than audio (seconds to minutes)
      await page.waitForSelector(':text("動画解説を生成しています")', {
        state: 'hidden',
        timeout: 30 * 60 * 1000
      });
      logger.info('Generation message disappeared, waiting for artifact card...');

      // Wait a moment for the artifact card to appear
      await page.waitForTimeout(2000);

      // Verify artifact card appeared
      const videoCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.green)').count();
      logger.info(`Video artifact cards found: ${videoCards}`);

      logger.info('Video Overview generation completed');
    }, 'Generate Video Overview', 1); // Only 1 retry for long operations
  }

  /**
   * Detect Infographic
   * T008: Implement infographic detection
   * Uses selector: button.artifact-button-content:has(mat-icon.artifact-icon.pink)
   * FR-001: Detect infographic availability after generation
   */
  async detectInfographic(): Promise<InfographicResult> {
    const page = this.getPage();

    try {
      logger.info('Detecting infographic...');

      // Find all infographic artifact cards (pink icon)
      const infographicCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.pink)').all();
      const count = infographicCards.length;

      if (count === 0) {
        logger.info('Infographic not detected');
        return { detected: false };
      }

      // T008: Log INFO when multiple detected (DOM順で最初のみ使用)
      if (count > 1) {
        logger.info(`Multiple infographics detected (count: ${count}), using first one (DOM order)`);
      }

      logger.info('Infographic detected', { count });
      return {
        detected: true,
        count,
      };
    } catch (error) {
      logger.error('Failed to detect infographic', { error });
      return { detected: false };
    }
  }

  /**
   * Generate both Audio and Video Overviews in parallel
   * This is more efficient than sequential generation
   * T016: Uses UI version-specific selectors from getSelectors()
   * FR-008: Individual error handling - continues even if some artifacts fail
   */
  async generateBothOverviews(): Promise<void> {
    const page = this.getPage();
    const selectors = this.getSelectors();

    logger.info('Generating Audio, Video, and Infographic in parallel', {
      uiVersion: this.uiVersion,
    });

    // Click all three buttons
    // T016: Use UI version-specific selector for audio
    await page.locator(selectors.generateNotebook).click();
    logger.info('Audio Overview generation started');

    // Video button
    await page.locator('div.green.create-artifact-button-container:has-text("動画解説")').click();
    logger.info('Video Overview generation started');

    // Infographic button (follows same pattern as audio/video)
    await page.locator('div.pink.create-artifact-button-container:has-text("インフォグラフィック")').click();
    logger.info('Infographic generation started');

    // Wait for all three generation status messages to appear (with individual try-catch)
    try {
      await page.waitForSelector(':text("音声解説を生成しています")', { timeout: 10000 });
    } catch (error) {
      logger.warn('Audio generation status message not found - may have failed to start');
    }

    try {
      await page.waitForSelector(':text("動画解説を生成しています")', { timeout: 10000 });
    } catch (error) {
      logger.warn('Video generation status message not found - may have failed to start');
    }

    // Note: Infographic may not have a visible "generating" message, so we skip waiting for it
    logger.info('All generations in progress...');

    // Wait for all to complete by detecting when "generating" messages disappear
    // Use Promise.allSettled to handle individual failures
    logger.info('Waiting for all generations to complete (may take several minutes)...');

    const results = await Promise.allSettled([
      // Wait for audio generation to complete or error
      page.waitForSelector(':text("音声解説を生成しています")', {
        state: 'hidden',
        timeout: 30 * 60 * 1000
      }).then(() => ({ type: 'audio', success: true }))
        .catch((error) => {
          logger.warn('Audio generation may have failed or timed out', { error: error.message });
          return { type: 'audio', success: false, error: error.message };
        }),

      // Wait for video generation to complete or error
      page.waitForSelector(':text("動画解説を生成しています")', {
        state: 'hidden',
        timeout: 30 * 60 * 1000
      }).then(() => ({ type: 'video', success: true }))
        .catch((error) => {
          logger.warn('Video generation may have failed or timed out', { error: error.message });
          return { type: 'video', success: false, error: error.message };
        }),
    ]);

    // Log results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value.success) {
          logger.info(`${value.type} generation message disappeared`);
        } else {
          logger.warn(`${value.type} generation failed`, { error: (value as any).error });
        }
      } else {
        logger.error('Generation promise rejected unexpectedly', { error: result.reason });
      }
    });

    // Wait a moment for artifact cards to appear
    await page.waitForTimeout(2000);

    // Verify all artifact cards appeared
    const audioCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.blue)').count();
    const videoCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.green)').count();
    const infographicCards = await page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.pink)').count();
    logger.info(`Audio artifact cards found: ${audioCards}`);
    logger.info(`Video artifact cards found: ${videoCards}`);
    logger.info(`Infographic artifact cards found: ${infographicCards}`);

    logger.info('Audio, Video, and Infographic generation completed (with possible partial failures)');
  }

  /**
   * Alias for generateBothOverviews() - more accurate name since it handles all three artifacts
   * T010: Create generateAllOverviews() method for clarity
   */
  async generateAllOverviews(): Promise<void> {
    return this.generateBothOverviews();
  }

  /**
   * Download generated infographic (PNG file)
   * T009: Infographic download using hamburger menu → Download pattern
   */
  async downloadInfographic(): Promise<Buffer> {
    const page = this.getPage();

    try {
      logger.info('Downloading infographic');

      // Find infographic card using pink icon (Phase 0 verified)
      const artifactCard = page.locator('button.artifact-button-content:has(mat-icon.artifact-icon.pink)').first();

      // Click hamburger menu (more_vert) within that specific card
      await artifactCard.locator('mat-icon:text("more_vert")').click();

      // Wait a moment for menu to expand
      await page.waitForTimeout(500);

      // Wait for and click download button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('text="ダウンロード"'),
      ]);

      // Save to buffer
      const path = await download.path();
      if (!path) {
        throw new Error('Infographic download failed - no file path');
      }

      const fs = await import('fs/promises');
      const buffer = await fs.readFile(path);

      logger.info('Infographic downloaded successfully', {
        size: buffer.length,
        filename: download.suggestedFilename(),
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download infographic', { error });
      throw error;
    }
  }

  /**
   * Download generated media (audio, video, or infographic)
   * T009: Extended to support 'infographic' type
   * Helper method for retrieving generated content
   */
  async downloadMedia(type: 'audio' | 'video' | 'infographic'): Promise<Buffer> {
    const page = this.getPage();

    try {
      logger.info('Downloading media', { type });

      // Find the correct artifact card based on type
      // Audio cards have blue icon, video cards have green icon, infographic cards have pink icon
      const iconClass = type === 'audio' ? 'blue' : type === 'video' ? 'green' : 'pink';
      const artifactCard = page.locator(`button.artifact-button-content:has(mat-icon.artifact-icon.${iconClass})`).first();

      // Click hamburger menu (more_vert) within that specific card
      // The download button is hidden until the menu is expanded
      await artifactCard.locator('mat-icon:text("more_vert")').click();

      // Wait a moment for menu to expand
      await page.waitForTimeout(500);

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
