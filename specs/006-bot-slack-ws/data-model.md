# Data Model: 複数Slackワークスペース対応

**Feature**: 006-bot-slack-ws
**Date**: 2025-10-15

## Overview

This document defines the data model for multi-workspace Slack bot support. The model extends the existing single-workspace schema with workspace installation tracking and request-workspace association.

## Entity Relationship Diagram

```
┌─────────────────────────────┐
│ slack_installations         │
│─────────────────────────────│
│ id (PK)                     │
│ team_id (UK)                │◄──────┐
│ team_name                   │       │
│ enterprise_id               │       │
│ enterprise_name             │       │ Foreign Key
│ bot_token                   │       │
│ bot_id                      │       │
│ bot_user_id                 │       │
│ bot_scopes (JSON)           │       │
│ user_token                  │       │
│ user_id                     │       │
│ user_scopes (JSON)          │       │
│ installed_at                │       │
│ updated_at                  │       │
└─────────────────────────────┘       │
                                      │
┌─────────────────────────────┐       │
│ requests                    │       │
│─────────────────────────────│       │
│ id (PK)                     │       │
│ workspace_id (FK)           │───────┘
│ url                         │
│ slack_channel               │
│ slack_thread_ts             │
│ slack_user                  │
│ ack_message_ts              │
│ status                      │
│ progress                    │
│ current_step                │
│ error_message               │
│ created_at                  │
│ started_at                  │
│ completed_at                │
└─────────────────────────────┘
        │
        │ Foreign Key
        │
        ▼
┌─────────────────────────────┐
│ media                       │
│─────────────────────────────│
│ id (PK)                     │
│ request_id (FK)             │
│ media_type                  │
│ filename                    │
│ r2_key                      │
│ r2_public_url               │
│ file_size                   │
│ created_at                  │
│ expires_at                  │
└─────────────────────────────┘
```

## Entities

### 1. SlackInstallation (NEW)

Represents a Slack workspace installation of the bot, storing OAuth tokens and workspace metadata.

**Table Name**: `slack_installations`

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique installation identifier |
| `team_id` | TEXT | NOT NULL, UNIQUE | Slack team (workspace) ID |
| `team_name` | TEXT | NULL | Slack workspace name (for display) |
| `enterprise_id` | TEXT | NULL | Enterprise Grid ID (if applicable) |
| `enterprise_name` | TEXT | NULL | Enterprise Grid name (if applicable) |
| `bot_token` | TEXT | NOT NULL | Slack bot user OAuth token (`xoxb-...`) |
| `bot_id` | TEXT | NOT NULL | Bot ID (e.g., `B01ABCDEFGH`) |
| `bot_user_id` | TEXT | NOT NULL | Bot user ID (e.g., `U01ABCDEFGH`) |
| `bot_scopes` | TEXT | NOT NULL | JSON array of bot scopes (e.g., `["app_mentions:read", "chat:write"]`) |
| `user_token` | TEXT | NULL | User OAuth token (if user installation) |
| `user_id` | TEXT | NULL | Installing user ID |
| `user_scopes` | TEXT | NULL | JSON array of user scopes |
| `installed_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Installation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last token refresh/update timestamp |

**Indexes**:
- `idx_slack_installations_team_id` on `team_id` (unique lookup)
- Composite unique constraint: `UNIQUE(team_id, enterprise_id)` (handles both standard and Enterprise Grid installations)

**Validation Rules**:
- `team_id` must match Slack team ID format (`T[A-Z0-9]+`)
- `bot_token` must start with `xoxb-`
- `bot_scopes` must be valid JSON array
- No duplicate `team_id` for standard workspaces (enterprise_id IS NULL)

**State Transitions**:
- **Install**: OAuth flow creates new record
- **Reinstall/Token Refresh**: Updates existing record (matched by `team_id`)
- **Uninstall**: Deletes record (cascade deletes not implemented - orphaned requests remain for audit trail)

### 2. Request (MODIFIED)

Represents a NotebookLM processing request from a Slack workspace. **Extended with workspace association**.

**Table Name**: `requests`

**Attributes** (new column highlighted):

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique request identifier |
| **`workspace_id`** | **TEXT** | **NULL, FOREIGN KEY → slack_installations.team_id** | **Associated workspace team ID** |
| `url` | TEXT | NOT NULL | Source URL for NotebookLM processing |
| `slack_channel` | TEXT | NOT NULL | Slack channel ID (e.g., `C01ABCDEFGH`) |
| `slack_thread_ts` | TEXT | NOT NULL | Slack thread timestamp (for replies) |
| `slack_user` | TEXT | NOT NULL | Requesting user ID (e.g., `U01ABCDEFGH`) |
| `ack_message_ts` | TEXT | NULL | Acknowledgment message timestamp (for deletion) |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | Processing status: `pending`, `processing`, `completed`, `failed` |
| `progress` | INTEGER | DEFAULT 0 | Processing progress (0-100) |
| `current_step` | TEXT | NULL | Current processing step description |
| `error_message` | TEXT | NULL | Error message if status is `failed` |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Request creation timestamp |
| `started_at` | DATETIME | NULL | Processing start timestamp |
| `completed_at` | DATETIME | NULL | Processing completion timestamp |

**Indexes**:
- `idx_requests_status` on `status` (existing)
- `idx_requests_created_at` on `created_at` (existing)
- **`idx_requests_workspace_id` on `workspace_id`** (NEW - for filtering requests by workspace)

**Validation Rules**:
- `workspace_id` must exist in `slack_installations.team_id` (or be NULL for legacy data)
- `status` must be one of: `pending`, `processing`, `completed`, `failed`
- `progress` must be between 0 and 100
- `url` must be valid HTTP/HTTPS URL

**State Transitions**:
```
pending → processing → completed
                    ↘ failed
