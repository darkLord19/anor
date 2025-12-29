import type { FastifyRequest, FastifyReply } from 'fastify';
import { createAuthClient } from '../lib/supabase/index.js';
import { AuthError } from '../lib/errors/index.js';

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  accessToken: string;
}

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  // Verify JWT with Supabase
  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Invalid or expired token');
  }

  // Attach user info to request
  (request as AuthenticatedRequest).userId = data.user.id;
  (request as AuthenticatedRequest).accessToken = token;
}
