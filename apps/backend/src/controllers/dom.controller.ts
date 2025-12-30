import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '@dotor/logger';
import { HTTP_STATUS } from '@dotor/shared';
import { z } from 'zod';
import { DOMService } from '../services/dom.service.js';
import { ValidationError } from '../lib/errors/index.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const createInstructionsSchema = z.object({
  request_id: z.string().uuid(),
  sources: z.array(z.enum(['linkedin', 'whatsapp'])),
  keywords: z.array(z.string()),
});

const submitResultsSchema = z.object({
  request_id: z.string().uuid(),
  source: z.string(),
  snippets: z.array(z.string()),
  error: z.string().optional(),
});

export class DOMController {
  private domService: DOMService;

  constructor(logger: Logger) {
    this.domService = new DOMService(logger);
  }

  async createInstructions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    const parseResult = createInstructionsSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.issues);
    }

    try {
      const result = this.domService.createInstructions(authRequest.userId, parseResult.data);
      await reply.code(HTTP_STATUS.OK).send(result);
    } catch (error) {
      await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to create instructions' });
    }
  }

  async submitResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    const parseResult = submitResultsSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request body', parseResult.error.issues);
    }

    try {
      const result = this.domService.submitResults(authRequest.userId, parseResult.data);
      await reply.code(HTTP_STATUS.OK).send(result);
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('Not authorized') ? HTTP_STATUS.FORBIDDEN 
                         : error.message.includes('not found') ? HTTP_STATUS.NOT_FOUND
                         : HTTP_STATUS.INTERNAL_SERVER_ERROR;
        await reply.code(statusCode).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to submit results' });
      }
    }
  }

  async getResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    const { request_id } = request.params as { request_id: string };

    try {
      const result = this.domService.getResults(authRequest.userId, request_id);
      await reply.code(HTTP_STATUS.OK).send(result);
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message.includes('Not authorized') ? HTTP_STATUS.FORBIDDEN 
                         : error.message.includes('not found') ? HTTP_STATUS.NOT_FOUND
                         : HTTP_STATUS.INTERNAL_SERVER_ERROR;
        await reply.code(statusCode).send({ error: error.message });
      } else {
        await reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Failed to get results' });
      }
    }
  }
}
