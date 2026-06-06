import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthRequest, AuthPayload } from '../types';
import { sendError } from '../utils/response';

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'INVALID_TOKEN', 'JWT is invalid or expired');
  }
}
