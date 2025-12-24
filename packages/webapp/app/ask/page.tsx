'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { AnswerCard } from '@/components/AnswerCard';
import { ConfidenceBar } from '@/components/ConfidenceBar';
import { SourceBadges } from '@/components/SourceBadges';
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

interface AskResponse {
  status: string;
  request_id: string;
  answer?: Answer;
  requires_extension?: boolean;
  sources_needed?: string[];
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  connectedAt?: string;
  needsRefresh?: boolean;
}


function AskPageContent() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const checkExtension = useCallback(async () => {
    try {
      setExtensionConnected(false);
    } catch {
      setExtensionConnected(false);
    }
  }, []);

  const checkGoogleConnection = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch('http://localhost:3001/google/status', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (res.ok) {
        const status = await res.json();
        setGoogleStatus(status);
      }
    } catch (error) {
      console.error('Failed to check Google status:', error);
      setGoogleStatus({ connected: false });
    } finally {
      setCheckingGoogle(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[ASK PAGE] Starting auth check');
      
      // Get session from Next.js API route (reads from cookies)
      try {
        const sessionResponse = await fetch('/api/session');
        
        if (!sessionResponse.ok) {
          console.log('[ASK PAGE] No session found, redirecting to login');
          router.push('/login');
          return;
        }
        
        const sessionData = await sessionResponse.json();
        setUser(sessionData.user);
        
        // Check Google connection status
        checkGoogleConnection(sessionData.accessToken);
      } catch (error) {
        console.error('[ASK PAGE] Auth check error:', error);
        router.push('/login');
      }
    };

    checkAuth();
    checkExtension();
  }, [router, checkExtension, checkGoogleConnection]);

  // Handle OAuth callback params
  useEffect(() => {
    if (searchParams.get('google_connected') === 'true') {
      // Refresh Google status after successful connection
      const refreshStatus = async () => {
        const sessionResponse = await fetch('/api/session');
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          checkGoogleConnection(sessionData.accessToken);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);

    try {
      // Get session from Next.js API route
      const sessionResponse = await fetch('/api/session');
      if (!sessionResponse.ok) {
        router.push('/login');
        return;
      }
      
      const sessionData = await sessionResponse.json();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      const res = await fetch(`${backendUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.accessToken}`,
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data);

      if (data.requires_extension && data.request_id) {
        pollForResults(data.request_id, sessionData.accessToken);
      }
    } catch (error) {
      console.error('Ask error:', error);
      setResponse({
        status: 'error',
        request_id: '',
        answer: {
          answer: 'An error occurred. Please try again.',
          citations: [],
          confidence: 0,
          insufficient: true,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const pollForResults = async (requestId: string, accessToken: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/dom/results/${requestId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const data = await res.json();

        if (data.status === 'complete' || attempts >= maxAttempts) {
          setResponse(prev => ({
            ...prev!,
            status: 'complete',
          }));
          return;
        }

        attempts++;
        setTimeout(poll, 1000);
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
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
            Anor
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
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
          </div>
        </div>
      </main>
    );
  }

  // Show Google connection prompt if not connected
  if (!googleStatus?.connected) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>✦</span>
            Anor
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
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
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          Anor
        </div>
        <div className={styles.headerRight}>
          <ExtensionStatus connected={extensionConnected} />
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

        {response?.requires_extension && response.status !== 'complete' && (
          <div className={styles.extensionNotice}>
            <span className={styles.noticeIcon}>⏳</span>
            Waiting for extension to search {response.sources_needed?.join(', ')}...
          </div>
        )}

        {response?.answer && (
          <div className={styles.results}>
            <ConfidenceBar confidence={response.answer.confidence} />
            <AnswerCard answer={response.answer} />
            {response.answer.citations.length > 0 && (
              <SourceBadges citations={response.answer.citations} />
            )}
          </div>
        )}

        {!response && !loading && (
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
            Anor
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
