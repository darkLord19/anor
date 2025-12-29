import type { FastifyRequest } from 'fastify';
import type { Logger } from '@dotor/logger';

export function createRequestLogger(logger: Logger, request: FastifyRequest) {
  return logger.child({
    requestId: request.id,
    method: request.method,
    url: request.url,
  });
}

export function logRequestStart(logger: Logger, request: FastifyRequest): void {
  logger.info({
    requestId: request.id,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
  }, 'Request started');
}

export function logRequestComplete(
  logger: Logger,
  request: FastifyRequest,
  statusCode: number,
  responseTime: number
): void {
  logger.info({
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode,
    responseTime,
  }, 'Request completed');
}
