/**
 * Main entry point for the NotebookLM Slack Bot
 */

import 'dotenv/config';
import { SlackBot } from './services/slack-bot.js';
import { logger, LogLevel } from './lib/logger.js';
import { loadWorkspacesFromEnv } from './lib/workspace-loader.js';

async function main() {
  // T013: Log startup message with current log level
  const logLevelName = ['ERROR', 'WARN', 'INFO', 'DEBUG'][logger.getLogLevel()];

  logger.info('╔═══════════════════════════════════════╗');
  logger.info('║  NotebookLM Slack Bot Starting...   ║');
  logger.info('╚═══════════════════════════════════════╝');
  logger.info('');
  logger.info(`Log level: ${logLevelName} (set LOG_LEVEL env var to change)`);
  logger.info('');

  // Load workspace configurations from environment variables
  logger.info('Loading workspace configurations...');
  const { workspaces, workspaceKeyMap, primaryAppToken } = await loadWorkspacesFromEnv();
  logger.info('');

  const bot = new SlackBot(workspaceKeyMap); // T025: Pass workspace key mapping

  try {
    await bot.start();

    logger.info('');
    logger.info('✓ Bot is now running and processing requests');
    logger.info('✓ Mention the bot in Slack with a URL to start processing');
    logger.info('');
    logger.info('Press Ctrl+C to stop');
    logger.info('');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n\nReceived SIGINT, shutting down gracefully...');
  // TODO: Stop processor and close database
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\n\nReceived SIGTERM, shutting down gracefully...');
  // TODO: Stop processor and close database
  process.exit(0);
});

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
