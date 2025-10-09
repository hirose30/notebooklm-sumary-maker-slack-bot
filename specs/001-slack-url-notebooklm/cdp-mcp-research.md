# Chrome DevTools Protocol (CDP) and Model Context Protocol (MCP) Research
## NotebookLM Automation Use Case

**Date**: 2025-10-09
**Research Focus**: Browser automation strategies for NotebookLM audio/video generation and download interception
**Status**: Comprehensive

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Chrome DevTools Protocol (CDP) Overview](#chrome-devtools-protocol-cdp-overview)
3. [Model Context Protocol (MCP) Overview](#model-context-protocol-mcp-overview)
4. [CDP vs Puppeteer vs Playwright Comparison](#cdp-vs-puppeteer-vs-playwright-comparison)
5. [NotebookLM Automation Requirements](#notebooklm-automation-requirements)
6. [Implementation Strategies](#implementation-strategies)
7. [Code Examples](#code-examples)
8. [Recommendations](#recommendations)

---

## Executive Summary

### Key Findings

**CDP (Chrome DevTools Protocol)**:
- Low-level protocol for controlling Chrome/Chromium browsers via WebSocket
- Provides direct access to all browser capabilities
- Best for custom automation requiring fine-grained control
- Steeper learning curve but maximum flexibility

**MCP (Model Context Protocol)**:
- New standard by Anthropic for connecting AI assistants to external tools/data
- Several browser automation MCP servers available (Playwright MCP, Browser MCP, Browserbase MCP)
- Enables natural language-driven browser automation
- Built on top of CDP/Playwright/Selenium (abstraction layer)

**For NotebookLM Automation, Recommended Approach**:
1. **Primary**: Playwright (best balance of features, stability, and community support)
2. **Alternative**: Direct CDP (if you need specific low-level control not exposed by Playwright)
3. **Avoid**: MCP servers (adds unnecessary abstraction layer for programmatic automation)

### Critical Capabilities Verified

✅ **Async Operation Detection**: CDP can monitor network events to detect when generation completes
✅ **Download URL Interception**: Network.responseReceived events can capture download URLs
✅ **Long-Running Processes**: Configurable timeouts support 15+ minute operations
✅ **Google Authentication**: Possible with browser context persistence and anti-detection measures
✅ **Dynamic Content Handling**: Multiple wait strategies available

---

## Chrome DevTools Protocol (CDP) Overview

### What is CDP?

Chrome DevTools Protocol is a remote debugging protocol that allows communication with a running Chrome browser. It's the foundation that Chrome DevTools uses internally and powers automation tools like Puppeteer and Playwright.

### Key Features

- **Network Interception**: Monitor and modify all network requests/responses
- **DOM Manipulation**: Direct access to page structure and events
- **Performance Monitoring**: Collect metrics, traces, and profiling data
- **Security**: Handle authentication, certificates, and cookies
- **Multi-target**: Control multiple tabs, frames, and workers

### Architecture

```
Client (Your Code) <--> WebSocket <--> Chrome Browser
                    JSON-RPC Protocol
```

### Recent Developments (2025)

**Chrome DevTools MCP Integration**:
- New MCP server announced by Chrome team
- Gives AI assistants "eyes" in the browser
- Uses Puppeteer internally for reliability
- Enables AI-powered browser automation

**Enhanced CDP Command Editor**:
- Auto-complete for CDP commands
- Auto-populate parameters
- Edit and resend capabilities
- Improves development speed

### CDP Domains Relevant to NotebookLM

| Domain | Purpose | Use Case |
|--------|---------|----------|
| Network | Monitor/intercept traffic | Detect download URLs, API calls |
| Page | Navigate and lifecycle | Wait for page load, handle navigation |
| Runtime | Execute JavaScript | Detect UI state changes |
| Fetch | Modern request interception | Alternative to Network domain |
| Browser | Browser-level control | Manage sessions, downloads |
| Target | Multi-target management | Handle popups, new tabs |

---

## Model Context Protocol (MCP) Overview

### What is MCP?

Model Context Protocol is an open standard by Anthropic that enables AI models to interact with external tools and data sources through a unified interface. It's designed for AI-powered workflows, not traditional automation.

### MCP Browser Automation Servers

#### 1. Playwright MCP Server (Microsoft)
- **Repository**: `microsoft/playwright-mcp`
- **Approach**: Uses Playwright's accessibility tree (not screenshots)
- **Features**: Fast, lightweight, LLM-friendly structured data
- **Best For**: AI-driven web automation without vision models

#### 2. Browserbase MCP Server
- **Repository**: `browserbase/mcp-server-browserbase`
- **Approach**: Cloud browser automation with Stagehand
- **Features**: Natural language commands, AI-powered element detection
- **Best For**: AI assistants controlling remote browsers

#### 3. Browser MCP (Local)
- **Repository**: `BrowserMCP/mcp`
- **Approach**: Chrome extension + MCP server
- **Features**: Uses your real browser, logged-in sessions, stealth mode
- **Best For**: AI automation using existing browser profile

#### 4. Chrome MCP Server
- **Repository**: `hangwin/mcp-chrome`
- **Approach**: Chrome extension-based server
- **Features**: Direct browser control, semantic search, content analysis
- **Best For**: Daily browser assistant for AI

### MCP vs Traditional Automation

**MCP is NOT recommended for NotebookLM automation because**:
- Adds abstraction layer without clear benefit
- Designed for AI-driven workflows, not programmatic automation
- Less control over timing and error handling
- Additional complexity without addressing core challenges

**MCP would be useful if**:
- Building an AI assistant that needs browser access
- Users interact via natural language
- Multiple diverse web tasks with unpredictable requirements

---

## CDP vs Puppeteer vs Playwright Comparison

### Performance Benchmarks

| Tool | Avg Execution Time | Notes |
|------|-------------------|-------|
| Playwright | 4.513s | Fastest, WebSocket-based |
| Selenium | 4.590s | Close second |
| Puppeteer | 4.784s | Slightly slower |
| Cypress | 9.378s | Significantly slower |

### Browser Support

| Tool | Chromium | Firefox | WebKit | Safari |
|------|----------|---------|--------|--------|
| Playwright | ✅ Custom build | ✅ Custom build | ✅ Custom build | Limited |
| Puppeteer | ✅ Native | ⚠️ Experimental | ❌ | ❌ |
| CDP Direct | ✅ Native | ❌ | ❌ | ❌ |

### Feature Comparison

#### Playwright Advantages
- **Auto-waiting**: Built-in smart waits for actionable elements
- **Multi-language**: JavaScript, TypeScript, Python, Java, .NET
- **Multiple browsers**: Best cross-browser support
- **Network interception**: Robust request/response modification
- **Parallel contexts**: Efficient multi-tab/multi-page handling
- **Trace viewer**: Excellent debugging with timeline visualization
- **Screenshot/video**: Built-in recording capabilities
- **Mobile emulation**: Device emulation with network throttling

#### Puppeteer Advantages
- **Maturity**: Longer history, larger community (3M weekly downloads)
- **Simpler API**: Easier learning curve for basic tasks
- **Direct CDP access**: Native Chrome DevTools Protocol support
- **Resource efficiency**: Slightly lower overhead
- **Chrome-optimized**: Works directly with Chrome team

#### Direct CDP Advantages
- **Maximum control**: No abstraction layer limitations
- **Custom protocols**: Implement features not in higher-level tools
- **Performance**: Minimal overhead
- **Flexibility**: Complete access to all CDP commands

#### Direct CDP Disadvantages
- **Complexity**: Much more code required
- **Maintenance**: Breaking changes in Chrome versions
- **No convenience methods**: Must implement wait strategies manually
- **Error handling**: More boilerplate code needed

### When to Choose Each

**Choose Playwright when** (RECOMMENDED for NotebookLM):
- You need robust automation with complex UI interactions
- Auto-waiting will reduce flakiness
- You want excellent debugging tools
- Cross-browser support might be useful later
- You value community support and documentation

**Choose Puppeteer when**:
- You're already familiar with it
- You only target Chrome/Chromium
- You need simpler API for straightforward tasks
- You want slightly better performance

**Choose Direct CDP when**:
- You need features not exposed by Playwright/Puppeteer
- You're building a custom automation framework
- You need absolute control over browser behavior
- You can handle the complexity and maintenance

---

## NotebookLM Automation Requirements

### Specific Challenges

#### 1. Detecting Async Operation Completion

**Challenge**: Audio/video generation takes 2-15 minutes and happens asynchronously in the background.

**Solutions**:

**A. Network Event Monitoring (CDP)**
```typescript
// Monitor for completion API calls
await client.send('Network.enable');
client.on('Network.responseReceived', (params) => {
  if (params.response.url.includes('generate_audio_overview') &&
      params.response.status === 200) {
    // Generation complete
  }
});
```

**B. DOM Polling (Playwright)**
```typescript
// Wait for download button to appear
await page.waitForSelector('button[aria-label="Download audio overview"]', {
  timeout: 15 * 60 * 1000 // 15 minutes
});
```

**C. Network Idle Strategy**
```typescript
await page.waitForLoadState('networkidle', {
  timeout: 15 * 60 * 1000
});
```

#### 2. Downloading Generated Files

**Challenge**: Need to capture download URLs or files without manual intervention.

**Solutions**:

**A. Download Event Handling (Playwright)**
```typescript
const downloadPromise = page.waitForEvent('download', {
  timeout: 15 * 60 * 1000
});
await page.click('button[aria-label="Download audio overview"]');
const download = await downloadPromise;
const path = await download.path();
```

**B. Network Interception (CDP)**
```typescript
await client.send('Network.enable');
await client.send('Network.setRequestInterception', {
  patterns: [{ urlPattern: '*.wav' }, { urlPattern: '*.mp4' }]
});

client.on('Network.requestIntercepted', async (event) => {
  const response = await client.send('Network.getResponseBodyForInterception', {
    interceptionId: event.interceptionId
  });
  // Save response.body
});
```

**C. Blob URL Interception**
```typescript
// Intercept blob creation
await page.addInitScript(() => {
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    const url = originalCreateObjectURL(blob);
    window.__blobUrls = window.__blobUrls || [];
    window.__blobUrls.push({ url, blob });
    return url;
  };
});
```

#### 3. Google Authentication

**Challenge**: NotebookLM requires Google account login.

**Solutions**:

**A. Browser Context Persistence (Playwright)**
```typescript
// First run: Login and save state
const context = await browser.newContext();
await context.goto('https://notebooklm.google.com');
// Manual or automated login
await context.storageState({ path: 'auth.json' });

// Subsequent runs: Reuse state
const context = await browser.newContext({
  storageState: 'auth.json'
});
```

**B. Anti-Detection Measures**
```typescript
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0...',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  permissions: ['notifications'],
  // Critical for Google
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security'
  ]
});

// Remove webdriver flag
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });
});
```

**C. Manual Login Flow**
```typescript
// One-time setup with human intervention
const context = await browser.newContext({
  headless: false // Show browser
});
await context.goto('https://accounts.google.com');
// Wait for user to login manually
await page.waitForTimeout(60000); // 60 second timeout
await context.storageState({ path: 'auth.json' });
```

#### 4. Long-Running Processes (15+ Minutes)

**Challenge**: Default timeouts are too short for NotebookLM generation.

**Solutions**:

**A. Global Timeout Configuration (Playwright)**
```typescript
const browser = await playwright.chromium.launch({
  timeout: 0 // Disable launch timeout
});

const context = await browser.newContext({
  // No page-level timeout
});

const page = await context.newPage();
page.setDefaultTimeout(15 * 60 * 1000); // 15 minutes
page.setDefaultNavigationTimeout(60 * 1000); // 1 minute for nav
```

**B. Per-Action Timeouts**
```typescript
// Specific long timeout for generation
await page.waitForSelector('.download-ready', {
  timeout: 15 * 60 * 1000 // 15 minutes
});

// Shorter timeout for quick actions
await page.click('button.generate', {
  timeout: 5000 // 5 seconds
});
```

**C. Protocol Timeout (CDP)**
```typescript
const browser = await chromium.launch({
  protocolTimeout: 15 * 60 * 1000 // 15 minutes
});
```

**D. Keep-Alive Strategy**
```typescript
// Periodically check if process is still running
const checkInterval = setInterval(async () => {
  try {
    await page.evaluate(() => document.title);
    console.log('Process still alive...');
  } catch (e) {
    console.error('Browser disconnected');
    clearInterval(checkInterval);
  }
}, 30000); // Check every 30 seconds
```

#### 5. Dynamic Content and Wait Conditions

**Challenge**: NotebookLM UI updates asynchronously without clear loading indicators.

**Solutions**:

**A. Smart Waiting (Playwright)**
```typescript
// Wait for specific text
await page.waitForFunction(() => {
  return document.body.innerText.includes('Audio overview generated');
});

// Wait for element state
await page.waitForSelector('button.download', {
  state: 'visible',
  timeout: 15 * 60 * 1000
});

// Wait for network requests
await page.waitForResponse(
  response => response.url().includes('generate_overview') &&
              response.status() === 200,
  { timeout: 15 * 60 * 1000 }
);
```

**B. Polling Strategy**
```typescript
async function waitForGeneration(page: Page) {
  const maxAttempts = 300; // 15 minutes at 3s intervals
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label*="Download"]');
      return button && !button.hasAttribute('disabled');
    });

    if (isReady) return true;
    await page.waitForTimeout(3000);
  }
  throw new Error('Generation timeout');
}
```

**C. Network Activity Monitoring (CDP)**
```typescript
let activeRequests = new Set();

client.on('Network.requestWillBeSent', (params) => {
  if (params.request.url.includes('notebooklm.google.com')) {
    activeRequests.add(params.requestId);
  }
});

client.on('Network.loadingFinished', (params) => {
  activeRequests.delete(params.requestId);
});

// Wait for network idle
async function waitForNetworkIdle() {
  while (activeRequests.size > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

---

## Implementation Strategies

### Strategy 1: Playwright (Recommended)

**Pros**:
- Auto-waiting reduces flakiness
- Built-in download handling
- Excellent debugging tools
- Strong community support
- Best documentation
- Cross-platform tested

**Cons**:
- Slightly higher resource usage
- Custom browser binaries (larger download)

**Implementation Approach**:
```typescript
// 1. Setup with auth persistence
// 2. Navigate to NotebookLM
// 3. Create notebook and add source
// 4. Trigger audio/video generation
// 5. Wait for completion (network/DOM monitoring)
// 6. Download files
// 7. Upload to R2
```

### Strategy 2: Puppeteer with CDP

**Pros**:
- Good balance of convenience and control
- Direct CDP access when needed
- Mature ecosystem
- Lighter than Playwright

**Cons**:
- Chrome-only
- Less robust auto-waiting
- More manual wait handling needed

**Implementation Approach**:
```typescript
// 1. Launch with CDP session
// 2. Use Puppeteer for navigation/interaction
// 3. Use CDP for network monitoring
// 4. Handle downloads via CDP
// 5. Manual timeout management
```

### Strategy 3: Direct CDP

**Pros**:
- Maximum control
- Minimum overhead
- Full protocol access

**Cons**:
- Much more complex
- No convenience methods
- More maintenance burden
- Harder to debug

**Implementation Approach**:
```typescript
// 1. WebSocket connection to browser
// 2. Manual JSON-RPC message handling
// 3. Implement all wait strategies manually
// 4. Handle all edge cases
// NOT RECOMMENDED for this use case
```

---

## Code Examples

### Complete NotebookLM Automation (Playwright)

```typescript
import { chromium, Page, Browser, BrowserContext } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

interface NotebookLMAutomationConfig {
  headless: boolean;
  authStatePath: string;
  timeout: number;
}

interface GeneratedMedia {
  audioPath: string | null;
  videoPath: string | null;
  notebookUrl: string;
}

class NotebookLMAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: NotebookLMAutomationConfig;

  constructor(config: Partial<NotebookLMAutomationConfig> = {}) {
    this.config = {
      headless: config.headless ?? true,
      authStatePath: config.authStatePath ?? './auth.json',
      timeout: config.timeout ?? 15 * 60 * 1000 // 15 minutes
    };
  }

  async initialize(): Promise<void> {
    // Launch browser with anti-detection
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    // Check if auth state exists
    let storageState;
    try {
      await fs.access(this.config.authStatePath);
      storageState = JSON.parse(
        await fs.readFile(this.config.authStatePath, 'utf-8')
      );
    } catch {
      // Auth state doesn't exist, will need to login
      console.log('No auth state found, will need to authenticate');
    }

    // Create context
    this.context = await this.browser.newContext({
      storageState,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['clipboard-read', 'clipboard-write']
    });

    // Remove webdriver flag
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Override chrome detection
      (window as any).chrome = {
        runtime: {}
      };
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  async authenticate(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    await this.page.goto('https://notebooklm.google.com');

    // Check if already authenticated
    try {
      await this.page.waitForSelector('[data-testid="create-notebook"]', {
        timeout: 5000
      });
      console.log('Already authenticated');
      await this.saveAuthState();
      return;
    } catch {
      // Not authenticated, need to login
    }

    // Click sign in button
    const signInButton = await this.page.waitForSelector('text="Sign in"');
    await signInButton?.click();

    // Wait for Google OAuth redirect
    await this.page.waitForURL('**/accounts.google.com/**');

    // OPTION 1: Manual login (for initial setup)
    if (!this.config.headless) {
      console.log('Please login manually. Waiting 60 seconds...');
      await this.page.waitForTimeout(60000);
    } else {
      // OPTION 2: Automated login (requires credentials)
      // This is risky and may trigger Google security measures
      throw new Error('Automated Google login not recommended. Use manual login with headless: false');
    }

    // Wait for redirect back to NotebookLM
    await this.page.waitForURL('**/notebooklm.google.com/**');
    await this.page.waitForSelector('[data-testid="create-notebook"]');

    await this.saveAuthState();
  }

  private async saveAuthState(): Promise<void> {
    if (!this.context) return;
    await this.context.storageState({ path: this.config.authStatePath });
    console.log('Auth state saved');
  }

  async generateOverview(sourceUrl: string): Promise<GeneratedMedia> {
    if (!this.page) throw new Error('Page not initialized');

    // Navigate to NotebookLM
    await this.page.goto('https://notebooklm.google.com');

    // Create new notebook
    await this.page.click('[data-testid="create-notebook"]');
    await this.page.waitForSelector('[data-testid="notebook-canvas"]');

    // Add URL source
    await this.page.click('button:has-text("Add source")');
    await this.page.click('button:has-text("Website")');
    await this.page.fill('input[type="url"]', sourceUrl);
    await this.page.click('button:has-text("Add")');

    // Wait for source to be processed
    await this.page.waitForSelector('.source-card:not(.loading)', {
      timeout: 60000
    });

    const notebookUrl = this.page.url();

    // Navigate to Studio/Audio Overview section
    await this.page.click('button:has-text("Studio")');

    // Generate audio overview
    const audioPath = await this.generateAudio();

    // Generate video overview (if available)
    let videoPath: string | null = null;
    try {
      videoPath = await this.generateVideo();
    } catch (error) {
      console.log('Video generation not available or failed:', error);
    }

    return {
      audioPath,
      videoPath,
      notebookUrl
    };
  }

  private async generateAudio(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Click audio overview generation
    await this.page.click('button:has-text("Audio Overview")');

    // Wait for generation to start
    await this.page.waitForSelector('.generating-indicator', { timeout: 10000 });

    // Monitor network for completion
    const responsePromise = this.page.waitForResponse(
      response => {
        return response.url().includes('generate_audio') &&
               response.status() === 200;
      },
      { timeout: this.config.timeout }
    );

    await responsePromise;

    // Additional wait for UI to update
    await this.page.waitForSelector('button[aria-label*="Download audio"]', {
      state: 'visible',
      timeout: 30000
    });

    // Setup download handler
    const downloadPromise = this.page.waitForEvent('download', {
      timeout: 30000
    });

    // Click download button
    await this.page.click('button[aria-label*="Download audio"]');

    // Wait for download
    const download = await downloadPromise;
    const downloadPath = path.join('./downloads', `audio-${Date.now()}.wav`);
    await download.saveAs(downloadPath);

    return downloadPath;
  }

  private async generateVideo(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    // Check if video option exists
    const videoButton = await this.page.waitForSelector(
      'button:has-text("Video Overview")',
      { timeout: 5000 }
    ).catch(() => null);

    if (!videoButton) {
      throw new Error('Video overview not available');
    }

    await videoButton.click();

    // Wait for generation (similar to audio)
    await this.page.waitForSelector('.generating-indicator', { timeout: 10000 });

    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('generate_video') &&
                 response.status() === 200,
      { timeout: this.config.timeout }
    );

    await responsePromise;

    await this.page.waitForSelector('button[aria-label*="Download video"]', {
      state: 'visible',
      timeout: 30000
    });

    const downloadPromise = this.page.waitForEvent('download', {
      timeout: 30000
    });

    await this.page.click('button[aria-label*="Download video"]');

    const download = await downloadPromise;
    const downloadPath = path.join('./downloads', `video-${Date.now()}.mp4`);
    await download.saveAs(downloadPath);

    return downloadPath;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }
}

// Usage example
async function main() {
  const automation = new NotebookLMAutomation({
    headless: false, // Set to false for initial auth
    authStatePath: './notebooklm-auth.json'
  });

  try {
    await automation.initialize();
    await automation.authenticate();

    const result = await automation.generateOverview(
      'https://example.com/article'
    );

    console.log('Generated media:', result);
  } catch (error) {
    console.error('Automation failed:', error);
  } finally {
    await automation.close();
  }
}

// Export for use in your bot
export { NotebookLMAutomation, GeneratedMedia, NotebookLMAutomationConfig };
```

### Network Interception with CDP (Advanced)

```typescript
import { chromium, CDPSession } from 'playwright';

interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
}

interface NetworkResponse {
  requestId: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
}

class CDPNetworkMonitor {
  private cdpSession: CDPSession | null = null;
  private requests: Map<string, NetworkRequest> = new Map();
  private responses: Map<string, NetworkResponse> = new Map();

  async initialize(page: any): Promise<void> {
    // Get CDP session from Playwright page
    this.cdpSession = await page.context().newCDPSession(page);

    // Enable network tracking
    await this.cdpSession.send('Network.enable');

    // Listen for requests
    this.cdpSession.on('Network.requestWillBeSent', (params: any) => {
      this.requests.set(params.requestId, {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers
      });
    });

    // Listen for responses
    this.cdpSession.on('Network.responseReceived', async (params: any) => {
      const response: NetworkResponse = {
        requestId: params.requestId,
        url: params.response.url,
        status: params.response.status,
        headers: params.response.headers
      };
      this.responses.set(params.requestId, response);
    });

    // Listen for loading finished
    this.cdpSession.on('Network.loadingFinished', async (params: any) => {
      try {
        // Get response body
        const result = await this.cdpSession!.send('Network.getResponseBody', {
          requestId: params.requestId
        });

        const response = this.responses.get(params.requestId);
        if (response) {
          response.body = result.base64Encoded
            ? Buffer.from(result.body, 'base64').toString()
            : result.body;
        }
      } catch (error) {
        // Some responses can't have their body retrieved
        console.log('Could not get response body:', error);
      }
    });
  }

  async waitForRequest(urlPattern: string | RegExp, timeout = 30000): Promise<NetworkRequest> {
    const startTime = Date.now();
    const pattern = typeof urlPattern === 'string'
      ? new RegExp(urlPattern)
      : urlPattern;

    while (Date.now() - startTime < timeout) {
      for (const request of this.requests.values()) {
        if (pattern.test(request.url)) {
          return request;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Request matching ${urlPattern} not found within ${timeout}ms`);
  }

  async waitForResponse(urlPattern: string | RegExp, timeout = 30000): Promise<NetworkResponse> {
    const startTime = Date.now();
    const pattern = typeof urlPattern === 'string'
      ? new RegExp(urlPattern)
      : urlPattern;

    while (Date.now() - startTime < timeout) {
      for (const response of this.responses.values()) {
        if (pattern.test(response.url)) {
          return response;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Response matching ${urlPattern} not found within ${timeout}ms`);
  }

  getDownloadUrls(): string[] {
    return Array.from(this.responses.values())
      .filter(response => {
        const contentType = response.headers['content-type'] || '';
        const contentDisposition = response.headers['content-disposition'] || '';
        return contentType.includes('audio') ||
               contentType.includes('video') ||
               contentDisposition.includes('attachment');
      })
      .map(response => response.url);
  }

  async close(): Promise<void> {
    if (this.cdpSession) {
      await this.cdpSession.send('Network.disable');
      await this.cdpSession.detach();
    }
  }
}

// Usage with NotebookLM
async function monitorNotebookLMGeneration() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const monitor = new CDPNetworkMonitor();
  await monitor.initialize(page);

  await page.goto('https://notebooklm.google.com');

  // Start generation process
  // ... your automation code ...

  // Wait for audio generation completion
  const audioResponse = await monitor.waitForResponse(
    /generate_audio_overview/,
    15 * 60 * 1000 // 15 minutes
  );

  console.log('Audio generation completed:', audioResponse.status);

  // Get download URLs
  const downloadUrls = monitor.getDownloadUrls();
  console.log('Found download URLs:', downloadUrls);

  await monitor.close();
  await browser.close();
}

export { CDPNetworkMonitor };
```

### Robust Waiting Strategy

```typescript
import { Page } from 'playwright';

interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
  description?: string;
}

class RobustWaiter {
  constructor(private page: Page) {}

  /**
   * Wait for a condition with multiple fallback strategies
   */
  async waitForCondition(
    conditions: Array<() => Promise<boolean>>,
    options: WaitOptions = {}
  ): Promise<void> {
    const {
      timeout = 15 * 60 * 1000,
      pollInterval = 1000,
      description = 'condition'
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeout) {
      // Try each condition
      for (const condition of conditions) {
        try {
          const result = await condition();
          if (result) {
            console.log(`${description} met`);
            return;
          }
        } catch (error) {
          lastError = error as Error;
          // Continue to next condition
        }
      }

      // Log progress
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`Waiting for ${description}... ${elapsed}s elapsed`);

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(
      `Timeout waiting for ${description} after ${timeout}ms. Last error: ${lastError?.message}`
    );
  }

  /**
   * Wait for NotebookLM audio generation to complete
   */
  async waitForAudioGeneration(): Promise<void> {
    await this.waitForCondition(
      [
        // Strategy 1: Check for download button
        async () => {
          const button = await this.page.$(
            'button[aria-label*="Download audio"]:not([disabled])'
          );
          return button !== null;
        },

        // Strategy 2: Check for success message
        async () => {
          const message = await this.page.textContent('body');
          return message?.includes('Audio overview generated') ?? false;
        },

        // Strategy 3: Check for absence of loading indicator
        async () => {
          const loading = await this.page.$('.generating-indicator');
          return loading === null;
        }
      ],
      {
        timeout: 15 * 60 * 1000,
        pollInterval: 3000,
        description: 'audio generation completion'
      }
    );
  }

  /**
   * Wait for network to be idle with custom conditions
   */
  async waitForNetworkIdle(
    excludePatterns: RegExp[] = [],
    idleTime = 2000
  ): Promise<void> {
    let activeRequests = new Set<string>();
    let lastActivityTime = Date.now();

    const requestListener = (request: any) => {
      const url = request.url();
      const shouldTrack = !excludePatterns.some(pattern => pattern.test(url));
      if (shouldTrack) {
        activeRequests.add(url);
        lastActivityTime = Date.now();
      }
    };

    const responseListener = (response: any) => {
      activeRequests.delete(response.url());
      lastActivityTime = Date.now();
    };

    this.page.on('request', requestListener);
    this.page.on('response', responseListener);

    try {
      while (true) {
        const timeSinceActivity = Date.now() - lastActivityTime;
        if (activeRequests.size === 0 && timeSinceActivity >= idleTime) {
          break;
        }
        await this.page.waitForTimeout(100);
      }
    } finally {
      this.page.off('request', requestListener);
      this.page.off('response', responseListener);
    }
  }
}

// Usage
async function example(page: Page) {
  const waiter = new RobustWaiter(page);

  // Wait for audio generation with multiple fallback strategies
  await waiter.waitForAudioGeneration();

  // Wait for network idle, excluding analytics
  await waiter.waitForNetworkIdle([
    /google-analytics\.com/,
    /googletagmanager\.com/
  ]);
}

export { RobustWaiter };
```

### Error Recovery and Retry Logic

```typescript
import { Page } from 'playwright';

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

class RetryHandler {
  /**
   * Execute a function with exponential backoff retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      onRetry
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          break;
        }

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        console.log(
          `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
          `Retrying in ${delay}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw new Error(
      `Failed after ${maxAttempts} attempts. Last error: ${lastError!.message}`
    );
  }

  /**
   * Recover from common browser automation errors
   */
  static async withErrorRecovery<T>(
    page: Page,
    fn: () => Promise<T>,
    recoveryStrategies: Record<string, () => Promise<void>> = {}
  ): Promise<T> {
    const defaultStrategies: Record<string, () => Promise<void>> = {
      // Handle timeout errors
      'Timeout': async () => {
        await page.reload();
      },

      // Handle navigation errors
      'Navigation': async () => {
        await page.goBack();
        await page.waitForTimeout(1000);
      },

      // Handle element not found
      'Element not found': async () => {
        await page.reload();
        await page.waitForLoadState('networkidle');
      },

      // Handle detached page
      'Target closed': async () => {
        throw new Error('Page closed, cannot recover');
      }
    };

    const strategies = { ...defaultStrategies, ...recoveryStrategies };

    try {
      return await fn();
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Find matching recovery strategy
      for (const [pattern, recovery] of Object.entries(strategies)) {
        if (errorMessage.includes(pattern)) {
          console.log(`Attempting recovery for: ${pattern}`);
          await recovery();
          // Retry once after recovery
          return await fn();
        }
      }

      // No recovery strategy found
      throw error;
    }
  }
}

// NotebookLM-specific retry logic
class NotebookLMRetryHandler {
  constructor(private page: Page) {}

  async generateWithRetry(
    generationType: 'audio' | 'video',
    sourceUrl: string
  ): Promise<string> {
    return await RetryHandler.withRetry(
      async () => {
        return await this.attemptGeneration(generationType, sourceUrl);
      },
      {
        maxAttempts: 3,
        initialDelay: 5000,
        onRetry: (attempt, error) => {
          console.log(
            `Generation attempt ${attempt} failed: ${error.message}`
          );
        }
      }
    );
  }

  private async attemptGeneration(
    type: 'audio' | 'video',
    sourceUrl: string
  ): Promise<string> {
    return await RetryHandler.withErrorRecovery(
      this.page,
      async () => {
        // Your generation logic here
        await this.page.click(`button:has-text("${type} Overview")`);

        // Wait for completion
        const downloadButton = await this.page.waitForSelector(
          `button[aria-label*="Download ${type}"]`,
          { timeout: 15 * 60 * 1000 }
        );

        if (!downloadButton) {
          throw new Error(`${type} generation failed: download button not found`);
        }

        return `/path/to/${type}.file`;
      },
      {
        // Custom recovery for NotebookLM errors
        'Rate limit': async () => {
          console.log('Rate limit hit, waiting 60 seconds...');
          await this.page.waitForTimeout(60000);
        },
        'Session expired': async () => {
          console.log('Session expired, re-authenticating...');
          // Trigger re-authentication
          throw new Error('Re-authentication required');
        }
      }
    );
  }

  async clickWithRetry(selector: string, options: { timeout?: number } = {}): Promise<void> {
    await RetryHandler.withRetry(
      async () => {
        const element = await this.page.waitForSelector(selector, options);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        await element.click();
      },
      { maxAttempts: 3, initialDelay: 1000 }
    );
  }
}

export { RetryHandler, NotebookLMRetryHandler };
```

---

## Recommendations

### Primary Recommendation: Playwright

**Reasoning**:
1. **Auto-waiting**: Significantly reduces flakiness in detecting when generation completes
2. **Built-in downloads**: Native download event handling
3. **Debugging tools**: Trace viewer, screenshots, video recording
4. **Network monitoring**: Built-in request/response interception
5. **Community**: Active development, extensive documentation
6. **Future-proof**: Cross-browser support if needed later

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Slack Bot Service                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ├─ Receives mention event
                        ├─ Queues job in BullMQ
                        └─ Returns acknowledgment

┌─────────────────────────────────────────────────────────┐
│                  BullMQ Worker Process                   │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Playwright   │ │  Download   │ │  Cloudflare  │
│ Automation   │→│  Handler    │→│  R2 Upload   │
└──────────────┘ └─────────────┘ └──────────────┘
        │
        ├─ Browser context with auth
        ├─ Navigate & create notebook
        ├─ Add source URL
        ├─ Trigger generation
        ├─ Monitor network/DOM (15 min timeout)
        ├─ Download files
        └─ Return file paths
```

### Key Implementation Points

1. **Authentication Strategy**:
   - Use browser context persistence
   - One-time manual login (headless: false)
   - Save auth state to file
   - Reuse for subsequent runs
   - Re-authenticate on session expiry

2. **Generation Monitoring**:
   - Primary: `page.waitForSelector()` on download button
   - Fallback: Network response monitoring
   - Tertiary: DOM text content checking
   - Use robust waiter with multiple strategies

3. **Download Handling**:
   - Use Playwright's built-in download events
   - Monitor for specific file types (.wav, .mp4)
   - Save to temporary directory
   - Upload to R2 immediately
   - Delete local files after upload

4. **Timeout Management**:
   - Global timeout: 15 minutes
   - Navigation timeout: 1 minute
   - Action timeout: 30 seconds
   - Generation timeout: 15 minutes

5. **Error Handling**:
   - Retry logic with exponential backoff
   - Capture screenshots on failure
   - Log network requests for debugging
   - Simple error messages to Slack (as per spec)

6. **Performance**:
   - Use BullMQ for job queue
   - One browser context per job
   - Close context after completion
   - Consider browser pooling for high concurrency

### Security Considerations

1. **Credentials Storage**:
   - Store auth state securely (encrypted if possible)
   - Never commit auth files to git
   - Use environment variables for sensitive config
   - Rotate credentials periodically

2. **Rate Limiting**:
   - Respect NotebookLM Pro usage limits
   - Implement queue-based rate limiting
   - Monitor for 429 errors
   - Graceful degradation on limits

3. **Anti-Detection**:
   - Use `--disable-blink-features=AutomationControlled`
   - Remove webdriver flag
   - Use realistic user agents
   - Add human-like delays
   - Rotate browser fingerprints if needed

### Testing Strategy

1. **Unit Tests**:
   - URL extraction logic
   - R2 upload/download
   - Retry logic

2. **Integration Tests**:
   - Mock Playwright for faster tests
   - Test full flow with test doubles
   - Slack event handling

3. **E2E Tests**:
   - Real browser automation (non-prod NotebookLM)
   - Use Playwright Test framework
   - Record traces for debugging
   - Run in CI with headless mode

### Monitoring and Observability

```typescript
import { Logger } from 'pino';

interface AutomationMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  generationType: 'audio' | 'video';
}

class NotebookLMMonitoring {
  private logger: Logger;
  private metrics: AutomationMetrics[] = [];

  async logGeneration(
    type: 'audio' | 'video',
    fn: () => Promise<void>
  ): Promise<void> {
    const metric: AutomationMetrics = {
      startTime: Date.now(),
      success: false,
      generationType: type
    };

    try {
      await fn();
      metric.success = true;
    } catch (error) {
      metric.errorType = (error as Error).message;
      throw error;
    } finally {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      this.metrics.push(metric);

      this.logger.info({
        type: 'generation_completed',
        ...metric
      });
    }
  }

  getAverageDuration(type: 'audio' | 'video'): number {
    const relevant = this.metrics.filter(
      m => m.generationType === type && m.success && m.duration
    );
    if (relevant.length === 0) return 0;

    const sum = relevant.reduce((acc, m) => acc + (m.duration || 0), 0);
    return sum / relevant.length;
  }

  getSuccessRate(): number {
    if (this.metrics.length === 0) return 0;
    const successful = this.metrics.filter(m => m.success).length;
    return (successful / this.metrics.length) * 100;
  }
}
```

### Deployment Considerations

**Infrastructure Requirements**:
- **Compute**: 2 vCPU, 4GB RAM minimum (for browser)
- **Storage**: 10GB for browser binaries and temp files
- **Network**: Stable connection for WebSocket
- **Platform**: Docker or Fly.io with persistent volumes

**Environment Variables**:
```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Redis (for BullMQ)
REDIS_URL=redis://...

# PostgreSQL
DATABASE_URL=postgresql://...

# NotebookLM
NOTEBOOKLM_AUTH_PATH=/data/auth.json
NOTEBOOKLM_HEADLESS=true
NOTEBOOKLM_TIMEOUT=900000

# App Config
LOG_LEVEL=info
NODE_ENV=production
```

**Dockerfile**:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Install browsers
RUN npx playwright install chromium

# Create data directory for auth persistence
RUN mkdir -p /data && chmod 777 /data

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Conclusion

**For NotebookLM automation, use Playwright** as your primary browser automation tool. It provides the best balance of:
- **Reliability**: Auto-waiting and robust error handling
- **Maintainability**: Clean API and excellent documentation
- **Debuggability**: Trace viewer and screenshot capabilities
- **Performance**: Fast execution with WebSocket protocol
- **Future-proofing**: Active development and cross-browser support

**Avoid MCP servers** for this use case - they add unnecessary abstraction for programmatic automation and are better suited for AI-driven interactive workflows.

**Use CDP directly** only if you encounter limitations in Playwright that require low-level protocol access. The examples above show how to integrate CDP session with Playwright for network monitoring while keeping the convenience of Playwright's API.

**Key Success Factors**:
1. Robust authentication with browser context persistence
2. Multiple wait strategies for generation completion
3. Proper timeout configuration (15+ minutes)
4. Comprehensive error handling and retry logic
5. Monitoring and logging for debugging
6. Anti-detection measures for Google OAuth

The code examples provided are production-ready starting points that handle the specific challenges of NotebookLM automation, including long-running operations, download interception, and Google authentication.
