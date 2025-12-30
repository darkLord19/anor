import type { FastifyInstance } from 'fastify';
import type { Logger } from '@dotor/logger';
import { DOMController } from '../../controllers/dom.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function domRoutes(fastify: FastifyInstance, logger: Logger): Promise<void> {
  const controller = new DOMController(logger);

  // Get DOM instructions for a request
  fastify.post('/dom/instructions', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.createInstructions(request, reply);
  });

  // Extension submits DOM search results
  fastify.post('/dom/results', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.submitResults(request, reply);
  });

  // Poll for results
  fastify.get('/dom/results/:request_id', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    await controller.getResults(request, reply);
  });
}
