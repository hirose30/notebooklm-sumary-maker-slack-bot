# Feature Specification: Logging System Redesign

**Feature Branch**: `007-log-sqlite-input`
**Created**: 2025-10-17
**Status**: Draft
**Input**: User description: "logの仕様を考え直したい。いま出ている、SQLiteの実行クエリが表示されているのは不要だと思う。ログレベルでコントロールされるべき。また、標準出力される情報は、Inputがあり、NotebookLMで処理がなされ、ファイルがアップロードされ、Skacに返信する一連の流れ、だけでいいと思う。
 また、ログファイルは出力されるべきで。ログファイル名には、ws1か2かの識別子の有無が欲しい。"

## Clarifications

### Session 2025-10-18

- Q: What log rotation strategy should the system use to prevent unbounded disk space growth? → A: Daily rotation - create new log file each day, keep all historical files indefinitely
- Q: What should the system do when log files cannot be written (disk full, permission denied)? → A: Log error to stderr only and continue operation - bot continues processing requests without persistent logs
- Q: How should the system organize logs from bot startup and system-level operations that occur before workspace context is available? → A: Write to a shared system log file with daily rotation (format: `system-YYYY-MM-DD.log`, no workspace identifier)
- Q: What should happen when the log level environment variable is set to an invalid value? → A: Default to INFO level and log a warning about the invalid value to stderr
- Q: How should the system handle concurrent writes to the same log file from different workspaces? → A: Rely on Node.js file system append operations being atomic at the OS level - no additional locking

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Console Output for Monitoring (Priority: P1)

As an operator monitoring the bot's standard output, I need to see only the essential flow of requests (Input received → NotebookLM processing → File upload → Slack response) without verbose debug details, so I can quickly understand the system's current state and identify issues.

**Why this priority**: This is the most critical improvement because operators currently see SQLite queries polluting the console output, making it difficult to monitor the actual business flow. Clean console output is essential for day-to-day operations.

**Independent Test**: Can be fully tested by running the bot with a single URL mention in Slack and verifying that stdout shows only high-level flow steps without database query details. Delivers immediate value by making monitoring easier.

**Acceptance Scenarios**:

1. **Given** the bot receives a URL mention in Slack, **When** processing the request, **Then** stdout displays only: request received, NotebookLM processing started, audio/video generation completed, files uploaded, Slack response sent
2. **Given** the bot is running with default configuration, **When** SQLite executes queries, **Then** these queries do NOT appear in stdout
3. **Given** an operator is monitoring stdout, **When** multiple requests are processed concurrently, **Then** each request's flow is clearly distinguishable and readable

---

### User Story 2 - Log Level Control for Debugging (Priority: P2)

As a developer troubleshooting issues, I need to enable detailed debug logging (including SQLite queries) via configuration, so I can diagnose problems without modifying code.

**Why this priority**: While not needed for normal operations, this is essential for troubleshooting. Developers occasionally need to see SQL queries and internal details to diagnose issues.

**Independent Test**: Can be tested independently by setting a log level environment variable to DEBUG and verifying that SQLite queries appear in output. Delivers value for debugging scenarios.

**Acceptance Scenarios**:

1. **Given** log level is set to DEBUG, **When** SQLite executes queries, **Then** these queries appear in the log output
2. **Given** log level is set to INFO (default), **When** the bot processes requests, **Then** only high-level flow information is logged
3. **Given** log level is set to ERROR, **When** normal operations occur, **Then** only error messages are logged
4. **Given** log level is changed via environment variable, **When** the bot restarts, **Then** the new log level takes effect immediately

---

### User Story 3 - Persistent Log Files with Workspace Context (Priority: P1)

As an operator reviewing historical issues, I need log files that persist all log output with clear workspace identification in filenames, so I can audit past activity and troubleshoot workspace-specific problems.

**Why this priority**: Currently, all logs go to console only and are lost when the process restarts. Persistent logs are critical for production operations, troubleshooting, and compliance.

**Independent Test**: Can be tested by processing requests from multiple workspaces and verifying that log files are created with workspace identifiers in their names and contain complete log history.

**Acceptance Scenarios**:

