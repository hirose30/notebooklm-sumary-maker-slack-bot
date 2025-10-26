# Research: Logging System Implementation

**Feature**: 007-log-sqlite-input
**Date**: 2025-10-18
**Purpose**: Resolve technical unknowns for logging system redesign

## 1. Log Level Filtering Implementation

### Decision: Runtime log level check with numeric comparison

**Rationale**:
- Assign numeric values to log levels: ERROR=0, WARN=1, INFO=2, DEBUG=3
- Filter logs by comparing current level against configured threshold
- Parse `LOG_LEVEL` environment variable once at startup, store in memory
- Each log call checks: `if (levelNumeric <= configuredThreshold) output()`

**Performance**:
- Single numeric comparison per log call (~1-2 CPU cycles)
- No regex, string parsing, or function calls in hot path
- Negligible overhead compared to I/O operations

**Alternatives Considered**:
- **String comparison**: Rejected due to higher overhead and need for mapping table
- **Compile-time optimization**: Rejected as it requires rebuild to change log level
- **Conditional compilation**: Not applicable to TypeScript/JavaScript runtime

**Implementation**:
```typescript
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private configuredLevel: LogLevel = LogLevel.INFO;

  private shouldLog(level: LogLevel): boolean {
    return level <= this.configuredLevel;
  }
}
```

---

## 2. File Transport Strategy

### Decision: fs.appendFile with async/await for each log entry

**Rationale**:
- `fs.appendFile()` is atomic on most filesystems (POSIX O_APPEND flag)
- Async writes prevent blocking the event loop during I/O
- No explicit buffering needed - OS handles write buffering
- Simple error handling per write operation
- Automatic file creation if not exists

**Performance Analysis**:
- ~10-100 log entries per request × ~10-100 requests/day = ~100-10,000 writes/day
- Modern SSDs handle 10k+ IOPS easily
- Async writes ensure request processing not blocked by disk I/O
- Trade-off: Slight CPU overhead from async promises vs blocking during sync writes

**Alternatives Considered**:

1. **fs.createWriteStream with persistent handles**:
   - Pros: Slightly better performance for high-volume logging
   - Cons: Complex rotation logic (must close/reopen streams), handle leak risk
   - **Rejected**: Complexity not justified for current scale (~10-100 requests/day)

2. **Synchronous fs.appendFileSync**:
   - Pros: Simpler error handling, guaranteed write before next statement
   - Cons: Blocks event loop, degrades request processing performance
   - **Rejected**: Violates "no performance degradation" success criterion (SC-006)

3. **In-memory buffering with periodic flush**:
   - Pros: Best performance for high-volume scenarios
   - Cons: Risk of log loss on crash, complex flush logic
   - **Rejected**: Added complexity, log loss risk unacceptable for troubleshooting

**Implementation Pattern**:
```typescript
import { appendFile } from 'fs/promises';

async write(message: string, filePath: string): Promise<void> {
  try {
    await appendFile(filePath, message + '\n', 'utf-8');
  } catch (error) {
    // Handle per error handling strategy (see section 5)
  }
}
```

---

## 3. Daily Log Rotation Logic

### Decision: Check date on every log write, lazy rotation on date change

**Rationale**:
- Track "current log date" in memory (e.g., "2025-10-18")
- On each log write, compare current date with tracked date
- If date changed: construct new filename, subsequent writes go to new file
- No explicit file closing needed (fs.appendFile opens/closes per write)
- No background timers or cron jobs required

**Rotation Check Frequency**:
- **Per log call**: Minimal overhead (single string comparison: "2025-10-18" === currentDate)
- Typical log frequency: 10-50 calls/request → 100-5000 comparisons/day
- String comparison overhead: ~10-20ns, negligible compared to file I/O (~1-10ms)

**Edge Case Handling**:
- **Rotation at midnight during request processing**: Next log write automatically uses new filename
- **Clock changes (DST, NTP adjustment)**: Date comparison based on wall clock, automatically adapts
- **First log of new day**: Creates new file via appendFile's auto-create behavior

**Alternatives Considered**:

1. **Interval-based rotation check (e.g., every 60 seconds)**:
   - Pros: Fewer date comparisons
   - Cons: Delayed rotation (could miss up to 60 seconds of logs in old file), requires background timer
   - **Rejected**: Adds complexity (timer management), delayed rotation is poor UX

2. **Startup-only rotation**:
   - Pros: Zero runtime overhead
   - Cons: Long-running processes never rotate (all logs in one file), violates FR-013
   - **Rejected**: Does not meet daily rotation requirement

3. **File size-based rotation trigger**:
   - Pros: Predictable file sizes
   - Cons: Requires stat() call per write (performance hit), or periodic size checks (complexity)
   - **Rejected**: User specified daily rotation, not size-based (clarification Q1)

**Implementation Pattern**:
```typescript
class LogTransport {
  private currentDate: string = '';

  private getCurrentLogFile(workspaceId: string): string {
    const today = new Date().toISOString().split('T')[0]; // "2025-10-18"
    if (this.currentDate !== today) {
      this.currentDate = today;
    }
    return `./logs/${workspaceId}-${today}.log`;
  }
}
```

