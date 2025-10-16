# notebooklm-sumary-maker-slack-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-15

## Active Technologies
- Node.js 20+ with TypeScript 5.x + @slack/bolt 4.5.0, better-sqlite3 12.4.1, Playwright 1.56.0, AWS SDK v3 (006-bot-slack-ws)
- SQLite database (file-based: ./data/bot.db), Cloudflare R2 for media files (006-bot-slack-ws)
- Multi-workspace Slack Bot with OAuth + InstallationStore, AsyncLocalStorage for workspace context (006-bot-slack-ws)
- TypeScript 5.3.3 + Node.js 20+ + @slack/bolt 4.5.0, better-sqlite3 12.4.1 (005-)
- SQLite (requests table requires schema change: add ack_message_ts column) (005-)

## Project Structure
```
src/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
Node.js 20+ with TypeScript 5.x: Follow standard conventions

## Recent Changes
- 006-bot-slack-ws: Added multi-workspace Slack support with OAuth + InstallationStore, AsyncLocalStorage for workspace context isolation
- 006-bot-slack-ws: Database migration 003 adds slack_installations table and workspace_id column to requests table
- 005-: Added TypeScript 5.3.3 + Node.js 20+ + @slack/bolt 4.5.0, better-sqlite3 12.4.1
- 003-url: Added Node.js 20+ / TypeScript 5.x + @slack/bolt (Slack Bot SDK)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
