import { getUser, getAccessToken } from './lib/session.js';
import { signOut } from './lib/auth.js';
import { submitAskResults } from './lib/api.js';

// Message types
interface Message {
  type: string;
  payload?: unknown;
}

interface DOMSearchRequest {
  type: 'DOM_SEARCH';
  payload: {
    request_id: string;
    keywords: string[];
    source: 'linkedin' | 'whatsapp';
  };
}

interface DOMSearchResponse {
  request_id: string;
  snippets: string[];
  source: string;
  error?: string;
}

interface DOMInstructionsRequest {
  type: 'EXECUTE_DOM_INSTRUCTIONS';
  payload: {
    request_id: string;
    instructions: Array<{
      request_id: string;
      source: 'linkedin' | 'whatsapp';
      keywords: string[];
    }>;
  };
}

// Log when background script starts
console.log('[Dotor Background] Background script loaded/started');

// Initialize session on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Dotor Background] onStartup triggered');
  // No need to init session with Supabase anymore
});

// Also initialize when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Dotor Background] onInstalled triggered');
  // No need to init session with Supabase anymore
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Dotor Background] ===== MESSAGE RECEIVED =====');
  console.log('[Dotor Background] Message type:', message.type);
  console.log('[Dotor Background] Sender:', _sender?.tab?.url || _sender?.url || _sender?.id || 'unknown');
  console.log('[Dotor Background] Full message:', JSON.stringify(message, null, 2));
  console.log('[Dotor Background] ===========================');
  
  // Special handling for long-running instructions
  if (message.type === 'EXECUTE_DOM_INSTRUCTIONS') {
    const payload = message.payload as any;
    sendResponse({ status: 'started', request_id: payload?.request_id });
    
    handleMessage(message)
      .then(() => {
        console.log('[Dotor Background] Internal instructions handled successfully');
      })
      .catch((error) => {
        console.error('[Dotor Background] Error handling internal instructions:', error);
      });
    return false;
  }

  handleMessage(message)
    .then((result) => {
      console.log('[Dotor Background] Message handled successfully:', message.type);
      console.log('[Dotor Background] Sending response:', result);
      try {
        sendResponse(result);
      } catch (responseError) {
        console.error('[Dotor Background] Error sending response:', responseError);
      }
    })
    .catch((error) => {
      console.error('[Dotor Background] Error handling message:', message.type, error);
      console.error('[Dotor Background] Error stack:', error instanceof Error ? error.stack : 'No stack');
      try {
        sendResponse({ error: error.message });
      } catch (responseError) {
        console.error('[Dotor Background] Error sending error response:', responseError);
      }
    });
  return true; // Keep channel open for async response
});

