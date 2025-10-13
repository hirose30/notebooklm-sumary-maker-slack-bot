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

  // Slack settings
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;

  // Cloudflare R2 settings
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

function loadConfig(): Config {
  const config: Config = {
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS === 'true',
    notebooklmEmail: process.env.NOTEBOOKLM_EMAIL || '',
    userDataDir: process.env.USER_DATA_DIR || './user-data',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackAppToken: process.env.SLACK_APP_TOKEN || '',
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
    r2AccountId: process.env.R2_ACCOUNT_ID || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2BucketName: process.env.R2_BUCKET_NAME || '',
    r2PublicUrl: process.env.R2_PUBLIC_URL || '',
  };

  logger.info('Configuration loaded', {
    headless: config.playwrightHeadless,
    userDataDir: config.userDataDir,
    hasSlackBotToken: !!config.slackBotToken,
    hasSlackAppToken: !!config.slackAppToken,
    hasR2Config: !!config.r2AccountId && !!config.r2AccessKeyId,
  });

  return config;
}

export const config = loadConfig();
