import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function POST(request: NextRequest) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        // Clear cookies by setting them with empty values and past expiry
        cookiesToSet.forEach(({ name }) => {
          request.cookies.delete(name);
        });
      },
    },
  });

  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  
  // Clear all Supabase auth cookies
  const urlParts = SUPABASE_URL.replace('https://', '').replace('http://', '').split('.');
  const projectRef = urlParts[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  
  response.cookies.delete(cookieName);
  response.cookies.set(cookieName, '', {
    expires: new Date(0),
    path: '/',
  });

  return response;
}