// Handle messages from external web pages (webapp)
chrome.runtime.onMessageExternal.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Dotor Background] ===== EXTERNAL MESSAGE RECEIVED =====');
  console.log('[Dotor Background] Message type:', message.type);
  console.log('[Dotor Background] Sender URL:', _sender?.url || 'unknown');
  console.log('[Dotor Background] Full message:', JSON.stringify(message, null, 2));
  console.log('[Dotor Background] ====================================');
  
  // Only handle EXECUTE_DOM_INSTRUCTIONS from external sources
  if (message.type === 'EXECUTE_DOM_INSTRUCTIONS') {
    const payload = message.payload as any;
    // Respond immediately to acknowledge receipt and avoid port timeout
    sendResponse({ status: 'started', request_id: payload?.request_id });

    handleMessage(message)
      .then(() => {
        console.log('[Dotor Background] External message handled successfully:', message.type);
        // Results are already submitted to backend in handleMessage
      })
      .catch((error) => {
        console.error('[Dotor Background] Error handling external message:', message.type, error);
      });
    
    return false; // We already sent the response
  }
  
  // Ignore other message types from external sources
  console.warn('[Dotor Background] Ignoring external message type:', message.type);
  return false;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'PING': {
      console.log('[Dotor Background] Received PING - responding with PONG');
      return { type: 'PONG', timestamp: Date.now() };
    }

    case 'GET_SESSION': {
      const user = await getUser();
      return { user };
    }

    case 'GET_TOKEN': {
      const token = await getAccessToken();
      return { token };
    }

    case 'SIGN_OUT': {
      await signOut();
      return { success: true };
    }

    case 'DOM_SEARCH': {
      const request = message as DOMSearchRequest;
      return handleDOMSearch(request.payload);
    }

    case 'EXECUTE_DOM_INSTRUCTIONS': {
      const request = message as DOMInstructionsRequest;
      console.log('[Dotor Background] Received EXECUTE_DOM_INSTRUCTIONS');
      console.log('[Dotor Background] Payload:', JSON.stringify(request.payload, null, 2));
      
      // Validate payload structure
      if (!request.payload) {
        throw new Error('Missing payload in EXECUTE_DOM_INSTRUCTIONS');
      }
      
      if (!request.payload.instructions || !Array.isArray(request.payload.instructions)) {
        throw new Error('Missing or invalid instructions array in payload');
      }
      
      console.log('[Dotor Background] Processing', request.payload.instructions.length, 'instructions');
      
      try {
        // Execute instructions directly in background script (don't use api.js which sends messages)
        const results = await executeDOMInstructionsDirect(request.payload.instructions);
        console.log('[Dotor Background] All DOM instructions executed successfully');
        
        // Submit results to backend directly from background script for robustness
        console.log('[Dotor Background] Submitting results to backend...');
        for (const result of results) {
          try {
            await submitAskResults(
              request.payload.request_id,
              result.source,
              result.snippets,
              result.error
            );
            console.log(`[Dotor Background] Successfully submitted results for ${result.source}`);
          } catch (submitError) {
            console.error(`[Dotor Background] Failed to submit results for ${result.source}:`, submitError);
          }
        }
        
        return { success: true, results };
      } catch (error) {
        console.error('[Dotor Background] Error executing DOM instructions:', error);
        throw error; // Re-throw to be caught by message handler
      }
    }

    default:
      console.warn('[Dotor Background] Unknown message type:', message.type);
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Wait for a tab to finish loading
async function waitForTabToLoad(tabId: number, maxWait = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let resolved = false;

    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        
        if (tab.status === 'complete' && !resolved) {
          resolved = true;
          console.log(`[Dotor Background] Tab ${tabId} loaded, waiting for content script...`);
          // Give content script more time to inject (document_idle)
          setTimeout(resolve, 2000);
          return;
        }

        if (Date.now() - startTime > maxWait) {
          if (!resolved) {
            resolved = true;
            reject(new Error('Tab load timeout'));
          }
          return;
        }

        // Check again in 500ms
        setTimeout(checkTab, 500);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      }
    };

    // Also listen for tab updates
    const listener = (updatedTabId: number, changeInfo: any) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        console.log(`[Dotor Background] Tab ${tabId} updated to complete, waiting for content script...`);
        // Give content script more time to inject
        setTimeout(resolve, 2000);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
    
    // Start checking
    checkTab();
  });
}

