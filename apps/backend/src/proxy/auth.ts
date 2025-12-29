import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  accessToken: string;
}

export async function verifyJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Create a client with the user's token to verify it
    const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      reply.code(401).send({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user info to request
    (request as AuthenticatedRequest).userId = user.id;
    (request as AuthenticatedRequest).accessToken = token;
  } catch {
    reply.code(401).send({ error: 'Token verification failed' });
  }
}
