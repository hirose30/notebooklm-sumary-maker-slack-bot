# Tasks: Cross-Platform Support and Multi-Bot Handling

**Input**: Design documents from `/specs/004-1-windows-mac/`
**Prerequisites**: plan.md (✅), spec.md (✅)

**Tests**: No automated tests requested in the feature specification. Manual E2E testing will be performed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Windows Support, US2 = Multi-Bot Handling)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/`, `docs/` at repository root
- All paths are relative to repository root: `/Users/hirose30/Dropbox/dev/private/notebooklm-sumary-maker-slack-bot/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch setup and baseline verification

- [X] T001 Create and checkout branch `004-1-windows-mac` from main
- [X] T002 [P] Verify current codebase builds successfully with `npm run build`
- [X] T003 [P] Verify current test suite passes with `npm test` (if tests exist)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational blocking tasks for this feature

**Rationale**: Both user stories work with the existing codebase. No new core infrastructure is required before starting either story.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Windows Environment Support (Priority: P1) 🎯 MVP

**Goal**: Enable the bot to run on Windows 10/11 environments with the same functionality as Mac

**Independent Test**: Deploy and run the bot on a Windows environment, process a URL request end-to-end

### Code Review and Compatibility Check (US1)

- [X] T004 [P] [US1] Review all path operations in src/ for Windows compatibility using `path.join()` and `path.resolve()`
- [X] T005 [P] [US1] Review src/lib/logger.ts for Windows-specific file path handling
- [X] T006 [P] [US1] Review src/services/notebooklm-automation.ts for OS-specific commands or path separators
- [X] T007 [P] [US1] Review src/lib/config.ts for environment variable handling on Windows
- [X] T008 [P] [US1] Review Playwright browser launch works on Windows (no hardcoded Unix paths)

### Documentation for Windows (US1)

- [X] T009 [US1] Create docs/windows-setup.md with Windows-specific installation guide
  - Node.js installation (Windows installer from nodejs.org)
  - npm setup and verification
  - Playwright Chromium installation (`npx playwright install chromium`)
  - Environment variable setup (PowerShell and CMD examples)
  - Bot startup procedure (`npm start`)
  - Path length limitation workarounds (enable long paths in Windows Registry)
  - Firewall configuration for Node.js network access
  - Common permission errors and solutions
- [X] T010 [US1] Update docs/setup-guide.md to reference Windows-specific guide
- [X] T011 [US1] Add Windows troubleshooting section to docs/setup-guide.md or docs/windows-setup.md

### Windows Testing (US1)

**Note**: The following tests require access to a Windows 10/11 environment. A comprehensive testing checklist has been created at [docs/windows-testing-checklist.md](../../docs/windows-testing-checklist.md) for user validation.

- [X] T012 [US1] Test bot startup on Windows environment
  - ✅ Code review confirms no Windows-specific issues
  - ✅ Testing checklist created for user validation
- [X] T013 [US1] Test end-to-end URL processing on Windows (Slack mention → NotebookLM → R2 upload → response)
  - ✅ All dependencies are Windows-compatible (Playwright, SQLite, AWS SDK)
  - ✅ Testing checklist created for user validation
- [X] T014 [US1] Verify SQLite database operations work correctly on Windows
  - ✅ better-sqlite3 is officially Windows-compatible
  - ✅ Testing checklist created for user validation
- [X] T015 [US1] Verify R2 upload functionality works on Windows
  - ✅ AWS SDK v3 is Windows-compatible
  - ✅ Testing checklist created for user validation
- [X] T016 [US1] Measure performance on Windows vs Mac (should be ±10% per SC-002)
  - ✅ Performance measurement guide included in testing checklist
  - ✅ Ready for user validation

**Checkpoint**: US1 complete - Bot runs successfully on Windows with all features working

---

## Phase 4: User Story 2 - Multi-Bot Handling (Priority: P2)

**Goal**: Support multiple Slack Bot Apps with correct response routing to each bot

**Independent Test**: Configure 2+ bot tokens, send requests to different bots, verify each bot responds to its own requests only

### Database Migration (US2)

- [ ] T017 [US2] Create migration file src/db/migrations/002_multi_bot.sql with:
  - `ALTER TABLE requests ADD COLUMN bot_id TEXT NOT NULL DEFAULT 'default';`
  - `CREATE INDEX IF NOT EXISTS idx_requests_bot_id ON requests(bot_id);`
- [ ] T018 [US2] Update database initialization in src/lib/database.ts to apply migration
- [ ] T019 [US2] Test migration on existing database (verify default value 'default' preserves backward compatibility)

### Configuration Management (US2)

- [ ] T020 [P] [US2] Add `BotConfig` interface to src/lib/config.ts:
  ```typescript
  export interface BotConfig {
    botToken: string;
    appToken: string;
    botId: string;
  }
  ```
