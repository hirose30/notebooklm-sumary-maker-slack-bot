# Implementation Plan: Logging System Redesign

**Branch**: `007-log-sqlite-input` | **Date**: 2025-10-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-log-sqlite-input/spec.md`

## Summary

Redesign the logging system to provide clean console output for operators while enabling detailed debugging capabilities and persistent log files with workspace context. The system will support configurable log levels (ERROR, WARN, INFO, DEBUG) via environment variables, hide SQLite queries from stdout by default, write all logs to persistent files with workspace identifiers and daily rotation, and gracefully handle failure scenarios.

## Technical Context

**Language/Version**: TypeScript 5.3.3 + Node.js 20+
**Primary Dependencies**: Custom logger (src/lib/logger.ts), Node.js fs module, AsyncLocalStorage for workspace context
**Storage**: File-based log storage in `./logs/` directory with daily rotation
**Testing**: Vitest for unit tests, integration tests for log file operations
**Target Platform**: Linux/macOS/Windows server (Node.js runtime)
**Project Type**: Single project (backend service)
**Performance Goals**: Log writes must not degrade request processing (<2 min per request), async file writes preferred
**Constraints**: No external logging libraries (enhance existing custom logger), preserve workspace context isolation, atomic log file appends
**Scale/Scope**: Multi-workspace bot (2+ workspaces), ~10-100 requests/day per workspace, indefinite log retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution file exists - skipping gate checks. This feature follows the existing project patterns:
- Enhances existing `src/lib/logger.ts` module (no new libraries)
- Maintains compatibility with AsyncLocalStorage workspace isolation
- Preserves existing log format and metadata structure
- No breaking changes to public APIs

## Project Structure

### Documentation (this feature)

```
specs/007-log-sqlite-input/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API contracts for logging)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── logger.ts        # MODIFY: Enhanced logger with file output, log levels
│   └── log-transport.ts # NEW: File transport layer with rotation logic
├── services/
│   └── workspace-context.ts  # EXISTING: Used for workspace identification
└── index.ts             # MODIFY: Initialize log level from env

tests/
├── unit/
│   ├── logger.test.ts          # NEW: Log level filtering tests
│   └── log-transport.test.ts   # NEW: File rotation, failure handling tests
└── integration/
    └── logging-e2e.test.ts     # NEW: Full logging flow with workspaces

