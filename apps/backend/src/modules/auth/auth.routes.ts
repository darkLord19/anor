import type { FastifyInstance } from 'fastify';
import type { Logger } from '@dotor/logger';
import { AuthController } from './auth.controller.js';

export async function authRoutes(fastify: FastifyInstance, logger: Logger): Promise<void> {
  const controller = new AuthController(logger);

  fastify.post('/auth/login', async (request, reply) => {
    await controller.login(request, reply);
  });

  fastify.post('/auth/signup', async (request, reply) => {
    await controller.signup(request, reply);
  });

  fastify.post('/auth/logout', async (request, reply) => {
    await controller.logout(request, reply);
  });
}