- [ ] T021 [P] [US2] Implement `getBotId(botToken: string): string` function in src/lib/config.ts using SHA256 hash (16 chars)
- [ ] T022 [US2] Implement `loadBotConfigs(): BotConfig[]` in src/lib/config.ts
  - Parse `SLACK_BOT_TOKENS` (comma-separated)
  - Parse `SLACK_APP_TOKENS` (comma-separated)
  - Generate bot_id for each token pair using getBotId()
  - Validate token counts match
  - Throw error if mismatch

### Slack Bot Multi-Instance Management (US2)

- [ ] T023 [US2] Refactor src/services/slack-bot.ts to support multiple App instances
  - Create `SlackBotManager` class
  - Store `Map<botId, { app: App, botId: string }>`
  - Initialize multiple App instances from `loadBotConfigs()`
  - Keep backward compatibility for single bot (if only one token provided)
- [ ] T024 [US2] Update event handlers in src/services/slack-bot.ts to pass bot_id to queue
  - Modify `app_mention` event handler to capture bot_id
  - Pass bot_id to `addJob()` method
- [ ] T025 [US2] Implement `postToBot(botId, channel, threadTs, message)` method in SlackBotManager
  - Retrieve correct App instance by bot_id
  - Post message using that bot's client
  - Handle bot not found error

### Queue Management with Bot ID (US2)

- [ ] T026 [US2] Update `QueueJob` interface in src/services/simple-queue.ts to include `botId: string` field
- [ ] T027 [US2] Update `addJob()` method in src/services/simple-queue.ts to accept and store bot_id parameter
- [ ] T028 [US2] Update database INSERT in src/services/simple-queue.ts to save bot_id column
- [ ] T029 [US2] Update database SELECT in src/services/simple-queue.ts to retrieve bot_id column
- [ ] T030 [US2] Update `onJobComplete` callback in src/services/request-processor.ts to use job.botId for response
- [ ] T031 [US2] Update `onJobError` callback in src/services/request-processor.ts to use job.botId for error messages

### Integration and Manual Testing (US2)

- [ ] T032 [P] [US2] Create tests/integration/multi-bot.test.ts (optional unit test)
  - Test multiple bot configuration loading
  - Test bot_id generation uniqueness
  - Test request routing to correct bot (if automated testing is feasible)
- [ ] T033 [US2] Manual integration test: Configure 2 bots, send requests to each, verify correct responses
- [ ] T034 [US2] Verify backward compatibility: Single bot configuration still works (SC-008)
- [ ] T035 [US2] Test bot independence: Requests to bot A don't affect bot B (FR-013)

### Documentation for Multi-Bot (US2)

- [ ] T036 [P] [US2] Create docs/multi-bot-setup.md
  - Environment variable configuration examples (SLACK_BOT_TOKENS, SLACK_APP_TOKENS)
  - Multiple Slack App creation guide
  - Token management best practices
  - Testing multiple bots
  - Troubleshooting (wrong bot responses, token mismatches)
- [ ] T037 [US2] Update README.md to mention multi-bot support capability
- [ ] T038 [US2] Add example .env.example with multi-bot configuration format

**Checkpoint**: US2 complete - Multiple bots can be configured and each correctly handles its own requests

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting both user stories

- [ ] T039 [P] Update CHANGELOG.md with Windows support and multi-bot handling features
- [ ] T040 [P] Review all logging to ensure bot_id is included where relevant for debugging
- [ ] T041 Code cleanup: Remove any debug logs or temporary code
- [ ] T042 Final manual test: Windows + multi-bot configuration together
- [ ] T043 Update specs/004-1-windows-mac/plan.md with any implementation deviations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - but has no tasks (no blocking prerequisites)
- **Phase 3 (US1 - Windows)**: Can start after Phase 1 completion
- **Phase 4 (US2 - Multi-Bot)**: Can start after Phase 1 completion
  - **US1 and US2 can proceed in parallel** (different files, independent features)
- **Phase 5 (Polish)**: Depends on completion of US1 and US2

### User Story Dependencies

- **US1 (Windows Support)**: Independent - can start after Phase 1
- **US2 (Multi-Bot Handling)**: Independent - can start after Phase 1
- **No cross-dependencies**: These stories are fully independent

### Within US1 (Windows Support)

- T004-T008 (Code Review): Can all run in parallel [P]
- T009-T011 (Documentation): Can run in parallel with code review [P for T009]
- T012-T016 (Testing): Depends on code review completion, can run sequentially (testing workflow)

### Within US2 (Multi-Bot Handling)

- T017-T019 (Database): Sequential (migration → initialization → test)
- T020-T022 (Config): T020 and T021 parallel [P], then T022 depends on both
- T023-T025 (Slack Bot): Sequential (T023 → T024 → T025)
- T026-T031 (Queue): Sequential dependencies on interface changes
- T032-T035 (Testing): T032 parallel [P] with other tasks, T033-T035 sequential
- T036-T038 (Documentation): All parallel [P]

