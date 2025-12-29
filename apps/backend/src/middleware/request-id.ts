import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

export async function requestIdMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const requestId = request.headers['x-request-id'] as string || randomUUID();
  request.id = requestId;
}
