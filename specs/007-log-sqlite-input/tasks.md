# Tasks: Logging System Redesign

**Input**: Design documents from `/specs/007-log-sqlite-input/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Single project structure at repository root
- Source: `src/`
- Tests: `tests/`
- Logs: `logs/` (created at runtime)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Create logs directory structure with .gitignore (logs/ with .gitignore entry to exclude *.log files)
- [x] T002 [P] Add LOG_LEVEL environment variable to .env.example with documentation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [Foundation] Create LogLevel enum in src/lib/logger.ts with numeric values (ERROR=0, WARN=1, INFO=2, DEBUG=3)
- [x] T004 [Foundation] Implement log level parsing from LOG_LEVEL env var in src/lib/logger.ts with validation and default to INFO
- [x] T005 [Foundation] Add shouldLog() method to Logger class for level-based filtering
- [x] T006 [P] [Foundation] Create LogTransport interface (ILogTransport) in src/lib/log-transport.ts
- [x] T007 [P] [Foundation] Extend WorkspaceContext interface to include workspaceKey property in src/services/workspace-context.ts (TypeScript type only)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Clean Console Output for Monitoring (Priority: P1) 🎯 MVP

**Goal**: Hide SQLite queries from console output by default, show only high-level business flow logs

**Independent Test**: Run bot with default config (INFO level), send URL mention, verify stdout shows only: request received, NotebookLM processing, file upload, Slack response (NO SQLite queries visible)

### Implementation for User Story 1

- [x] T008 [US1] Modify Logger class in src/lib/logger.ts to check log level before outputting to console
- [x] T009 [US1] Update each logging method (debug, info, warn, error) in src/lib/logger.ts to call shouldLog() before console output
- [x] T010 [US1] Modify SQLite verbose callback in src/lib/database.ts to use logger.debug() instead of direct console output
- [x] T011 [US1] Update workspaceLogger methods in src/lib/logger.ts to respect log level filtering
- [x] T012 [US1] Initialize log level from LOG_LEVEL env var in src/index.ts at bot startup
- [x] T013 [US1] Add startup log message indicating current log level in src/index.ts

**Checkpoint**: At this point, console output should be clean at INFO level, SQLite queries hidden

---

## Phase 4: User Story 2 - Log Level Control for Debugging (Priority: P2)

**Goal**: Enable DEBUG mode to show all log details including SQLite queries

**Independent Test**: Set LOG_LEVEL=DEBUG, restart bot, verify SQLite queries appear in output; Set LOG_LEVEL=ERROR, verify only errors show

### Implementation for User Story 2

- [x] T014 [US2] Add error handling for invalid LOG_LEVEL values in src/lib/logger.ts (warn to stderr, default to INFO)
- [x] T015 [US2] Document LOG_LEVEL environment variable behavior in quickstart.md (already exists, validate accuracy)
- [ ] T016 [US2] Test all four log levels (ERROR, WARN, INFO, DEBUG) manually and verify filtering works correctly

**Checkpoint**: At this point, all log levels should work correctly and be configurable via environment variable

---

## Phase 5: User Story 3 - Persistent Log Files with Workspace Context (Priority: P1)

**Goal**: Write all logs to persistent files with workspace identifiers in filenames, daily rotation

**Independent Test**: Process requests from WS1 and WS2, verify separate log files created (ws1-YYYY-MM-DD.log, ws2-YYYY-MM-DD.log) with all log entries

### Implementation for User Story 3

- [x] T017 [P] [US3] Implement LogTransport class in src/lib/log-transport.ts with fileLoggingEnabled state
- [x] T018 [P] [US3] Implement ensureLogDirectory() method in LogTransport to create logs/ directory if missing
- [x] T019 [US3] Implement getLogFilePath() method in LogTransport to generate filename with workspace ID and date (format: {workspaceId}-{YYYY-MM-DD}.log)
- [x] T020 [US3] Implement write() method in LogTransport using fs.appendFile async for atomic log writes
- [x] T021 [US3] Add daily rotation logic to write() method (check date on each write, update currentDate when changed)
- [x] T022 [US3] Implement error handling in write() method for ENOSPC, EACCES, ENOENT (log to stderr, disable file logging)
- [x] T023 [US3] Implement close() method in LogTransport for graceful shutdown (currently no-op, future-proofing)
- [x] T024 [US3] Extract workspace key from env var name in src/lib/workspace-loader.ts during initialization (SLACK_WS1_BOT_TOKEN → "ws1")
- [x] T025 [US3] Store workspaceKey in WorkspaceContext during workspace loading in src/lib/workspace-loader.ts
- [x] T026 [US3] Create LogTransport instance in src/lib/logger.ts and integrate with Logger class
- [x] T027 [US3] Update Logger methods (debug, info, warn, error) to write to both console AND file transport
- [x] T028 [US3] Update workspaceLogger to pass workspace context to LogTransport for file routing
- [x] T029 [US3] Handle system logs (no workspace context) by using "system" as workspaceId in LogTransport

**Checkpoint**: All user stories should now be independently functional - console filtering works, log levels configurable, files written with workspace IDs

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T030 [P] Add unit tests for log level filtering in tests/unit/logger.test.ts (test all four levels, invalid values)
- [ ] T031 [P] Add unit tests for log file rotation logic in tests/unit/log-transport.test.ts (test date change detection)
- [ ] T032 [P] Add unit tests for error handling in tests/unit/log-transport.test.ts (ENOSPC, EACCES, ENOENT scenarios)
- [ ] T033 [P] Add integration test for full logging flow in tests/integration/logging-e2e.test.ts (workspace context → file writes)
- [x] T034 [P] Add .gitignore entry for logs/*.log to prevent committing log files
- [ ] T035 Verify quickstart.md accuracy (log level usage, troubleshooting, file locations)
- [ ] T036 Manual testing: Run bot with INFO level, verify clean console output
- [ ] T037 Manual testing: Run bot with DEBUG level, verify SQLite queries visible
- [ ] T038 Manual testing: Process requests from multiple workspaces, verify separate log files created
- [ ] T039 Manual testing: Test disk full scenario (simulate ENOSPC), verify bot continues without crashing
- [ ] T040 Manual testing: Verify log file rotation at midnight (or simulate date change)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - US1 (Clean Console) and US2 (Log Level Control) are tightly related but US1 must complete first
  - US3 (Persistent Files) can start after Foundational, but logically follows US1/US2 for integrated testing
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1 - Clean Console)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2 - Log Levels)**: Builds on US1 (requires log filtering to exist), should complete after US1
- **User Story 3 (P1 - Persistent Files)**: Can start after Foundational - Independent but benefits from US1/US2 being complete for easier testing

### Recommended Execution Order

1. **Phase 1: Setup** (T001-T002) - Quick setup tasks
2. **Phase 2: Foundational** (T003-T007) - Core infrastructure
3. **Phase 3: US1** (T008-T013) - Clean console output ← MVP MILESTONE
4. **Phase 4: US2** (T014-T016) - Log level control
5. **Phase 5: US3** (T017-T029) - Persistent log files
6. **Phase 6: Polish** (T030-T040) - Tests and validation

### Within Each User Story

- Foundational tasks before implementation tasks
- Core logic before integration points
- Implementation before manual testing
- Story complete before moving to next priority

### Parallel Opportunities

- **Setup Phase**: T001 and T002 can run in parallel (different files)
- **Foundational Phase**: T006 and T007 can run in parallel (different files)
- **US3 Phase**: T017 and T018 can run in parallel with T024 and T025 (different files)
- **Polish Phase**: All test tasks (T030-T033) can run in parallel, T034 can run anytime

---

## Parallel Example: User Story 3

```bash
# Launch file transport and workspace loader changes in parallel:
Task: "Implement LogTransport class in src/lib/log-transport.ts"
Task: "Extract workspace key from env var name in src/lib/workspace-loader.ts"

