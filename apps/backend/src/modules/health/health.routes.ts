import type { FastifyInstance } from 'fastify';
import { HealthController } from '../../controllers/health.controller.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const controller = new HealthController();

  fastify.get('/health', async (request, reply) => {
    await controller.check(request, reply);
  });
}
