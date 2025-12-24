import { initSession, getAccessToken, signOut } from './lib/supabase.js';

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
console.log('[Anor Background] Background script loaded/started');

// Initialize session on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Anor Background] onStartup triggered');
  await initSession();
});

// Also initialize when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Anor Background] onInstalled triggered');
  await initSession();
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Anor Background] ===== MESSAGE RECEIVED =====');
  console.log('[Anor Background] Message type:', message.type);
  console.log('[Anor Background] Sender:', _sender?.tab?.url || _sender?.url || _sender?.id || 'unknown');
  console.log('[Anor Background] Full message:', JSON.stringify(message, null, 2));
  console.log('[Anor Background] ===========================');
  
  handleMessage(message)
    .then((result) => {
      console.log('[Anor Background] Message handled successfully:', message.type);
      console.log('[Anor Background] Sending response:', result);
      try {
        sendResponse(result);
      } catch (responseError) {
        console.error('[Anor Background] Error sending response:', responseError);
      }
    })
    .catch((error) => {
      console.error('[Anor Background] Error handling message:', message.type, error);
      console.error('[Anor Background] Error stack:', error instanceof Error ? error.stack : 'No stack');
      try {
        sendResponse({ error: error.message });
      } catch (responseError) {
        console.error('[Anor Background] Error sending error response:', responseError);
      }
    });
  return true; // Keep channel open for async response
});