1. **Given** the bot is running, **When** it processes requests, **Then** all log output is written to persistent log files
2. **Given** a request is processed for workspace WS1, **When** logs are written, **Then** the log filename includes the workspace identifier (e.g., "ws1")
3. **Given** a request is processed for workspace WS2, **When** logs are written, **Then** a separate log file with "ws2" identifier is used
4. **Given** log files exist from previous days, **When** the bot runs today, **Then** old log files are retained and new logs are appended or written to new date-based files
5. **Given** an operator needs to review logs, **When** they open the logs directory, **Then** log files are clearly organized by workspace and date

---

### Edge Cases

All critical edge cases have been addressed in the Functional Requirements and Clarifications sections.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support configurable log levels (ERROR, WARN, INFO, DEBUG) controllable via environment variable; if an invalid log level is provided, the system MUST default to INFO level and log a warning about the invalid value to stderr
- **FR-002**: System MUST hide SQLite query logs from stdout when log level is INFO or higher (default)
- **FR-003**: System MUST show SQLite query logs when log level is DEBUG
- **FR-004**: System MUST output to stdout only high-level business flow logs: request received, NotebookLM processing status, file upload status, Slack response status
- **FR-005**: System MUST write all log output to persistent log files in the logs directory
- **FR-006**: System MUST include workspace identifier (ws1, ws2, etc.) in log filenames for workspace-specific logs
- **FR-007**: System MUST create separate log files per workspace to enable workspace-specific log analysis
- **FR-008**: System MUST handle system-level logs (startup, workspace loading) that occur before workspace context is available by writing them to a shared system log file with daily rotation (format: `system-YYYY-MM-DD.log`)
- **FR-009**: System MUST include timestamps in ISO 8601 format for all log entries
- **FR-010**: System MUST preserve the current workspace-aware logging behavior (automatic injection of teamId and teamName in log metadata)
- **FR-011**: System MUST ensure log files are created with appropriate permissions (readable by operators)
- **FR-012**: System MUST handle log write failures gracefully without crashing the bot; when log files cannot be written (disk full, permission denied), the system MUST log the error to stderr and continue operation without persistent logs
- **FR-013**: System MUST rotate log files daily, creating a new log file each day while retaining all historical log files indefinitely

### Key Entities *(include if feature involves data)*

- **Log Level Configuration**: Environment-based setting that controls verbosity (ERROR, WARN, INFO, DEBUG); default is INFO
- **Log Entry**: Timestamped message with severity level, message text, and optional metadata (workspace context, job details)
- **Log File**: Persistent file containing log entries; identified by workspace and date/rotation criteria
- **Workspace Context**: Team identifier (WS1, WS2, etc.) and associated metadata (teamId, teamName) that determines log file routing

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can monitor stdout and see only high-level request flow (4-6 key steps per request) without SQLite query noise
- **SC-002**: Developers can enable DEBUG logging and see complete execution details including all SQLite queries
- **SC-003**: Log files persist all log output with 100% of entries preserved across bot restarts
- **SC-004**: Log files are clearly identifiable by workspace (WS1, WS2) in filename, enabling operators to quickly locate relevant logs
- **SC-005**: Operators can locate and review workspace-specific logs within 30 seconds when troubleshooting issues
- **SC-006**: Log file writes do not cause performance degradation (request processing time remains under 2 minutes for typical URLs)

## Assumptions

- The existing AsyncLocalStorage-based workspace context mechanism will continue to work and provide workspace identification
- The custom logger in `/src/lib/logger.ts` will be enhanced rather than replaced with a third-party library (consistent with the existing "can be upgraded later" comment)
- Log file format will remain consistent with current console format: `[ISO_TIMESTAMP] LEVEL: message {metadata}`
- The logs directory (`./logs/`) will be created automatically if it doesn't exist (via T001) and will be used for log file output
- Workspace identifiers (WS1, WS2) will be extracted from the environment variable names (`SLACK_WS1_BOT_TOKEN`, etc.) or from workspace context
- Each workspace uses a separate Chrome user-data directory (`./user-data-ws1`, `./user-data-ws2`, etc.) to enable different NotebookLM accounts to be logged in simultaneously for multi-workspace deployments
- Standard output (stdout) will continue to be the primary interface for real-time monitoring; log files are for persistence and historical review
- Log level changes require bot restart (no dynamic log level changes at runtime)
- Concurrent log writes rely on Node.js file system append operations being atomic at the OS level (no additional file locking mechanism required)
