# Data Model: Logging System

**Feature**: 007-log-sqlite-input
**Date**: 2025-10-18
**Purpose**: Define entities, relationships, and state for the logging system

## Overview

The logging system manages log entries routed to console and file outputs based on configurable log levels. The model supports workspace-aware logging with daily file rotation.

## Entities

### 1. LogLevel (Enum)

**Purpose**: Defines severity levels for log filtering

**Values**:
- `ERROR = 0` - Critical errors only
- `WARN = 1` - Warnings and errors
- `INFO = 2` - Informational messages, warnings, and errors (default)
- `DEBUG = 3` - All messages including debug details

**Ordering**: Numeric values enable simple comparison (`level <= threshold`)

**Validation**:
- Environment variable `LOG_LEVEL` accepts: "ERROR", "WARN", "INFO", "DEBUG" (case-insensitive)
- Invalid values default to INFO with stderr warning

---

### 2. LogLevelConfig

**Purpose**: Runtime configuration for log filtering and output routing

**Properties**:

| Property | Type | Description | Validation |
|----------|------|-------------|------------|
| `level` | LogLevel | Current log level threshold | Must be valid LogLevel enum value |
| `enableFileOutput` | boolean | Whether to write logs to files | Default: true |
| `enableConsoleOutput` | boolean | Whether to write logs to console | Default: true |

**Lifecycle**:
- **Initialization**: Created once at application startup
- **Source**: `LOG_LEVEL` environment variable (parsed and validated)
- **Mutability**: Immutable after initialization (requires restart to change)

**Default Values**:
```typescript
{
  level: LogLevel.INFO,
  enableFileOutput: true,
  enableConsoleOutput: true
}
```

---

### 3. LogEntry

**Purpose**: Represents a single log message with metadata

**Properties**:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `timestamp` | string (ISO 8601) | UTC timestamp | "2025-10-18T10:30:45.123Z" |
| `level` | LogLevel | Severity level | LogLevel.INFO |
| `message` | string | Log message text | "Processing request" |
| `metadata` | object (optional) | Additional context | `{ teamId: "T01...", url: "..." }` |

**Format** (as string):
```
[2025-10-18T10:30:45.123Z] INFO: Processing request {"teamId":"T01ABC","jobId":42}
```

**Metadata Fields** (workspace-aware logging):
- `teamId`: Slack workspace team ID (from AsyncLocalStorage)
- `teamName`: Human-readable workspace name
- Additional context: `jobId`, `url`, `requestId`, etc.

**Validation**:
- `message`: Required, non-empty string
- `timestamp`: Auto-generated, always valid ISO 8601
- `metadata`: Optional, must be JSON-serializable

---

### 4. LogFile

**Purpose**: Represents a log file on disk with rotation metadata

**Properties**:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `filePath` | string | Absolute path to log file | "/app/logs/ws1-2025-10-18.log" |
| `workspaceId` | string | Workspace identifier or "system" | "ws1", "ws2", "system" |
| `date` | string (YYYY-MM-DD) | Current log date for rotation | "2025-10-18" |

**Naming Convention**:
- **Workspace logs**: `{workspaceId}-{YYYY-MM-DD}.log`
  - Example: `ws1-2025-10-18.log`, `ws2-2025-10-19.log`
- **System logs**: `system-{YYYY-MM-DD}.log`
  - Example: `system-2025-10-18.log`

**Rotation Trigger**:
- Date change detected by comparing `date` property with current date
- New file created automatically via `fs.appendFile` on first write

**File Location**:
- Directory: `./logs/` (relative to project root)
- Created automatically if doesn't exist (via mkdir)

---

### 5. LogTransport

**Purpose**: Manages routing of log entries to console and file outputs

**Responsibilities**:
1. Write log entries to console (stdout/stderr)
2. Write log entries to appropriate log file (workspace-specific or system)
3. Handle daily log file rotation
4. Handle write errors gracefully

**State**:

| Property | Type | Description |
|----------|------|-------------|
| `currentDate` | string (YYYY-MM-DD) | Tracked date for rotation detection |
| `fileLoggingEnabled` | boolean | Disabled on persistent write errors |
| `logDirectory` | string | Path to logs directory (`./logs/`) |

**Methods**:

```typescript
interface ILogTransport {
  /**
   * Write a log entry to console and/or file
   * @param level - Log level for filtering
   * @param formattedMessage - Pre-formatted log message
   */
  write(level: LogLevel, formattedMessage: string): Promise<void>;

  /**
   * Ensure log directory exists, create if needed
   */
  ensureLogDirectory(): Promise<void>;

  /**
   * Get current log file path for workspace context
   * @param workspaceId - Workspace identifier or null for system
   */
  getLogFilePath(workspaceId: string | null): string;

  /**
   * Close all open resources (for graceful shutdown)
   */
  close(): Promise<void>;
}
```

**State Transitions**:
1. **Initialization**: `fileLoggingEnabled = true`, `currentDate = ""`
2. **First Write**: Check/create log directory, update `currentDate`
3. **Date Change**: Update `currentDate`, subsequent writes use new filename
4. **Write Error**: Set `fileLoggingEnabled = false`, log to stderr

---

### 6. WorkspaceContext (Extended)

