import { Request, Response, NextFunction } from 'express';
import { logError } from '../utils/logger';
import { sendError } from '../utils/response';
import { ApiError } from '../types';

export function errorMiddleware(
  err: ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const traceId = (req as Request & { traceId?: string }).traceId ?? 'unknown';

  logError(traceId, err, { method: req.method, path: req.path });

  const status = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  sendError(res, status, code, message, err.details);
}

export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}

export function createError(
  message: string,
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  details?: unknown
): ApiError {
  const err = new Error(message) as ApiError;
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}
