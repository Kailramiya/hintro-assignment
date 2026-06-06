# Architecture

## Overview

Hintro Meeting Intelligence Service is a REST API that ingests meeting transcripts and returns AI-powered structured insights — action items with grounded citations, decisions, summaries, and automated email reminders for overdue tasks.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│              (curl / Postman / Swagger UI)               │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Express API Server                   │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Trace Middleware│  │ Auth Middleware│  │ Error Handler │  │
│  │ (UUID inject) │  │ (JWT verify)  │  │ (global)      │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                    Routes                        │   │
│  │  POST /auth/register  POST /auth/login           │   │
│  │  POST /meetings       GET  /meetings             │   │
│  │  GET  /meetings/:id   POST /meetings/:id/analyze │   │
│  │  GET  /action-items   GET  /action-items/overdue │   │
│  │  PUT  /action-items/:id   DELETE /action-items/:id│  │
│  │  GET  /health         GET  /api/evaluation       │   │
│  └──────────────────────────────────────────────────┘   │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌───────────────────────┐
│   PostgreSQL DB  │   │  Google Gemini 2.0     │
│   (via Prisma)   │   │  Flash AI              │
│                  │   │                        │
│  User            │   │  - Transcript analysis │
│  Meeting         │   │  - Action item extract │
│  MeetingAnalysis │   │  - Decision extract    │
│  ActionItem      │   │  - Summary generation  │
│  ReminderHistory │   │  - Follow-up suggestions│
└──────────────────┘   └───────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               node-cron Scheduler (hourly)              │
│                                                         │
│  1. Query overdue ActionItems (dueDate < now, PENDING)  │
│  2. Send email via Resend API                           │
│  3. Write ReminderHistory record                        │
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── config/
│   ├── env.ts           # Zod-validated env vars — crashes at startup if missing
│   ├── database.ts      # Prisma singleton with dev hot-reload caching
│   └── swagger.ts       # Full OpenAPI 3.0.3 spec as TypeScript object
│
├── middleware/
│   ├── trace.ts         # Injects UUID traceId into every request
│   ├── auth.ts          # JWT verification — returns 401 if missing/invalid
│   ├── error.ts         # Global error handler — hides stack in production
│   └── validate.ts      # Zod validation — returns 422 with field-level errors
│
├── modules/
│   ├── auth/            # register, login
│   ├── meetings/        # CRUD + trigger analysis
│   └── action-items/    # list, get, update status, delete, overdue
│
├── services/
│   ├── ai/
│   │   └── gemini.service.ts      # Gemini integration + hallucination prevention
│   ├── notifications/
│   │   └── email.service.ts       # Resend HTML email
│   └── scheduler/
│       └── reminder.scheduler.ts  # node-cron hourly overdue job
│
├── types/               # Shared TypeScript interfaces
├── utils/
│   └── logger.ts        # Winston structured JSON logger
└── server.ts            # Entry point
```

---

## Data Flow — Meeting Analysis

```
POST /api/meetings/:id/analyze
        │
        ▼
  Auth middleware (verify JWT)
        │
        ▼
  Load meeting from DB (transcript, participants)
        │
        ▼
  Format transcript → [HH:MM:SS] Speaker: text
        │
        ▼
  Build grounding prompt (strict citation rules)
        │
        ▼
  Gemini 2.0 Flash → raw JSON response
        │
        ▼
  Parse + strip code fences if present
        │
        ▼
  Post-validation:
  - Warn if citationSpeaker not in transcript
  - Warn if citationTimestamp not in transcript
  - DROP action items where assignee never spoke
        │
        ▼
  prisma.$transaction:
  - Upsert MeetingAnalysis (summary, decisions, followUpSuggestions)
  - Create ActionItem rows (one per action item)
  - Update meeting.analyzedAt
        │
        ▼
  Return unified response { traceId, success, data }
```

---

## Database Schema

```
User ──────< Meeting ──────< ActionItem ──────< ReminderHistory
                │
                └──────── MeetingAnalysis (1:1)
```

- `Meeting.transcript` — stored as `Json` (array of `{speaker, text, timestamp}`)
- `Meeting.participants` — stored as `Json` (array of `{name, email?}`)
- `MeetingAnalysis.decisions` — stored as `Json`
- `MeetingAnalysis.followUpSuggestions` — stored as `Json`

---

## Key Design Decisions

### 1. Hallucination Prevention
Gemini is prompted with explicit grounding rules: every action item and decision must include the exact verbatim quote, timestamp, and speaker from the transcript. Post-processing then validates these citations and drops any action item whose assignee never appeared as a speaker.

### 2. Unified Response Format
Every endpoint returns `{ traceId, success, data, error }`. The `traceId` (UUID) is injected by middleware and echoed in the `x-trace-id` response header, making distributed debugging straightforward.

### 3. Atomic Analysis Save
Analysis results are saved inside `prisma.$transaction` — either the summary, all decisions, and all action items are saved together, or nothing is. This prevents partial data from a failed write.

### 4. Env Validation at Startup
All required environment variables are validated with Zod when the server starts. If any are missing, the process exits immediately with a clear error message rather than crashing silently later.

### 5. Route Ordering
`/action-items/overdue` is registered before `/:id` in Express to prevent the router from matching the string `"overdue"` as an ID parameter.

---

## External Services

| Service | Purpose | Required |
|---------|---------|---------|
| PostgreSQL | Primary database | Yes |
| Google Gemini 2.0 Flash | AI transcript analysis | Yes |
| Resend | Transactional email reminders | Optional (reminders disabled if not set) |

---

## Security

- Passwords hashed with **bcrypt** (salt rounds: 12)
- JWTs signed with `JWT_SECRET`, expire in 7 days
- **Helmet** sets secure HTTP headers on every response
- **express-rate-limit** caps requests at 100/15min per IP
- **CORS** restricted to configured origin
- Stack traces hidden in production error responses
