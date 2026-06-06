# Testing Guide

This document covers manual test scenarios, edge cases discovered during development, and known limitations.

---

## Test Environment Setup

```bash
# Start the server
npm run dev

# Set a JWT token (after registering/logging in)
TOKEN="your-jwt-token-here"
BASE="http://localhost:3000"
```

---

## Auth Scenarios

### Happy Path

```bash
# Register
curl -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"password123"}'

# Login
curl -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Validation Edge Cases

| Scenario | Expected Code | Expected Error |
|---|---|---|
| Missing email | 422 | `VALIDATION_ERROR` — email required |
| Invalid email format (`notanemail`) | 422 | `VALIDATION_ERROR` — invalid email |
| Password under 8 chars | 422 | `VALIDATION_ERROR` — min 8 chars |
| Duplicate email registration | 409 | `EMAIL_CONFLICT` |
| Wrong password on login | 401 | `INVALID_CREDENTIALS` |
| Missing Authorization header | 401 | `UNAUTHORIZED` |
| Malformed token (`Bearer notaToken`) | 401 | `INVALID_TOKEN` |

---

## Meeting Scenarios

### Create Meeting

```bash
curl -X POST $BASE/api/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Review",
    "meetingDate": "2024-12-01T10:00:00Z",
    "participants": [
      {"name":"Alice Johnson","email":"alice@test.com"},
      {"name":"Bob Smith","email":"bob@test.com"}
    ],
    "transcript": [
      {"speaker":"Alice Johnson","text":"We shipped the login feature successfully.","timestamp":"00:01:00"},
      {"speaker":"Bob Smith","text":"I will write unit tests for the auth module by Wednesday.","timestamp":"00:01:45"},
      {"speaker":"Alice Johnson","text":"We decided to postpone the dashboard feature to next sprint.","timestamp":"00:02:30"}
    ]
  }'
```

### Validation Edge Cases

| Scenario | Expected |
|---|---|
| Invalid `meetingDate` (not ISO) | 422 VALIDATION_ERROR |
| `participants: []` | 422 — at least 1 required |
| `transcript: []` | 422 — at least 1 required |
| Transcript entry missing `timestamp` | 422 |
| Timestamp format `01:00` (not HH:MM:SS) | 422 |
| `GET /api/meetings/nonexistent-uuid` | 404 NOT_FOUND |
| Accessing another user's meeting | 403 FORBIDDEN |

---

## AI Analysis Scenarios

### Full Analysis Flow

```bash
# Create meeting (save the returned ID)
MEETING_ID="<id-from-create>"

# Run analysis
curl -X POST $BASE/api/meetings/$MEETING_ID/analyze \
  -H "Authorization: Bearer $TOKEN"
```

### Edge Cases

| Scenario | Expected |
|---|---|
| Analyze same meeting twice | 409 ALREADY_ANALYZED |
| Transcript with no action items | Analysis succeeds, `actionItems: []` |
| Transcript with only one speaker | Only that speaker can be assignee |
| Transcript mentioning a person who never spoke | That person NOT assigned (hallucination filter) |
| Very short transcript (1 line) | Summary generated, actionItems likely empty |

### Citation Verification

After analysis, manually verify:
1. Each `citationText` appears verbatim in the original transcript
2. Each `citationTimestamp` matches a real transcript entry
3. Each action item `assignee` is a speaker in the transcript
4. No participants who never spoke are referenced

---

## Action Item Scenarios

### Status Transitions

```bash
# Create standalone action item
curl -X POST $BASE/api/action-items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Write documentation",
    "assignee": "Alice Johnson",
    "assigneeEmail": "alice@test.com",
    "dueDate": "2024-11-01T00:00:00Z"
  }'

# Update to IN_PROGRESS
curl -X PATCH $BASE/api/action-items/$ITEM_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'

# Update to COMPLETED
curl -X PATCH $BASE/api/action-items/$ITEM_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}'
```

### Filtering

```bash
# By status
curl "$BASE/api/action-items?status=PENDING" -H "Authorization: Bearer $TOKEN"

# By assignee (case-insensitive partial match)
curl "$BASE/api/action-items?assignee=alice" -H "Authorization: Bearer $TOKEN"

# By meeting
curl "$BASE/api/action-items?meetingId=$MEETING_ID" -H "Authorization: Bearer $TOKEN"

# Overdue
curl "$BASE/api/action-items/overdue" -H "Authorization: Bearer $TOKEN"
```

### Validation Edge Cases

| Scenario | Expected |
|---|---|
| `status: "DONE"` | 422 — must be PENDING/IN_PROGRESS/COMPLETED |
| `assigneeEmail: "notanemail"` | 422 VALIDATION_ERROR |
| `dueDate: "not-a-date"` | 422 VALIDATION_ERROR |
| Invalid `meetingId` (bad UUID) | 422 VALIDATION_ERROR |
| `meetingId` pointing to non-existent meeting | 404 NOT_FOUND |

---

## System Endpoints

```bash
curl $BASE/health
# { "status": "UP", "database": "connected" }

curl $BASE/api/evaluation
# Returns candidateName, features list, etc.

curl $BASE/api-docs
# Opens Swagger UI
```

---

## Pagination

```bash
# Page 1, 5 items
curl "$BASE/api/meetings?page=1&limit=5" -H "Authorization: Bearer $TOKEN"

# Page 2
curl "$BASE/api/meetings?page=2&limit=5" -H "Authorization: Bearer $TOKEN"

# Date filter
curl "$BASE/api/meetings?from=2024-01-01&to=2024-12-31" -H "Authorization: Bearer $TOKEN"
```

Response always includes:
```json
{
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "totalPages": 3
  }
}
```

---

## Limitations Discovered

1. **Re-analysis not supported**: Once a meeting is analyzed, re-running returns 409. Intentional — prevents duplicate action items. A `?force=true` parameter would require cleanup logic.

2. **No action item ownership for standalone items**: Standalone action items (no `meetingId`) are currently accessible to all authenticated users in list queries. In production, they'd be linked to the creating user.

3. **Scheduler runs in-process**: If the app scales to multiple instances, each runs its own cron job. The `reminderSentAt` field acts as a soft deduplication guard.

4. **AI latency**: The analyze endpoint is synchronous — it waits for Gemini to respond (~2-5s). In production, this would be moved to a background job queue with a webhook/polling pattern.

5. **JWT revocation**: Tokens cannot be invalidated before expiry without a blocklist. Log out is client-side only (discard the token).
