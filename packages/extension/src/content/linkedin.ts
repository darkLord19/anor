/**
 * LinkedIn Messages content script
 * Searches by using LinkedIn's search functionality and collecting messages
 */

let interceptedMessages: any[] = [];

// Listen for messages from the MAIN world interceptor
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'LINKEDIN_MESSAGES_INTERCEPTED') {
    console.log('[Dotor LinkedIn] Intercepted GraphQL messages', event.data.data);
    processInterceptedData(event.data.data);
  }
});

function processInterceptedData(data: any) {
  try {
    // Handle different response structures
    const elements = data?.data?.messengerMessagesByAnchorTimestamp?.elements || 
                    data?.data?.messengerMessages?.elements;

    if (Array.isArray(elements)) {
      const newMessages = elements.map((msg: any) => {
        const body = msg.body?.text || '';
        const senderFirstName = msg.actor?.participantType?.member?.firstName?.text || '';
        const senderLastName = msg.actor?.participantType?.member?.lastName?.text || '';
        const sender = `${senderFirstName} ${senderLastName}`.trim();
        const timestamp = msg.deliveredAt;
        
        return {
          sender,
          message: body,
          timestamp: new Date(timestamp).toISOString()
        };
      }).filter((msg: any) => msg.message); // Filter out empty messages
      
      // Add to buffer
      interceptedMessages = [...interceptedMessages, ...newMessages];
      console.log(`[Dotor LinkedIn] Added ${newMessages.length} messages to buffer. Total: ${interceptedMessages.length}`);
    }
  } catch (e) {
    console.error('[Dotor LinkedIn] Error processing intercepted data', e);
  }
}

