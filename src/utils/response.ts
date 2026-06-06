import { Response } from 'express';

interface SuccessResponse<T> {
  traceId: string;
  success: true;
  data: T;
  error: null;
}

interface ErrorResponse {
  traceId: string;
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const traceId = (res.req as { traceId?: string }).traceId ?? 'unknown';
  const body: SuccessResponse<T> = { traceId, success: true, data, error: null };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): void {
  const traceId = (res.req as { traceId?: string }).traceId ?? 'unknown';
  const body: ErrorResponse = {
    traceId,
    success: false,
    data: null,
    error: { code, message, ...(details !== undefined && { details }) },
  };
  res.status(status).json(body);
}
