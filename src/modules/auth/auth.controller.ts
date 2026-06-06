import { Request, Response, NextFunction } from 'express';
import { register, login } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { RegisterInput, LoginInput } from './auth.schema';

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await register(req.body as RegisterInput);
    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await login(req.body as LoginInput);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
