import winston from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: isDev ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});

export function logRequest(
  traceId: string,
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  logger.info('HTTP request', { traceId, method, path, status, durationMs });
}

export function logError(traceId: string, error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Error occurred', {
    traceId,
    message: err.message,
    stack: err.stack,
    ...context,
  });
}
