import type { FastifyInstance } from 'fastify';
import type { Logger } from '@dotor/logger';
import { AccountController } from '../../controllers/account.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function accountRoutes(fastify: FastifyInstance, logger: Logger): Promise<void> {
  const controller = new AccountController(logger);

  // Get current session/user info
  fastify.get('/account/session', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.getSession(request, reply);
  });

  // Get user profile
  fastify.get('/account/profile', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.getProfile(request, reply);
  });

  // Update user profile
  fastify.put('/account/profile', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.updateProfile(request, reply);
  });

  // Update password
  fastify.put('/account/password', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.updatePassword(request, reply);
  });

  // Sign out
  fastify.post('/account/signout', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.signout(request, reply);
  });

  // Delete account
  fastify.post('/account/delete', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.deleteAccount(request, reply);
  });

  // Get feature flags
  fastify.get('/account/feature-flags', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.getFeatureFlags(request, reply);
  });
}
