# Implementation Plan: 複数Slackワークスペース対応

**Branch**: `006-bot-slack-ws` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)

## Summary

Enable the NotebookLM Slack bot to operate across multiple Slack workspaces simultaneously through separate Node.js processes, managing independent Socket Mode connections and request routing while sharing common resources (NotebookLM account, R2 storage). Each workspace maintains its own .env configuration file, authentication tokens, database file, and browser session, with complete process isolation ensuring errors in one workspace don't affect others.

## Technical Context

**Language/Version**: Node.js 20+ with TypeScript 5.x
**Primary Dependencies**: @slack/bolt 4.5.0 (Socket Mode), better-sqlite3 12.4.1, Playwright 1.56.0, AWS SDK v3
**Storage**: SQLite database (per-workspace: `./data/bot-ws1.db`, `./data/bot-ws2.db`), Cloudflare R2 (shared object storage)
**Testing**: Vitest (unit/integration), Playwright (E2E), tsx (test scripts)
**Target Platform**: Node.js server (Linux/macOS/Windows 10+), Socket Mode Slack App (1 APP_TOKEN per process)
**Project Type**: Multiple processes (separate backend process per workspace with Slack integration)
**Performance Goals**: Handle 3-10 workspaces (separate processes), maintain existing NotebookLM processing latency
**Constraints**: Single NotebookLM account (shared), no hot reload (restart required for config changes), Socket Mode limitation (1 APP_TOKEN per process)
**Scale/Scope**: 3-10 Slack workspaces, ~2000 LOC existing codebase, environment variable-based multi-workspace architecture

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (with justified breaking change)

| Gate | Status | Notes |
|------|--------|-------|
| Simplicity | ✅ PASS | Environment variable-based config (minimal: 2 vars per workspace) vs OAuth complexity |
| Testability | ✅ PASS | All user stories independently testable with separate process test scenarios |
| Backward Compatibility | ⚠️ BREAKING (Justified) | Manual migration required (`.env` → `.env.ws1`, env var name changes) |
| Error Isolation | ✅ PASS | Separate processes ensure complete workspace isolation |
| Observability | ✅ PASS | Workspace context (team_id) recorded in database and logs |

**Post-Design Re-evaluation**: ✅ CONFIRMED (Implementation Pivot Applied)

- **Environment variable approach (Option A+)**: Avoids OAuth public endpoint requirement, maintains Socket Mode-only deployment
- **Slack API auto-fetch**: Reduces config burden from 6+ vars to 2 vars per workspace (`auth.test` endpoint)
- **Separate process architecture**: Complete isolation (no shared state), solves Socket Mode limitation (1 APP_TOKEN per process)
- **Database per workspace**: Eliminates locking issues, simplifies data management
- **Breaking change justification**: Manual migration (env file rename + var name changes) is simpler than OAuth implementation

## Project Structure

### Source Code

```
src/
├── models/
│   └── workspace.ts           # [IMPLEMENTED] Workspace types (WorkspaceConfig, SlackInstallation)
├── services/
│   ├── slack-bot.ts           # [IMPLEMENTED] Custom authorize function + workspace WebClient
│   ├── simple-queue.ts        # [IMPLEMENTED] workspace_id tracking + camelCase mapping
│   └── request-processor.ts   # [NOT CHANGED] Uses existing workspace context from request
├── lib/
│   ├── config.ts              # [NOT CHANGED] Existing validation sufficient
│   ├── database.ts            # [IMPLEMENTED] DB_PATH env var support + migration 003
│   ├── logger.ts              # [NOT CHANGED] Standard logging (no AsyncLocalStorage wrapper)
│   └── workspace-loader.ts    # [IMPLEMENTED] Env-based config + Slack API auto-fetch
└── db/migrations/
    └── 003_multi_workspace.sql # [IMPLEMENTED] slack_installations table + workspace_id column

scripts/
├── start-ws1.sh               # [IMPLEMENTED] .env.ws1 loader (Unix/Linux/macOS)
├── start-ws2.sh               # [IMPLEMENTED] .env.ws2 loader with WS2→WS1 mapping (Unix/Linux/macOS)
├── start-ws1.ps1              # [IMPLEMENTED] .env.ws1 loader (Windows)
├── start-ws2.ps1              # [IMPLEMENTED] .env.ws2 loader with WS2→WS1 mapping (Windows)
├── login-ws1.ps1              # [IMPLEMENTED] NotebookLM login for WS1 (Windows)
└── login-ws2.ps1              # [IMPLEMENTED] NotebookLM login for WS2 (Windows)

.env.ws1, .env.ws2             # [IMPLEMENTED] Per-workspace configuration files
```

