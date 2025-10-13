# Research: Slack NotebookLM Pro 統合ボット (軽量版)

## Technology Decisions

### Database Choice
**Decision**: SQLite
**Rationale**:
- Single-file database with zero configuration overhead
- Perfect for serial processing (one request at a time)
- Built-in transaction support for queue management
- No external dependencies or services to manage
**Alternatives considered**:
- PostgreSQL: Rejected due to operational complexity for single-bot use case
- Redis + BullMQ: Overkill for serial processing requirements

### UI Automation Framework
**Decision**: Playwright
**Rationale**:
- Superior Chrome DevTools Protocol (CDP) support
- Built-in browser context persistence for authentication
- Excellent network interception capabilities for download URL capture
- Better TypeScript support than Puppeteer
**Alternatives considered**:
- Puppeteer: Less feature-rich CDP integration
- Selenium: Poor performance for long-running operations
- Chrome DevTools MCP: Unnecessary abstraction layer

### Queue Implementation
**Decision**: SQLite-based simple queue
**Rationale**:
- Leverages existing database for state management
- Simple status-based processing (pending → processing → completed)
- No additional infrastructure required
- Adequate for serial processing model
**Alternatives considered**:
- BullMQ/Redis: Unnecessary complexity for serial processing
- p-queue: In-memory only, loses state on restart
- AWS SQS: External dependency with cost implications

### Cloud Storage
**Decision**: Cloudflare R2
**Rationale**:
- S3-compatible API (AWS SDK v3 works out of the box)
- Generous free tier (10GB storage, 1M requests/month)
- No egress fees
- Simple public URL generation
**Alternatives considered**:
- Google Drive: API complexity, quota limitations
- AWS S3: Higher cost, egress fees
- Local storage: Not suitable for 7-day retention requirement

## Best Practices Research

### Playwright Authentication Persistence
```typescript
// Best practice: Use launchPersistentContext for auth state
const context = await chromium.launchPersistentContext('./user-data', {
  headless: process.env.NODE_ENV === 'production',
  args: ['--disable-blink-features=AutomationControlled']
});
```
- Store auth in `./user-data` directory
- Manual login required only after deployment/restart
- Survives process restarts

### Long-running Process Management
```typescript
// Set appropriate timeouts for 15-minute operations
page.setDefaultTimeout(15 * 60 * 1000);
page.setDefaultNavigationTimeout(30000);
```
- Use page-level timeouts, not global
- Implement progress tracking for user feedback
- Handle network idle states properly

### SQLite Concurrent Access
```sql
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```
- WAL mode allows readers while writing
- Busy timeout prevents lock errors
- Still maintains serial processing guarantee

### Network Response Interception
```typescript
// Best practice: Use response event for download URL capture
page.on('response', async (response) => {
  if (response.url().includes('download')) {
    const url = response.url();
    // Process download URL
  }
});
```
- More reliable than waiting for download events
- Can intercept blob URLs and redirects
- Works with streaming responses

## Integration Patterns

### Slack Bot Architecture
```typescript
// Socket Mode for simplified deployment
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});
```
- Socket Mode eliminates webhook complexity
- No public URL required
- Automatic reconnection handling

### Error Handling Strategy
```typescript
// Simple user-facing errors as per requirement
try {
  await processRequest(url);
} catch (error) {
  await slack.reply("処理中にエラーが発生しました。");
  logger.error('Processing failed', error);
}
```
- User gets simple message
- Full error logged for debugging
- No retry suggestions to user

### Media File Handling
```typescript
// Stream directly to R2 without local storage
const response = await page.waitForResponse(/* ... */);
const buffer = await response.body();
await r2Client.putObject({
  Bucket: 'media',
  Key: `${requestId}-audio.mp3`,
  Body: buffer
});
```
- Avoids local disk I/O
- Reduces memory footprint
- Faster overall processing

## Performance Considerations

### Serial Processing Benefits
- Simpler error handling
- Predictable resource usage
- No race conditions
- Easy debugging

### Memory Management
- Single Playwright context (~200MB)
- SQLite memory usage minimal (<10MB)
- Total footprint under 500MB
- Suitable for small VPS deployment

### Processing Time Breakdown
- Slack event receipt: <1s
- NotebookLM navigation: ~30s
- Source processing: 2-5min
- Audio generation: 5-10min
- Video generation: 5-10min
- Upload to R2: <30s
- **Total**: 12-15min typical

## Security Considerations

### Authentication Storage
- Browser profile in `./user-data` must be protected
- Use file permissions: `chmod 700 ./user-data`
- Consider encryption at rest for production

### Slack Token Management
- Use environment variables
- Never commit tokens to repository
- Rotate tokens periodically

### R2 Public URLs
- Generate signed URLs with 7-day expiration
- Use random keys to prevent enumeration
- Consider CDN for production use

## Deployment Recommendations

### Minimum Requirements
- Node.js 20+
- 1GB RAM
- 10GB disk space
- Persistent filesystem for SQLite and auth

### Recommended Platforms
1. **Fly.io**: Good persistent volume support
2. **Railway**: Simple deployment, SQLite support
3. **VPS**: Maximum control, lowest cost

### Monitoring
- Health check endpoint for uptime monitoring
- SQLite query for queue depth
- Playwright screenshot on errors
- Slack notification for critical failures

## Conclusion

The lightweight approach with SQLite and Playwright provides the optimal balance of:
- **Simplicity**: Minimal moving parts
- **Reliability**: Persistent state, crash recovery
- **Performance**: Adequate for 100 users with serial processing
- **Cost**: Can run on minimal infrastructure

This architecture meets all functional requirements while maintaining operational simplicity suitable for a personal/small team deployment.