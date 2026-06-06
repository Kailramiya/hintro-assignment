import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest } from '../utils/logger';

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();

  (req as Request & { traceId: string }).traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  const start = Date.now();

  res.on('finish', () => {
    logRequest(traceId, req.method, req.path, res.statusCode, Date.now() - start);
  });

  next();
}
