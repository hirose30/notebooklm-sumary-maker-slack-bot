# Quickstart Guide: Multi-Workspace Slack Bot Setup

**Feature**: 006-bot-slack-ws
**Date**: 2025-10-15

## Overview

This guide walks through migrating from single-workspace to multi-workspace configuration and setting up additional Slack workspaces.

## Prerequisites

- Node.js 20+ installed
- Existing single-workspace NotebookLM Slack bot running
- Access to Slack workspace(s) with permission to install apps
- Cloudflare R2 bucket already configured

## Migration Steps

### Step 1: Update Environment Variables

**Before** (single workspace):
```bash
# .env
SLACK_BOT_TOKEN=xoxb-1234567890-1234567890123-abc...
SLACK_APP_TOKEN=xapp-1-A01ABCDEFGH-1234567890123-def...
SLACK_SIGNING_SECRET=1234567890abcdefghijklmnopqrst
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://pub-....r2.dev
NOTEBOOKLM_EMAIL=your-email@example.com
```

**After** (multi-workspace):
```bash
# .env
# OAuth credentials (from Slack App settings)
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=abcdef1234567890abcdef1234567890
SLACK_STATE_SECRET=your-random-32-char-secret-here-12345
SLACK_SIGNING_SECRET=1234567890abcdefghijklmnopqrst

# Socket Mode (for development/testing)
SLACK_APP_TOKEN=xapp-1-A01ABCDEFGH-1234567890123-def...

# Remove these (now stored in database per workspace):
# SLACK_BOT_TOKEN=xoxb-...  ❌ DELETE
# SLACK_APP_TOKEN=xapp-...  ℹ️ Keep for Socket Mode, but installations use OAuth

# Cloudflare R2 (unchanged - shared across workspaces)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://pub-....r2.dev

# NotebookLM (unchanged - shared across workspaces)
NOTEBOOKLM_EMAIL=your-email@example.com

# Optional (development)
PLAYWRIGHT_HEADLESS=true
USER_DATA_DIR=./user-data
```

### Step 2: Generate OAuth Credentials

1. Go to https://api.slack.com/apps
2. Select your app (or create new app from existing manifest)
3. Navigate to **OAuth & Permissions** → **Redirect URLs**
4. Add redirect URL: `https://your-bot-domain.com/slack/oauth_redirect`
   - For local development: `http://localhost:3000/slack/oauth_redirect`
5. Navigate to **Basic Information** → **App Credentials**
6. Copy:
   - **Client ID** → `SLACK_CLIENT_ID`
   - **Client Secret** → `SLACK_CLIENT_SECRET`
   - **Signing Secret** → `SLACK_SIGNING_SECRET`
7. Generate random 32+ character secret for `SLACK_STATE_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 3: Update Slack App Manifest (Enable Distribution)

```yaml
# app-manifest.yaml
display_information:
  name: NotebookLM Summary Bot
  description: Generate audio/video summaries from URLs using NotebookLM
  background_color: "#2c2d30"

features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: NotebookLM Bot
    always_online: true

oauth_config:
  redirect_urls:
    - https://your-bot-domain.com/slack/oauth_redirect
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - channels:history
      - groups:history
      - im:history
      - mpim:history

settings:
  event_subscriptions:
    request_url: https://your-bot-domain.com/slack/events
    bot_events:
      - app_mention
  org_deploy_enabled: false  # Set true for Enterprise Grid
  socket_mode_enabled: true  # For development/testing
  token_rotation_enabled: false

# Note: With OAuth, bot can be installed in multiple workspaces
```

### Step 4: Run Database Migration

```bash
# Migration runs automatically on startup
# But you can verify migration status:

npm run bot:start

