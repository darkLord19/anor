import type { FastifyInstance } from 'fastify';
import type { Logger } from '@dotor/logger';
import { AuthController } from '../../controllers/auth.controller.js';
import rateLimit from '@fastify/rate-limit';

export async function authRoutes(fastify: FastifyInstance, logger: Logger): Promise<void> {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const controller = new AuthController(logger);

  fastify.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      await controller.login(request, reply);
    },
  );

  fastify.post(
    '/auth/signup',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      await controller.signup(request, reply);
    },
  );

  fastify.post(
    '/auth/logout',
    {
      config: {
        rateLimit: {
          max: 50,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      await controller.logout(request, reply);
    },
  );
}