```

**Migration Notes**:
- Existing records will have `workspace_id = NULL` after migration
- Application code can backfill `workspace_id` from environment variable (`SLACK_TEAM_ID`) for legacy data
- Future migrations may enforce `workspace_id NOT NULL` after backfill

### 3. Media (UNCHANGED)

Represents generated audio/video files from NotebookLM processing. **No schema changes required**.

**Table Name**: `media`

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique media file identifier |
| `request_id` | INTEGER | NOT NULL, FOREIGN KEY → requests.id | Associated request |
| `media_type` | TEXT | NOT NULL | Media type: `audio` or `video` |
| `filename` | TEXT | NOT NULL | Original filename |
| `r2_key` | TEXT | NOT NULL | Cloudflare R2 object key |
| `r2_public_url` | TEXT | NOT NULL | Public URL for download (expires in 7 days) |
| `file_size` | INTEGER | NULL | File size in bytes |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | File creation timestamp |
| `expires_at` | DATETIME | NULL | URL expiration timestamp (7 days from creation) |

**Indexes**:
- `idx_media_request_id` on `request_id` (existing)
- `idx_media_expires_at` on `expires_at` (existing)

**Workspace Association**:
- Media files are associated with workspaces **indirectly** via `request_id → requests.workspace_id`
- R2 bucket is shared across all workspaces (no per-workspace isolation)
- Public URLs are accessible from any workspace

## TypeScript Type Definitions

### SlackInstallation

```typescript
/**
 * Slack workspace installation record
 * Stores OAuth tokens and workspace metadata
 */
export interface SlackInstallation {
  id: number;
  teamId: string;
  teamName: string | null;
  enterpriseId: string | null;
  enterpriseName: string | null;
  botToken: string;
  botId: string;
  botUserId: string;
  botScopes: string[]; // Parsed from JSON
  userToken: string | null;
  userId: string | null;
  userScopes: string[] | null; // Parsed from JSON
  installedAt: Date;
  updatedAt: Date;
}

/**
 * Raw database row for slack_installations table
 */
