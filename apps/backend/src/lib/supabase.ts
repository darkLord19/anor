import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
// Use publishable key for client operations (replaces anon key)
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
// Service role key for admin operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY environment variables');
}

// Client for authenticated user requests (uses JWT from request)
export function createUserClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
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

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : null;

export { supabaseUrl, supabasePublishableKey };
