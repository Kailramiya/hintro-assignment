# Meeting Intelligence Service

An AI-powered backend service that extracts structured insights from meeting transcripts — summaries, action items, decisions, and follow-up suggestions — with every insight **grounded by an exact transcript citation**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Documentation](#api-documentation)
- [API Usage Examples](#api-usage-examples)
- [Deployment](#deployment)
- [Docker](#docker)

---

## Features

- **JWT Authentication** — register and login with email + password
- **Meeting Management** — create meetings with structured transcripts; list with pagination and date filtering
- **AI Analysis** — Gemini 1.5 Flash generates summary, action items, decisions, and follow-up suggestions
- **Grounded Citations** — every AI insight includes the exact transcript quote, timestamp, and speaker it came from
- **Action Item Management** — create, filter, and update status (PENDING → IN_PROGRESS → COMPLETED)
- **Overdue Detection** — dedicated endpoint returns all overdue incomplete items
- **Scheduled Reminders** — node-cron job runs hourly; sends email via Resend for overdue items
- **Unified Response Format** — every response includes `{ traceId, success, data, error }`
- **Request Tracing** — `x-trace-id` header propagated through all logs and responses
- **Structured Logging** — Winston JSON logger with request/response correlation
- **Swagger UI** — full OpenAPI 3.0 spec at `/api-docs`
- **Docker Support** — single `docker-compose up` spins up app + PostgreSQL
- **CI Pipeline** — GitHub Actions type-check and build on every push

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| AI | Google Gemini 1.5 Flash |
| Email | Resend |
| Scheduler | node-cron |
| Validation | Zod |
| Logging | Winston |
| Docs | swagger-ui-express |

---

## Prerequisites

- Node.js >= 18
- PostgreSQL database (local or cloud — see [free options](#free-database-options))
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com/app/apikey))
- Resend API key (free at [resend.com](https://resend.com)) — optional; reminders are logged if absent

### Free Database Options

| Provider | Free Tier |
|---|---|
| [Neon](https://neon.tech) | 512 MB, always free |
| [Railway](https://railway.app) | $5 credit/month |
| [Supabase](https://supabase.com) | 500 MB, 2 projects free |

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/hintro-meeting-intelligence.git
cd hintro-meeting-intelligence

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, GEMINI_API_KEY, etc.

# 4. Push schema to database (development)
npx prisma db push

# 5. Start development server
npm run dev
```

The server starts at `http://localhost:3000`.
Swagger UI is at `http://localhost:3000/api-docs`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWTs (min 16 chars) |
| `JWT_EXPIRES_IN` | | Token expiry (default: `7d`) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `RESEND_API_KEY` | | Resend API key for email reminders |
| `RESEND_FROM_EMAIL` | | Sender email address |
| `PORT` | | Server port (default: `3000`) |
| `NODE_ENV` | | `development` or `production` |
| `CANDIDATE_NAME` | | Your name (shown in /api/evaluation) |
| `CANDIDATE_EMAIL` | | Your email (shown in /api/evaluation) |
| `REPOSITORY_URL` | | GitHub repo URL |
| `DEPLOYED_URL` | | Deployed app URL |

---

## Running the App

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm start

# Type checking
npm run type-check

# Prisma Studio (database GUI)
npm run prisma:studio
```

---

## API Documentation

Live Swagger UI: `http://localhost:3000/api-docs`

Raw OpenAPI JSON: `http://localhost:3000/api-docs.json`

---

## API Usage Examples

### 1. Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Johnson",
    "password": "securepass123"
  }'
```

Response:
```json
{
  "traceId": "...",
  "success": true,
  "data": {
    "user": { "id": "...", "email": "alice@example.com", "name": "Alice Johnson" },
    "token": "eyJhbGci..."
  },
  "error": null
}
```

### 2. Create a Meeting

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Sprint Planning",
    "meetingDate": "2024-12-01T10:00:00Z",
    "participants": [
      { "name": "Alice Johnson", "email": "alice@example.com" },
      { "name": "Bob Smith", "email": "bob@example.com" }
    ],
    "transcript": [
      { "speaker": "Alice Johnson", "text": "We need to finalize the API design by end of week.", "timestamp": "00:01:00" },
      { "speaker": "Bob Smith", "text": "I will handle the database schema. I can have it done by Friday.", "timestamp": "00:01:30" },
      { "speaker": "Alice Johnson", "text": "We decided to use PostgreSQL for all data storage.", "timestamp": "00:02:00" },
      { "speaker": "Bob Smith", "text": "Agreed. I will also write migration scripts.", "timestamp": "00:02:15" }
    ]
  }'
```

### 3. Run AI Analysis

```bash
curl -X POST http://localhost:3000/api/meetings/MEETING_ID/analyze \
  -H "Authorization: Bearer YOUR_JWT"
```

Response includes grounded insights:
```json
{
  "data": {
    "summary": "The team planned Q4 sprint work, focusing on API design and database decisions...",
    "actionItems": [
      {
        "title": "Finalize API design",
        "assignee": "Alice Johnson",
        "dueDate": null,
        "citationText": "We need to finalize the API design by end of week.",
        "citationTimestamp": "00:01:00",
        "citationSpeaker": "Alice Johnson"
      },
      {
        "title": "Complete database schema",
        "assignee": "Bob Smith",
        "dueDate": "2024-12-06T00:00:00.000Z",
        "citationText": "I will handle the database schema. I can have it done by Friday.",
        "citationTimestamp": "00:01:30",
        "citationSpeaker": "Bob Smith"
      }
    ],
    "decisions": [
      {
        "description": "PostgreSQL selected as the database",
        "citationText": "We decided to use PostgreSQL for all data storage.",
        "citationTimestamp": "00:02:00",
        "citationSpeaker": "Alice Johnson"
      }
    ],
    "followUpSuggestions": [
      "Schedule a follow-up to review the completed database schema before Friday",
      "Clarify what 'end of week' means for the API design deadline"
    ]
  }
}
```

### 4. Get Overdue Action Items

```bash
curl http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer YOUR_JWT"
```

### 5. Update Action Item Status

```bash
curl -X PATCH http://localhost:3000/api/action-items/ITEM_ID/status \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "status": "COMPLETED" }'
```

---

## Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Create new project on [railway.app](https://railway.app)
3. Add a PostgreSQL plugin
4. Deploy from GitHub repo
5. Set environment variables in Railway dashboard
6. Railway auto-detects Node.js and runs `npm run build && npm start`

Add to `package.json` if needed:
```json
"postinstall": "npx prisma generate"
```

### Render

1. Create a new Web Service pointing to your repo
2. Build command: `npm install && npx prisma generate && npm run build`
3. Start command: `npx prisma migrate deploy && node dist/server.js`
4. Add environment variables in Render dashboard

---

## Docker

```bash
# Copy and fill in .env
cp .env.example .env

# Start everything (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

The app will be available at `http://localhost:3000`.
