export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface LoginResult {
  session: AuthSession;
  user: AuthUser;
}

export interface SignupResult {
  user: AuthUser;
  session: AuthSession | null;
}
