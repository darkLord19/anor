import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // During build, env vars may not be available
  if (!url || !key) {
    if (typeof window === 'undefined') {
      throw new Error('Supabase client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    // In browser but no env vars - something is wrong
    console.error('Missing Supabase environment variables');
  }
  
  // Don't cache - always create fresh to ensure latest auth state
  return createBrowserClient(url ?? '', key ?? '');
}