// Handle messages from external web pages (webapp)
chrome.runtime.onMessageExternal.addListener((message: Message, _sender, sendResponse) => {
  console.log('[Anor Background] ===== EXTERNAL MESSAGE RECEIVED =====');
  console.log('[Anor Background] Message type:', message.type);
  console.log('[Anor Background] Sender URL:', _sender?.url || 'unknown');
  console.log('[Anor Background] Full message:', JSON.stringify(message, null, 2));
  console.log('[Anor Background] ====================================');
  
  // Only handle EXECUTE_DOM_INSTRUCTIONS from external sources
  if (message.type === 'EXECUTE_DOM_INSTRUCTIONS') {
    handleMessage(message)
      .then((result) => {
        console.log('[Anor Background] External message handled successfully:', message.type);
        console.log('[Anor Background] Sending response:', result);
        try {
          sendResponse(result);
        } catch (responseError) {
          console.error('[Anor Background] Error sending external response:', responseError);
        }
      })
      .catch((error) => {
        console.error('[Anor Background] Error handling external message:', message.type, error);
        console.error('[Anor Background] Error stack:', error instanceof Error ? error.stack : 'No stack');
        try {
          sendResponse({ error: error.message });
        } catch (responseError) {
          console.error('[Anor Background] Error sending external error response:', responseError);
        }
      });
    return true; // Keep channel open for async response
  }
  
  // Ignore other message types from external sources
  console.warn('[Anor Background] Ignoring external message type:', message.type);
  return false;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'PING': {
      console.log('[Anor Background] Received PING - responding with PONG');
      return { type: 'PONG', timestamp: Date.now() };
    }

    case 'GET_SESSION': {
      const user = await initSession();
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
      console.log('[Anor Background] Received EXECUTE_DOM_INSTRUCTIONS');
      console.log('[Anor Background] Payload:', JSON.stringify(request.payload, null, 2));
      
      // Validate payload structure
      if (!request.payload) {
        throw new Error('Missing payload in EXECUTE_DOM_INSTRUCTIONS');
      }
      
      if (!request.payload.instructions || !Array.isArray(request.payload.instructions)) {
        throw new Error('Missing or invalid instructions array in payload');
      }
      
      console.log('[Anor Background] Processing', request.payload.instructions.length, 'instructions');
      
      try {
        // Execute instructions directly in background script (don't use api.js which sends messages)
        await executeDOMInstructionsDirect(request.payload.instructions);
        console.log('[Anor Background] All DOM instructions executed successfully');
        return { success: true };
      } catch (error) {
        console.error('[Anor Background] Error executing DOM instructions:', error);
        throw error; // Re-throw to be caught by message handler
      }
    }

    default:
      console.warn('[Anor Background] Unknown message type:', message.type);
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Get or create a tab for a source
async function getOrCreateTab(source: 'linkedin' | 'whatsapp'): Promise<chrome.tabs.Tab | null> {
  const url = source === 'linkedin'
    ? 'https://www.linkedin.com/messaging/'
    : 'https://web.whatsapp.com/';

  const urlPattern = source === 'linkedin'
    ? 'https://www.linkedin.com/messaging/*'
    : 'https://web.whatsapp.com/*';

  console.log(`[Anor Background] Checking for existing ${source} tab with pattern: ${urlPattern}`);

  // First, check if a tab is already open
  const existingTabs = await chrome.tabs.query({ url: urlPattern });
  if (existingTabs.length > 0) {
    console.log(`[Anor Background] Found existing ${source} tab:`, existingTabs[0]!.id, 'URL:', existingTabs[0]!.url);
    return existingTabs[0]!;
  }

  // No tab found, create one in the background
  console.log(`[Anor Background] No existing ${source} tab found, creating new one at URL: ${url}`);
  try {
    const newTab = await chrome.tabs.create({
      url,
      active: false, // Open in background
    });

    console.log(`[Anor Background] Created ${source} tab with ID:`, newTab.id, 'URL:', newTab.url || url);

    // Wait for the tab to load
    console.log(`[Anor Background] Waiting for ${source} tab to load...`);
    await waitForTabToLoad(newTab.id!);

    console.log(`[Anor Background] ${source} tab loaded successfully`);
    return newTab;
  } catch (error) {
    console.error(`[Anor Background] Failed to create ${source} tab:`, error);
    return null;
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
          console.log(`[Anor Background] Tab ${tabId} loaded, waiting for content script...`);
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
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        console.log(`[Anor Background] Tab ${tabId} updated to complete, waiting for content script...`);
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

  console.log(`[Anor Background] Starting DOM search for ${source} with keywords:`, keywords);

  // Get or create the tab
  const tab = await getOrCreateTab(source);

  if (!tab || !tab.id) {
    console.error(`[Anor Background] Failed to get or create ${source} tab`);
    return {
      request_id,
      snippets: [],
      source,
      error: `Failed to open ${source} tab`,
    };
  }

  console.log(`[Anor Background] Tab ${tab.id} ready for ${source}, URL: ${tab.url}`);

  // Wait longer for content script to inject, especially for newly opened tabs
  // Content scripts run at document_idle, so we need to wait for the page to fully load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if content script is ready by trying to ping it
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'SEARCH_DOM',
        payload: { keywords },
      });
      
      console.log(`[Anor Background] Search successful for ${source}, found ${response.snippets?.length || 0} snippets`);
      
      return {
        request_id,
        snippets: response.snippets ?? [],
        source,
        error: response.error,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Anor Background] Attempt ${attempt + 1} failed for ${source}:`, errorMsg);
      
      // Check if it's a "receiving end does not exist" error (content script not injected)
      if (errorMsg.includes('receiving end') || errorMsg.includes('Could not establish connection')) {
        // Wait longer and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Other errors, try one more time
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Final attempt failed
      console.error(`[Anor Background] All attempts failed for ${source}`);
      return {
        request_id,
        snippets: [],
        source,
        error: `Content script not ready or page not accessible: ${errorMsg}`,
      };
    }
  }

  return {
    request_id,
    snippets: [],
    source,
    error: 'Content script failed to respond after multiple attempts',
  };
}

// Execute DOM instructions directly (called from background script, not via message)
async function executeDOMInstructionsDirect(
  instructions: Array<{
    request_id: string;
    source: 'linkedin' | 'whatsapp';
    keywords: string[];
  }>
): Promise<void> {
  if (instructions.length === 0) {
    return;
  }

  const requestId = instructions[0]!.request_id;

  // Submit results function that doesn't require Supabase client
  // We'll get the token directly from storage to avoid importing Supabase
  async function submitAskResultsDirect(
    requestId: string,
    source: string,
    snippets: string[],
    error?: string
  ): Promise<{ error?: string }> {
    try {
      // Get access token directly from storage (avoid Supabase client)
      const SESSION_KEY = 'anor_session';
      const sessionData = await chrome.storage.local.get(SESSION_KEY);
      const session = sessionData[SESSION_KEY];
      const accessToken = session?.access_token;

      if (!accessToken) {
        return { error: 'Not authenticated' };
      }

      const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
      const response = await fetch(`${API_BASE}/ask/${requestId}/dom-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          source,
          snippets,
          error,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error ?? 'Request failed' };
      }

      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Request failed' };
    }
  }

  // Execute all instructions in parallel
  await Promise.all(
    instructions.map(async (instruction) => {
      try {
        console.log(`[Anor Background] Executing instruction for ${instruction.source} with keywords:`, instruction.keywords);
        
        // Call handleDOMSearch directly (we're already in the background script)
        const response = await handleDOMSearch({
          request_id: instruction.request_id,
          keywords: instruction.keywords,
          source: instruction.source,
        });

        const snippets = response.snippets ?? [];
        const error = response.error;
        
        console.log(`[Anor Background] Search completed for ${instruction.source}: ${snippets.length} snippets${error ? `, error: ${error}` : ''}`);
        
        // Submit results to backend
        const submitResult = await submitAskResultsDirect(
          requestId,
          instruction.source,
          snippets,
          error
        );
        
        if (submitResult.error) {
          console.error(`[Anor Background] Failed to submit results for ${instruction.source}:`, submitResult.error);
        } else {
          console.log(`[Anor Background] Results submitted successfully for ${instruction.source}`);
        }
      } catch (error) {
        console.error(`[Anor Background] Error executing instruction for ${instruction.source}:`, error);
        
        // Submit error to backend
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        await submitAskResultsDirect(
          requestId,
          instruction.source,
          [],
          errorMessage
        );
      }
    })
  );
}

// Expose for direct calls from popup
export { initSession, getAccessToken, signOut };
