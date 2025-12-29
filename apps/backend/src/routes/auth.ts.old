import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabasePublishableKey } from '../lib/supabase.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // We need a fresh client for auth operations to avoid sharing state
  const getSupabase = () => createClient(supabaseUrl, supabasePublishableKey);

  fastify.post('/auth/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);
      const supabase = getSupabase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return reply.code(401).send({ error: error.message });
      }

      return {
        session: data.session,
        user: data.user,
      };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: e.issues });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/auth/signup', async (request, reply) => {
    try {
      const { email, password } = signupSchema.parse(request.body);
      const supabase = getSupabase();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid input', details: e.issues });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/auth/logout', async (_request, _reply) => {
    // Client should clear tokens.
    return { success: true };
  });
}
