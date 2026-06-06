import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { traceMiddleware } from './middleware/trace';
import { errorMiddleware, notFoundMiddleware } from './middleware/error';
import { setupSwagger } from './config/swagger';

import authRoutes from './modules/auth/auth.routes';
import meetingRoutes from './modules/meetings/meetings.routes';
import actionItemRoutes from './modules/action-items/action-items.routes';
import systemRoutes from './modules/system/system.routes';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter: 200 requests / 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
  })
);

// Request tracing — must be early so traceId is available everywhere
app.use(traceMiddleware);

// API docs
setupSwagger(app);

// Routes
app.use(systemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/action-items', actionItemRoutes);

// 404 + global error handler — must be last
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