// LinkedIn messaging selectors (may need updates as LinkedIn changes their UI)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEARCH_DOM') {
    console.log('[Dotor LinkedIn] Received search request (legacy)');
    // Legacy handler - just return empty or error
    sendResponse({ snippets: [], error: 'Use SCRAPE_MESSAGES instead' });
  }
  
  if (message.type === 'SCRAPE_MESSAGES') {
    console.log('[Dotor LinkedIn] Received scrape request');
    
    // Return intercepted messages if we have them
    if (interceptedMessages.length > 0) {
        console.log(`[Dotor LinkedIn] Returning ${interceptedMessages.length} intercepted messages`);
        const snippets = interceptedMessages.map(m => JSON.stringify(m));
        sendResponse({ snippets });
        return true;
    }

    // Handle async operation (Fallback to DOM scraping)
    (async () => {
      try {
        const snippets = await scrapeCurrentPage();
        console.log(`[Dotor LinkedIn] Scrape completed, found ${snippets.length} snippets`);
        sendResponse({ snippets });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Scrape failed';
        console.error('[Dotor LinkedIn] Scrape error:', errorMsg);
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
  console.log('[Dotor LinkedIn] Scraping messages (DOM Fallback), current URL:', currentUrl);
  
  // Check if we're on a messaging page
  if (!currentUrl.includes('/messaging/')) {
    console.warn('[Dotor LinkedIn] Not on messaging page, current URL:', currentUrl);
    return [];
  }
  
  const allSnippets: string[] = [];
  
  // Step 1: Find conversation threads in search results
  // Wait a bit for results to appear if they haven't yet
  console.log('[Dotor LinkedIn] Waiting for search results to render...');
  
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

  console.log('[Dotor LinkedIn] Using conversation selectors:', conversationSelectors);

  for (let attempt = 0; attempt < 5; attempt++) {
    await delay(2000); // Wait 2s between attempts
    
    // Debug: Log what we see in the DOM
    const listContainer = document.querySelector('.msg-conversations-container__conversations-list, ul.msg-conversations-container__conversations-list');
    if (listContainer) {
        console.log(`[Dotor LinkedIn] Found list container. Children count: ${listContainer.children.length}`);
    } else {
        console.log('[Dotor LinkedIn] List container NOT found');
    }

    conversationItems = Array.from(document.querySelectorAll(conversationSelectors.join(', ')));
    
    if (conversationItems.length > 0) {
      console.log(`[Dotor LinkedIn] Found ${conversationItems.length} conversation items on attempt ${attempt + 1}`);
      break;
    }
    console.log(`[Dotor LinkedIn] Attempt ${attempt + 1}: No conversations found yet...`);
  }
  
  if (conversationItems.length === 0) {
    console.log(`[Dotor LinkedIn] No conversations found on this page after multiple attempts`);
    return [];
  }
  
  // Step 2: Iterate through all conversations
  console.log(`[Dotor LinkedIn] Found ${conversationItems.length} conversation items. Processing all of them...`);

  for (let i = 0; i < conversationItems.length; i++) {
    const conversationItem = conversationItems[i] as HTMLElement;
    console.log(`[Dotor LinkedIn] Processing conversation ${i + 1}/${conversationItems.length}`);
    
    // Try to find the best clickable target
    let clickTarget = conversationItem;
    const specificClickable = conversationItem.querySelector('.msg-conversation-card__content--selectable') || 
                             conversationItem.querySelector('.msg-conversation-listitem__link') ||
                             conversationItem.closest('.msg-conversation-listitem__link');
                             
    if (specificClickable) {
        console.log('[Dotor LinkedIn] Found specific clickable child/parent:', specificClickable.className);
        clickTarget = specificClickable as HTMLElement;
    }
    
    console.log('[Dotor LinkedIn] Clicking conversation target...');
    try {
        clickTarget.click();
    } catch (e) {
        console.error('[Dotor LinkedIn] Error clicking conversation:', e);
    }
    
    // Wait for conversation to load
    console.log('[Dotor LinkedIn] Waiting for conversation thread to load...');
    await delay(3000);
    
    // Step 3: Scroll up 10 times to load more messages
    // Scrolling disabled for now as it was causing issues finding the container
    /*
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
            console.log(`[Dotor LinkedIn] Found message list with selector: ${selector}`);
            break;
        }
    }
    
    if (messageList) {
      console.log('[Dotor LinkedIn] Found message list container:', messageList.className);
      console.log('[Dotor LinkedIn] Scrolling up to load more messages');
      
      for (let j = 0; j < 10; j++) { 
        messageList.scrollTop = 0; // Scroll to top
        await delay(800);
      }
      
      console.log('[Dotor LinkedIn] Finished scrolling, collecting messages');
    } else {
      // Fallback: Try to find ANY scrollable element that looks like a list
      const allDivs = Array.from(document.querySelectorAll('div'));
      const scrollableDiv = allDivs.find(div => {
          const style = window.getComputedStyle(div);
          return (style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight;
      });
      
      if (scrollableDiv) {
          console.log('[Dotor LinkedIn] Found a scrollable div as fallback:', scrollableDiv.className);
          messageList = scrollableDiv;
          // Try scrolling this one
          for (let j = 0; j < 10; j++) { 
              messageList.scrollTop = 0; 
              await delay(800);
          }
      } else {
          console.warn('[Dotor LinkedIn] Could not find message list container to scroll. Tried selectors:', messageListSelectors);
      }
    }
    */
    
    // Step 4: Collect all messages from the conversation
    // We want structured data: { sender, message, timestamp }
    
    // Find all message list items (events)
    const messageEvents = Array.from(document.querySelectorAll('li.msg-s-message-list__event'));
    console.log(`[Dotor LinkedIn] Found ${messageEvents.length} message events`);
    
    let currentSender = 'Unknown';
    
    for (const event of messageEvents) {
        // 1. Try to extract sender from this event (it might be a group header)
        const senderEl = event.querySelector('.msg-s-message-group__name');
        if (senderEl) {
            currentSender = senderEl.textContent?.trim() || currentSender;
        } else {
            // Fallback: check for "X sent the following message" hidden text
            const hiddenText = (event as HTMLElement).innerText; // innerText includes hidden text usually
            if (hiddenText.includes('sent the following message')) {
                const match = hiddenText.match(/^(.+?) sent the following message/);
                if (match && match[1]) {
                    currentSender = match[1].trim();
                }
            }
        }
        
        // 2. Try to extract timestamp
        let timestamp = '';
        const timeEl = event.querySelector('time');
        if (timeEl) {
            timestamp = timeEl.textContent?.trim() || '';
        }
        
        // 3. Extract message body
        const bodyEl = event.querySelector('.msg-s-event-listitem__body');
        if (bodyEl) {
            // Use innerText to preserve newlines/formatting, fallback to textContent
            const message = (bodyEl as HTMLElement).innerText?.trim() || bodyEl.textContent?.trim() || '';
            
            if (message) {
                // Create structured object
                const snippetObj = {
                    sender: currentSender,
                    message: message,
                    timestamp: timestamp
                };
                
                // Serialize to JSON string to fit the string[] interface
                const snippetJson = JSON.stringify(snippetObj);
                
                if (!allSnippets.includes(snippetJson)) {
                    allSnippets.push(snippetJson);
                }
            }
        }
    }
  }
  
  console.log(`[Dotor LinkedIn] Total snippets collected: ${allSnippets.length}`);
  console.log(`[Dotor LinkedIn] Sample snippets:`, allSnippets.slice(0, 3));
  
  return allSnippets;
}

// Log that content script is active (for debugging)
console.log('[Dotor] LinkedIn content script loaded');
