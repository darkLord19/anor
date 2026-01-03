/**
 * WhatsApp Web content script
 * Read-only DOM search - never navigates or mutates
 */

import { extractSnippets } from '../lib/dom-search.js';
// Keep extractSnippets for potential future use or other parts of the file
// @ts-ignore
const _keep = extractSnippets;

// WhatsApp Web selectors (may need updates as WhatsApp changes their UI)
const SELECTORS = {
  messageContainer: '#main',
  messageList: '[data-testid="conversation-panel-messages"]',
  messageItem: 'div[role="row"]',
  messageText: '.copyable-text',
  chatName: '[data-testid="conversation-info-header-chat-title"]',
  contactName: '[data-testid="cell-frame-title"]',
  // Search related
  searchInput: 'div[aria-label="Search input textbox"]',
  sidePanel: '#pane-side',
  searchResultItem: 'div[role="gridcell"][aria-colindex="2"]',
};

// Handle search requests from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Dotor] WhatsApp content script received message:', message.type);
  
  if (message.type === 'SCRAPE_MESSAGES') {
    const keyword = message.keyword;
    
    if (keyword) {
      performSearchAndScrape(keyword)
        .then(snippets => {
          console.log(`[Dotor] Scraped ${snippets.length} snippets for "${keyword}"`);
          sendResponse({ snippets });
        })
        .catch(error => {
          console.error('[Dotor] Search failed:', error);
          sendResponse({ 
            snippets: [], 
            error: error instanceof Error ? error.message : 'Search failed' 
          });
        });
    } else {
      // Fallback: scrape current open chat
      try {
        const snippets = scrapeCurrentChat([]);
        sendResponse({ snippets });
      } catch (error) {
        sendResponse({ snippets: [], error: 'Scrape failed' });
      }
    }
    return true; // Async response
  }
  
  if (message.type === 'SEARCH_DOM') {
    // Legacy support
    try {
      const snippets = scrapeCurrentChat(message.payload.keywords);
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
 * Perform search in WhatsApp Web and scrape results
 */
async function performSearchAndScrape(keyword: string): Promise<string[]> {
  let searchInput = document.querySelector(SELECTORS.searchInput) as HTMLElement;
  
  // Fallback for search input if primary selector fails
  if (!searchInput) {
    searchInput = document.querySelector('div[contenteditable="true"][data-tab="3"]') as HTMLElement;
  }

  if (!searchInput) {
    console.warn('[Dotor] Search input not found');
    return [];
  }

  // 1. Clear and Type keyword
  searchInput.focus();
  // Use execCommand for compatibility with WhatsApp's rich text editor
  document.execCommand('selectAll', false, undefined);
  document.execCommand('insertText', false, keyword);
  
  // Dispatch events to ensure React state updates
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  // 2. Wait for results to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Scrape the side panel results
  const sidePanel = document.querySelector(SELECTORS.sidePanel);
  if (!sidePanel) {
    console.warn('[Dotor] Side panel not found');
    return [];
  }
  
  // Wait a bit more for results to populate fully
  await new Promise(resolve => setTimeout(resolve, 1000));

  const items = Array.from(sidePanel.querySelectorAll(SELECTORS.searchResultItem));
  console.log(`[Dotor] Found ${items.length} search results`);

  const snippets: string[] = [];
  
  // Process top 2 results
  const resultsToProcess = items.slice(0, 2);
  
  for (const item of resultsToProcess) {
    try {
      console.log('[Dotor] Clicking search result item...');
      
      // Simulate a full click sequence (mousedown -> mouseup -> click)
      // This is often needed for React-based apps like WhatsApp
      const mouseEventInit = { bubbles: true, cancelable: true, view: window };
      item.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
      item.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
      (item as HTMLElement).click();
      
      // Wait for chat to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Scroll to gather more context
      await scrollChat();
      
      // Scrape current chat
      // We pass the keyword to extract relevant snippets, but also get context
      const chatSnippets = scrapeCurrentChat([keyword]);
      console.log(`[Dotor] Scraped ${chatSnippets.length} snippets from chat`);
      
      if (chatSnippets.length > 0) {
        snippets.push(...chatSnippets);
      } else {
        // If no keyword match found in chat (weird since it was a search result),
        // grab the last few messages anyway as they might be relevant context
        const fallbackSnippets = scrapeCurrentChat([]);
        snippets.push(...fallbackSnippets);
      }
    } catch (e) {
      console.error('[Dotor] Error processing search result item:', e);
    }
  }
  
  return snippets;
}

/**
 * Scroll the chat up and down to trigger lazy loading
 */
async function scrollChat() {
  let chatList = document.querySelector(SELECTORS.messageList) as HTMLElement;
  
  // Fallback: find the scrollable container within #main
  if (!chatList) {
    const main = document.querySelector('#main');
    if (main) {
      // The message list is usually a direct child or close descendant that is scrollable
      // We look for an element with significant scrollHeight
      const candidates = Array.from(main.querySelectorAll('div'));
      // Find the one with the largest scrollHeight that is scrollable
      chatList = candidates.reduce((best, curr) => {
        if (curr.scrollHeight > curr.clientHeight && curr.clientHeight > 100) {
          if (!best || curr.scrollHeight > best.scrollHeight) {
            return curr;
          }
        }
        return best;
      }, null as HTMLElement | null) as HTMLElement;
    }
  }

  if (!chatList) {
    console.warn('[Dotor] Could not find scrollable chat list');
    return;
  }
  
  console.log('[Dotor] Found chat list, scrolling...', { 
    scrollHeight: chatList.scrollHeight, 
    scrollTop: chatList.scrollTop,
    clientHeight: chatList.clientHeight 
  });
  
  // Scroll up a bit to load context
  const currentScroll = chatList.scrollTop;
  chatList.scrollTop = Math.max(0, currentScroll - 500);
  chatList.dispatchEvent(new Event('scroll', { bubbles: true }));
  await new Promise(r => setTimeout(r, 1000));
  
  // Scroll down a bit
  chatList.scrollTop = Math.min(chatList.scrollHeight, currentScroll + 500);
  chatList.dispatchEvent(new Event('scroll', { bubbles: true }));
  await new Promise(r => setTimeout(r, 1000));
}

/**
 * Scrape messages from the currently open chat
 */
function scrapeCurrentChat(keywords: string[]): string[] {
  // Only run when a chat is open
  const chatPanel = document.querySelector(SELECTORS.messageContainer);
  if (!chatPanel) {
    console.warn('[Dotor] Chat panel not found');
    return [];
  }
  
  // Search messages in current conversation
  let messageSnippets: string[] = [];
  
  // Get all message rows
  const messageRows = Array.from(document.querySelectorAll(SELECTORS.messageItem));
  console.log(`[Dotor] Found ${messageRows.length} message rows`);
  
  // Extract text from messages
  const allMessages = messageRows.map(row => {
    // Try to find copyable text container
    const copyableText = row.querySelector(SELECTORS.messageText);
    if (copyableText) {
      // Get the data-pre-plain-text attribute which contains timestamp and sender
      const meta = copyableText.getAttribute('data-pre-plain-text') || '';
      const content = copyableText.textContent || '';
      return `${meta}${content}`.trim();
    }
    return '';
  }).filter(text => text.length > 0);

  if (keywords.length > 0) {
    // Filter by keywords
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    messageSnippets = allMessages.filter(msg => 
      normalizedKeywords.some(k => msg.toLowerCase().includes(k))
    );
    
    // If we found matches, include some context (surrounding messages)
    // This is a simple implementation, could be improved
    if (messageSnippets.length > 0 && messageSnippets.length < 5) {
        // If few matches, just return last 10 messages to give context
        messageSnippets = allMessages.slice(-10);
    }
  } else {
    // Scrape last 15 messages if no keywords
    messageSnippets = allMessages.slice(-15);
  }
  
  // Get current chat name for context
  // Try multiple selectors for chat name
  let chatName = '';
  const chatNameElement = document.querySelector(SELECTORS.chatName);
  if (chatNameElement) {
      chatName = chatNameElement.textContent?.trim() || '';
  } else {
      // Fallback: try to find header title in main panel
      const headerTitle = document.querySelector('#main header span[dir="auto"]');
      if (headerTitle) {
          chatName = headerTitle.textContent?.trim() || '';
      }
  }
  
  // Prefix snippets with chat context if available
  if (chatName && messageSnippets.length > 0) {
    return messageSnippets.map(snippet => `[${chatName}] ${snippet}`);
  }
  
  return messageSnippets;
}

// Log that content script is active (for debugging)
console.log('[Dotor] WhatsApp content script loaded');
