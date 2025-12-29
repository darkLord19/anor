import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, ValidationError } from './domain-errors.js';
import { HTTP_STATUS } from '@dotor/shared';
import type { Logger } from '@dotor/logger';

export function createErrorHandler(logger: Logger) {
  return async (error: FastifyError, request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      logger.warn({ error: error.issues, path: request.url }, 'Validation error');
      await reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues,
      });
      return;
    }

    // Handle domain errors
    if (error instanceof DomainError) {
      logger.warn(
        { code: error.code, message: error.message, path: request.url },
        'Domain error'
      );
      await reply.code(error.statusCode).send({
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    // Handle Fastify validation errors
    if (error.validation) {
      const validationError = new ValidationError('Request validation failed', error.validation);
      logger.warn({ error: error.validation, path: request.url }, 'Fastify validation error');
      await reply.code(validationError.statusCode).send({
        error: validationError.message,
        code: validationError.code,
        details: validationError.details,
      });
      return;
    }

    // Log unexpected errors
    logger.error(
      {
        err: error,
        path: request.url,
        method: request.method,
        requestId: request.id,
      },
      'Unexpected error'
    );

    // Send generic error response
    await reply.code(error.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      error: isDevelopment ? error.message : 'Internal server error',
      ...(isDevelopment && { stack: error.stack }),
    });
  };
}