# Check logs for:
# ✅ "Applied migration: version=3, file=003_multi_workspace.sql"
# ✅ "Database initialized successfully"
```

**What the migration does**:
- Creates `slack_installations` table
- Adds `workspace_id` column to `requests` table (nullable)
- Creates indexes for performance

### Step 5: Install Bot in First Workspace (OAuth Flow)

**Option A: Via Installation URL** (Recommended)

1. Start your bot:
   ```bash
   npm run bot:start
   ```

2. Navigate to OAuth installation URL:
   ```
   https://your-bot-domain.com/slack/install
   ```

3. Click "Add to Slack"

4. Select workspace and authorize scopes

5. After redirect, check logs:
   ```
   ✅ Installation stored for team T01ABCDEFGH (Team Alpha)
   ```

**Option B: Manual Database Insert** (For migration from env vars)

If you want to preserve your existing workspace without OAuth flow:

```typescript
// scripts/migrate-env-vars-to-db.ts
import { db } from './src/lib/database.js';

const EXISTING_TEAM_ID = 'T01ABCDEFGH'; // From Slack workspace settings
const EXISTING_TEAM_NAME = 'Your Workspace Name';
const EXISTING_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;

db.prepare(`
  INSERT INTO slack_installations (
    team_id,
    team_name,
    enterprise_id,
    bot_token,
    bot_id,
    bot_user_id,
    bot_scopes
  ) VALUES (?, ?, NULL, ?, ?, ?, ?)
`).run(
  EXISTING_TEAM_ID,
  EXISTING_TEAM_NAME,
  EXISTING_BOT_TOKEN,
  'B01ABCDEFGH', // Get from Slack App settings
  'U01ABCDEFGH', // Get from Slack App settings
  JSON.stringify(['app_mentions:read', 'chat:write'])
);

// Backfill existing requests
db.prepare(`
  UPDATE requests
  SET workspace_id = ?
  WHERE workspace_id IS NULL
`).run(EXISTING_TEAM_ID);

console.log('✅ Migration complete');
```

Run migration:
```bash
npx tsx scripts/migrate-env-vars-to-db.ts
```

### Step 6: Install Bot in Additional Workspaces

For each additional workspace:

1. Navigate to OAuth installation URL:
   ```
   https://your-bot-domain.com/slack/install
   ```

2. Click "Add to Slack"

3. **Important**: Select the **different workspace** from dropdown

4. Authorize scopes

5. Verify installation in logs:
   ```
   ✅ Installation stored for team T02ZYXWVUTS (Team Beta)
   ```

6. Test in new workspace:
   ```
   @NotebookLM Bot https://example.com/article
   ```

### Step 7: Verify Multi-Workspace Operation

**Check database**:
```sql
sqlite3 ./data/bot.db

-- List all installed workspaces
SELECT team_id, team_name, installed_at FROM slack_installations;

-- Expected output:
-- T01ABCDEFGH | Team Alpha | 2025-10-15 10:00:00
-- T02ZYXWVUTS | Team Beta  | 2025-10-15 10:05:00

-- Check requests are associated with workspaces
SELECT id, workspace_id, url, status FROM requests ORDER BY created_at DESC LIMIT 10;
```

**Check logs** (should include workspace context):
```
INFO: Processing mention teamId=T01ABCDEFGH teamName="Team Alpha" channel=C01...
INFO: Job added to queue jobId=123 teamId=T01ABCDEFGH
INFO: Processing request teamId=T01ABCDEFGH requestId=123
INFO: Posted completion results teamId=T01ABCDEFGH jobId=123
```

**Test workspace isolation**:

1. Send request from Workspace A:
   ```
   @NotebookLM Bot https://example.com/article-a
   ```

2. Send request from Workspace B:
   ```
   @NotebookLM Bot https://example.com/article-b
   ```

3. Verify each workspace receives only its own responses (no cross-posting)

## Troubleshooting

### Error: "Missing required environment variable: SLACK_CLIENT_ID"

**Solution**: Add OAuth credentials to `.env` (see Step 1)

### Error: "Database schema version too old"

**Solution**: Ensure migration 003 has run. Check `schema_version` table:
```sql
SELECT * FROM schema_version ORDER BY version DESC LIMIT 1;
```

If version < 3, delete database and restart:
```bash
rm ./data/bot.db
npm run bot:start
```

### Error: "Installation not found for team T01..."

**Cause**: OAuth installation missing for workspace

**Solution**: Re-run OAuth flow or manually insert installation (see Step 5 Option B)

### Bot responds in wrong workspace

**Cause**: `workspace_id` mismatch in database

**Solution**: Check requests table:
```sql
SELECT id, workspace_id, slack_channel FROM requests WHERE id = <failing_job_id>;
```

Verify `workspace_id` matches the channel's workspace.

### OAuth redirect fails: "invalid_redirect_uri"

**Cause**: Redirect URL not configured in Slack App settings

**Solution**:
1. Go to https://api.slack.com/apps → Your App → OAuth & Permissions
2. Add redirect URL: `https://your-bot-domain.com/slack/oauth_redirect`
3. Save changes
4. Retry installation

