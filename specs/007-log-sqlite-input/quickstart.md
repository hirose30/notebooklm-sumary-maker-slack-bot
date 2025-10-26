# Quick Start Guide: Logging System

**Feature**: 007-log-sqlite-input
**Audience**: Operators and developers using the NotebookLM Slack bot

## Overview

The bot's logging system provides:
- **Clean console output** for monitoring (INFO level by default)
- **Detailed debug logs** when troubleshooting (DEBUG level)
- **Persistent log files** organized by workspace and date
- **Automatic daily rotation** with indefinite retention

---

## 1. Default Behavior (No Configuration)

By default, the bot logs at **INFO level** to both **console** and **log files**.

**What you'll see in console**:
```
[2025-10-18T10:30:45.123Z] INFO: Bot is now running and processing requests
[2025-10-18T10:31:12.456Z] INFO: Received app mention {"teamId":"T01ABC","channel":"C01XYZ"}
[2025-10-18T10:31:15.789Z] INFO: Processing request {"id":42,"url":"https://example.com"}
[2025-10-18T10:32:30.123Z] INFO: Request processed successfully {"id":42,"audioSize":1024000}
```

**What you WON'T see** (hidden at INFO level):
- SQLite query details
- Internal function call traces
- Browser automation step-by-step logs

**Log files created** (in `./logs/` directory):
```
logs/
├── system-2025-10-18.log   # Startup and system-level logs
├── ws1-2025-10-18.log      # Workspace 1 request logs
└── ws2-2025-10-18.log      # Workspace 2 request logs
```

---

## 2. Setting the Log Level

Control verbosity using the `LOG_LEVEL` environment variable.

### Available Levels

| Level | What Gets Logged | Use Case |
|-------|-----------------|----------|
| `ERROR` | Errors only | Production (minimal noise) |
| `WARN` | Warnings + errors | Production (moderate detail) |
| `INFO` | Informational + warnings + errors | **Default** - normal operations |
| `DEBUG` | Everything including SQL queries | Troubleshooting and development |

### Set Log Level (Linux/macOS)

```bash
# Temporary (current session only)
export LOG_LEVEL=DEBUG
npm run bot:start

# Or inline for single command
LOG_LEVEL=DEBUG npm run bot:start
```

### Set Log Level (Windows PowerShell)

```powershell
# Temporary (current session only)
$env:LOG_LEVEL="DEBUG"
npm run bot:start

# Or in .env file (persistent)
# Edit .env and add:
LOG_LEVEL=DEBUG
```

### Set Log Level (.env file)

```bash
# Add to .env file in project root
LOG_LEVEL=DEBUG

# Restart the bot
npm run bot:start
```

**Note**: Log level changes require restarting the bot.

---

## 3. Viewing Console Output

### Normal Monitoring (INFO level)

```bash
npm run bot:start

# You'll see clean, high-level flow:
# - Bot startup
# - Request received
# - NotebookLM processing
# - File upload
# - Slack response
```

### Debug Mode (DEBUG level)

```bash
LOG_LEVEL=DEBUG npm run bot:start

# You'll see detailed execution:
# - SQLite queries (SELECT, INSERT, UPDATE)
# - Browser automation steps
# - Retry attempts
# - Internal state changes
```

### Filter by Log Level (using grep)

```bash
# Show only errors
npm run bot:start 2>&1 | grep ERROR

# Show warnings and errors
npm run bot:start 2>&1 | grep -E "WARN|ERROR"

# Show a specific workspace
npm run bot:start 2>&1 | grep "ws1"
```

---

## 4. Finding and Reading Log Files

### Log File Location

```bash
# Navigate to logs directory
cd logs/

# List all log files
ls -lh

# Output:
# system-2025-10-18.log   (12 KB)
# ws1-2025-10-18.log      (45 KB)
# ws2-2025-10-18.log      (38 KB)
```

### Log File Naming Convention

