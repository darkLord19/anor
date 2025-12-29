import { buildApp } from './app.js';
import { getEnv, getPort, getHost } from './lib/env/index.js';

async function start() {
  try {
    // Validate environment variables
    getEnv();
    
    // Build application
    const { app, logger } = await buildApp();
    
    // Start server
    const port = getPort();
    const host = getHost();
    
    await app.listen({ port, host });
    logger.info({ port, host }, 'Server listening');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
