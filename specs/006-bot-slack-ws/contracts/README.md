# API Contracts: 複数Slackワークスペース対応

**Feature**: 006-bot-slack-ws
**Date**: 2025-10-15

## Overview

This directory contains TypeScript interface definitions that serve as contracts between different components of the multi-workspace Slack bot system.

## Contracts

### 1. `installation-store-interface.ts`

**Purpose**: Defines the contract for Slack OAuth installation storage

**Key Interfaces**:
- `InstallationStore`: Main interface for storing/retrieving workspace OAuth tokens
- `Installation`: OAuth installation data structure (from Slack OAuth flow)
- `InstallQuery`: Query parameters for fetching installations

**Implementers**:
- `src/lib/installation-store.ts` - SQLite-backed InstallationStore implementation

**Consumers**:
- `@slack/bolt` App constructor (via `installationStore` option)
- Slack OAuth flow (automatic installation storage)
- Authorize function (automatic token retrieval)

**Related Research**: See [research.md](../research.md) section 1 (Multi-workspace Slack Bolt Patterns)

---

### 2. `workspace-context.ts`

**Purpose**: Defines workspace context that flows through request processing

**Key Interfaces**:
- `WorkspaceContext`: Request-scoped workspace metadata (teamId, teamName, botToken, etc.)
- `WorkspaceLogger`: Logger interface with automatic workspace context injection

**Implementers**:
- `src/lib/workspace-context.ts` - AsyncLocalStorage-based context manager
- `src/lib/logger.ts` - Workspace-aware logger wrapper

**Consumers**:
- `src/services/slack-bot.ts` - Sets context in event handlers
- `src/services/simple-queue.ts` - Reads context for workspace-scoped queueing
- `src/services/request-processor.ts` - Reads context for workspace-scoped logging
- All service classes - Access context via `workspaceContext.getStore()`

**Related Research**: See [research.md](../research.md) section 4 (Error Isolation Patterns)

---

## Contract Principles

### 1. Type Safety

All contracts are defined as TypeScript interfaces (not implementations). This ensures:
- Compile-time type checking
- IntelliSense support in IDEs
- Clear documentation of expected data structures
- Flexibility in implementation (interface-based design)

### 2. Separation of Concerns

Contracts define **what** is expected, not **how** it is implemented:
- `InstallationStore` interface → SQLite implementation in `src/lib/`
- `WorkspaceContext` interface → AsyncLocalStorage implementation in `src/lib/`

### 3. Backward Compatibility

Contracts include optional fields to support:
- Legacy installations (pre-Enterprise Grid)
- Standard workspaces vs. Enterprise Grid installations
- Bot-only vs. user+bot installations

### 4. Error Handling

Contracts document expected error behavior:
- When to throw vs. return `undefined`
- Required error logging context
- Idempotency requirements (e.g., `deleteInstallation`)

## Usage Examples

### Using InstallationStore

```typescript
import { App } from '@slack/bolt';
import { SQLiteInstallationStore } from './lib/installation-store';
import { db } from './lib/database';

const installationStore = new SQLiteInstallationStore(db);

const app = new App({
  signingSecret: config.slackSigningSecret,
  clientId: config.slackClientId,
  clientSecret: config.slackClientSecret,
  stateSecret: config.slackStateSecret,
  scopes: ['app_mentions:read', 'chat:write'],
  installationStore, // Implements InstallationStore interface
  socketMode: true,
});

// OAuth endpoints auto-created:
// - GET /slack/install
// - GET /slack/oauth_redirect
```

### Using WorkspaceContext

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import type { WorkspaceContext } from '../contracts/workspace-context';

const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();

// Set context in event handler
app.event('app_mention', async ({ event, client, context }) => {
  const workspace: WorkspaceContext = {
    teamId: context.teamId,
    teamName: context.teamName || 'Unknown',
    botToken: context.botToken,
    botUserId: context.botUserId,
    enterpriseId: context.enterpriseId || null,
  };

  await workspaceContext.run(workspace, async () => {
    await handleMention(event, client);
  });
});

// Access context in nested functions
function handleMention(event: any, client: any): void {
  const workspace = workspaceContext.getStore();
  logger.info('Processing mention', {
    teamId: workspace.teamId,
    teamName: workspace.teamName,
  });
}
```

## Validation Rules

### InstallationStore Contract

✅ **MUST** implement all three methods: `storeInstallation`, `fetchInstallation`, `deleteInstallation`
✅ **MUST** return `Promise<void>` from `storeInstallation` and `deleteInstallation`
✅ **MUST** return `Promise<Installation | undefined>` from `fetchInstallation`
✅ **MUST** throw on database write failures (not return error codes)
✅ **MUST** return `undefined` (not throw) when installation not found
✅ **MUST** support both standard and Enterprise Grid installations

### WorkspaceContext Contract

✅ **MUST** set context at event handler boundary (not in nested functions)
✅ **MUST** include `teamId` (required for database queries)
✅ **SHOULD** include `teamName` (for human-readable logs)
✅ **MUST NEVER** log `botToken` (security requirement)
✅ **MUST** throw error if `workspaceContext.getStore()` returns `undefined` in business logic

## Testing Contracts

### Unit Tests

Test that implementations satisfy contract requirements:

```typescript
import { InstallationStore } from '../contracts/installation-store-interface';
import { SQLiteInstallationStore } from './installation-store';

describe('SQLiteInstallationStore contract compliance', () => {
  let store: InstallationStore;

  beforeEach(() => {
    store = new SQLiteInstallationStore(db);
  });

  it('implements storeInstallation', async () => {
    const installation = createMockInstallation();
    await expect(store.storeInstallation(installation)).resolves.toBeUndefined();
  });

  it('implements fetchInstallation', async () => {
    const result = await store.fetchInstallation({ teamId: 'T001' });
    expect(result).toBeInstanceOf(Object); // or undefined
  });

  it('returns undefined for non-existent installation', async () => {
    const result = await store.fetchInstallation({ teamId: 'T_NONEXISTENT' });
    expect(result).toBeUndefined();
  });

  it('implements deleteInstallation idempotently', async () => {
    await store.deleteInstallation({ teamId: 'T001' });
    await expect(store.deleteInstallation({ teamId: 'T001' })).resolves.toBeUndefined();
  });
});
```

### Integration Tests

Test contract interactions between components:

```typescript
describe('Multi-workspace request processing', () => {
  it('routes requests to correct workspace via context', async () => {
    // Setup: 2 workspaces
    const workspace1 = await installWorkspace({ teamId: 'T001', teamName: 'Team Alpha' });
    const workspace2 = await installWorkspace({ teamId: 'T002', teamName: 'Team Beta' });

    // Trigger mention in workspace 1
    await triggerMention({ teamId: 'T001', channel: 'C001', text: 'https://example.com' });

    // Assert: Request has workspace_id = 'T001'
    const request = await getLatestRequest();
    expect(request.workspaceId).toBe('T001');

    // Assert: Logs include workspace context
    expect(logs).toContainEqual({
      level: 'info',
      message: 'Processing mention',
      teamId: 'T001',
      teamName: 'Team Alpha',
    });
  });
});
```

## References

- **Slack Bolt SDK**: https://github.com/slackapi/node-slack-sdk/tree/main/packages/bolt
- **InstallationStore Docs**: https://slack.dev/node-slack-sdk/tutorials/oauth#storing-installations
- **AsyncLocalStorage**: https://nodejs.org/api/async_context.html#class-asynclocalstorage
- **Feature Spec**: [../spec.md](../spec.md)
- **Data Model**: [../data-model.md](../data-model.md)
- **Research**: [../research.md](../research.md)
