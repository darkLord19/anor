// Storage key for session
const SESSION_KEY = 'dotor_session';

export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
}

// Session storage helpers
export async function saveSession(session: Session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function loadSession(): Promise<Session | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as Session) ?? null;
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

// Get current access token for API calls
export async function getAccessToken(): Promise<string | null> {
  const session = await loadSession();
  return session?.access_token ?? null;
}

export async function getUser(): Promise<User | null> {
  const session = await loadSession();
  return session?.user ?? null;
}
