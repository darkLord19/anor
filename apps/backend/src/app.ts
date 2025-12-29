import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createLogger } from '@dotor/logger';
import { getEnv, isDevelopment } from './lib/env/index.js';
import { createErrorHandler } from './lib/errors/index.js';
import { requestIdMiddleware } from './middleware/index.js';

// Import route modules
import { authRoutes } from './modules/auth/index.js';
import { healthRoutes } from './routes/health.js';
import { askRoutes } from './routes/ask.js';
import { domRoutes } from './routes/dom.js';
import { googleRoutes } from './routes/google.js';
import { accountRoutes } from './routes/account.js';

export async function buildApp() {
  const env = getEnv();
  
  // Create logger
  const logger = createLogger({
    service: 'dotor-backend',
    level: env.LOG_LEVEL,
    prettyPrint: isDevelopment(),
  });

  // Create Fastify instance
  const app = Fastify({
    logger: false, // Use our custom logger instead
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
  });

  // Register request ID middleware
  app.addHook('preHandler', requestIdMiddleware);

  // Register security plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too many requests',
      code: 'RATE_LIMIT',
    }),
  });

  // Register CORS
  const corsOrigin = env.CORS_ORIGIN;
  await app.register(cors, {
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });

  // Register error handler
  app.setErrorHandler(createErrorHandler(logger));

  // Register routes
  await app.register(async (instance) => {
    await healthRoutes(instance);
    await authRoutes(instance, logger);
    await askRoutes(instance);
    await domRoutes(instance);
    await googleRoutes(instance);
    await accountRoutes(instance);
  });

  return { app, logger };
}
