# notebooklm-sumary-maker-slack-bot Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-18

## Active Technologies
- Node.js 20+ with TypeScript 5.x + @slack/bolt 4.5.0, better-sqlite3 12.4.1, Playwright 1.56.0, AWS SDK v3 (006-bot-slack-ws)
- SQLite database (file-based: ./data/bot.db), Cloudflare R2 for media files (006-bot-slack-ws)
- Multi-workspace Slack Bot with OAuth + InstallationStore, AsyncLocalStorage for workspace context (006-bot-slack-ws)
- Custom logger with file transport, log level filtering (ERROR/WARN/INFO/DEBUG), daily rotation (007-log-sqlite-input)
- File-based logging to ./logs/ directory with workspace-specific files (007-log-sqlite-input)
- TypeScript 5.3.3 + Node.js 20+ + @slack/bolt 4.5.0, better-sqlite3 12.4.1 (005-)
- SQLite (requests table requires schema change: add ack_message_ts column) (005-)

## Project Structure
```
src/
├── lib/
│   ├── logger.ts          # Custom logger with log level filtering
│   └── log-transport.ts   # File transport with daily rotation
tests/
logs/                      # Runtime log files (workspace-specific, daily rotation)
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
Node.js 20+ with TypeScript 5.x: Follow standard conventions

## Recent Changes
- 007-log-sqlite-input: Enhanced logging system with configurable log levels (LOG_LEVEL env var), file output to ./logs/ with workspace identifiers, daily rotation, SQLite query filtering
- 007-log-sqlite-input: Log files named {workspace}-{YYYY-MM-DD}.log (e.g., ws1-2025-10-18.log, system-2025-10-18.log), indefinite retention
- 006-bot-slack-ws: Added multi-workspace Slack support with OAuth + InstallationStore, AsyncLocalStorage for workspace context isolation
- 006-bot-slack-ws: Database migration 003 adds slack_installations table and workspace_id column to requests table
- 005-: Added TypeScript 5.3.3 + Node.js 20+ + @slack/bolt 4.5.0, better-sqlite3 12.4.1
- 003-url: Added Node.js 20+ / TypeScript 5.x + @slack/bolt (Slack Bot SDK)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
