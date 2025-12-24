import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function POST(request: NextRequest) {
  console.log('[LOGIN API] Starting login request');
  
  // Create redirect response first - we'll add cookies to it
  const redirectResponse = NextResponse.redirect(new URL('/ask', request.url));
  
  // Track cookies that get set
  const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookies = request.cookies.getAll();
        console.log('[LOGIN API] Getting cookies:', cookies.map(c => c.name));
        return cookies;
      },
      setAll(cookiesToSetArray: Array<{ name: string; value: string; options?: CookieOptions }>) {
        console.log('[LOGIN API] setAll called with', cookiesToSetArray.length, 'cookies:', cookiesToSetArray.map(c => ({ name: c.name, hasValue: !!c.value, options: c.options })));
        // Store cookies to add to redirect response
        cookiesToSet.push(...cookiesToSetArray);
        console.log('[LOGIN API] Total cookies tracked:', cookiesToSet.length);
        // Also set on request for immediate access
        cookiesToSetArray.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
      },
    },
  });
  
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  console.log('[LOGIN API] Attempting signInWithPassword for:', email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log('[LOGIN API] Sign in error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  console.log('[LOGIN API] Sign in successful. Session:', {
    hasSession: !!data.session,
    userId: data.session?.user?.id,
    expiresAt: data.session?.expires_at,
  });

  // signInWithPassword returns session in the response
  if (!data.session) {
    console.log('[LOGIN API] No session in response data');
    return NextResponse.json(
      { error: 'Failed to create session. Please try again.' },
      { status: 500 }
    );
  }

  const session = data.session;
  
  // Extract project ref from URL for cookie name
  const urlParts = SUPABASE_URL.replace('https://', '').replace('http://', '').split('.');
  const projectRef = urlParts[0];
  
  console.log('[LOGIN API] Project ref:', projectRef);
  console.log('[LOGIN API] Manually setting auth cookies from session');
  
  // Set the Supabase auth token cookie manually
  // Format: sb-<project-ref>-auth-token
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  
  const expiresAt = session.expires_at 
    ? new Date(session.expires_at * 1000)
    : new Date(Date.now() + (session.expires_in || 3600) * 1000);
  
  console.log('[LOGIN API] Setting cookie:', cookieName, 'expires:', expiresAt);
  
  // Supabase SSR browser client needs to read cookies, so we can't use httpOnly
  // But we'll set it as httpOnly for security and let the middleware handle it
  // Actually, let's check what Supabase expects - it might need the cookie to be readable
  redirectResponse.cookies.set(cookieName, cookieValue, {
    httpOnly: false, // Browser client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: session.expires_in || 3600,
  });
  
  console.log('[LOGIN API] Cookie value length:', cookieValue.length);
  
  // Add any cookies that were set via setAll callback (shouldn't happen but just in case)
  console.log('[LOGIN API] Adding cookies from setAll callback:', cookiesToSet.map(c => c.name));
  cookiesToSet.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, {
      ...options,
      httpOnly: options?.httpOnly ?? (name.includes('auth-token') || name.includes('sb-')),
      secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
      sameSite: options?.sameSite ?? 'lax',
      path: options?.path ?? '/',
    });
  });
  
  // Verify cookies were set
  const finalCookies = redirectResponse.cookies.getAll();
  console.log('[LOGIN API] Final cookies in redirect:', finalCookies.map(c => c.name));
  
  console.log('[LOGIN API] Redirecting to /ask');
  return redirectResponse;
}

