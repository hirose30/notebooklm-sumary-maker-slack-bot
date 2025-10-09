# Implementation Plan: Slack NotebookLM Pro 統合ボット (軽量版)

**Branch**: `001-slack-url-notebooklm` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-slack-url-notebooklm/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Lightweight Slack bot that automatically generates audio and video summaries from URLs shared in threads using NotebookLM Pro. The solution uses SQLite for simple data persistence, Playwright for UI automation to access NotebookLM Pro features not available via API, and Cloudflare R2 for media storage with shareable links posted back to Slack threads.

## Technical Context

**Language/Version**: Node.js 20+ with TypeScript 5.x
**Primary Dependencies**: @slack/bolt, Playwright, AWS SDK v3 (for R2), SQLite3
**Storage**: SQLite for request tracking and simple queue, Cloudflare R2 for media files
**Testing**: Vitest for unit tests, Playwright Test for E2E
**Target Platform**: Self-hosted or lightweight VPS (long-running process support required)
**Project Type**: single - Lightweight bot service with browser automation
**Performance Goals**: Process single URL within 15 minutes, serial processing (one request at a time)
**Constraints**: <15 min processing time per request, 7-day media retention, single NotebookLM Pro account
**Scale/Scope**: Serial request processing, SQLite-based simple queue, ~100 users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since no specific constitution principles are defined in the constitution.md file (template placeholders only), the following general engineering principles will be applied:

- ✅ **Simplicity First**: SQLite for data, simple queue instead of complex infrastructure
- ✅ **Minimal Dependencies**: Only essential packages (@slack/bolt, Playwright, AWS SDK, SQLite3)
- ✅ **Modular Design**: Separate concerns (Slack integration, NotebookLM automation, storage)
- ✅ **Error Handling**: Simple error messages as specified in requirements
- ✅ **Observability**: Basic logging for debugging UI automation issues
- ⚠️ **Serial Processing**: One request at a time due to single NotebookLM account (acceptable for scale)

## Project Structure

### Documentation (this feature)

```
specs/001-slack-url-notebooklm/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (heavy version - PostgreSQL)
├── data-model-lite.md   # Lightweight SQLite version (CURRENT - adopted)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── db/
│   ├── schema.ts                # SQLite schema definitions
│   └── migrations/              # Database migrations
│       └── 001_initial.sql      # Initial tables (requests, media)
├── services/
│   ├── slack-bot.ts             # Slack event handler (@slack/bolt)
│   ├── url-extractor.ts         # URL extraction from threads
│   ├── notebooklm-automation.ts # Playwright automation for NotebookLM
│   ├── cloudflare-storage.ts    # R2 upload and URL generation
│   ├── simple-queue.ts          # SQLite-based job queue
│   └── request-processor.ts     # Main orchestration service
├── cli/
│   └── bot-manager.ts           # CLI for starting/stopping bot
└── lib/
    ├── config.ts                # Configuration management
    ├── database.ts              # SQLite connection and helpers
    └── logger.ts                # Logging utility

tests/
├── integration/
│   ├── bot-flow.test.ts         # End-to-end bot flow
│   └── notebooklm.test.ts       # UI automation tests
└── unit/
    ├── url-extractor.test.ts    # URL extraction logic
    ├── simple-queue.test.ts      # Queue operations
    └── storage.test.ts          # R2 storage operations
```

**Structure Decision**: Single project structure selected as this is a lightweight standalone bot service. All components (Slack integration, browser automation, storage) work together as a cohesive unit with minimal dependencies.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| UI automation dependency | NotebookLM Pro has no public API | Manual processing would defeat automation purpose |
| Browser automation complexity | Required for NotebookLM access | No API available, browser automation is the only option |