**Format**: `{workspace}-{YYYY-MM-DD}.log`

- `system-2025-10-18.log` - System/startup logs (no workspace context)
- `ws1-2025-10-18.log` - Workspace 1 logs for October 18, 2025
- `ws2-2025-10-19.log` - Workspace 2 logs for October 19, 2025

**Daily Rotation**: New file created automatically each day at midnight.

### Reading Log Files

```bash
# View entire log file
cat logs/ws1-2025-10-18.log

# View latest entries (last 50 lines)
tail -n 50 logs/ws1-2025-10-18.log

# Follow logs in real-time
tail -f logs/ws1-2025-10-18.log

# Search for specific request ID
grep "\"id\":42" logs/ws1-2025-10-18.log

# Search for errors
grep ERROR logs/ws1-2025-10-18.log
```

### Finding Logs for a Specific Date

```bash
# List logs for October 18, 2025
ls logs/*2025-10-18.log

# View all workspace 1 logs from October
ls logs/ws1-2025-10-*.log
```

---

## 5. Troubleshooting Common Issues

### Issue: SQLite Queries Appearing in Console

**Symptom**: Console shows `[DEBUG] SQLite: SELECT * FROM requests...`

**Cause**: Log level is set to DEBUG

**Solution**:
```bash
# Remove DEBUG setting or change to INFO
unset LOG_LEVEL
# OR
export LOG_LEVEL=INFO

# Restart bot
npm run bot:start
```

---

### Issue: No Log Files Created

**Symptom**: `./logs/` directory is empty or doesn't exist

**Possible Causes**:

1. **Bot hasn't processed any requests yet**
   - Solution: Log files created on first log write, trigger a request

2. **Permission denied**
   - Check console for: `[ERROR] Log file write failed (EACCES)`
   - Solution: Ensure bot process has write permissions to project directory
   ```bash
   chmod 755 logs/
   ```

3. **Disk full**
   - Check console for: `[ERROR] Log file write failed (ENOSPC)`
   - Solution: Free disk space, restart bot

---

### Issue: Invalid Log Level Warning

**Symptom**: Console shows `[WARN] Invalid LOG_LEVEL "TRACE". Defaulting to INFO.`

**Cause**: Typo or unsupported log level value

**Solution**: Use only valid levels: ERROR, WARN, INFO, DEBUG
```bash
export LOG_LEVEL=DEBUG  # Correct
# Not: TRACE, VERBOSE, ALL, etc.
```

---

### Issue: Log Files Growing Too Large

**Symptom**: Individual log files exceed 100 MB or filling disk

**Cause**: High request volume or DEBUG level logging over multiple days

**Solution**: Manual cleanup (automated retention not implemented)
```bash
# Delete logs older than 30 days
find logs/ -name "*.log" -mtime +30 -delete

# Or compress old logs
gzip logs/*-2025-09-*.log
```

**Note**: By design, log files are retained indefinitely. Operators are responsible for cleanup.

---

## 6. Log File Rotation Behavior

### How Rotation Works

- **Automatic**: New log file created when date changes (UTC timezone)
- **Per-workspace**: Each workspace gets its own daily log file
- **No downtime**: Rotation happens seamlessly during first log write of new day

### Example Timeline

```
2025-10-18 23:59:45 → writes to ws1-2025-10-18.log
2025-10-19 00:00:12 → writes to ws1-2025-10-19.log (new file)
```

### Retention Policy

**Default**: Keep all log files indefinitely

**Recommendation**: Implement manual cleanup or log aggregation:
- Weekly: Review and archive logs to external storage
- Monthly: Delete logs older than retention requirement (e.g., 90 days)
- Consider log aggregation tools (e.g., Loki, Elasticsearch) for long-term storage

---

## 7. Log Format Reference

### Console Output Format

```
[TIMESTAMP] LEVEL: message {metadata}
```