# Launch test tasks in parallel:
Task: "Add unit tests for log level filtering in tests/unit/logger.test.ts"
Task: "Add unit tests for log file rotation logic in tests/unit/log-transport.test.ts"
Task: "Add unit tests for error handling in tests/unit/log-transport.test.ts"
Task: "Add integration test for full logging flow in tests/integration/logging-e2e.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007) **CRITICAL - blocks all stories**
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Test US1 independently - console output should be clean, SQLite queries hidden
5. Deploy/demo if ready → Operators can now monitor cleanly!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **Deploy/Demo (MVP!)** - Clean console for operators
3. Add User Story 2 → Test independently → Deploy/Demo - Debugging capability added
4. Add User Story 3 → Test independently → Deploy/Demo - Persistent logs added
5. Add Polish → Final testing → Production ready
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 (T008-T013)
   - Developer B: Can start User Story 3 LogTransport work (T017-T023) in parallel
   - Developer C: Can prepare tests (T030-T033)
3. After US1 completes, Developer B integrates US3 with Logger
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **No breaking changes**: Existing logger continues to work throughout implementation
- **Backward compatible**: Log level defaults to INFO (current implicit behavior)
- **Error handling**: Bot never crashes due to log write failures (continues operation)

---

## File Modification Summary

### Modified Files (Existing)

- `src/lib/logger.ts` - Add log level filtering, integrate file transport (T003, T004, T005, T008, T009, T011, T014, T026, T027)
- `src/lib/database.ts` - Update SQLite verbose callback to use logger.debug() (T010)
- `src/index.ts` - Initialize log level from env var (T012, T013)
- `src/lib/workspace-loader.ts` - Extract and store workspaceKey (T024, T025)
- `src/services/workspace-context.ts` - Add workspaceKey to interface (T007)

### New Files

- `src/lib/log-transport.ts` - File transport implementation (T006, T017-T023, T029)
- `tests/unit/logger.test.ts` - Unit tests for log filtering (T030)
- `tests/unit/log-transport.test.ts` - Unit tests for rotation/errors (T031, T032)
- `tests/integration/logging-e2e.test.ts` - E2E logging tests (T033)
- `logs/.gitignore` - Exclude log files from git (T001, T034)
- `.env.example` - Document LOG_LEVEL variable (T002)

### Runtime Artifacts

- `logs/system-YYYY-MM-DD.log` - System logs (created automatically)
- `logs/ws1-YYYY-MM-DD.log` - Workspace 1 logs (created automatically)
- `logs/ws2-YYYY-MM-DD.log` - Workspace 2 logs (created automatically)

---

## Task Count Summary

- **Total Tasks**: 40
- **Setup**: 2 tasks (T001-T002)
- **Foundational**: 5 tasks (T003-T007)
- **User Story 1 (P1 - Clean Console)**: 6 tasks (T008-T013)
- **User Story 2 (P2 - Log Levels)**: 3 tasks (T014-T016)
- **User Story 3 (P1 - Persistent Files)**: 13 tasks (T017-T029)
- **Polish & Testing**: 11 tasks (T030-T040)

**Parallel Opportunities**: 12 tasks marked [P] can run in parallel within their phases

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = **13 tasks** for clean console output
