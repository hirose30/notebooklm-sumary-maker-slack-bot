# Slack OAuth Scopes Configuration

## Required Scopes for Infographic Upload

To enable infographic file upload to Slack, the following OAuth scopes are required:

### Bot Token Scopes

Configure these in Slack App Management → **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**:

- `files:write` - **Required for infographic upload** (feature 009)
- `files:read` - Optional, for file metadata verification
- `chat:write` - Already configured (existing feature)
- `channels:read` - Already configured (existing feature)
- `groups:read` - Already configured (existing feature)

## Verification

After adding `files:write` scope:

1. **Reinstall to Workspace** in Slack App Management
2. Update `.env` file with new `SLACK_WS*_BOT_TOKEN`
3. Restart bot: `npm run bot:start:ws1`

## Testing

```bash
# Verify token scopes
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test | jq '.scopes'
```

Expected output should include `files:write`.

## Reference

- Slack API: [files.uploadV2](https://api.slack.com/methods/files.uploadV2)
- Quickstart guide: [../specs/009-notebooklm-dl-slack/quickstart.md](../specs/009-notebooklm-dl-slack/quickstart.md)
