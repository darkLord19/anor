'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBackendUrl } from '@/lib/config';
import styles from './page.module.css';
import { AnswerCard } from '@/components/AnswerCard';
import { ConfidenceBar } from '@/components/ConfidenceBar';
import { ExtensionStatus } from '@/components/ExtensionStatus';
import { ConnectGoogle } from '@/components/ConnectGoogle';

interface Answer {
  answer: string;
  citations: Array<{
    source: string;
    content: string;
    id: string;
  }>;
  confidence: number;
  insufficient: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  answer?: Answer;
  status?: 'pending' | 'processing' | 'complete' | 'failed';
  requestId?: string;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  connectedAt?: string;
  needsRefresh?: boolean;
}

interface FeatureFlags {
  enableLinkedIn: boolean;
  enableWhatsApp: boolean;
  enableAsyncMode: boolean;
}


function AskPageContent() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    enableLinkedIn: false,
    enableWhatsApp: false,
    enableAsyncMode: false,
  });
  const hasCheckedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 150);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setQuery('');
    setLoading(false);
  };

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    if (!checkingGoogle) return;
    
    const timeout = setTimeout(() => {
      console.warn('[ASK PAGE] Safety timeout triggered - forcing loading state to false');
      setCheckingGoogle(false);
      // Don't set default status here - let the check complete or show error
      // Only set to false if we're absolutely sure (check failed)
    }, 12000); // 12 second max loading time (should be less than individual timeouts)

    return () => clearTimeout(timeout);
  }, [checkingGoogle, googleStatus]);

  const checkExtension = useCallback(async () => {
    try {
      // Check if extension is available by looking for the global variable
      // or by sending a ping message
      const isConnected = 
        typeof window !== 'undefined' && 
        (window as any).__DOTOR_EXTENSION__ === true;
      
      if (isConnected) {
        setExtensionConnected(true);
        return;
      }
      
      // Also try message-based check as fallback
      const pingPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 1000);
        
        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'DOTOR_EXTENSION_PONG') {
            clearTimeout(timeout);
            window.removeEventListener('message', messageHandler);
            // Store extension ID if provided
            if (event.data.extensionId) {
              (window as any).__DOTOR_EXTENSION_ID__ = event.data.extensionId;
              console.log('[ASK PAGE] Stored extension ID from ping:', event.data.extensionId);
            }
            resolve(event.data.extensionId !== null);
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Send ping
        window.postMessage({ type: 'DOTOR_EXTENSION_PING' }, window.location.origin);
      });
      
      const connected = await pingPromise;
      setExtensionConnected(connected);
    } catch {
      setExtensionConnected(false);
    }
  }, []);

  // Listen for extension context invalidated messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleContextInvalidated = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DOTOR_EXTENSION_CONTEXT_INVALIDATED') {
        console.log('[ASK PAGE] Extension context invalidated - attempting direct messaging fallback');
        
        // Try direct messaging if we have the extension ID and payload
        const extensionId = (window as any).__DOTOR_EXTENSION_ID__;
        const payload = event.data.payload;
        
        if (extensionId && payload && typeof chrome !== 'undefined' && chrome.runtime) {
          console.log('[ASK PAGE] Attempting direct messaging with extension ID:', extensionId);
          try {
            chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'EXECUTE_DOM_INSTRUCTIONS',
                payload: payload,
              },
              (_response) => {
                if (chrome.runtime?.lastError) {
                  console.warn('[ASK PAGE] Direct messaging also failed:', chrome.runtime.lastError.message);
                  setExtensionConnected(false);
                  // Re-check extension connection after a short delay
                  setTimeout(() => {
                    checkExtension();
                  }, 1000);
                } else {
                  console.log('[ASK PAGE] Direct messaging succeeded!');
                  setExtensionConnected(true);
                }
              }
            );
          } catch (error) {
            console.error('[ASK PAGE] Direct messaging error:', error);
            setExtensionConnected(false);
            setTimeout(() => {
              checkExtension();
            }, 1000);
          }
        } else {
          console.log('[ASK PAGE] No extension ID available for direct messaging');
          setExtensionConnected(false);
          // Re-check extension connection after a short delay
          setTimeout(() => {
            checkExtension();
          }, 1000);
        }
      }
    };

    window.addEventListener('message', handleContextInvalidated);
    return () => {
      window.removeEventListener('message', handleContextInvalidated);
    };
  }, [checkExtension]);

  // Listen for extension results
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleExtensionResults = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'DOTOR_EXTENSION_RESULTS') {
        console.log('[ASK PAGE] Received results from extension:', event.data.payload);
        
        const { request_id, results } = event.data.payload;
        
        if (!request_id || !results) {
          console.error('[ASK PAGE] Invalid results payload:', event.data.payload);
          return;
        }
        
        try {
          // Get session
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.error('[ASK PAGE] Failed to get session for submitting results');
            return;
          }
          
          const backendUrl = getBackendUrl();
          
          // Submit each result to the backend
          for (const result of results) {
            console.log(`[ASK PAGE] Submitting results for ${result.source}...`);
            
            const res = await fetch(`${backendUrl}/ask/${request_id}/dom-results`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                source: result.source,
                snippets: result.snippets,
                error: result.error,
              }),
            });
            
            if (!res.ok) {
              console.error(`[ASK PAGE] Failed to submit results for ${result.source}:`, res.status);
            } else {
              console.log(`[ASK PAGE] Successfully submitted results for ${result.source}`);
            }
          }
          
        } catch (error) {
          console.error('[ASK PAGE] Error submitting extension results:', error);
        }
      }
    };

    window.addEventListener('message', handleExtensionResults);
    return () => {
      window.removeEventListener('message', handleExtensionResults);
    };
  }, []);

  // Listen for extension results (via window.postMessage)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleExtensionResults = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DOTOR_EXTENSION_RESULTS') {
        console.log('[ASK PAGE] Received results from extension via postMessage:', event.data.payload);
        
        const { request_id, results } = event.data.payload;
        
        if (request_id && results) {
          submitExtensionResults(request_id, results);
        }
      }
    };

    window.addEventListener('message', handleExtensionResults);
    return () => {
      window.removeEventListener('message', handleExtensionResults);
    };
  }, []);

  const checkGoogleConnection = useCallback(async (accessToken: string) => {
    try {
      const backendUrl = getBackendUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[ASK PAGE] Google status check timeout - aborting');
        controller.abort();
      }, 8000); // 8 second timeout
      
      console.log('[ASK PAGE] Checking Google connection status...');
      
      // Fetch Google status and feature flags in parallel
      const [googleRes, flagsRes] = await Promise.all([
        fetch(`${backendUrl}/google/status`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        }),
        fetch(`${backendUrl}/account/feature-flags`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        }).catch(() => null), // Feature flags are optional
      ]);
      
      clearTimeout(timeoutId);
      
      // Process feature flags
      if (flagsRes && flagsRes.ok) {
        try {
          const flagsData = await flagsRes.json();
          if (flagsData && flagsData.flags) {
            setFeatureFlags(flagsData.flags);
            console.log('[ASK PAGE] Feature flags loaded:', flagsData.flags);
          }
        } catch (e) {
          console.warn('[ASK PAGE] Failed to parse feature flags:', e);
        }
      }
      
      if (googleRes.ok) {
        try {
          const status = await googleRes.json();
          console.log('[ASK PAGE] Google status received:', JSON.stringify(status));
          
          // Ensure status has at least connected property
          if (status && typeof status === 'object') {
            setGoogleStatus(status);
            console.log('[ASK PAGE] Google status state updated');
          } else {
            console.warn('[ASK PAGE] Invalid status format, defaulting to not connected');
            setGoogleStatus({ connected: false });
          }
        } catch (jsonError) {
          console.error('[ASK PAGE] Failed to parse Google status response:', jsonError);
          setGoogleStatus({ connected: false });
        }
      } else {
        const errorText = await googleRes.text().catch(() => 'Unknown error');
        console.error('[ASK PAGE] Google status check failed:', googleRes.status, googleRes.statusText, errorText);
        setGoogleStatus({ connected: false });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[ASK PAGE] Google status check timed out after 8 seconds');
      } else if (error instanceof Error && error.message.includes('fetch')) {
        console.error('[ASK PAGE] Network error checking Google status:', error.message);
      } else {
        console.error('[ASK PAGE] Failed to check Google status:', error);
      }
      setGoogleStatus({ connected: false });
    } finally {
      console.log('[ASK PAGE] Setting checkingGoogle to false');
      setCheckingGoogle((prev) => {
        if (prev) {
          console.log('[ASK PAGE] Actually updating checkingGoogle from', prev, 'to false');
        }
        return false;
      });
    }
  }, []);

  useEffect(() => {
    if (hasCheckedRef.current) {
      console.log('[ASK PAGE] Auth check already completed, skipping');
      return;
    }
    
    let isMounted = true;
    hasCheckedRef.current = true;
    
    const checkAuth = async () => {
      console.log('[ASK PAGE] Starting auth check');
      
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.log('[ASK PAGE] No session found, redirecting to login');
          if (isMounted) {
            setCheckingGoogle(false);
            setGoogleStatus({ connected: false });
            router.push('/login');
          }
          return;
        }
        
        if (!isMounted) return;
        
        setUser(session.user);
        
        // Check Google connection status
        if (isMounted) {
          await checkGoogleConnection(session.access_token);
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('[ASK PAGE] Auth check error:', error);
        
        setCheckingGoogle(false);
        setGoogleStatus({ connected: false });
        setInitError('Failed to initialize. Please refresh the page.');
        // Don't redirect on error, let user see the error state
      }
    };

    checkAuth().catch((error) => {
      console.error('[ASK PAGE] Unhandled error in checkAuth:', error);
      if (isMounted) {
        setCheckingGoogle(false);
        setGoogleStatus({ connected: false });
        setInitError('Failed to initialize. Please refresh the page.');
      }
    });
    
    // Check extension connection
    checkExtension();
    
    // Periodically re-check extension connection (in case it's installed after page load)
    const extensionCheckInterval = setInterval(() => {
      if (isMounted) {
        checkExtension();
      }
    }, 3000); // Check every 3 seconds
    
    return () => {
      isMounted = false;
      clearInterval(extensionCheckInterval);
    };
  }, [router, checkExtension, checkGoogleConnection]);

  // Handle OAuth callback params
  useEffect(() => {
    if (searchParams.get('google_connected') === 'true') {
      // Refresh Google status after successful connection
      const refreshStatus = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          checkGoogleConnection(session.access_token);
        }
      };
      refreshStatus();
      // Clean up URL
      router.replace('/ask');
    }
    if (searchParams.get('google_error') === 'true') {
      // Show error message
      console.error('Google connection failed');
      router.replace('/ask');
    }
  }, [searchParams, router, checkGoogleConnection]);

  const submitExtensionResults = async (requestId: string, results: any[]) => {
    console.log('[ASK PAGE] submitExtensionResults called with:', { requestId, resultsCount: results?.length });
    try {
      // Get session
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('[ASK PAGE] Failed to get session for submitting results');
        return;
      }
      
      const backendUrl = getBackendUrl();
      
      // Submit each result to the backend
      for (const result of results) {
        console.log(`[ASK PAGE] Submitting results for ${result.source}...`);
        
        const res = await fetch(`${backendUrl}/ask/${requestId}/dom-results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            source: result.source,
            snippets: result.snippets,
            error: result.error,
          }),
        });
        
        if (!res.ok) {
          console.error(`[ASK PAGE] Failed to submit results for ${result.source}:`, res.status);
        } else {
          console.log(`[ASK PAGE] Successfully submitted results for ${result.source}`);
        }
      }
    } catch (error) {
      console.error('[ASK PAGE] Error submitting extension results:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const currentQuery = query;
    setQuery('');
    setLoading(true);

    // Add user message
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    
    setMessages(prev => [
      ...prev, 
      { id: userMsgId, role: 'user', content: currentQuery },
      { id: assistantMsgId, role: 'assistant', status: 'pending' }
    ]);

    try {
      // Get session from Next.js API route
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      const backendUrl = getBackendUrl();

      const res = await fetch(`${backendUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          query: currentQuery,
          conversationId 
        }),
      });

      const data = await res.json();
      
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Update assistant message with initial response
      setMessages(prev => prev.map(msg => {
        if (msg.id === assistantMsgId) {
          return {
            ...msg,
            requestId: data.request_id,
            status: data.status === 'complete' ? 'complete' : 'processing',
            answer: data.answer
          };
        }
        return msg;
      }));

      if (data.requires_extension && data.request_id && data.instructions) {
        console.log('[ASK PAGE] Extension required, instructions:', data.instructions);
        
        // Send instructions to extension if connected
        if (extensionConnected && typeof window !== 'undefined') {
          console.log('[ASK PAGE] Extension connected, sending instructions...');
          
          // Set up listener for extension context invalidated
          const contextInvalidatedHandler = (event: MessageEvent) => {
            if (event.data && event.data.type === 'DOTOR_EXTENSION_CONTEXT_INVALIDATED') {
              window.removeEventListener('message', contextInvalidatedHandler);
              console.warn('[ASK PAGE] Extension context invalidated - extension may need to be reloaded');
              setExtensionConnected(false);
              // Still poll for results in case extension reconnects
            }
          };
          window.addEventListener('message', contextInvalidatedHandler);
          
          try {
            // Try to send message to extension - use direct messaging first, then fallback to window.postMessage
            const message = {
              type: 'EXECUTE_DOM_INSTRUCTIONS',
              payload: {
                request_id: data.request_id,
                instructions: data.instructions,
              },
            };
            
            // Try direct messaging via chrome.runtime.sendMessage (requires externally_connectable)
            // Check for extension ID from window object (set by content script)
            let extensionId = (window as any).__DOTOR_EXTENSION_ID__;
            
            // If no extension ID, try to get it by checking if extension is available
            if (!extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
              // Can't get extension ID directly from web page, but we can try to detect it
              // by attempting to send a message without ID (won't work, but we'll fallback)
              console.log('[ASK PAGE] Extension ID not available, will use window.postMessage');
            }
            
            if (extensionId && typeof chrome !== 'undefined' && chrome.runtime) {
              console.log('[ASK PAGE] Attempting direct messaging to extension:', extensionId);
              try {
                chrome.runtime.sendMessage(
                  extensionId,
                  message,
                  (response) => {
                    // Check for lastError safely
                    const lastError = chrome.runtime?.lastError;
                    if (lastError) {
                      const errorMsg = lastError.message || 'Unknown error';
                      console.warn('[ASK PAGE] Direct messaging failed, falling back to window.postMessage:', errorMsg);
                      // Fallback to window.postMessage
                      window.postMessage({
                        type: 'DOTOR_EXECUTE_INSTRUCTIONS',
                        payload: message.payload,
                      }, window.location.origin);
                    } else {
                      console.log('[ASK PAGE] Direct message sent successfully, response:', response);
                      if (response && response.results) {
                        submitExtensionResults(data.request_id, response.results);
                      }
                    }
                  }
                );
              } catch (directError) {
                console.warn('[ASK PAGE] Direct messaging error, falling back to window.postMessage:', directError);
                // Fallback to window.postMessage
                window.postMessage({
                  type: 'DOTOR_EXECUTE_INSTRUCTIONS',
                  payload: message.payload,
                }, window.location.origin);
              }
            } else {
              // No extension ID available or chrome.runtime not available, use window.postMessage
              console.log('[ASK PAGE] Using window.postMessage (direct messaging not available)');
              window.postMessage({
                type: 'DOTOR_EXECUTE_INSTRUCTIONS',
                payload: message.payload,
              }, window.location.origin);
            }
            console.log('[ASK PAGE] Message sent successfully');
          } catch (error) {
            console.error('[ASK PAGE] Failed to send instructions to extension:', error);
          }
        } else {
          console.warn('[ASK PAGE] Extension not connected, cannot send instructions. extensionConnected:', extensionConnected);
        }
        
        // Poll for results
        pollForResults(data.request_id, session.access_token);
      }
    } catch (error) {
      console.error('Ask error:', error);
      setMessages(prev => prev.map(msg => {
        if (msg.id === assistantMsgId) {
          return {
            ...msg,
            status: 'failed',
            answer: {
              answer: 'An error occurred. Please try again.',
              citations: [],
              confidence: 0,
              insufficient: true,
            }
          };
        }
        return msg;
      }));
    } finally {
      setLoading(false);
    }
  };

  const pollForResults = async (requestId: string, accessToken: string) => {
    const maxAttempts = 60; // Increased timeout for extension searches
    let attempts = 0;
    const backendUrl = getBackendUrl();

    const poll = async () => {
      try {
        // Poll the ask endpoint for results
        const res = await fetch(`${backendUrl}/ask/${requestId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Poll failed: ${res.status}`);
        }

        const statusData = await res.json();

        // If complete, fetch the full answer
        if (statusData.status === 'complete') {
          if (statusData.answer) {
            setMessages(prev => prev.map(msg => {
              if (msg.requestId === requestId) {
                return {
                  ...msg,
                  status: 'complete',
                  answer: statusData.answer
                };
              }
              return msg;
            }));
            return;
          }
          
          // Fallback: just mark as complete
          setMessages(prev => prev.map(msg => {
            if (msg.requestId === requestId) {
              return {
                ...msg,
                status: 'complete'
              };
            }
            return msg;
          }));
          return;
        }

        // Continue polling if not complete
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          // Timeout - show error
          setMessages(prev => prev.map(msg => {
            if (msg.requestId === requestId) {
              return {
                ...msg,
                status: 'failed',
                answer: {
                  answer: 'Search timed out. The extension is opening the required tabs automatically - this may take a moment. Please try again in a few seconds.',
                  citations: [],
                  confidence: 0,
                  insufficient: true,
                }
              };
            }
            return msg;
          }));
        }
      } catch (error) {
        console.error('Poll error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setMessages(prev => prev.map(msg => {
            if (msg.requestId === requestId) {
              return {
                ...msg,
                status: 'failed',
                answer: {
                  answer: 'Failed to get results. Please try again.',
                  citations: [],
                  confidence: 0,
                  insufficient: true,
                }
              };
            }
            return msg;
          }));
        }
      }
    };

    poll();
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/signout', { method: 'POST' });
    } catch (error) {
      console.error('Sign out error:', error);
    }
    router.push('/login');
  };

  // Show loading state while checking Google connection
  if (checkingGoogle) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>✦</span>
            Dotor
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
              <button 
                onClick={() => router.push('/settings')} 
                className={styles.settingsButton}
                title="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                </svg>
              </button>
              <span className={styles.userEmail}>{user?.email}</span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                Sign out
              </button>
            </div>
          </div>
        </header>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <span className={styles.spinner} />
            <p>Loading...</p>
            {initError && (
              <p style={{ marginTop: '1rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                {initError}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Show Google connection prompt only if we've checked and confirmed it's not connected
  // Don't show if we're still checking or if status is null (might still be loading)
  if (checkingGoogle === false && googleStatus && !googleStatus.connected) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>✦</span>
            Dotor
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
              <button 
                onClick={() => router.push('/settings')} 
                className={styles.settingsButton}
                title="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                </svg>
              </button>
              <span className={styles.userEmail}>{user?.email}</span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                Sign out
              </button>
            </div>
          </div>
        </header>
        <ConnectGoogle />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>✦</span>
            Dotor
          </div>
          {messages.length > 0 && (
            <button onClick={handleNewChat} className={styles.newChatButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Chat
            </button>
          )}
        </div>
        <div className={styles.headerRight}>
          {featureFlags.enableAsyncMode && (
            <ExtensionStatus connected={extensionConnected} />
          )}
          <div className={styles.userMenu}>
            <button 
              onClick={() => router.push('/settings')} 
              className={styles.settingsButton}
              title="Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
              </svg>
            </button>
            <span className={styles.userEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        {messages.length === 0 && !loading && (
          <div className={styles.hints}>
            <h3>Try asking:</h3>
            <div className={styles.hintList}>
              <button 
                className={styles.hint} 
                onClick={() => setQuery("What meetings do I have this week?")}
              >
                What meetings do I have this week?
              </button>
              <button 
                className={styles.hint}
                onClick={() => setQuery("Find emails from my manager about the project deadline")}
              >
                Find emails from my manager about the project deadline
              </button>
              <button 
                className={styles.hint}
                onClick={() => setQuery("What did John message me about on LinkedIn?")}
              >
                What did John message me about on LinkedIn?
              </button>
            </div>
          </div>
        )}

        <div className={styles.messages}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
              {msg.role === 'user' ? (
                <div className={styles.userMessage}>{msg.content}</div>
              ) : (
                <div className={styles.assistantMessage}>
                  {msg.status === 'pending' || msg.status === 'processing' ? (
                    <div className={styles.messageLoading}>
                      <span className={styles.spinner} />
                      <p>
                        {msg.status === 'processing' ? 'Searching sources...' : 'Thinking...'}
                      </p>
                    </div>
                  ) : msg.answer ? (
                    <>
                      <ConfidenceBar confidence={msg.answer.confidence} />
                      <AnswerCard answer={msg.answer} />
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your emails, calendar, or messages..."
              className={styles.input}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={styles.submitButton}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>✦</span>
            Dotor
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
              <button 
                onClick={() => window.location.href = '/settings'} 
                className={styles.settingsButton}
                title="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                </svg>
              </button>
            </div>
          </div>
        </header>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <span className={styles.spinner} />
            <p>Loading...</p>
          </div>
        </div>
      </main>
    }>
      <AskPageContent />
    </Suspense>
  );
}
