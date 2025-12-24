import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET(request: NextRequest) {
  const requestCookies = request.cookies.getAll();
  
  const authCookie = requestCookies.find(c => c.name.includes('auth-token'));
  let parsedSession: any = null;
  
  if (authCookie && authCookie.value?.startsWith('{')) {
    try {
      parsedSession = JSON.parse(authCookie.value);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }
  
  let response = NextResponse.next();
  const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return requestCookies;
      },
      setAll(cookiesToSetArray: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.push(...cookiesToSetArray);
        cookiesToSetArray.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, {
            ...options,
            httpOnly: false,
            secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
            sameSite: options?.sameSite ?? 'lax',
            path: options?.path ?? '/',
          });
        });
      },
    },
  });

  if (parsedSession && parsedSession.access_token && parsedSession.user) {
    const jsonResponse = NextResponse.json({
      accessToken: parsedSession.access_token,
      user: {
        id: parsedSession.user.id,
        email: parsedSession.user.email,
        name: parsedSession.user.user_metadata?.full_name || parsedSession.user.user_metadata?.name || '',
      },
    });

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: parsedSession.access_token,
      refresh_token: parsedSession.refresh_token,
    });
    
    if (!setSessionError) {
      response.cookies.getAll().forEach((cookie) => {
        jsonResponse.cookies.set(cookie.name, cookie.value, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      });

      cookiesToSet.forEach(({ name, value, options }) => {
        jsonResponse.cookies.set(name, value, {
          ...options,
          httpOnly: false,
          secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
          sameSite: options?.sameSite ?? 'lax',
          path: options?.path ?? '/',
        });
      });
      
      return jsonResponse;
    }
    
    return jsonResponse;
  }

  const { data: { session: sessionData } } = await supabase.auth.getSession();
  
  if (sessionData && sessionData.user) {
    const jsonResponse = NextResponse.json({
      accessToken: sessionData.access_token,
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || '',
      },
    });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    });

    cookiesToSet.forEach(({ name, value, options }) => {
      jsonResponse.cookies.set(name, value, {
        ...options,
        httpOnly: false,
        secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
        sameSite: options?.sameSite ?? 'lax',
        path: options?.path ?? '/',
      });
    });

    return jsonResponse;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    if (authCookie) {
      const errorResponse = NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      );
      errorResponse.cookies.delete(authCookie.name);
      errorResponse.cookies.set(authCookie.name, '', {
        expires: new Date(0),
        path: '/',
      });
      return errorResponse;
    }
    return NextResponse.json(
      { error: 'No session found' },
      { status: 401 }
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'No session found' },
      { status: 401 }
    );
  }

  const jsonResponse = NextResponse.json({
    accessToken: session.access_token,
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    },
  });

  response.cookies.getAll().forEach((cookie) => {
    jsonResponse.cookies.set(cookie.name, cookie.value, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  });

  cookiesToSet.forEach(({ name, value, options }) => {
    jsonResponse.cookies.set(name, value, {
      ...options,
      httpOnly: false,
      secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
      sameSite: options?.sameSite ?? 'lax',
      path: options?.path ?? '/',
    });
  });

  return jsonResponse;
}

