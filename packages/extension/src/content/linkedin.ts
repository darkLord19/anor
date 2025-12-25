/**
 * LinkedIn Messages content script
 * Searches by using LinkedIn's search functionality and collecting messages
 */

// LinkedIn messaging selectors (may need updates as LinkedIn changes their UI)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEARCH_DOM') {
    console.log('[Anor LinkedIn] Received search request (legacy)');
    // Legacy handler - just return empty or error
    sendResponse({ snippets: [], error: 'Use SCRAPE_MESSAGES instead' });
  }
  
  if (message.type === 'SCRAPE_MESSAGES') {
    console.log('[Anor LinkedIn] Received scrape request');
    
    // Handle async operation
    (async () => {
      try {
        const snippets = await scrapeCurrentPage();
        console.log(`[Anor LinkedIn] Scrape completed, found ${snippets.length} snippets`);
        sendResponse({ snippets });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Scrape failed';
        console.error('[Anor LinkedIn] Scrape error:', errorMsg);
        sendResponse({ 
          snippets: [], 
          error: errorMsg
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }
});

/**
 * Helper to wait for a specified duration
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrape the current LinkedIn messaging page
 * Assumes the page is already loaded with the correct search term
 */
async function scrapeCurrentPage(): Promise<string[]> {
  const currentUrl = window.location.href;
  console.log('[Anor LinkedIn] Scraping messages, current URL:', currentUrl);
  
  // Check if we're on a messaging page
  if (!currentUrl.includes('/messaging/')) {
    console.warn('[Anor LinkedIn] Not on messaging page, current URL:', currentUrl);
    return [];
  }
  
  const allSnippets: string[] = [];
  
  // Step 1: Find conversation threads in search results
  // Wait a bit for results to appear if they haven't yet
  console.log('[Anor LinkedIn] Waiting for search results to render...');
  
  // Retry loop for finding conversations
  let conversationItems: Element[] = [];
  const conversationSelectors = [
    '.msg-conversations-container--inbox-shortcuts ul > li', // Derived from user provided path
    '.scaffold-layout__list ul > li',
    '.msg-conversation-card__content--selectable',
    '.msg-conversation-listitem',
    '.msg-conversation-card',
    '[data-view-name="conversation-item"]',
    '.msg-conversation-listitem__link',
    'a[href*="/messaging/thread/"]',
    'li.msg-conversation-listitem'
  ];

  console.log('[Anor LinkedIn] Using conversation selectors:', conversationSelectors);

  for (let attempt = 0; attempt < 5; attempt++) {
    await delay(2000); // Wait 2s between attempts
    
    // Debug: Log what we see in the DOM
    const listContainer = document.querySelector('.msg-conversations-container__conversations-list, ul.msg-conversations-container__conversations-list');
    if (listContainer) {
        console.log(`[Anor LinkedIn] Found list container. Children count: ${listContainer.children.length}`);
    } else {
        console.log('[Anor LinkedIn] List container NOT found');
    }

    conversationItems = Array.from(document.querySelectorAll(conversationSelectors.join(', ')));
    
    if (conversationItems.length > 0) {
      console.log(`[Anor LinkedIn] Found ${conversationItems.length} conversation items on attempt ${attempt + 1}`);
      break;
    }
    console.log(`[Anor LinkedIn] Attempt ${attempt + 1}: No conversations found yet...`);
  }
  
  if (conversationItems.length === 0) {
    console.log(`[Anor LinkedIn] No conversations found on this page after multiple attempts`);
    return [];
  }
  
  // Step 2: Iterate through all conversations
  console.log(`[Anor LinkedIn] Found ${conversationItems.length} conversation items. Processing all of them...`);

  for (let i = 0; i < conversationItems.length; i++) {
    const conversationItem = conversationItems[i] as HTMLElement;
    console.log(`[Anor LinkedIn] Processing conversation ${i + 1}/${conversationItems.length}`);
    
    // Try to find the best clickable target
    let clickTarget = conversationItem;
    const specificClickable = conversationItem.querySelector('.msg-conversation-card__content--selectable') || 
                             conversationItem.querySelector('.msg-conversation-listitem__link') ||
                             conversationItem.closest('.msg-conversation-listitem__link');
                             
    if (specificClickable) {
        console.log('[Anor LinkedIn] Found specific clickable child/parent:', specificClickable.className);
        clickTarget = specificClickable as HTMLElement;
    }
    
    console.log('[Anor LinkedIn] Clicking conversation target...');
    try {
        clickTarget.click();
    } catch (e) {
        console.error('[Anor LinkedIn] Error clicking conversation:', e);
    }
    
    // Wait for conversation to load
    console.log('[Anor LinkedIn] Waiting for conversation thread to load...');
    await delay(3000);
    
    // Step 3: Scroll up 10 times to load more messages
    // Try to find the message list container more aggressively
    let messageList = null;
    const messageListSelectors = [
        '.msg-s-message-list-container',
        '.msg-s-event-listitem__body',
        '[role="main"]',
        '.msg-s-message-list',
        '.msg-s-message-list-content',
        'div.msg-s-message-list-container--column-reversed'
    ];

    for (const selector of messageListSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            messageList = el;
            console.log(`[Anor LinkedIn] Found message list with selector: ${selector}`);
            break;
        }
    }
    
    if (messageList) {
      console.log('[Anor LinkedIn] Found message list container:', messageList.className);
      console.log('[Anor LinkedIn] Scrolling up to load more messages');
      
      for (let j = 0; j < 10; j++) { 
        messageList.scrollTop = 0; // Scroll to top
        await delay(800);
      }
      
      console.log('[Anor LinkedIn] Finished scrolling, collecting messages');
    } else {
      // Fallback: Try to find ANY scrollable element that looks like a list
      const allDivs = Array.from(document.querySelectorAll('div'));
      const scrollableDiv = allDivs.find(div => {
          const style = window.getComputedStyle(div);
          return (style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight;
      });
      
      if (scrollableDiv) {
          console.log('[Anor LinkedIn] Found a scrollable div as fallback:', scrollableDiv.className);
          messageList = scrollableDiv;
          // Try scrolling this one
          for (let j = 0; j < 10; j++) { 
              messageList.scrollTop = 0; 
              await delay(800);
          }
      } else {
          console.warn('[Anor LinkedIn] Could not find message list container to scroll. Tried selectors:', messageListSelectors);
      }
    }
    
    // Step 4: Collect all messages from the conversation
    // Try multiple selectors for message content
    const messageSelectors = [
      '.msg-s-event-listitem__message-bubble',
      '.msg-s-message-list__event',
      '[data-view-name="message-item"]',
      '.msg-s-event-listitem__body',
      'p.msg-s-event-listitem__body',
      '.msg-s-event-with-indicator'
    ];
    
    console.log('[Anor LinkedIn] Using message selectors:', messageSelectors);
    const messageElements = Array.from(document.querySelectorAll(messageSelectors.join(', ')));
    
    console.log(`[Anor LinkedIn] Found ${messageElements.length} messages in this conversation`);
    
    for (const msgElement of messageElements) {
      const text = msgElement.textContent?.trim();
      if (text && text.length > 0) {
        // Store full message text
        if (!allSnippets.includes(text)) {
          allSnippets.push(text);
        }
      }
    }
  }
  
  console.log(`[Anor LinkedIn] Total snippets collected: ${allSnippets.length}`);
  console.log(`[Anor LinkedIn] Sample snippets:`, allSnippets.slice(0, 3));
  
  return allSnippets;
}

// Log that content script is active (for debugging)
console.log('[Anor] LinkedIn content script loaded');
