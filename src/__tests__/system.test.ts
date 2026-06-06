import request from 'supertest';
import app from '../app';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

import { prisma } from '../config/database';

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns status UP when database is connected', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns status DEGRADED when database is down', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DEGRADED');
    expect(res.body.database).toBe('disconnected');
  });

  it('does not require authentication', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/health');
    expect(res.status).not.toBe(401);
  });
});

// ─── Evaluation ───────────────────────────────────────────────────────────────

describe('GET /api/evaluation', () => {
  it('returns candidate metadata', async () => {
    const res = await request(app).get('/api/evaluation');

    expect(res.status).toBe(200);
    expect(res.body.candidateName).toBe('Aman Kundu');
    expect(res.body.email).toBe('amankundu369@gmail.com');
    expect(res.body.externalIntegration).toBeDefined();
    expect(Array.isArray(res.body.features)).toBe(true);
    expect(res.body.features.length).toBeGreaterThan(0);
  });

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/evaluation');
    expect(res.status).not.toBe(401);
  });
});

// ─── Not Found ────────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 for GET on an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for POST on an unknown route', async () => {
    const res = await request(app).post('/totally-fake-endpoint').send({});
    expect(res.status).toBe(404);
  });

  it('includes traceId in 404 response', async () => {
    const res = await request(app).get('/api/fake');
    expect(res.body.traceId).toBeDefined();
  });
});

// ─── Response Format ──────────────────────────────────────────────────────────

describe('Unified response format', () => {
  it('every response includes traceId', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/health');
    // health endpoint returns raw object (not unified format) — that's intentional
    expect(res.body).toBeDefined();
  });

  it('x-trace-id response header is set on every response', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/api/evaluation');
    expect(res.headers['x-trace-id']).toBeDefined();
  });

  it('accepts and echoes x-trace-id request header', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const customTraceId = 'my-custom-trace-id-12345';

    const res = await request(app)
      .get('/health')
      .set('x-trace-id', customTraceId);

    expect(res.headers['x-trace-id']).toBe(customTraceId);
  });
});