logs/                    # Log output directory (created at runtime)
├── system-YYYY-MM-DD.log       # System/startup logs
├── ws1-YYYY-MM-DD.log          # Workspace 1 logs
└── ws2-YYYY-MM-DD.log          # Workspace 2 logs
```

**Structure Decision**: Single project structure maintained. Logging enhancement adds:
- One new module (`log-transport.ts`) for file operations
- Enhancements to existing `logger.ts` for log level control
- Test files for new functionality
- Runtime log directory (not checked into git)

## Complexity Tracking

*No constitution violations - this section is not applicable.*

## Phase 0: Research & Unknowns

### Research Tasks

1. **Log Level Filtering Implementation**
   - Research: How to implement efficient log level filtering in custom logger
   - Decision needed: Runtime log level check vs compile-time optimization
   - Alternatives: Environment variable parsing, in-memory config object

2. **File Transport Strategy**
   - Research: Node.js fs.appendFile vs fs.createWriteStream for log files
   - Decision needed: Async vs sync writes, buffering strategy
   - Performance consideration: Impact of file I/O on request processing

3. **Daily Log Rotation Logic**
   - Research: Date-based file naming patterns (YYYY-MM-DD format)
   - Decision needed: Rotation check frequency (per log call, interval-based, startup-only)
   - Edge case: Log rotation at midnight while requests are processing

4. **Workspace Identifier Extraction**
   - Research: How to extract "ws1", "ws2" from environment variable names or workspace context
   - Current pattern: `SLACK_WS1_BOT_TOKEN`, `SLACK_WS2_BOT_TOKEN` env vars
   - Decision needed: Parse from env var names vs store in workspace context

5. **Error Handling Patterns**
   - Research: Best practices for handling ENOSPC (disk full), EACCES (permission denied)
   - Decision needed: Retry logic, fallback behavior, error reporting
   - Constraint: Must not crash bot on log write failures

### Output Artifact

`research.md` will document:
- Chosen log level filtering approach with performance justification
- File transport implementation (appendFile vs writeStream)
- Rotation logic design (when and how rotation is checked)
- Workspace ID extraction mechanism
- Error handling strategy with specific error codes

## Phase 1: Design Artifacts

### Data Model (`data-model.md`)

**Entities**:

1. **LogLevelConfig**
   - Properties: `currentLevel` (ERROR|WARN|INFO|DEBUG), `envVarName`, `defaultLevel`
   - Validation: Invalid values default to INFO with stderr warning
   - Lifecycle: Initialized at startup, immutable during runtime

2. **LogEntry**
   - Properties: `timestamp` (ISO 8601), `level`, `message`, `metadata` (object)
   - Metadata includes: `teamId`, `teamName`, workspace-specific context
   - Format: `[TIMESTAMP] LEVEL: message {metadata}`

3. **LogFile**
   - Properties: `filePath`, `workspaceId`, `date`, `isOpen`
   - Naming pattern: `{workspaceId}-{YYYY-MM-DD}.log` or `system-{YYYY-MM-DD}.log`
   - Rotation trigger: Date change detection

4. **LogTransport**
   - Responsibilities: Route logs to console and/or file based on level
   - State: Current log file handles, rotation state
   - Methods: `write(entry)`, `rotate()`, `handleWriteError(error)`

### API Contracts

No external API contracts - logging is an internal infrastructure concern.

**Internal Interfaces** (TypeScript types in code):

```typescript
// Log level configuration
interface LogLevelConfig {
  level: LogLevel;
  enableFileOutput: boolean;
  enableConsoleOutput: boolean;
}

// Log transport interface
interface ILogTransport {
  write(level: LogLevel, formattedMessage: string, workspaceId: string | null): Promise<void>;
  close(): Promise<void>;
}
```

### Quick Start Guide (`quickstart.md`)

**Topics**:
1. Setting log level via `LOG_LEVEL` environment variable
2. Viewing logs in console (default INFO level)
3. Enabling debug mode for troubleshooting
4. Finding workspace-specific log files in `./logs/` directory
5. Log file naming conventions and rotation behavior
6. Troubleshooting: disk full, permission issues

## Phase 2: Task Breakdown

*Deferred to `/speckit.tasks` command - not generated by `/speckit.plan`*

## Implementation Notes

### Modified Files
- `src/lib/logger.ts`: Add log level filtering, file transport integration
- `src/lib/database.ts`: Make SQLite verbose callback respect log level
- `src/index.ts`: Initialize log level from environment

### New Files
- `src/lib/log-transport.ts`: File writing, rotation, error handling
- `tests/unit/logger.test.ts`: Log level filtering tests
- `tests/unit/log-transport.test.ts`: File operations tests
- `tests/integration/logging-e2e.test.ts`: End-to-end logging tests

### Environment Variables
- `LOG_LEVEL`: Controls log verbosity (ERROR|WARN|INFO|DEBUG), default INFO
- Existing `SLACK_WS1_BOT_TOKEN`, `SLACK_WS2_BOT_TOKEN`: Used to identify workspaces

### Testing Strategy
1. **Unit Tests**: Log level filtering logic, date rotation logic, error handling
2. **Integration Tests**: Full flow with mock AsyncLocalStorage, file system operations
3. **Manual Testing**: Run bot with different log levels, verify file output, test disk full scenario

### Rollout Considerations
- Backward compatible: Existing code continues to work (console-only logging preserved)
- Log level defaults to INFO (current behavior effectively)
- Log files created automatically on first write (no manual setup required)
- Existing workspace context mechanism unchanged

### Open Questions for Implementation Phase
- Should log file directory (`./logs/`) be configurable via environment variable?
- Should there be a maximum log file size safety limit (even with daily rotation)?
- Should log files use UTF-8 encoding explicitly or rely on system default?
- Should the bot log a startup message indicating log level and file output status?
