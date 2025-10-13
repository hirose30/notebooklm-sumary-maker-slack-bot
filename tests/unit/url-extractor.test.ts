/**
 * Unit tests for url-extractor.ts
 * Tests the extractUrlFromThread function
 */

import { describe, it, expect } from 'vitest';
import { extractUrlFromThread } from '../../src/services/url-extractor.js';

describe('extractUrlFromThread', () => {
  it('should extract URL from mentionText when present', () => {
    const mentionText = '@bot https://example.com/article';
    const parentText = 'https://other.com/page';

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBe('https://example.com/article');
  });

  it('should extract URL from parentText when mentionText has no URL', () => {
    const mentionText = '@bot please summarize this';
    const parentText = 'Check out this article: https://example.com/article';

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBe('https://example.com/article');
  });

  it('should return null when neither mentionText nor parentText have URLs', () => {
    const mentionText = '@bot please help';
    const parentText = 'Just a regular message';

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBeNull();
  });

  it('should prioritize mentionText URL over parentText URL', () => {
    const mentionText = '@bot https://priority.com/article';
    const parentText = 'https://secondary.com/page';

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBe('https://priority.com/article');
  });

  it('should handle null parentText gracefully', () => {
    const mentionText = '@bot https://example.com/article';
    const parentText = null;

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBe('https://example.com/article');
  });

  it('should extract URL from Slack formatted links', () => {
    const mentionText = '@bot <https://example.com/article|example>';
    const parentText = null;

    const result = extractUrlFromThread(mentionText, parentText);

    expect(result).toBe('https://example.com/article');
  });
});
