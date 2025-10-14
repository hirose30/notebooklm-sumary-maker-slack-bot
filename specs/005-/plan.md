# Implementation Plan: Slack メッセージクリーンアップと通知改善

**Branch**: `005-` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature implements two key improvements to Slack message handling:
1. **Message cleanup**: Delete acknowledgment messages when processing completes to maintain clean conversation history
2. **Channel broadcast**: Always use `reply_broadcast: true` for completion messages so all channel members see results in the main timeline

Technical approach: Extend database schema to store acknowledgment message timestamps, modify SlackBot to use chat.delete API, and ensure all completion messages use reply_broadcast flag.

## Technical Context

**Language/Version**: TypeScript 5.3.3 + Node.js 20+
**Primary Dependencies**: @slack/bolt 4.5.0, better-sqlite3 12.4.1
**Storage**: SQLite (requests table requires schema change: add ack_message_ts column)
**Testing**: Manual Slack testing (no automated test infrastructure)
**Target Platform**: Cross-platform (Mac/Windows/Linux) Node.js server
**Project Type**: Single project (Slack bot backend)
**Performance Goals**: <3s message operations, reliable message deletion
**Constraints**: Slack API rate limits, message deletion requires chat:write scope
**Scale/Scope**: Single bot instance, 1-10 concurrent requests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: Constitution template not populated - using default evaluation

**Default Gates**:
- ✅ No new external services required (uses existing Slack API)
- ✅ No new dependencies required (uses @slack/bolt)
- ✅ Changes are isolated to existing SlackBot service
- ✅ Database schema change is additive (no breaking changes)
- ✅ Feature can be tested manually via Slack
- ⚠️ No automated tests (consistent with existing project - manual Slack testing only)

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── lib/
│   └── database.ts          # Modified: Add ack_message_ts column to schema
├── services/
│   ├── slack-bot.ts         # Modified: Store ack_message_ts, delete messages, use reply_broadcast
│   ├── simple-queue.ts      # Read: Check database methods
│   └── request-processor.ts # Read: Understand completion flow
└── index.ts

data/
└── bot.db                   # Modified: Schema migration required
```

**Structure Decision**: Single project structure. All changes are contained within the existing `src/services/slack-bot.ts` and `src/lib/database.ts`. No new files required - this is a modification to existing message handling behavior.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Feature fits within existing architecture and follows current patterns.

---

## Phase 0: Research (Complete)

**Output**: [research.md](./research.md)

**Summary**: Documented technical decisions for:
- Slack API usage (chat.delete, reply_broadcast parameter)
- Database migration strategy (versioned migrations with schema_version table)
- Message timestamp storage flow
- Error handling for deletion failures

**Key Decisions**:
1. Use `chat.delete` API with existing `chat:write` scope
2. Add `ack_message_ts` column as nullable TEXT field
3. Implement versioned migration system to support sequential migrations
4. Log deletion failures as warnings (non-critical, don't block completion)
5. Always use `reply_broadcast: true` for completion messages (mandatory, not optional)

---

## Phase 1: Design & Contracts (Complete)

**Outputs**:
- [data-model.md](./data-model.md)
- [contracts/slack-api.md](./contracts/slack-api.md)
- [quickstart.md](./quickstart.md)

### Data Model Summary

**Modified Entity**: `requests` table
- Added: `ack_message_ts TEXT NULLABLE`
- Migration: `002_add_ack_message_ts.sql`
- Backward compatible: NULL for old requests

**New Database Methods**:
- `SimpleQueue.updateAckMessageTs(requestId, messageTs)`: Store timestamp
- `SimpleQueue.getRequest(requestId)`: Retrieve request with timestamp

### Contracts Summary

**External APIs** (Slack):
1. `chat.postMessage` (acknowledgment): Capture `ts` for deletion
2. `chat.delete`: Delete acknowledgment message (error handling: log warning, continue)
3. `chat.postMessage` (completion): Always use `reply_broadcast: true`

**Internal APIs** (Database):
1. Store acknowledgment timestamp after posting
2. Retrieve request details before completion
3. Validate timestamp format (regex: `^\d+\.\d+$`)

### Implementation Guide

See [quickstart.md](./quickstart.md) for detailed step-by-step implementation:
- Database migration with versioning
- Database access layer modifications
- SlackBot event handler changes
- Testing strategy (4 test cases)
- Troubleshooting guide

**Estimated Implementation Time**: 3-4 hours (including testing)

---

## Constitution Check (Post-Design Re-Evaluation)

**Status**: ✅ PASSED - No violations identified

**Re-Evaluation Results**:

- ✅ **No new dependencies**: Uses existing @slack/bolt SDK
- ✅ **No new external services**: Uses existing Slack API endpoints
- ✅ **Changes are localized**: Only modifies SlackBot and database schema
- ✅ **Non-breaking changes**: Nullable column, backward compatible
- ✅ **Follows existing patterns**: Migration system, error handling, logging
- ✅ **Testing strategy defined**: Manual Slack testing (consistent with project)
- ✅ **Error handling compliant**: Deletion failures don't block user experience (FR-006)
- ✅ **Observability maintained**: Appropriate logging (info/warn levels)

**Design Quality**:
- Migration system enhanced with versioning (improves maintainability)
- Error handling is graceful and user-focused
- API contracts clearly documented
- Implementation guide is comprehensive

**Ready for Implementation**: Yes - All planning phases complete, no blockers identified

---

## Next Phase

This planning phase (`/speckit.plan`) is now complete. The next step is to run `/speckit.tasks` to generate the implementation task list ([tasks.md](./tasks.md)).

**Branch**: `005-`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md) (this file)