## Advanced Configuration

### Enterprise Grid Installation

For Enterprise Grid workspaces, enable org-wide installation:

```yaml
# app-manifest.yaml
settings:
  org_deploy_enabled: true
```

Then handle enterprise installs:
```typescript
// Detects Enterprise Grid installations
if (installation.isEnterpriseInstall) {
  // Enterprise-wide installation
  console.log('Enterprise:', installation.enterprise.id);
} else {
  // Standard workspace installation
  console.log('Team:', installation.team.id);
}
```

### Custom Installation Landing Page

Customize `/slack/install` endpoint:

```typescript
import { App } from '@slack/bolt';

const app = new App({
  // ... OAuth config
  installerOptions: {
    directInstall: true, // Skip landing page, go straight to Slack
    // Or customize landing page:
    renderHtmlForInstallPath: (url) => `
      <html>
        <body>
          <h1>Install NotebookLM Bot</h1>
          <a href="${url}">
            <img src="https://platform.slack-edge.com/img/add_to_slack.png" />
          </a>
        </body>
      </html>
    `,
  },
});
```

### Uninstalling from Workspace

When workspace uninstalls the bot:

1. Slack sends `app_uninstalled` event
2. `installationStore.deleteInstallation()` is called automatically
3. Database record is deleted
4. Existing requests remain (for audit trail)

To clean up old requests:
```sql
DELETE FROM requests WHERE workspace_id = 'T01ABCDEFGH';
DELETE FROM media WHERE request_id IN (
  SELECT id FROM requests WHERE workspace_id = 'T01ABCDEFGH'
);
```

## Production Deployment

### HTTPS Required for OAuth

OAuth redirect requires HTTPS in production:

**Option 1: Deploy to cloud with HTTPS**
- Heroku, Render, Railway (automatic HTTPS)
- AWS EC2 + Load Balancer (ALB with SSL certificate)
- Cloudflare Tunnel (automatic HTTPS)

**Option 2: Use ngrok for testing**
```bash
ngrok http 3000

# Use ngrok URL in Slack App redirect URL:
# https://abc123.ngrok.io/slack/oauth_redirect
```

### Environment Variables in Production

**Heroku**:
```bash
heroku config:set SLACK_CLIENT_ID=1234567890.1234567890
heroku config:set SLACK_CLIENT_SECRET=abcdef...
heroku config:set SLACK_STATE_SECRET=random32chars...
```

**Docker**:
```yaml
# docker-compose.yml
environment:
  - SLACK_CLIENT_ID=${SLACK_CLIENT_ID}
  - SLACK_CLIENT_SECRET=${SLACK_CLIENT_SECRET}
  - SLACK_STATE_SECRET=${SLACK_STATE_SECRET}
```

### Database Persistence

Ensure SQLite database persists across deployments:

**Docker volume**:
```yaml
# docker-compose.yml
volumes:
  - ./data:/app/data
```

**Heroku** (not recommended for SQLite - use PostgreSQL):
```bash
# SQLite on ephemeral filesystem will lose data on restart
# Consider migrating to PostgreSQL for Heroku
```

## Next Steps

After successful multi-workspace setup:

1. **Monitor logs** for workspace context in all events
2. **Test workspace isolation** with concurrent requests
3. **Set up alerts** for OAuth token expiration (if Slack implements rotation)
4. **Document** which workspaces are installed (team IDs and names)
5. **Plan** for workspace-specific configuration (if needed in future)

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Research**: [research.md](./research.md)
- **Slack OAuth Guide**: https://api.slack.com/authentication/oauth-v2
- **Bolt Multi-Workspace**: https://slack.dev/bolt-js/concepts#multi-workspace-installation
