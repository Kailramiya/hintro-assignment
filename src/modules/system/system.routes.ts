import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../config/database';

const router = Router();

router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', timestamp: new Date().toISOString(), database: 'connected' });
  } catch {
    res.status(503).json({ status: 'DEGRADED', timestamp: new Date().toISOString(), database: 'disconnected' });
  }
});

router.get('/api/evaluation', (_req: Request, res: Response): void => {
  res.json({
    candidateName: env.CANDIDATE_NAME,
    email: env.CANDIDATE_EMAIL,
    repositoryUrl: env.REPOSITORY_URL,
    deployedUrl: env.DEPLOYED_URL,
    externalIntegration: 'Resend (Transactional Email)',
    features: [
      'JWT authentication with bcrypt password hashing',
      'Meeting CRUD with pagination and date filtering',
      'AI analysis via Gemini 1.5 Flash with grounded citations',
      'Citation enforcement — every insight has transcript timestamp + exact quote',
      'Action item management (create, list, filter)',
      'Overdue detection endpoint',
      'Scheduled reminders via node-cron (hourly)',
      'Email notifications via Resend',
      'Unified API response format with traceId',
      'Structured JSON logging via Winston',
      'Request tracing (x-trace-id header)',
      'Zod request validation with detailed errors',
      'Centralized error handling',
      'Swagger/OpenAPI 3.0 documentation',
      'Docker + docker-compose support',
      'GitHub Actions CI pipeline',
      'Rate limiting via express-rate-limit',
      'Security headers via Helmet',
    ],
  });
});

export default router;
