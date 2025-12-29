import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function POST(request: NextRequest) {
  let redirectResponse: NextResponse | null = null;
  
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSetArray: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSetArray.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        
        const redirectUrl = new URL('/ask', request.url);
        redirectResponse = NextResponse.redirect(redirectUrl, { status: 303 });
        
        cookiesToSetArray.forEach(({ name, value, options }) => {
          const cookieOptions: CookieOptions = {
            ...options,
            httpOnly: options?.httpOnly ?? false,
            secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
            sameSite: options?.sameSite ?? 'lax',
            path: options?.path ?? '/',
          };
          
          if (options?.maxAge !== undefined) {
            cookieOptions.maxAge = options.maxAge;
          }
          if (options?.expires !== undefined) {
            cookieOptions.expires = options.expires;
          }
          
          redirectResponse!.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });
  
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  if (!data.session) {
    return NextResponse.json(
      { error: 'Failed to create session. Please try again.' },
      { status: 500 }
    );
  }

  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (setSessionError && !redirectResponse) {
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }

  if (redirectResponse) {
    return redirectResponse;
  }

  redirectResponse = NextResponse.redirect(new URL('/ask', request.url), { status: 303 });
  
  const urlParts = SUPABASE_URL.replace('https://', '').replace('http://', '').split('.');
  const projectRef = urlParts[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  
  const cookieValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });
  
  const expiresAt = data.session.expires_at 
    ? new Date(data.session.expires_at * 1000)
    : new Date(Date.now() + (data.session.expires_in || 3600) * 1000);
  
  redirectResponse.cookies.set(authCookieName, cookieValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: data.session.expires_in || 3600,
  });
  
  return redirectResponse;
}

