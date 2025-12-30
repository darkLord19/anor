import { createAuthClient } from '../lib/supabase/index.js';
import { AuthError } from '../lib/errors/index.js';
import type { Logger } from '@dotor/logger';
import type { LoginResult, SignupResult } from '../modules/auth/auth.types.js';

export class AuthService {
  constructor(private readonly logger: Logger) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const supabase = createAuthClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      this.logger.warn({ email, error: error.message }, 'Login failed');
      throw new AuthError(error.message);
    }

    if (!data.session || !data.user) {
      throw new AuthError('Login failed');
    }

    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in ?? 3600,
        token_type: data.session.token_type,
      },
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
      },
    };
  }

  async signup(email: string, password: string): Promise<SignupResult> {
    const supabase = createAuthClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      this.logger.warn({ email, error: error.message }, 'Signup failed');
      throw new AuthError(error.message);
    }

    if (!data.user) {
      throw new AuthError('Signup failed');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
      },
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in ?? 3600,
        token_type: data.session.token_type,
      } : null,
    };
  }
}
