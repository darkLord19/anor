import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { askRoutes } from './routes/ask.js';
import { domRoutes } from './routes/dom.js';
import { googleRoutes } from './routes/google.js';
import { accountRoutes } from './routes/account.js';
import { authRoutes } from './routes/auth.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function buildServer() {
  const isDev = process.env.NODE_ENV === 'development';
  
  const fastify = Fastify({
    logger: isDev
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : {
          level: process.env.LOG_LEVEL ?? 'info',
        },
  });

  // Register CORS
  const corsOrigin = process.env.CORS_ORIGIN;
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like server-to-server or curl)
      if (!origin) {
        cb(null, true);
        return;
      }

      // Allow Chrome extensions
      if (origin.startsWith('chrome-extension://')) {
        cb(null, true);
        return;
      }

      // If CORS_ORIGIN is set, check against it
      if (corsOrigin) {
        const allowedOrigins = corsOrigin.split(',').map(o => o.trim());
        if (allowedOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        // Not allowed
        cb(new Error("Not allowed by CORS"), false);
        return;
      }

      // If CORS_ORIGIN is not set, allow all (development mode)
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(askRoutes);
  await fastify.register(domRoutes);
  await fastify.register(googleRoutes);
  await fastify.register(accountRoutes);
  await fastify.register(authRoutes);

  return fastify;
}

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
