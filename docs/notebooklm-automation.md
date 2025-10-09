# NotebookLM Automation Documentation

**T014: Findings and implementation details for NotebookLM Pro automation**

## Overview

This document captures the findings from implementing Playwright-based automation for NotebookLM Pro, including UI selectors, timing considerations, and best practices.

## Implementation Summary

### Phase 2 Completion Status
- ✅ T006: Browser initialization with persistent context
- ✅ T007: Manual login helper script
- ✅ T008: Notebook creation automation
- ✅ T009: URL source addition
- ✅ T010: Audio Overview generation
- ✅ T011: Video Overview generation
- ✅ T012: Standalone test script
- ✅ T013: Error handling and retry logic

## UI Selectors

### Home Page - Create Notebook
```typescript
// "新しいノートブック" button
selector: '.create-new-action-button-icon-container'
```

### Notebook Page - Add Source
```typescript
// Source dialog appears automatically after notebook creation

// "ウェブサイト" option in source dialog
selector: 'text="ウェブサイト"'

// URL input textbox
selector: 'textbox[aria-label="URL を貼り付け"]'

// "挿入" button
selector: 'button:has-text("挿入")'

// Wait for source processing completion
selector: 'text="1 ソース"'
```

### Media Generation
```typescript
// Audio Overview button (in chat area)
selector: 'button:has-text("音声解説")'

// Video Overview button (in chat area)
selector: 'button:has-text("動画解説")'

// Generation status indicators
selector: 'text="音声解説を生成しています"'
selector: 'text="動画解説を生成しています"'

// Completion indicator (download button)
selector: 'text="ダウンロード"'
```

## Authentication

### Persistent Context Approach
- Uses `launchPersistentContext` to save cookies and auth state
- User data stored in `./user-data` directory (gitignored)
- Manual login required once via `scripts/manual-login.ts`
- Authentication persists across browser restarts

### Login Flow
```bash
# Run manual login helper
npx tsx scripts/manual-login.ts

# Follow these steps:
1. Browser window opens with NotebookLM
2. Log in with Google account
3. Press Ctrl+C when login complete
4. Session saved to ./user-data
```

## Timing Considerations

### Short Operations (< 5 seconds)
- Notebook creation
- URL source addition (UI interaction only)
- Navigation between pages

### Medium Operations (5-30 seconds)
- Source processing/indexing after URL addition
- Wait 10-15 seconds before requesting media generation

### Long Operations (3-15 minutes)
- Audio Overview generation: ~3-8 minutes
- Video Overview generation: ~5-15 minutes
- Default timeout set to 15 minutes for safety

## Error Handling

### Retry Strategy
```typescript
// Default retry config
maxRetries: 3
baseDelay: 2000ms (2 seconds)
maxDelay: 30000ms (30 seconds)
backoff: exponential (2s, 4s, 8s, ...)

// Exception: Long operations use 1 retry only
- generateAudioOverview: maxRetries=1
- generateVideoOverview: maxRetries=1
```

### Common Failure Modes
1. **Selector not found**: UI changed or page not loaded
   - Solution: Retry with exponential backoff

2. **Timeout during media generation**: Network issues or service overload
   - Solution: Single retry with fresh request

3. **Authentication expired**: Session cookie invalidated
   - Solution: Re-run manual login script

## Bot Detection Avoidance

### Browser Launch Arguments
```typescript
args: [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=site-per-process',
]
```

### Best Practices
- Use Japanese locale (`ja-JP`) to match NotebookLM's primary market
- Standard viewport (1920x1080) to avoid fingerprinting
- Preserve user-agent and browser profile
- Avoid rapid-fire requests (use delays between operations)

## Testing

### Standalone Test Script
```bash
# Test with example.com
npx tsx scripts/test-notebooklm.ts

# Test with custom URL
TEST_URL=https://your-article.com npx tsx scripts/test-notebooklm.ts
```

### Test Coverage
- ✅ Browser initialization
- ✅ Notebook creation
- ✅ URL source addition
- ✅ Audio Overview generation
- ✅ Video Overview generation
- ✅ Media download (optional)

## Known Limitations

### Single Account Serial Processing
- NotebookLM Pro has rate limits per account
- Only one notebook operation at a time recommended
- Queue system will enforce serial processing

### Media Generation Time Uncertainty
- Generation time varies by content length and complexity
- No progress indicator available via UI automation
- Must wait for completion or timeout

### UI Selector Fragility
- NotebookLM uses Material Design components
- Class names may change with UI updates
- Text-based selectors (e.g., `text="音声解説"`) more stable
- Regular testing required after NotebookLM updates

## Future Improvements

### Phase 3+ Considerations
1. **Slack Integration**: Connect automation to Slack events
2. **Storage**: Save generated media to R2 (Cloudflare)
3. **Queue System**: Implement SQLite-based job queue
4. **Progress Updates**: Send Slack notifications during long operations
5. **Error Recovery**: Handle partial failures (e.g., audio succeeds, video fails)

### Monitoring Recommendations
1. Log all automation steps with timestamps
2. Track success/failure rates by operation type
3. Monitor generation times to detect service degradation
4. Alert on authentication failures

## Selector Validation Checklist

**Before deploying to production, validate these selectors:**

- [ ] Create notebook button exists
- [ ] Add source button exists
- [ ] Website source type chip exists
- [ ] URL input textarea exists
- [ ] Submit button text matches one of: "追加", "挿入", "Insert"
- [ ] Audio button text is "音声解説"
- [ ] Video button text is "動画解説"
- [ ] Download button text is "ダウンロード"
- [ ] Play button text is "再生"

## References

- **Playwright Docs**: https://playwright.dev/docs/intro
- **NotebookLM**: https://notebooklm.google.com
- **Implementation**: `src/services/notebooklm-automation.ts`
- **Test Script**: `scripts/test-notebooklm.ts`
- **Login Helper**: `scripts/manual-login.ts`

---

**Last Updated**: 2025-10-09
**Implementation Phase**: Phase 2 Complete (NotebookLM Automation PoC)