---

## 4. Workspace Identifier Extraction

### Decision: Store workspace key (WS1, WS2) in workspace context during initialization

**Rationale**:
- Workspace loading already parses environment variables (`SLACK_WS1_BOT_TOKEN`, etc.)
- Extract workspace key ("WS1") from env var name during workspace initialization
- Store workspace key in `WorkspaceContext` alongside `teamId`, `teamName`
- Retrieve via `workspaceContext.getStore()?.workspaceKey` in log transport

**Why not parse env vars on every log write**:
- Parsing overhead on hot path
- Requires scanning all env vars repeatedly
- Workspace context already available via AsyncLocalStorage

**Why not use teamId as workspace identifier**:
- TeamId is Slack's internal ID (e.g., "T01ABCDEFGH"), not human-readable
- User explicitly requested "ws1" or "ws2" identifier in filename (spec requirement FR-006)
- Operator experience: `ws1-2025-10-18.log` clearer than `T01ABCDEFGH-2025-10-18.log`

**Alternatives Considered**:

1. **Parse from SLACK_WS*_BOT_TOKEN env var names on each log write**:
   - Pros: No workspace context modification
   - Cons: Performance overhead, requires env var scanning
   - **Rejected**: Inefficient hot path operation

2. **Use teamName from Slack API**:
   - Pros: Human-readable
   - Cons: May contain spaces/special chars (bad for filenames), requires sanitization
   - **Rejected**: Less predictable than controlled WS1/WS2 keys

3. **Use teamId as-is**:
   - Pros: Unique, no collisions
   - Cons: Not human-readable, violates user requirement for "ws1/ws2" identifier
   - **Rejected**: Does not meet spec requirement

**Implementation**:
```typescript
// In workspace-loader.ts during initialization:
const workspaceKey = envVarName.match(/SLACK_(WS\d+)_BOT_TOKEN/)?.[1] || 'unknown';
workspaceContext.set({ ...context, workspaceKey });

// In log-transport.ts:
const workspace = workspaceContext.getStore();
const wsId = workspace?.workspaceKey || 'system';
const logFile = `./logs/${wsId}-${date}.log`;
```

---

## 5. Error Handling Strategy

### Decision: Log to stderr and continue (non-blocking fallback)

**Error Scenarios & Responses**:

1. **ENOSPC (disk full)**:
   - Action: Log error once to stderr, disable file logging for remainder of session
   - Rationale: Prevent infinite error loops, bot continues serving requests
   - Recovery: Manual operator intervention (free disk space, restart bot)

2. **EACCES (permission denied)**:
   - Action: Log error to stderr at startup, disable file logging
   - Rationale: Fail-fast notification to operator
   - Prevention: Document required permissions in quickstart.md

3. **ENOENT (log directory doesn't exist)**:
   - Action: Attempt to create `./logs/` directory, log error to stderr if mkdir fails
   - Rationale: Auto-create convenience, but don't retry indefinitely
   - Fallback: Disable file logging if directory creation fails

4. **Unknown errors**:
   - Action: Log full error to stderr, disable file logging
   - Rationale: Defensive programming, prevent crashes from unexpected errors

**Implementation Pattern**:
```typescript
class LogTransport {
  private fileLoggingEnabled = true;

  async write(message: string): Promise<void> {
    if (!this.fileLoggingEnabled) return;

    try {
      await appendFile(filePath, message + '\n', 'utf-8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOSPC' || err.code === 'EACCES') {
        console.error(`[ERROR] Log file write failed (${err.code}): ${err.message}`);
        console.error('[ERROR] Disabling file logging for this session');
        this.fileLoggingEnabled = false;
      } else if (err.code === 'ENOENT') {
        // Try to create directory once
        await this.ensureLogDirectory();
      } else {
        console.error(`[ERROR] Unexpected log write error: ${err.message}`);
        this.fileLoggingEnabled = false;
      }
    }
  }
}
```

**Why no retry logic**:
- ENOSPC: Retrying won't help until disk space freed (operator action required)
- EACCES: Permission issue requires configuration fix (no automatic recovery)
- Retrying could cause resource exhaustion (error loop) or request delays

**Why disable file logging vs crash**:
- Clarification answer: "Log error to stderr and continue operation" (Q2)
- Bot's primary function (Slack → NotebookLM → response) more important than logging
- Operator monitoring stderr will see error notification immediately

---

## Summary of Decisions

| Research Area | Decision | Key Trade-off |
|---------------|----------|---------------|
| Log Level Filtering | Numeric comparison at runtime | Performance vs configurability → chose configurability |
| File Transport | fs.appendFile async | Simplicity vs maximum performance → chose simplicity |
| Rotation Logic | Per-write date check | Check frequency vs rotation accuracy → chose accuracy |
| Workspace ID | Store in context at init | Initialization complexity vs runtime performance → chose runtime perf |
| Error Handling | Log to stderr, disable file logging | Reliability vs availability → chose availability |

**No unresolved unknowns remain.** Ready for Phase 1 design artifacts.
