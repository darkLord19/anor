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

// Initialize session on startup
chrome.runtime.onStartup.addListener(async () => {
  await initSession();
});

// Also initialize when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
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
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
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

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Handle DOM search by forwarding to appropriate content script
async function handleDOMSearch(payload: DOMSearchRequest['payload']): Promise<DOMSearchResponse> {
  const { request_id, keywords, source } = payload;

  // Find tabs for the target source
  const urlPattern = source === 'linkedin'
    ? 'https://www.linkedin.com/messaging/*'
    : 'https://web.whatsapp.com/*';

  const tabs = await chrome.tabs.query({ url: urlPattern });

  if (tabs.length === 0) {
    return {
      request_id,
      snippets: [],
      source,
      error: `No ${source} tab found`,
    };
  }

  // Send search request to content script
  const tab = tabs[0]!;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id!, {
      type: 'SEARCH_DOM',
      payload: { keywords },
    });

    return {
      request_id,
      snippets: response.snippets ?? [],
      source,
    };
  } catch (error) {
    return {
      request_id,
      snippets: [],
      source,
      error: error instanceof Error ? error.message : 'DOM search failed',
    };
  }
}

// Expose for direct calls from popup
export { initSession, getAccessToken, signOut };
