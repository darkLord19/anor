/**
 * Web app content script
 * Injects a global variable to indicate the extension is installed
 */

// Check if extension context is valid
// This function must NEVER throw - it must always return a boolean
function isExtensionContextValid(): boolean {
  try {
    // Check if chrome APIs are available
    if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
      return false;
    }
    
    // Try to access chrome.runtime.id - will throw if context is invalidated
    // We need to catch the error here because accessing .id throws when invalidated
    // Use a try-catch around the actual property access
    try {
      const extensionId = chrome.runtime.id;
      return extensionId !== undefined && extensionId !== '';
    } catch {
      // Accessing .id threw - context is invalidated
      return false;
    }
  } catch (error) {
    // Any error means context is invalidated
    return false;
  }
}

// Get extension ID safely
function getExtensionId(): string | null {
  try {
    if (!isExtensionContextValid()) {
      return null;
    }
    return chrome.runtime.id;
  } catch {
    return null;
  }
}

// Send message to background script safely
function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Don't check context here - let chrome.runtime.sendMessage handle it
    // The check might fail due to timing issues
    try {
      // Verify chrome.runtime exists before using it
      if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
        reject(new Error('Chrome runtime not available'));
        return;
      }
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.error('[Dotor Webapp Content] chrome.runtime.lastError:', errorMsg);
          reject(new Error(errorMsg));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('[Dotor Webapp Content] Exception sending message:', error);
      reject(error);
    }
  });
}

