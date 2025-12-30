import type { FastifyRequest, FastifyReply } from 'fastify';
import { HTTP_STATUS } from '@dotor/shared';

export class HealthController {
  async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.code(HTTP_STATUS.OK).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'dotor-backend',
    });
  }
}