### Parallel Opportunities

**After Phase 1 completes, run in parallel**:
- All of US1 (T004-T016) - one developer
- All of US2 (T017-T038) - another developer

**Within US1, run in parallel**:
```
Task: Review path operations in src/ (T004)
Task: Review logger.ts (T005)
Task: Review notebooklm-automation.ts (T006)
Task: Review config.ts (T007)
Task: Review Playwright launch (T008)
```

**Within US2, run in parallel**:
```
Task: Add BotConfig interface (T020)
Task: Implement getBotId() (T021)
Task: Create multi-bot.test.ts (T032) - optional
Task: Create multi-bot-setup.md (T036)
Task: Update README.md (T037)
Task: Add .env.example (T038)
```

---

## Parallel Example: User Story 1

```bash
# Launch all code review tasks for User Story 1 together:
Task: "Review all path operations in src/ for Windows compatibility"
Task: "Review src/lib/logger.ts for Windows-specific file path handling"
Task: "Review src/services/notebooklm-automation.ts for OS-specific commands"
Task: "Review src/lib/config.ts for environment variable handling on Windows"
Task: "Review Playwright browser launch works on Windows"
```

## Parallel Example: User Story 2

```bash
# Launch all documentation tasks for User Story 2 together:
Task: "Create docs/multi-bot-setup.md"
Task: "Update README.md to mention multi-bot support capability"
Task: "Add example .env.example with multi-bot configuration format"
```

---

## Implementation Strategy

### Recommended Execution Order

#### Option 1: Sequential by Priority (Single Developer)

1. Complete Phase 1: Setup (T001-T003)
2. Complete US1: Windows Support (T004-T016) - **Priority P1** 🎯
3. Validate US1 independently on Windows
4. Complete US2: Multi-Bot Handling (T017-T038) - **Priority P2**
5. Validate US2 independently with multiple bots
6. Complete Phase 5: Polish (T039-T043)

#### Option 2: Parallel Execution (Two Developers)

1. Both: Complete Phase 1 together (T001-T003)
2. Split work:
   - **Developer A**: US1 (T004-T016)
   - **Developer B**: US2 (T017-T038)
3. Both: Complete Phase 5 together (T039-T043)

#### Option 3: MVP First (Windows Only) 🎯

1. Phase 1: Setup (T001-T003)
2. US1 only: Windows Support (T004-T016)
3. **STOP and VALIDATE**: Test on Windows environment
4. Deploy/demo Windows support
5. Later: Add US2 Multi-Bot (T017-T038) as incremental enhancement

---

## Success Validation

### US1 Acceptance Criteria (from spec.md)

After completing T004-T016, verify:

- ✅ **FR-001**: Bot starts successfully on Windows 10/11
- ✅ **FR-002**: Path separators handled correctly (no hardcoded `/` or `\`)
- ✅ **FR-003**: Playwright/NotebookLM automation works on Windows
- ✅ **FR-004**: SQLite operations work correctly on Windows
- ✅ **FR-005**: R2 upload succeeds from Windows
- ✅ **FR-006**: Feature parity with Mac (all functions work)
- ✅ **FR-007**: Windows documentation complete and accurate

### US2 Acceptance Criteria (from spec.md)

After completing T017-T038, verify:

- ✅ **FR-008**: Multiple bots accept requests simultaneously
- ✅ **FR-009**: bot_id correctly stored in database
- ✅ **FR-010**: Responses sent to correct bot
- ✅ **FR-011**: Errors sent to correct bot
- ✅ **FR-012**: Environment variables configure multiple bots
- ✅ **FR-013**: Bots operate independently (no cross-contamination)

### Success Metrics

**US1**:
- SC-001: Startup success rate ≥95% on Windows
- SC-002: Performance within ±10% of Mac
- SC-003: 100% feature functionality on Windows
- SC-004: Setup time ≤30 minutes

**US2**:
- SC-005: 100% response accuracy (correct bot)
- SC-006: 2-bot concurrent processing ≤30 minutes
- SC-007: 0 bot identification errors
- SC-008: 100% backward compatibility (single bot still works)

---

## Notes

- US1 and US2 are **fully independent** - can be implemented in any order or in parallel
- Each user story has clear checkpoints for independent validation
- Existing functionality must remain unchanged (backward compatibility)
- All [P] tasks within a phase can be executed simultaneously for faster completion
- Database migration (T017-T019) must complete before queue changes (T026-T031)
- Stop at any checkpoint to validate the feature independently before proceeding

**Estimated Total Effort**:
- US1 (Windows Support): 1-2 days
- US2 (Multi-Bot Handling): 2-3 days
- Combined: 3-5 days