export interface SlackInstallationRow {
  id: number;
  team_id: string;
  team_name: string | null;
  enterprise_id: string | null;
  enterprise_name: string | null;
  bot_token: string;
  bot_id: string;
  bot_user_id: string;
  bot_scopes: string; // JSON string
  user_token: string | null;
  user_id: string | null;
  user_scopes: string | null; // JSON string
  installed_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
```

### Request (Updated)

```typescript
/**
 * NotebookLM processing request
 * Extended with workspace_id for multi-workspace support
 */
export interface Request {
  id: number;
  workspaceId: string | null; // NEW: Associated workspace team ID
  url: string;
  slackChannel: string;
  slackThreadTs: string;
  slackUser: string;
  ackMessageTs: string | null;
  status: RequestStatus;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Raw database row for requests table
 */
export interface RequestRow {
  id: number;
  workspace_id: string | null; // NEW
  url: string;
  slack_channel: string;
  slack_thread_ts: string;
  slack_user: string;
  ack_message_ts: string | null;
  status: string;
  progress: number;
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
```

### Media (Unchanged)

```typescript
/**
 * Generated media file (audio/video)
 * No changes for multi-workspace support
 */
export interface Media {
  id: number;
  requestId: number;
  mediaType: 'audio' | 'video';
  filename: string;
  r2Key: string;
  r2PublicUrl: string;
  fileSize: number | null;
  createdAt: Date;
  expiresAt: Date | null;
}
```

## Database Migration Script

**File**: `src/db/migrations/003_multi_workspace.sql`

```sql
-- Migration 003: Multi-workspace support
-- Adds slack_installations table and workspace_id to requests

-- New table: Slack workspace installations (OAuth tokens)
CREATE TABLE IF NOT EXISTS slack_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  team_name TEXT,
  enterprise_id TEXT,
  enterprise_name TEXT,
  bot_token TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  bot_scopes TEXT NOT NULL, -- JSON array
  user_token TEXT,
  user_id TEXT,
  user_scopes TEXT, -- JSON array
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, enterprise_id)
);

-- Expand: Add workspace_id to existing requests table
-- Nullable for backward compatibility with existing data
ALTER TABLE requests ADD COLUMN workspace_id TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_workspace_id ON requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(team_id);

-- Note: Foreign key constraint not added (SQLite ALTER TABLE limitation)
-- Application code enforces referential integrity
```

## Data Access Patterns

### 1. Fetch Installation by Team ID

**Use Case**: Authorize Slack API calls for a specific workspace

```typescript
function getInstallation(teamId: string): SlackInstallation | null {
  const row = db.prepare(`
    SELECT * FROM slack_installations
    WHERE team_id = ? AND enterprise_id IS NULL
  `).get(teamId) as SlackInstallationRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    enterpriseId: row.enterprise_id,
    enterpriseName: row.enterprise_name,
    botToken: row.bot_token,
    botId: row.bot_id,
    botUserId: row.bot_user_id,
    botScopes: JSON.parse(row.bot_scopes),
    userToken: row.user_token,
    userId: row.user_id,
    userScopes: row.user_scopes ? JSON.parse(row.user_scopes) : null,
    installedAt: new Date(row.installed_at),
    updatedAt: new Date(row.updated_at),
  };
}
```

### 2. List All Active Workspaces

**Use Case**: Startup validation, admin dashboard

```typescript
function listInstallations(): SlackInstallation[] {
  const rows = db.prepare(`
    SELECT * FROM slack_installations
    ORDER BY installed_at DESC
  `).all() as SlackInstallationRow[];

  return rows.map(row => ({
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    // ... (same mapping as above)
  }));
}
```

### 3. Get Requests for Workspace

**Use Case**: Workspace-specific request history, debugging

```typescript
function getRequestsByWorkspace(workspaceId: string, limit: number = 100): Request[] {
  const rows = db.prepare(`
    SELECT * FROM requests
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(workspaceId, limit) as RequestRow[];

  return rows.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    url: row.url,
    // ... (camelCase mapping)
  }));
}
```

### 4. Get Pending Requests (All Workspaces)

**Use Case**: Request processor queue

```typescript
function getPendingRequests(): Request[] {
  const rows = db.prepare(`
    SELECT * FROM requests
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all() as RequestRow[];

  return rows.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    // ... (camelCase mapping)
  }));
}
```

## Constraints and Invariants

### Data Integrity

1. **Unique Workspace**: Each `team_id` can only have one active installation (enforced by `UNIQUE(team_id, enterprise_id)`)
2. **Valid Workspace Reference**: All `requests.workspace_id` values must exist in `slack_installations.team_id` (enforced by application, not DB)
3. **Valid Status**: `requests.status` must be one of: `pending`, `processing`, `completed`, `failed`
4. **Progress Range**: `requests.progress` must be 0-100
5. **Media Association**: All `media.request_id` values must exist in `requests.id` (enforced by FOREIGN KEY)

### Business Rules

1. **Workspace Isolation**: Requests from workspace A must never receive responses in workspace B
2. **Shared Media**: Media files in R2 can be accessed from any workspace (public URLs)
3. **Legacy Data**: Requests with `workspace_id = NULL` are legacy (pre-migration) data
4. **Token Security**: `bot_token` and `user_token` must never be logged or exposed in API responses

## Migration Strategy

### Phase 1: Schema Expansion (Backward Compatible)

1. Run migration `003_multi_workspace.sql`
2. New `slack_installations` table created
3. New `workspace_id` column added to `requests` (nullable)
4. Old code continues to work (ignores `workspace_id`)

### Phase 2: Data Backfill (Optional)

**Option A**: Backfill existing requests with default workspace
```typescript
// During startup, if SLACK_TEAM_ID env var exists
const defaultTeamId = process.env.SLACK_TEAM_ID;
if (defaultTeamId) {
  db.prepare(`
    UPDATE requests
    SET workspace_id = ?
    WHERE workspace_id IS NULL
  `).run(defaultTeamId);
}
```

**Option B**: Leave legacy data as-is
- `workspace_id = NULL` indicates pre-migration requests
- These requests are read-only (no new responses sent)

### Phase 3: Code Deployment

1. Deploy new code with multi-workspace support
2. OAuth flow creates installations in `slack_installations`
3. New requests automatically get `workspace_id` populated
4. Old requests remain accessible (filtered queries handle NULL)

### Phase 4: Cleanup (Future)

**Optional**: Make `workspace_id` NOT NULL
- Requires SQLite table rebuild (no ALTER COLUMN support)
- Only after all legacy data is backfilled or archived
- Migration `004_workspace_id_not_null.sql` (not implemented in this phase)

## Testing Considerations

### Unit Tests

1. **Installation CRUD**: Test insert, update, delete, fetch operations
2. **Workspace Association**: Test requests are correctly associated with workspace_id
3. **Legacy Data Handling**: Test queries handle `workspace_id = NULL` gracefully

### Integration Tests

1. **Multi-Workspace Routing**: Create 2+ installations, verify requests route to correct workspace
2. **Workspace Isolation**: Verify errors in workspace A don't affect workspace B
3. **Shared Media**: Verify media URLs work across workspaces
4. **Migration**: Test schema migration runs successfully on empty and populated databases

### Data Scenarios

```typescript
// Test Scenario: 3 workspaces with isolated requests
const workspace1 = createInstallation({ teamId: 'T001', teamName: 'Team Alpha' });
const workspace2 = createInstallation({ teamId: 'T002', teamName: 'Team Beta' });
const workspace3 = createInstallation({ teamId: 'T003', teamName: 'Team Gamma' });

const request1 = createRequest({ workspaceId: 'T001', url: 'https://example.com/1' });
const request2 = createRequest({ workspaceId: 'T002', url: 'https://example.com/2' });
const legacyRequest = createRequest({ workspaceId: null, url: 'https://example.com/old' });

// Assert: getRequestsByWorkspace('T001') returns only request1
// Assert: getRequestsByWorkspace('T002') returns only request2
// Assert: getPendingRequests() returns all 3 requests
```