**Purpose**: Existing entity extended to include workspace identifier for log routing

**New Property**:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `workspaceKey` | string | Human-readable workspace identifier | "ws1", "ws2" |

**Extraction Logic**:
- Parse from environment variable name: `SLACK_WS1_BOT_TOKEN` → `"ws1"`
- Stored during workspace initialization in `workspace-loader.ts`
- Retrieved via `workspaceContext.getStore()?.workspaceKey`

**Existing Properties** (unchanged):
- `teamId`: Slack team ID
- `teamName`: Workspace display name
- `botToken`: Slack bot token (never logged)
- `botUserId`: Bot user ID

---

## Relationships

```
LogLevelConfig (1) ← (1) Logger
Logger (1) → (1) LogTransport
LogTransport (1) → (0..*) LogFile
WorkspaceContext (1) → (1) LogFile
LogEntry (1) → (0..1) WorkspaceContext
```

**Description**:
- One `LogLevelConfig` per application instance
- One `Logger` instance uses one `LogTransport`
- `LogTransport` manages multiple `LogFile` instances (one per workspace per day)
- Each `LogFile` corresponds to one `WorkspaceContext`
- Each `LogEntry` may reference workspace metadata (null for system logs)

---

## State Diagrams

### Log File Lifecycle

```
[Not Exists]
    ↓
  (First log write with new date)
    ↓
[Created] ← fs.appendFile auto-creates
    ↓
  (Subsequent writes same day)
    ↓
[Active - receiving writes]
    ↓
  (Date changes)
    ↓
[Inactive - new file created for new date]
    ↓
[Archived - retained indefinitely]
```

### File Logging State

```
[Enabled]
    ↓
  (Write error: ENOSPC, EACCES, unknown)
    ↓
[Disabled]
    ↓
  (Remains disabled until bot restart)
```

---

## Validation Rules

### FR-001: Log Level Validation
```typescript
function parseLogLevel(envValue: string | undefined): LogLevel {
  const normalized = (envValue || 'INFO').toUpperCase();
  const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

  if (!validLevels.includes(normalized)) {
    console.error(`[WARN] Invalid LOG_LEVEL "${envValue}". Defaulting to INFO.`);
    return LogLevel.INFO;
  }

  return LogLevel[normalized as keyof typeof LogLevel];
}
```

### FR-006: Workspace Identifier Extraction
```typescript
function extractWorkspaceKey(envVarName: string): string {
  const match = envVarName.match(/SLACK_(WS\d+)_BOT_TOKEN/);
  return match?.[1]?.toLowerCase() || 'unknown';
}
```

### FR-009: Timestamp Format
```typescript
function getCurrentTimestamp(): string {
  return new Date().toISOString(); // "2025-10-18T10:30:45.123Z"
}
```

### FR-013: Daily Rotation Check
```typescript
function shouldRotate(currentDate: string): boolean {
  const today = new Date().toISOString().split('T')[0]; // "2025-10-18"
  return currentDate !== today;
}
```

---

## File System Structure

```
project-root/
└── logs/                          # Created at runtime
    ├── system-2025-10-17.log      # Previous day system logs
    ├── system-2025-10-18.log      # Current day system logs
    ├── ws1-2025-10-17.log         # Previous day workspace 1 logs
    ├── ws1-2025-10-18.log         # Current day workspace 1 logs
    ├── ws2-2025-10-17.log         # Previous day workspace 2 logs
    └── ws2-2025-10-18.log         # Current day workspace 2 logs
```

**Notes**:
- Files created on-demand (first log write)
- No automatic deletion (indefinite retention per clarification Q1)
- Operator responsible for manual cleanup if needed

---

## TypeScript Type Definitions

```typescript
// Core enums and types
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Configuration
export interface LogLevelConfig {
  level: LogLevel;
  enableFileOutput: boolean;
  enableConsoleOutput: boolean;
}

// Log entry structure
export interface LogEntry {
  timestamp: string; // ISO 8601
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

// Log file metadata
export interface LogFileMetadata {
  filePath: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
}

// Transport interface
export interface ILogTransport {
  write(level: LogLevel, formattedMessage: string): Promise<void>;
  ensureLogDirectory(): Promise<void>;
  getLogFilePath(workspaceId: string | null): string;
  close(): Promise<void>;
}

// Extended workspace context
export interface WorkspaceContext {
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  workspaceKey: string; // NEW: ws1, ws2, etc.
  enterpriseId?: string;
}
```

---

## Summary

**Total Entities**: 6 (LogLevel, LogLevelConfig, LogEntry, LogFile, LogTransport, WorkspaceContext)

**Key Design Decisions**:
- Numeric log levels enable efficient filtering
- Lazy file rotation (check on each write)
- Workspace identifier stored in context at initialization
- File logging can be disabled on errors without affecting console output
- No explicit file handles (fs.appendFile opens/closes per write)

**Compliance with Spec**:
- ✅ FR-001: Log level configuration with validation
- ✅ FR-006-007: Workspace identifiers in filenames
- ✅ FR-008: System logs use "system" identifier
- ✅ FR-009: ISO 8601 timestamps
- ✅ FR-010: Workspace metadata preserved
- ✅ FR-013: Daily rotation logic
