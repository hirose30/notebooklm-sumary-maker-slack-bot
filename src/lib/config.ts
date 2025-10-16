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

  // Slack settings (env-based multi-workspace)
  slackSigningSecret: string;
  slackAppToken?: string; // Optional: Fallback for Socket Mode if SLACK_WS1_APP_TOKEN not set

  // Cloudflare R2 settings
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

/**
 * Validate environment variables
 * Fail-fast if required configuration is missing or invalid
 */
function validateConfig(): void {
  const errors: string[] = [];

  // Required environment variables
  const requiredEnvVars = {
    SLACK_SIGNING_SECRET: 'Slack app signing secret',
    R2_ACCOUNT_ID: 'Cloudflare R2 account ID',
    R2_ACCESS_KEY_ID: 'Cloudflare R2 access key ID',
    R2_SECRET_ACCESS_KEY: 'Cloudflare R2 secret access key',
    R2_BUCKET_NAME: 'Cloudflare R2 bucket name',
    R2_PUBLIC_URL: 'Cloudflare R2 public URL',
    NOTEBOOKLM_EMAIL: 'NotebookLM account email',
  };

  // Check required env vars
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key] || process.env[key]!.trim() === '') {
      errors.push(`Missing required environment variable: ${key} (${description})`);
    }
  }

  // Validate URL formats
  if (process.env.R2_PUBLIC_URL && !process.env.R2_PUBLIC_URL.startsWith('https://')) {
    errors.push('R2_PUBLIC_URL must start with https://');
  }

  // Display errors and exit if any validation failed
  if (errors.length > 0) {
    logger.error('Configuration validation failed', { errors });
    console.error('\n=== Configuration Validation Errors ===');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error('======================================\n');
    console.error('Example .env file:\n');
    console.error('SLACK_SIGNING_SECRET=1234567890abcdefghijklmnopqrst');
    console.error('SLACK_WS1_BOT_TOKEN=xoxb-...');
    console.error('SLACK_WS1_APP_TOKEN=xapp-...');
    console.error('R2_ACCOUNT_ID=your-account-id');
    console.error('R2_ACCESS_KEY_ID=your-access-key');
    console.error('R2_SECRET_ACCESS_KEY=your-secret-key');
    console.error('R2_BUCKET_NAME=your-bucket-name');
    console.error('R2_PUBLIC_URL=https://pub-....r2.dev');
    console.error('NOTEBOOKLM_EMAIL=your-email@example.com');
    console.error('\nNote: TEAM_ID, TEAM_NAME, BOT_ID, BOT_USER_ID are auto-fetched from Slack API\n');
    process.exit(1);
  }

  logger.info('Configuration validation passed');
}

function loadConfig(): Config {
  // Validate before loading
  validateConfig();

  const config: Config = {
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS === 'true',
    notebooklmEmail: process.env.NOTEBOOKLM_EMAIL!,
    userDataDir: process.env.USER_DATA_DIR || './user-data',
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET!,
    slackAppToken: process.env.SLACK_APP_TOKEN, // Optional fallback for Socket Mode
    r2AccountId: process.env.R2_ACCOUNT_ID!,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID!,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    r2BucketName: process.env.R2_BUCKET_NAME!,
    r2PublicUrl: process.env.R2_PUBLIC_URL!,
  };

  logger.info('Configuration loaded', {
    headless: config.playwrightHeadless,
    userDataDir: config.userDataDir,
    hasSlackSigningSecret: !!config.slackSigningSecret,
    hasSlackAppToken: !!config.slackAppToken,
    hasR2Config: !!config.r2AccountId && !!config.r2AccessKeyId,
  });

  return config;
}

export const config = loadConfig();
