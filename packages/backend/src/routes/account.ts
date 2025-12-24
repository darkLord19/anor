import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJWT, type AuthenticatedRequest } from '../middleware/auth.js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(6),
});

export async function accountRoutes(fastify: FastifyInstance): Promise<void> {
  // Get current session/user info
  fastify.get('/account/session', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const supabase = createUserClient(authRequest.accessToken);

    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return reply.code(401).send({ error: 'Failed to get user' });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          createdAt: user.created_at,
        },
        accessToken: authRequest.accessToken,
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to get session');
      return reply.code(500).send({ error: 'Failed to get session' });
    }
  });

  // Get user profile
  fastify.get('/account/profile', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const supabase = createUserClient(authRequest.accessToken);

    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return reply.code(401).send({ error: 'Failed to get user' });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        createdAt: user.created_at,
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to get profile');
      return reply.code(500).send({ error: 'Failed to get profile' });
    }
  });

  // Update user profile (name)
  fastify.put('/account/profile', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const parseResult = updateProfileSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { name } = parseResult.data;

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    try {
      // Use Admin API to update user metadata (backend should use Admin API)
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authRequest.userId,
        { user_metadata: { full_name: name } }
      );

      if (updateError) {
        fastify.log.error(updateError, 'Failed to update profile');
        return reply.code(400).send({ error: updateError.message });
      }

      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      fastify.log.error(error, 'Failed to update profile');
      return reply.code(500).send({ error: 'Failed to update profile' });
    }
  });

  // Update password
  fastify.put('/account/password', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const parseResult = updatePasswordSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { password } = parseResult.data;

    if (!supabaseAdmin) {
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    try {
      // Use Admin API to update password (backend should use Admin API)
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authRequest.userId,
        { password }
      );

      if (updateError) {
        fastify.log.error(updateError, 'Failed to update password');
        return reply.code(400).send({ error: updateError.message });
      }

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      fastify.log.error(error, 'Failed to update password');
      return reply.code(500).send({ error: 'Failed to update password' });
    }
  });

  // Sign out
  fastify.post('/account/signout', {
    preHandler: verifyJWT,
  }, async (_request, _reply) => {
    // Sign out is handled client-side by clearing cookies
    // This endpoint just confirms the request is authenticated
    return { success: true };
  });

  // Request account deletion
  fastify.post('/account/delete', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    
    if (!supabaseAdmin) {
      fastify.log.error('Supabase admin client not configured');
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    try {
      // Delete all user data from connections table
      const { error: connectionsError } = await supabaseAdmin
        .from('connections')
        .delete()
        .eq('user_id', authRequest.userId);

      if (connectionsError) {
        fastify.log.error(connectionsError, 'Failed to delete connections');
        return reply.code(500).send({ error: 'Failed to delete user data' });
      }

      // Delete usage events
      const { error: usageEventsError } = await supabaseAdmin
        .from('usage_events')
        .delete()
        .eq('user_id', authRequest.userId);

      if (usageEventsError) {
        fastify.log.error(usageEventsError, 'Failed to delete usage events');
        // Continue even if this fails
      }

      // Delete profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', authRequest.userId);

      if (profileError) {
        fastify.log.error(profileError, 'Failed to delete profile');
        // Continue even if this fails
      }

      // Delete the auth user using Admin API
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        authRequest.userId
      );

      if (deleteError) {
        fastify.log.error(deleteError, 'Failed to delete user');
        return reply.code(500).send({ error: 'Failed to delete account' });
      }

      fastify.log.info({ userId: authRequest.userId }, 'Account deleted successfully');
      
      return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
      fastify.log.error(error, 'Account deletion error');
      return reply.code(500).send({ error: 'Failed to delete account' });
    }
  });
}