**Implementation Notes**:
- AsyncLocalStorage not used (separate process architecture provides natural isolation)
- InstallationStore pattern replaced with custom authorize function
- OAuth endpoints not implemented (Socket Mode-only)

## Phase 0: Research (Completed with Implementation Pivot)

See [research.md](./research.md) for initial technical decisions. **Implementation deviated from research phase due to Socket Mode constraint discovery**:

1. ✅ **Multi-workspace Pattern**: **CHANGED** - Separate processes per workspace (not single App + OAuth) due to Socket Mode limitation
2. ✅ **Configuration**: **CHANGED** - .env files with Slack API auto-fetch (not OAuth + InstallationStore)
3. ✅ **Database Strategy**: **CHANGED** - Separate DB per workspace (not shared DB with workspace_id filtering)
4. ✅ **Error Isolation**: **CHANGED** - Process isolation (not AsyncLocalStorage)
5. ✅ **Validation**: Startup-time validation with fail-fast strategy (unchanged)

## Phase 1: Design (Completed)

Artifacts generated:

- ✅ **Data Model**: [data-model.md](./data-model.md)
  - `slack_installations` table schema
  - `requests` table extension (workspace_id column)
  - TypeScript type definitions

- ✅ **API Contracts**: [contracts/](./contracts/)
  - `installation-store-interface.ts` - Slack InstallationStore interface
  - `workspace-context.ts` - AsyncLocalStorage context contract

- ✅ **Quickstart Guide**: [quickstart.md](./quickstart.md)
  - Migration steps from single to multi-workspace
  - OAuth flow setup
  - Production deployment checklist

- ✅ **Agent Context**: Updated CLAUDE.md with multi-workspace technologies

## Phase 2: Implementation Tasks

**Not generated by this command** - use `/speckit.tasks` to generate tasks.md

Key implementation areas (preview):
1. Database migration (003_multi_workspace.sql)
2. SQLite InstallationStore implementation
3. AsyncLocalStorage workspace context
4. SlackBot service refactoring (OAuth initialization)
5. SimpleQueue workspace_id integration
6. Configuration validation updates
7. Unit + integration tests

## Notes

- **Shared Resources**: NotebookLM account and R2 bucket shared across workspaces (no isolation needed)
- **Sequential Processing**: Existing queue architecture unchanged (no parallel processing within workspace)
- **Separate Processes**: Each workspace runs in separate Node.js process with dedicated database and browser session
- **Migration Strategy**: Manual migration - rename `.env` to `.env.ws1`, update env var names (`BOT_TOKEN` → `SLACK_WS1_BOT_TOKEN`), create startup script
- **Operational Commands**:
  - Start WS1: `npm run bot:start:ws1` (runs `./scripts/start-ws1.sh`)
  - Start WS2: `npm run bot:start:ws2` (runs `./scripts/start-ws2.sh`)
  - Production: Use process manager (pm2, systemd) to manage multiple processes

## Implementation Challenges Resolved

1. **SQLite NULL Uniqueness Issue**: `UNIQUE(team_id, enterprise_id)` doesn't work with NULL - solved with DELETE-then-INSERT pattern
2. **Case Mapping Bug**: `getRequest()` returned snake_case - fixed by using `mapRowToJob()` for camelCase conversion
3. **WebClient Token Issue**: `this.app.client` used wrong token - fixed with `getClientForWorkspace()` method
4. **Env Var Isolation**: dotenv-cli loaded both `.env` and `.env.ws1` - fixed with shell scripts using `source` and `unset`
5. **Browser Session Separation**: Each workspace needs separate USER_DATA_DIR for independent NotebookLM login sessions
6. **Windows PowerShell Support**: Added cross-platform startup scripts (`.ps1` files) with robust `.env` parsing, environment variable mapping (`SLACK_WS2_*` → `SLACK_WS1_*`), and Windows-specific npm commands for both NotebookLM login and bot startup