**Example**:
```
[2025-10-18T10:30:45.123Z] INFO: Processing request {"id":42,"teamId":"T01ABC","teamName":"Acme Corp"}
```

**Fields**:
- `TIMESTAMP`: ISO 8601 UTC timestamp
- `LEVEL`: ERROR, WARN, INFO, or DEBUG
- `message`: Human-readable log message
- `metadata`: JSON object with context (optional)

### Common Metadata Fields

| Field | Description | Example |
|-------|-------------|---------|
| `teamId` | Slack workspace team ID | "T01ABCDEFGH" |
| `teamName` | Workspace display name | "Acme Corp" |
| `id` | Request/job ID | 42 |
| `url` | URL being processed | "https://example.com/article" |
| `channel` | Slack channel ID | "C01XYZ123" |
| `audioSize` | Audio file size (bytes) | 1024000 |
| `videoSize` | Video file size (bytes) | 5120000 |

---

## 8. Performance Considerations

### Impact on Request Processing

**Expected**: No noticeable impact
- Log writes are asynchronous (non-blocking)
- Typical overhead: <10ms per request

**If experiencing slowdowns**:
1. Check disk I/O performance (`iostat`, `iotop`)
2. Reduce log level to ERROR or WARN
3. Disable file logging temporarily (see Troubleshooting)

### Disk Space Planning

**Estimation** (for capacity planning):

| Scenario | Logs/Day | File Size/Day | 30-Day Total |
|----------|----------|---------------|--------------|
| Low volume (10 requests/day) | ~1,000 lines | ~100 KB | ~3 MB |
| Medium volume (100 requests/day) | ~10,000 lines | ~1 MB | ~30 MB |
| High volume (1000 requests/day) | ~100,000 lines | ~10 MB | ~300 MB |

**Variables**:
- Log level (DEBUG generates 5-10x more logs than INFO)
- Metadata verbosity
- Request complexity (longer processing = more logs)

---

## 9. Best Practices

### Development

```bash
# Use DEBUG level to see everything
LOG_LEVEL=DEBUG npm run dev
```

### Production

```bash
# Use INFO level for normal operations
LOG_LEVEL=INFO npm run start

# Or omit (INFO is default)
npm run start
```

### Troubleshooting

```bash
# Enable DEBUG temporarily
LOG_LEVEL=DEBUG npm run bot:start

# Review recent logs
tail -f logs/ws1-$(date +%Y-%m-%d).log

# Search for errors in last 7 days
grep ERROR logs/ws1-2025-10-*.log
```

### Log Retention

```bash
# Weekly: Archive logs to external storage
tar -czf logs-archive-$(date +%Y-%m-%d).tar.gz logs/*.log

# Monthly: Delete logs older than 90 days
find logs/ -name "*.log" -mtime +90 -delete
```

---

## 10. Quick Reference

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `LOG_LEVEL` | ERROR, WARN, INFO, DEBUG | INFO | Controls log verbosity |

### Log Locations

| Type | Path Pattern | Example |
|------|--------------|---------|
| System logs | `logs/system-YYYY-MM-DD.log` | `logs/system-2025-10-18.log` |
| Workspace logs | `logs/wsN-YYYY-MM-DD.log` | `logs/ws1-2025-10-18.log` |

### Useful Commands

```bash
# Start with DEBUG logging
LOG_LEVEL=DEBUG npm run bot:start

# View today's workspace 1 logs
tail -f logs/ws1-$(date +%Y-%m-%d).log

# Search for errors
grep ERROR logs/*.log

# Count log entries by level
grep -c INFO logs/ws1-2025-10-18.log
grep -c ERROR logs/ws1-2025-10-18.log
```

---

## Support

**Questions or issues?** Check the troubleshooting section above or review:
- [spec.md](spec.md) - Feature specification
- [plan.md](plan.md) - Implementation plan
- [data-model.md](data-model.md) - Technical data model

**Log file issues**: Ensure `./logs/` directory exists and is writable by bot process.
