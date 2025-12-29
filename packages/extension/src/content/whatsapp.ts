/**
 * WhatsApp Web content script
 * Read-only DOM search - never navigates or mutates
 */

import { extractSnippets } from '../lib/dom-search.js';

// WhatsApp Web selectors (may need updates as WhatsApp changes their UI)
const SELECTORS = {
  messageContainer: '#main',
  messageList: '[data-testid="conversation-panel-messages"]',
  messageItem: '[data-testid="msg-container"]',
  messageText: '.selectable-text',
  chatName: '[data-testid="conversation-info-header-chat-title"]',
  contactName: '[data-testid="cell-frame-title"]',
};

// Handle search requests from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEARCH_DOM') {
    try {
      const snippets = searchWhatsAppMessages(message.payload.keywords);
      sendResponse({ snippets });
    } catch (error) {
      sendResponse({ 
        snippets: [], 
        error: error instanceof Error ? error.message : 'Search failed' 
      });
    }
  }
  return true;
});

/**
 * Search WhatsApp messages for keywords
 * Read-only operation - never mutates DOM or navigates
 */
function searchWhatsAppMessages(keywords: string[]): string[] {
  // Only run when a chat is open
  const chatPanel = document.querySelector(SELECTORS.messageContainer);
  if (!chatPanel) {
    return [];
  }
  
  // Search messages in current conversation
  const messageSnippets = extractSnippets(
    keywords,
    SELECTORS.messageText,
    20
  );
  
  // Get current chat name for context
  const chatNameElement = document.querySelector(SELECTORS.chatName);
  const chatName = chatNameElement?.textContent?.trim();
  
  // Prefix snippets with chat context if available
  if (chatName && messageSnippets.length > 0) {
    return messageSnippets.map(snippet => `[${chatName}] ${snippet}`);
  }
  
  return messageSnippets;
}

// Log that content script is active (for debugging)
console.log('[Dotor] WhatsApp content script loaded');
