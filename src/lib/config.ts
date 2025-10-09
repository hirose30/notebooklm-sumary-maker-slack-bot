/**
 * Environment configuration management
 */

import { logger } from './logger.js';

export interface Config {
  // Playwright settings
  playwrightHeadless: boolean;

  // NotebookLM settings
  notebooklmEmail: string;

  // User data directory for browser auth persistence
  userDataDir: string;
}

function loadConfig(): Config {
  const config: Config = {
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS === 'true',
    notebooklmEmail: process.env.NOTEBOOKLM_EMAIL || '',
    userDataDir: process.env.USER_DATA_DIR || './user-data',
  };

  logger.info('Configuration loaded', {
    headless: config.playwrightHeadless,
    userDataDir: config.userDataDir,
  });

  return config;
}

export const config = loadConfig();
