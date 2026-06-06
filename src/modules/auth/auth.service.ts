import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { createError } from '../../middleware/error';
import { RegisterInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw createError('Email is already registered', 409, 'EMAIL_CONFLICT');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

  return { user, token };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Constant-time compare to prevent timing attacks
  const dummyHash = '$2b$12$invalidhashfortimingatk';
  const passwordMatch = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : await bcrypt.compare(input.password, dummyHash);

  if (!user || !passwordMatch) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    token,
  };
}
