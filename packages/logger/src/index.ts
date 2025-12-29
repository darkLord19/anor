import pino from 'pino';

export interface LoggerOptions {
  level?: string;
  service: string;
  environment?: string;
  prettyPrint?: boolean;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export function createLogger(options: LoggerOptions) {
  const { level = 'info', service, environment = process.env.NODE_ENV ?? 'development', prettyPrint = false } = options;

  const logger = pino({
    level,
    base: {
      service,
      environment,
    },
    redact: {
      paths: ['password', 'token', 'accessToken', 'refreshToken', 'authorization', 'cookie'],
      remove: true,
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(prettyPrint && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss.l',
        },
      },
    }),
  });

  return {
    info: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        logger.info(context);
      } else {
        logger.info(context, message);
      }
    },
    error: (context: LogContext | Error | string, message?: string) => {
      if (context instanceof Error) {
        logger.error({ err: context }, message ?? context.message);
      } else if (typeof context === 'string') {
        logger.error(context);
      } else {
        logger.error(context, message);
      }
    },
    warn: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        logger.warn(context);
      } else {
        logger.warn(context, message);
      }
    },
    debug: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        logger.debug(context);
      } else {
        logger.debug(context, message);
      }
    },
    child: (bindings: LogContext) => {
      const childLogger = logger.child(bindings);
      return {
        info: (ctx: LogContext | string, msg?: string) => {
          if (typeof ctx === 'string') {
            childLogger.info(ctx);
          } else {
            childLogger.info(ctx, msg);
          }
        },
        error: (ctx: LogContext | Error | string, msg?: string) => {
          if (ctx instanceof Error) {
            childLogger.error({ err: ctx }, msg ?? ctx.message);
          } else if (typeof ctx === 'string') {
            childLogger.error(ctx);
          } else {
            childLogger.error(ctx, msg);
          }
        },
        warn: (ctx: LogContext | string, msg?: string) => {
          if (typeof ctx === 'string') {
            childLogger.warn(ctx);
          } else {
            childLogger.warn(ctx, msg);
          }
        },
        debug: (ctx: LogContext | string, msg?: string) => {
          if (typeof ctx === 'string') {
            childLogger.debug(ctx);
          } else {
            childLogger.debug(ctx, msg);
          }
        },
      };
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
