import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', details);
      return;
    }

    req.body = result.data;
    next();
  };
}
