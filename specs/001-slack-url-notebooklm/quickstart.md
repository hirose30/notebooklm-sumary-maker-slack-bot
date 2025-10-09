# Quickstart: Slack NotebookLM Pro 統合ボット

## Prerequisites

- Node.js 20+ and npm installed
- Slack workspace with admin access
- NotebookLM Pro account
- Cloudflare R2 account (or AWS S3 compatible storage)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd notebooklm-sumary-maker-slack-bot
npm install
```

### 2. Database Setup

```bash
# Initialize SQLite database
npm run db:init

# Run migrations
npm run db:migrate
```

### 3. Slack App Configuration

1. Create a new Slack app at https://api.slack.com/apps
2. Enable Socket Mode in Settings → Socket Mode
3. Generate an App-Level Token with `connections:write` scope
4. Add Bot Token Scopes:
   - `app_mentions:read` - Read mentions
   - `chat:write` - Post messages
   - `channels:history` - Read channel history
   - `groups:history` - Read private channel history
5. Install the app to your workspace

### 4. Environment Configuration

Create `.env` file:

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=notebooklm-media
R2_PUBLIC_URL=https://media.yourdomain.com

# Database
DATABASE_PATH=./data/bot.db

# NotebookLM Configuration
NOTEBOOKLM_EMAIL=your-email@gmail.com
PLAYWRIGHT_HEADLESS=false  # Set to true for production
```

### 5. Initial NotebookLM Authentication

```bash
# First run - Manual login required
npm run auth:setup

# This will open a browser window
# Log in to your Google account manually
# The session will be saved to ./user-data directory
```

### 6. Start the Bot

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Usage

### Basic Operation

1. In any Slack channel where the bot is present, mention it with a URL:
   ```
   @notebooklm-bot https://example.com/article
   ```

2. The bot will respond with:
   ```
   📝 URLを受け付けました。処理を開始します...
   ```

3. After processing (10-15 minutes), the bot will reply:
   ```
   ✅ 処理が完了しました！

   🎵 Audio Overview: https://media.yourdomain.com/abc123-audio.mp3
   🎬 Video Overview: https://media.yourdomain.com/abc123-video.mp4

   (リンクは7日間有効です)
   ```

### Error Handling

If an error occurs, the bot will respond:
```
❌ 処理中にエラーが発生しました。
```

Check logs for detailed error information:
```bash
tail -f logs/bot.log
```

## Monitoring

### Check Queue Status

```bash
# View pending requests
npm run queue:status

# View processing history
npm run queue:history
```

### Database Queries

```bash
# Open SQLite CLI
sqlite3 ./data/bot.db

# Check pending requests
SELECT * FROM requests WHERE status = 'pending';

# Check recent completions
SELECT * FROM requests
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

## Troubleshooting

### Bot not responding to mentions

1. Check bot is in the channel
2. Verify Socket Mode is connected:
   ```bash
   npm run health
   ```
3. Check Slack token permissions

### NotebookLM authentication failed

1. Delete the user-data directory:
   ```bash
   rm -rf ./user-data
   ```
2. Run auth setup again:
   ```bash
   npm run auth:setup
   ```

### Processing stuck

1. Check current processing status:
   ```bash
   npm run queue:current
   ```
2. Reset stuck request:
   ```bash
   npm run queue:reset <request-id>
   ```

### Media upload failed

1. Verify R2 credentials:
   ```bash
   npm run storage:test
   ```
2. Check bucket permissions and CORS settings

## Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests (requires setup)
npm run test:e2e
```

### Local Development

```bash
# Start with hot reload
npm run dev

# Start with debugging
npm run debug
```

### Adding New Features

1. Create feature branch from `main`
2. Update schema in `src/db/migrations/`
3. Add service in `src/services/`
4. Write tests in `tests/`
5. Update this documentation

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs
```

### Using Docker

```bash
# Build image
docker build -t notebooklm-bot .

# Run container
docker run -d \
  --name notebooklm-bot \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/user-data:/app/user-data \
  --env-file .env \
  notebooklm-bot
```

### Health Monitoring

The bot exposes a health endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "queue": {
    "pending": 2,
    "processing": 1,
    "completed": 145
  },
  "uptime": 86400
}
```

## Maintenance

### Daily Tasks

- Monitor queue depth
- Check error logs
- Verify storage usage

### Weekly Tasks

- Review processing metrics
- Clean up old media files
- Update NotebookLM authentication if needed

### Monthly Tasks

- Rotate Slack tokens
- Archive old request data
- Review and optimize performance

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs in `./logs/`
3. Create an issue in the repository

## License

[Your License Here]