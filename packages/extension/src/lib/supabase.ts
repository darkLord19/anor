import { createClient, type User } from '@supabase/supabase-js';

// Environment variables injected at build time via Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables');
}

// Storage key for session
const SESSION_KEY = 'anor_session';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // We handle persistence via chrome.storage
    detectSessionInUrl: false,
  },
});

// Session storage helpers
export async function saveSession(session: { access_token: string; refresh_token: string }) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function loadSession(): Promise<{ access_token: string; refresh_token: string } | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return result[SESSION_KEY] ?? null;
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

// Get current access token for API calls
export async function getAccessToken(): Promise<string | null> {
  const session = await loadSession();
  return session?.access_token ?? null;
}

// Initialize session from storage
export async function initSession(): Promise<User | null> {
  const session = await loadSession();
  if (!session) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    console.error('Failed to restore session:', error);
    await clearSession();
    return null;
  }

  // Update stored session if tokens were refreshed
  if (data.session) {
    await saveSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return data.user;
}

// PKCE auth flow for Chrome extension
export async function signInWithOAuth() {
  const redirectUrl = chrome.identity.getRedirectURL();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Failed to get OAuth URL');
  }

  // Use Chrome identity API for the OAuth flow
  return new Promise<User>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: data.url,
        interactive: true,
      },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Auth failed'));
          return;
        }

        // Extract tokens from response URL
        const url = new URL(responseUrl);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
          reject(new Error('No access token in response'));
          return;
        }

        // Set session in Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });

        if (sessionError || !sessionData.user) {
          reject(new Error(sessionError?.message ?? 'Failed to set session'));
          return;
        }

        // Save session to storage
        await saveSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? '',
        });

        resolve(sessionData.user);
      }
    );
  });
}

// Sign in with email and password
export async function signInWithPassword(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? 'Failed to sign in');
  }

  // Save session to storage
  await saveSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return data.user;
}

// Sign up with email and password
export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  // If session is created immediately, save it
  if (data.session) {
    await saveSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return { user: data.user, error: null };
}

// Sign in with magic link (OTP)
export async function signInWithMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: chrome.identity.getRedirectURL(),
    },
  });

  return { error: error?.message ?? null };
}

// Sign out
export async function signOut() {
  await supabase.auth.signOut();
  await clearSession();
}