// Handle DOM search by forwarding to appropriate content script
async function handleDOMSearch(payload: DOMSearchRequest['payload']): Promise<DOMSearchResponse> {
  const { request_id, keywords, source } = payload;

  console.log(`[Dotor Background] Starting DOM search for ${source} with keywords:`, keywords);

  // ALWAYS create a new tab for search
  let url = source === 'linkedin' ? 'https://www.linkedin.com/messaging/' : 'https://web.whatsapp.com/';
  
  // Optimization: For LinkedIn, start directly with the first keyword if available
  if (source === 'linkedin' && keywords.length > 0 && keywords[0]) {
      const targetUrl = new URL('https://www.linkedin.com/messaging/');
      targetUrl.searchParams.set('searchTerm', keywords[0]);
      url = targetUrl.toString();
  }

  let tab: chrome.tabs.Tab | undefined;
  
  try {
    tab = await chrome.tabs.create({
      url,
      active: false, // Open in background
    });
    console.log(`[Dotor Background] Created new ${source} tab with ID:`, tab.id);
  } catch (error) {
    console.error(`[Dotor Background] Failed to create ${source} tab:`, error);
    return {
      request_id,
      snippets: [],
      source,
      error: `Failed to open ${source} tab`,
    };
  }

  if (!tab || !tab.id) {
     return { request_id, snippets: [], source, error: 'Tab creation failed' };
  }

  try {
    console.log(`[Dotor Background] Tab ${tab.id} ready for ${source}, URL: ${tab.url}`);

    // Wait for initial load
    await waitForTabToLoad(tab.id);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const allSnippets: string[] = [];
    
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      if (!keyword) continue;
      
      console.log(`[Dotor Background] Processing keyword: "${keyword}"`);
      
      try {
        // 1. Navigate to the search URL
        const targetUrl = new URL('https://www.linkedin.com/messaging/');
        targetUrl.searchParams.set('searchTerm', keyword);
        const targetUrlString = targetUrl.toString();
        
        // Skip navigation if we're already on the correct URL (first keyword optimization)
        if (source === 'linkedin' && i === 0) {
             console.log(`[Dotor Background] Already on search URL for first keyword: "${keyword}"`);
             // No need to navigate or wait, we just did
        } else {
            console.log(`[Dotor Background] Navigating tab ${tab.id} to ${targetUrlString}`);
            await chrome.tabs.update(tab.id!, { url: targetUrlString });
            
            // 2. Wait for tab to load
            await waitForTabToLoad(tab.id!);
        }
        
        // 3. Send scrape command
        console.log(`[Dotor Background] Sending scrape command for keyword: "${keyword}"`);
        
        // Retry logic for sending message
        let response = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            response = await chrome.tabs.sendMessage(tab.id!, {
              type: 'SCRAPE_MESSAGES'
            });
            break; // Success
          } catch (msgError) {
            console.warn(`[Dotor Background] Message attempt ${attempt + 1} failed:`, msgError);
            
            // If content script is missing, inject it
            const errorMsg = String(msgError);
            if (errorMsg.includes('receiving end') || errorMsg.includes('Could not establish connection')) {
               const scriptFile = source === 'linkedin' ? 'content-linkedin.js' : 'content-whatsapp.js';
               await chrome.scripting.executeScript({
                  target: { tabId: tab.id! },
                  files: [scriptFile],
               });
               await new Promise(r => setTimeout(r, 1000));
            } else {
               await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        
        if (response && response.snippets) {
          console.log(`[Dotor Background] Collected ${response.snippets.length} snippets for "${keyword}"`);
          allSnippets.push(...response.snippets);
        } else {
          console.warn(`[Dotor Background] No snippets collected for "${keyword}"`);
        }
        
      } catch (keywordError) {
        console.error(`[Dotor Background] Error processing keyword "${keyword}":`, keywordError);
      }
    }
    
    return {
      request_id,
      snippets: allSnippets,
      source,
    };

  } finally {
    // Close the tab when done
    if (tab && tab.id) {
        try {
            await chrome.tabs.remove(tab.id);
            console.log(`[Dotor Background] Closed ${source} tab ${tab.id}`);
        } catch (e) {
            console.error(`[Dotor Background] Failed to close tab ${tab.id}`, e);
        }
    }
  }
}

// Execute DOM instructions directly (called from background script, not via message)
async function executeDOMInstructionsDirect(
  instructions: Array<{
    request_id: string;
    source: 'linkedin' | 'whatsapp';
    keywords: string[];
  }>
): Promise<Array<{ source: string; snippets: string[]; error?: string | undefined }>> {
  if (instructions.length === 0) {
    return [];
  }

  // Execute all instructions in parallel and collect results
  const results = await Promise.all(
    instructions.map(async (instruction) => {
      try {
        console.log(`[Dotor Background] Executing instruction for ${instruction.source} with keywords:`, instruction.keywords);
        
        // Call handleDOMSearch directly (we're already in the background script)
        const response = await handleDOMSearch({
          request_id: instruction.request_id,
          keywords: instruction.keywords,
          source: instruction.source,
        });

        const snippets = response.snippets ?? [];
        const error = response.error;
        
        console.log(`[Dotor Background] Search completed for ${instruction.source}: ${snippets.length} snippets${error ? `, error: ${error}` : ''}`);
        
        return {
          source: instruction.source,
          snippets,
          error
        };
      } catch (error) {
        console.error(`[Dotor Background] Error executing instruction for ${instruction.source}:`, error);
        
        return {
          source: instruction.source,
          snippets: [],
          error: error instanceof Error ? error.message : 'Execution failed'
        };
      }
    })
  );

  return results;
}

// Expose for direct calls from popup
export { getUser, getAccessToken, signOut };
