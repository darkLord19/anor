/**
 * LinkedIn Messages content script
 * Read-only DOM search - never navigates or mutates
 */

import { extractSnippets } from '../lib/dom-search.js';

// LinkedIn messaging selectors (may need updates as LinkedIn changes their UI)
const SELECTORS = {
  messageContainer: '.msg-conversations-container',
  messageList: '.msg-s-message-list',
  messageItem: '.msg-s-event-listitem__body',
  messageText: '.msg-s-event-listitem__message-bubble',
  conversationName: '.msg-conversation-listitem__participant-names',
};

// Handle search requests from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEARCH_DOM') {
    console.log('[Anor LinkedIn] Received search request with keywords:', message.payload.keywords);
    console.log('[Anor LinkedIn] Current URL:', window.location.href);
    
    try {
      const snippets = searchLinkedInMessages(message.payload.keywords);
      console.log(`[Anor LinkedIn] Search completed, found ${snippets.length} snippets`);
      sendResponse({ snippets });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Search failed';
      console.error('[Anor LinkedIn] Search error:', errorMsg);
      sendResponse({ 
        snippets: [], 
        error: errorMsg
      });
    }
  }
  return true; // Keep channel open for async response
});

/**
 * Search LinkedIn messages for keywords
 * Read-only operation - never mutates DOM or navigates
 */
function searchLinkedInMessages(keywords: string[]): string[] {
  const currentUrl = window.location.href;
  console.log('[Anor LinkedIn] Searching messages, current URL:', currentUrl);
  
  // Check if we're on a messaging page
  if (!currentUrl.includes('/messaging/')) {
    console.warn('[Anor LinkedIn] Not on messaging page, current URL:', currentUrl);
    // Return empty but don't error - might be on login page or redirecting
    return [];
  }
  
  // Check if user is logged in (LinkedIn shows login page if not authenticated)
  if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
    console.warn('[Anor LinkedIn] User not logged in or on checkpoint page');
    return [];
  }
  
  // Wait a bit for page to be interactive (LinkedIn is a SPA)
  // Check if message elements exist
  const messageContainer = document.querySelector(SELECTORS.messageContainer);
  const messageList = document.querySelector(SELECTORS.messageList);
  
  if (!messageContainer && !messageList) {
    console.warn('[Anor LinkedIn] Message container not found, page may still be loading');
    // Still try to search, might find elements
  }
  
  // First, try to find messages in the current conversation
  const conversationSnippets = extractSnippets(
    keywords,
    SELECTORS.messageText,
    15
  );
  
  console.log(`[Anor LinkedIn] Found ${conversationSnippets.length} conversation snippets`);
  
  // Also search conversation names for context
  const nameSnippets = extractSnippets(
    keywords,
    SELECTORS.conversationName,
    5
  );
  
  console.log(`[Anor LinkedIn] Found ${nameSnippets.length} name snippets`);
  
  const allSnippets = [...conversationSnippets, ...nameSnippets];
  console.log(`[Anor LinkedIn] Total snippets found: ${allSnippets.length}`);
  
  return allSnippets;
}

// Log that content script is active (for debugging)
console.log('[Anor] LinkedIn content script loaded');
