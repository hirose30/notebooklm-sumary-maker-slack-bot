/**
 * URL extraction service
 * Extracts and validates URLs from Slack message text
 */

import { logger } from '../lib/logger.js';

/**
 * Extract the first valid URL from text
 * @param text - Message text to extract URL from
 * @returns First valid URL found, or null if none found
 */
export function extractUrl(text: string): string | null {
  // Remove Slack's URL formatting: <https://example.com|example.com> -> https://example.com
  const cleanText = text.replace(/<([^|>]+)\|[^>]+>/g, '$1').replace(/<([^>]+)>/g, '$1');

  // URL regex pattern
  const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

  const matches = cleanText.match(urlPattern);

  if (!matches || matches.length === 0) {
    logger.debug('No URLs found in text', { text: cleanText.substring(0, 100) });
    return null;
  }

  const firstUrl = matches[0];
  logger.info('URL extracted', { url: firstUrl });

  return firstUrl;
}

/**
 * Validate if a string is a valid URL
 * @param urlString - String to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract and validate URL from Slack message
 * @param text - Message text
 * @returns Valid URL or null
 */
export function extractAndValidateUrl(text: string): string | null {
  const url = extractUrl(text);

  if (!url) {
    return null;
  }

  if (!isValidUrl(url)) {
    logger.warn('Invalid URL format', { url });
    return null;
  }

  return url;
}

/**
 * Extract URL from thread context (mention text or parent text)
 * Priority: mentionText > parentText
 * @param mentionText - Text from the mention message
 * @param parentText - Text from the parent thread message (null if no parent)
 * @returns Valid URL or null
 */
export function extractUrlFromThread(mentionText: string, parentText: string | null): string | null {
  // Priority 1: Check mention text first
  const mentionUrl = extractAndValidateUrl(mentionText);
  if (mentionUrl) {
    logger.info('URL found in mention text', { url: mentionUrl });
    return mentionUrl;
  }

  // Priority 2: Check parent text if available
  if (parentText) {
    const parentUrl = extractAndValidateUrl(parentText);
    if (parentUrl) {
      logger.info('URL found in parent thread', { url: parentUrl });
      return parentUrl;
    }
  }

  // No URL found in either location
  logger.debug('No URL found in thread context');
  return null;
}
