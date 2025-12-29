import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.js';
import { getEnv } from '../env/index.js';

let adminClientCache: SupabaseClient<Database> | null = null;

/**
 * Get admin Supabase client for privileged operations
 * Uses service role key and bypasses RLS
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (adminClientCache) {
    return adminClientCache;
  }

  const env = getEnv();
  adminClientCache = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  return adminClientCache;
}

/**
 * Create user-scoped Supabase client for request-specific operations
 * Respects RLS policies
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const env = getEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create public Supabase client for auth operations
 * Used for login, signup, etc.
 */
export function createAuthClient(): SupabaseClient<Database> {
  const env = getEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
