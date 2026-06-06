import request from 'supertest';
import app from '../app';
import { TEST_USER } from './helpers/auth.helper';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
jest.mock('../config/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

// Mock bcrypt for speed (12 rounds is very slow in tests)
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhash'),
  compare: jest.fn(),
}));

import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

const mockUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// ─── Register ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a JWT', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: TEST_USER.id,
      email: 'alice@example.com',
      name: 'Alice Johnson',
      createdAt: new Date(),
    } as never);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice Johnson', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.traceId).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined(); // never expose hash
  });

  it('returns 409 when email is already registered', async () => {
    mockUser.findUnique.mockResolvedValue(TEST_USER as never);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice Johnson', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_CONFLICT');
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'Alice', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('email');
  });

  it('returns 422 when password is under 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('name');
  });

  it('returns 422 when body is empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and returns a JWT', async () => {
    mockUser.findUnique.mockResolvedValue(TEST_USER as never);
    mockBcrypt.compare.mockResolvedValue(true as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.id).toBe(TEST_USER.id);
  });

  it('returns 401 for wrong password', async () => {
    mockUser.findUnique.mockResolvedValue(TEST_USER as never);
    mockBcrypt.compare.mockResolvedValue(false as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for non-existent email (timing-safe)', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    mockBcrypt.compare.mockResolvedValue(false as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    // Same error whether email wrong or password wrong — no enumeration
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(422);
  });
});

// ─── Auth middleware ───────────────────────────────────────────────────────────

describe('JWT Auth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when Bearer prefix is missing', async () => {
    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', 'justtoken123');
    expect(res.status).toBe(401);
  });
});
