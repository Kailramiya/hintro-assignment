# Technical Decisions

This document captures the key architectural and technology decisions made for the Meeting Intelligence Service, along with the reasoning, alternatives considered, and tradeoffs.

---

## 1. Authentication: JWT over Sessions

**Decision:** Stateless JWT tokens with 7-day expiry.

**Why:**
- The service is designed to be deployed as a single stateless container (or horizontally scaled). Sessions require shared state (Redis, database) between instances.
- JWTs are self-contained — the server verifies the signature without a database lookup, reducing latency on every authenticated request.
- The assignment hints at a REST API that will be tested externally — JWTs are simpler to pass in curl/Postman without cookie configuration.

**Alternatives considered:**
- **Session-based auth**: Would require a Redis instance for shared session storage in multi-instance deployments. Adds operational complexity.
- **OAuth2 / third-party**: Over-engineered for an internal-facing service. No social login needed.

**Tradeoffs:**
- JWTs cannot be revoked before expiry without a blocklist. Mitigated by keeping expiry short (7d) and providing logout instructions.
- The `JWT_SECRET` must be kept secure. Documented clearly in `.env.example`.

---

## 2. Database: PostgreSQL with Prisma ORM

**Decision:** PostgreSQL as the primary database; Prisma as the ORM.

**Why:**
- PostgreSQL supports `JSON` columns natively, which is ideal for storing transcript arrays and participant lists without over-normalizing the schema.
- Prisma provides type-safe query builders generated from the schema — compiler catches invalid queries before runtime.
- The team at most production companies uses Prisma or Drizzle; this demonstrates familiarity with modern Node.js data access patterns.
- Free hosting is widely available (Neon, Railway, Supabase).

**Alternatives considered:**
- **MongoDB**: Schema-less flexibility isn't needed here; the data model is well-defined. PostgreSQL's relational guarantees (foreign keys, constraints) are more appropriate.
- **SQLite**: Simpler for local dev but doesn't support JSON column operators or concurrent writes well. Not suitable for production.
- **TypeORM / Sequelize**: More verbose, weaker TypeScript integration than Prisma.

**Tradeoffs:**
- Prisma migrations add a deployment step (`prisma migrate deploy`). Handled in Docker CMD and documented.
- JSON columns (transcript, participants) aren't directly indexed — acceptable at this scale.

---

## 3. AI Provider: Google Gemini 1.5 Flash

**Decision:** Google Gemini 1.5 Flash via `@google/generative-ai` SDK.

**Why:**
- **Free tier**: The AI Studio free tier is generous enough for development and evaluation.
- **`responseMimeType: 'application/json'`**: Gemini supports structured JSON output natively, reducing prompt engineering needed to avoid markdown wrappers.
- **Speed**: Flash model is fast (< 3s for typical meeting transcripts) — suitable for a synchronous analysis endpoint.
- **Context window**: 1M token context window handles even very long meeting transcripts.

**Alternatives considered:**
- **OpenAI GPT-4o**: Excellent quality but requires paid API key.
- **Groq (Llama)**: Fast and free, but JSON output reliability is lower for complex schemas.
- **Claude (Anthropic)**: High quality; considered as fallback if Gemini quota exceeded.

**Tradeoffs:**
- Gemini occasionally wraps JSON in code fences despite `responseMimeType` setting. Handled with a fallback cleaning step in `gemini.service.ts`.
- Rate limits on free tier (~60 requests/minute). Sufficient for evaluation.

---

## 4. External Integration: Resend (Email)

**Decision:** Resend as the email provider for overdue action item reminders.

**Why:**
- Simple REST API — one `resend.emails.send()` call, no SMTP configuration.
- Free tier: 100 emails/day, 3,000/month — sufficient for a demo and real small teams.
- Modern developer-focused API with good TypeScript SDK.
- Emails are the most universally accessible notification channel (no Slack workspace required, no bot token setup).

**Alternatives considered:**
- **Slack Webhook**: Requires a Slack workspace and app setup. Not universally available for evaluators.
- **SendGrid**: More enterprise-focused, free tier requires credit card in some regions.
- **Nodemailer + SMTP**: Requires managing SMTP credentials; deliverability issues with personal Gmail.
- **Discord Webhook**: Less professional context for workplace action items.

**Tradeoffs:**
- Resend requires a verified sending domain in production. For evaluation, the service gracefully degrades (logs a warning, records `status: 'failed'` in `ReminderHistory`) if `RESEND_API_KEY` is absent.

---

## 5. Project Structure: Modules Pattern

**Decision:** Feature-based module structure (`modules/auth`, `modules/meetings`, `modules/action-items`) rather than layer-based (`controllers/`, `services/`, `models/`).

**Why:**
- Scales better as the project grows — adding a new feature means adding one directory, not touching four.
- Easier code navigation: everything related to meetings is in `src/modules/meetings/`.
- Matches the pattern used in NestJS and modern Express projects.

**Alternatives considered:**
- **Layer-based structure**: `controllers/`, `services/`, `repositories/`. Familiar but leads to feature coupling across layers.
- **Hexagonal / clean architecture**: Valuable in large teams but adds indirection (ports, adapters) without benefit at this scale.

---

## 6. Validation: Zod

**Decision:** Zod for all request body validation.

**Why:**
- Zod schemas are the source of truth for TypeScript types (`z.infer<typeof schema>`), so there's no duplication between runtime validation and compile-time types.
- Error messages are developer-friendly and easy to forward to API consumers.
- Integrates cleanly with a generic `validate(schema)` middleware.

**Tradeoffs:**
- Slightly more verbose than `express-validator` for simple cases. Worth it for the type inference benefit.

---

## 7. Logging: Winston

**Decision:** Winston with structured JSON output in production, colorized simple output in development.

**Why:**
- JSON logs are machine-parseable by log aggregators (Datadog, Railway logs, etc.).
- Every log line includes `traceId`, enabling cross-request correlation.
- The `traceId` flows from the HTTP middleware through service calls, making debugging straightforward.

---

## 8. Scheduler: node-cron (In-Process)

**Decision:** `node-cron` running inside the same process as the API server.

**Why:**
- Zero additional infrastructure — no separate worker process, no Redis queue.
- Acceptable for the scale of this assignment (one cron job, hourly).

**Tradeoffs:**
- In a multi-instance deployment, each instance would run its own scheduler, potentially sending duplicate reminders. Mitigated by checking `reminderSentAt` before sending. In production, this would move to a dedicated worker service or BullMQ queue.

---

## 9. Response Envelope

**Decision:** Every API response wrapped in `{ traceId, success, data, error }`.

**Why:**
- Clients always receive a consistent shape — no need to inspect status codes to know if an error occurred.
- `traceId` in the body makes it easy for frontend devs to report issues even when they can't inspect headers.
- Matches the format specified in the assignment requirements.
