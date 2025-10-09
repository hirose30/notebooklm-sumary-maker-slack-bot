/**
 * Manual Slack integration test
 * Tests basic Slack bot connectivity and event handling
 */

import { SlackBot } from '../src/services/slack-bot.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  logger.info('=== Starting Slack Bot Test ===');
  logger.info('This script will:');
  logger.info('1. Connect to Slack workspace');
  logger.info('2. Listen for @mentions');
  logger.info('3. Extract URLs from messages');
  logger.info('4. Reply with acknowledgment');
  logger.info('');
  logger.info('To test:');
  logger.info('1. Mention the bot in a Slack channel with a URL');
  logger.info('2. Example: @bot https://example.com/article');
  logger.info('3. Bot should acknowledge and extract the URL');
  logger.info('');
  logger.info('Press Ctrl+C to stop the bot');
  logger.info('');

  const bot = new SlackBot();

  try {
    await bot.start();
    logger.info('✓ Bot connected successfully');
    logger.info('Listening for mentions...');

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    logger.error('Test failed', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
