import type { FastifyReply } from 'fastify';
import { HTTP_STATUS } from '@dotor/shared';

export interface SuccessResponse<T = unknown> {
  data: T;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode = HTTP_STATUS.OK): FastifyReply {
  return reply.code(statusCode).send({ data });
}

export function sendError(
  reply: FastifyReply,
  message: string,
  statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  code?: string,
  details?: unknown
): FastifyReply {
  return reply.code(statusCode).send({
    error: message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  });
}
