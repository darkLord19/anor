'use client';

import { useState, useEffect, useCallback } from 'react';
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

// Lazy load supabase client
const getSupabase = async () => {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
};

export default function AskPage() {
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
      console.log('[ASK PAGE] Document cookies:', document.cookie);
      
      const supabase = await getSupabase();
      
      // First, try to get session and set it explicitly if we have cookies
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      console.log('[ASK PAGE] Initial session check:', {
        hasSession: !!initialSession,
        userId: initialSession?.user?.id,
      });
      
      // Retry getting user a few times - cookies might not be available immediately after redirect
      let user = null;
      for (let i = 0; i < 5; i++) {
        console.log(`[ASK PAGE] Auth check attempt ${i + 1}/5`);
        const { data, error } = await supabase.auth.getUser();
        console.log('[ASK PAGE] getUser result:', {
          hasUser: !!data.user,
          userId: data.user?.id,
          error: error?.message,
        });
        
        if (data.user) {
          user = data.user;
          console.log('[ASK PAGE] User found:', user.id);
          break;
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (!user) {
        console.log('[ASK PAGE] No user found, checking session');
        // Final check - try getting session instead
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[ASK PAGE] getSession result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          error: sessionError?.message,
        });
        
        if (!session) {
          console.log('[ASK PAGE] No session found, checking all cookies');
          // Debug: log all cookies
          const allCookies = document.cookie.split(';').map(c => c.trim());
          console.log('[ASK PAGE] All cookies:', allCookies);
          
          console.log('[ASK PAGE] Redirecting to login');
          router.push('/login');
          return;
        }
        // If we have session but no user, try to get user from session
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          console.log('[ASK PAGE] Session exists but no user, redirecting to login');
          router.push('/login');
          return;
        }
        user = userData.user;
        console.log('[ASK PAGE] User found from session:', user.id);
      }
      
      setUser(user);
      // Check Google connection status
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('[ASK PAGE] Session available, checking Google connection');
        checkGoogleConnection(session.access_token);
      } else {
        console.log('[ASK PAGE] No session for Google check');
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
        const supabase = await getSupabase();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);

    try {
      const supabase = await getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const res = await fetch('http://localhost:3001/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data);

      if (data.requires_extension && data.request_id) {
        pollForResults(data.request_id, session.access_token);
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
    const supabase = await getSupabase();
    await supabase.auth.signOut();
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
          {googleStatus?.email && (
            <div className={styles.googleConnected}>
              <svg className={styles.googleSmallIcon} viewBox="0 0 24 24" width="16" height="16">
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              </svg>
              <span>{googleStatus.email}</span>
            </div>
          )}
          <div className={styles.userMenu}>
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
