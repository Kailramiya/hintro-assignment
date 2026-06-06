# Changelog

## [1.0.0] — 2024-12-01

### Milestone 1: Project Foundation
- Initialized Node.js + TypeScript project with Express
- Configured Prisma schema with User, Meeting, MeetingAnalysis, ActionItem, ReminderHistory models
- Set up Zod-based environment validation (`config/env.ts`)
- Implemented Winston structured logger with request tracing middleware
- Established unified `{ traceId, success, data, error }` API response format

### Milestone 2: Authentication
- Implemented `POST /api/auth/register` with bcrypt password hashing (12 rounds)
- Implemented `POST /api/auth/login` with constant-time comparison to prevent timing attacks
- JWT middleware (`authMiddleware`) for protecting all private routes
- Zod validation schemas for register and login request bodies

### Milestone 3: Meeting Management
- Implemented `POST /api/meetings` — create meeting with participants and structured transcript
- Implemented `GET /api/meetings` — paginated list with optional date range filtering
- Implemented `GET /api/meetings/:id` — single meeting with full analysis and action items
- Transcript entry timestamp validated against `HH:MM:SS` regex

### Milestone 4: AI Integration
- Integrated Google Gemini 1.5 Flash via `@google/generative-ai`
- Engineered grounding prompt enforcing citation requirements for every insight
- Implemented `POST /api/meetings/:id/analyze` — triggers AI analysis and persists results
- Post-processing validation: drops hallucinated assignees not present in transcript
- Analysis + action item creation wrapped in Prisma transaction for atomicity
- `temperature: 0.1` and `responseMimeType: 'application/json'` for deterministic structured output

### Milestone 5: Action Item Management
- Implemented `POST /api/action-items` — manual creation with optional meeting linkage
- Implemented `GET /api/action-items` — list with status/assignee/meetingId filtering and pagination
- Implemented `GET /api/action-items/overdue` — items where status != COMPLETED and dueDate < now
- Implemented `PATCH /api/action-items/:id/status` — status transition with Zod enum validation
- Registered `/overdue` route before `/:id` to prevent Express route shadowing

### Milestone 6: Scheduled Reminders & External Integration
- Implemented `node-cron` scheduler running hourly at `:00`
- Integrated Resend email API for overdue action item notifications
- HTML email template with meeting context and due date
- ReminderHistory records written for every send attempt (success or failure)
- Graceful degradation: reminder system logs warnings when `RESEND_API_KEY` is absent

### Milestone 7: API Documentation & System Endpoints
- Full OpenAPI 3.0 spec defined in `src/config/swagger.ts`
- Swagger UI served at `GET /api-docs` via `swagger-ui-express`
- Raw JSON spec at `GET /api-docs.json`
- `GET /health` with live database connectivity check
- `GET /api/evaluation` returning candidate metadata and feature list

### Milestone 8: Production Hardening
- Helmet security headers
- CORS configured for `*` (evaluation-friendly)
- Global rate limiter: 200 requests/15 minutes per IP
- `notFoundMiddleware` for unmatched routes
- Centralized `errorMiddleware` with stack traces hidden in production
- Graceful shutdown (SIGTERM/SIGINT handlers)

### Milestone 9: DevOps & Documentation
- Multi-stage Dockerfile (builder + runner) for minimal production image
- `docker-compose.yml` with PostgreSQL 16 and health check dependency
- GitHub Actions CI pipeline: install → type-check → build
- `README.md` with full setup, environment, and usage examples
- `DECISIONS.md` with technology and architecture rationale
- `AI_APPROACH.md` with prompt design and citation strategy
- `TESTING.md` with test scenarios and edge cases
- `CHECKLIST.md` with completion status