// Inject global variable to indicate extension is available
if (typeof window !== 'undefined') {
  console.log('[Dotor Webapp Content] Initializing content script...');
  
  // Initialize extension status safely
  let extensionValid = false;
  try {
    extensionValid = isExtensionContextValid();
    console.log('[Dotor Webapp Content] Extension context valid:', extensionValid);
  } catch (error) {
    console.error('[Dotor Webapp Content] Error checking extension context:', error);
    extensionValid = false;
  }
  
  (window as any).__DOTOR_EXTENSION__ = extensionValid;
  console.log('[Dotor Webapp Content] Set __DOTOR_EXTENSION__ to:', extensionValid);
  
  // Also expose extension ID for direct messaging
  if (extensionValid) {
    const extensionId = getExtensionId();
    if (extensionId) {
      (window as any).__DOTOR_EXTENSION_ID__ = extensionId;
      console.log('[Dotor Webapp Content] Set __DOTOR_EXTENSION_ID__ to:', extensionId);
    }
  }
  
  // Also set up a message listener for ping requests and instructions
  window.addEventListener('message', (event) => {
    // Log ALL messages for debugging to see what's happening
    if (event.data && typeof event.data === 'object') {
      console.log('[Dotor Webapp Content] Received window message:', {
        type: event.data.type,
        origin: event.origin,
        currentOrigin: window.location.origin,
        data: event.data
      });
    }
    
    // Only accept messages from the same origin
    if (event.origin !== window.location.origin) {
      console.log('[Dotor Webapp Content] Ignoring message from different origin:', event.origin);
      return;
    }
    
    if (event.data && event.data.type === 'DOTOR_EXTENSION_PING') {
      // Check if extension context is still valid
      const isValid = isExtensionContextValid();
      if (!isValid) {
        // Extension context invalidated - respond with no extension
        (window as any).__DOTOR_EXTENSION__ = false;
        (window as any).__DOTOR_EXTENSION_ID__ = undefined;
        window.postMessage({
          type: 'DOTOR_EXTENSION_PONG',
          extensionId: null,
        }, window.location.origin);
        return;
      }
      
      // Update extension status and ID
      (window as any).__DOTOR_EXTENSION__ = true;
      const extensionId = getExtensionId();
      if (extensionId) {
        (window as any).__DOTOR_EXTENSION_ID__ = extensionId;
        window.postMessage({
          type: 'DOTOR_EXTENSION_PONG',
          extensionId: extensionId,
        }, window.location.origin);
      } else {
        // Context valid but no ID - shouldn't happen, but handle it
        window.postMessage({
          type: 'DOTOR_EXTENSION_PONG',
          extensionId: null,
        }, window.location.origin);
      }
    } else if (event.data && event.data.type === 'DOTOR_EXECUTE_INSTRUCTIONS') {
      console.log('[Dotor Webapp Content] Received DOTOR_EXECUTE_INSTRUCTIONS:', event.data.payload);
      
      console.log('[Dotor Webapp Content] Processing DOTOR_EXECUTE_INSTRUCTIONS, attempting to forward to background...');
      
      // Check if extension context is valid before attempting to send
      // If invalid, notify webapp immediately so it can use direct messaging
      if (!isExtensionContextValid()) {
        console.warn('[Dotor Webapp Content] Extension context invalidated, cannot forward message');
        (window as any).__DOTOR_EXTENSION__ = false;
        (window as any).__DOTOR_EXTENSION_ID__ = undefined;
        window.postMessage({
          type: 'DOTOR_EXTENSION_CONTEXT_INVALIDATED',
          payload: event.data.payload,
        }, window.location.origin);
        return;
      }
      
      // Update extension ID in case it wasn't set
      const extensionId = getExtensionId();
      if (extensionId) {
        (window as any).__DOTOR_EXTENSION_ID__ = extensionId;
      }
      
      // Helper function to send message (with minimal retry only for transient errors)
      const sendMessageToBackground = (): Promise<void> => {
        if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
          return Promise.reject(new Error('Chrome runtime not available'));
        }
        
        return new Promise((resolve, reject) => {
          const messageToSend = {
            type: 'EXECUTE_DOM_INSTRUCTIONS',
            payload: event.data.payload,
          };
          
          console.log('[Dotor Webapp Content] Sending message to background...');
          console.log('[Dotor Webapp Content] Message structure:', JSON.stringify(messageToSend, null, 2));
          
          try {
            chrome.runtime.sendMessage(messageToSend, (response) => {
              if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
                console.error('[Dotor Webapp Content] chrome.runtime.lastError:', errorMsg);
                
                // Check if it's a context invalidated error - don't retry these
                const isContextError = 
                  errorMsg.includes('Extension context invalidated') || 
                  errorMsg.includes('receiving end') ||
                  errorMsg.includes('Could not establish connection') ||
                  errorMsg.includes('message port closed');
                
                if (isContextError) {
                  // Context invalidated - update state and fail immediately
                  (window as any).__DOTOR_EXTENSION__ = false;
                  (window as any).__DOTOR_EXTENSION_ID__ = undefined;
                  reject(new Error(errorMsg));
                } else {
                  // Other error - might be transient, but fail anyway since webapp can retry with direct messaging
                  reject(new Error(errorMsg));
                }
              } else {
                console.log('[Dotor Webapp Content] ✅ Instructions forwarded successfully!');
                console.log('[Dotor Webapp Content] Response from background:', response);
                
                // If response contains results, forward them to the webapp
                if (response && response.results) {
                  console.log('[Dotor Webapp Content] Forwarding results to webapp:', response.results);
                  window.postMessage({
                    type: 'DOTOR_EXTENSION_RESULTS',
                    payload: {
                      request_id: event.data.payload.request_id,
                      results: response.results
                    }
                  }, window.location.origin);
                }
                
                resolve();
              }
            });
          } catch (syncError) {
            // Synchronous error when calling sendMessage - context is definitely invalidated
            const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
            console.error('[Dotor Webapp Content] Synchronous error sending message:', errorMsg);
            
            // Update state and fail immediately
            (window as any).__DOTOR_EXTENSION__ = false;
            (window as any).__DOTOR_EXTENSION_ID__ = undefined;
            reject(new Error(errorMsg));
          }
        });
      };
      
      // Attempt to send message
      sendMessageToBackground()
        .catch((error) => {
          console.error('[Dotor Webapp Content] Failed to send instructions:', error);
          
          // Notify webapp that extension context is invalidated
          // The webapp should then try direct messaging if it has the extension ID
          window.postMessage({
            type: 'DOTOR_EXTENSION_CONTEXT_INVALIDATED',
            payload: event.data.payload,
          }, window.location.origin);
        });
    }
  });
  
      // Periodically check if extension context is still valid
      // This helps detect when extension is reloaded
      setInterval(() => {
        try {
          const wasValid = (window as any).__DOTOR_EXTENSION__ === true;
          let isValid = false;
          
          try {
            isValid = isExtensionContextValid();
          } catch {
            isValid = false;
          }
          
          if (wasValid && !isValid) {
            // Extension was reloaded/disabled
            (window as any).__DOTOR_EXTENSION__ = false;
            (window as any).__DOTOR_EXTENSION_ID__ = undefined;
            console.log('[Dotor Webapp Content] Extension context invalidated - extension may have been reloaded');
            // Don't send invalidated message from periodic check - only send when actively trying to use extension
          } else if (!wasValid && isValid) {
            // Extension was re-enabled/reloaded
            (window as any).__DOTOR_EXTENSION__ = true;
            const extensionId = getExtensionId();
            if (extensionId) {
              (window as any).__DOTOR_EXTENSION_ID__ = extensionId;
            }
            console.log('[Dotor] Extension context restored');
          } else if (isValid) {
            // Extension is still valid, make sure ID is set
            const extensionId = getExtensionId();
            if (extensionId && (window as any).__DOTOR_EXTENSION_ID__ !== extensionId) {
              (window as any).__DOTOR_EXTENSION_ID__ = extensionId;
            }
          }
        } catch (error) {
          // Silently handle errors in the interval check
          (window as any).__DOTOR_EXTENSION__ = false;
        }
      }, 5000); // Check every 5 seconds (less frequent to avoid spam)
  
  // Log that content script is active (for debugging)
  try {
    const isValid = isExtensionContextValid();
    console.log('[Dotor Webapp Content] Content script loaded', isValid ? '(extension active)' : '(extension inactive)');
    console.log('[Dotor Webapp Content] Current URL:', window.location.href);
    console.log('[Dotor Webapp Content] Extension flag:', (window as any).__DOTOR_EXTENSION__);
  } catch (error) {
    console.log('[Dotor Webapp Content] Content script loaded (extension inactive)', error);
  }
  
  // Also log when messages are received (for debugging)
  console.log('[Dotor Webapp Content] Message listener set up, waiting for messages...');
}

