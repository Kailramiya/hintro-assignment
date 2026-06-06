import request from 'supertest';
import app from '../app';
import { generateToken, TEST_USER, OTHER_USER } from './helpers/auth.helper';
import {
  SAMPLE_MEETING,
  SAMPLE_TRANSCRIPT,
  SAMPLE_PARTICIPANTS,
  SAMPLE_ANALYSIS,
  SAMPLE_ACTION_ITEM,
  AI_ANALYSIS_RESULT,
} from './helpers/fixtures';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({
  prisma: {
    meeting: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    meetingAnalysis: { create: jest.fn() },
    actionItem: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('../services/ai/gemini.service', () => ({
  analyzeMeeting: jest.fn(),
}));

import { prisma } from '../config/database';
import { analyzeMeeting } from '../services/ai/gemini.service';

const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>;
const mockAnalysis = prisma.meetingAnalysis as jest.Mocked<typeof prisma.meetingAnalysis>;
const mockGemini = analyzeMeeting as jest.MockedFunction<typeof analyzeMeeting>;

const TOKEN = `Bearer ${generateToken()}`;

const VALID_MEETING_PAYLOAD = {
  title: 'Q4 Sprint Planning',
  meetingDate: '2024-12-01T10:00:00Z',
  participants: SAMPLE_PARTICIPANTS,
  transcript: SAMPLE_TRANSCRIPT,
};

// ─── Create Meeting ───────────────────────────────────────────────────────────

describe('POST /api/meetings', () => {
  it('creates a meeting and returns 201', async () => {
    mockMeeting.create.mockResolvedValue({
      ...SAMPLE_MEETING,
      createdBy: { id: TEST_USER.id, name: TEST_USER.name, email: TEST_USER.email },
    } as never);

    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send(VALID_MEETING_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Q4 Sprint Planning');
    expect(res.body.traceId).toBeDefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/meetings').send(VALID_MEETING_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it('returns 422 when title is missing', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({ ...VALID_MEETING_PAYLOAD, title: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('title');
  });

  it('returns 422 when meetingDate is not ISO format', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({ ...VALID_MEETING_PAYLOAD, meetingDate: 'December 1 2024' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('meetingDate');
  });

  it('returns 422 when participants array is empty', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({ ...VALID_MEETING_PAYLOAD, participants: [] });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('participants');
  });

  it('returns 422 when transcript array is empty', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({ ...VALID_MEETING_PAYLOAD, transcript: [] });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('transcript');
  });

  it('returns 422 when transcript entry has wrong timestamp format', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({
        ...VALID_MEETING_PAYLOAD,
        transcript: [{ speaker: 'Alice', text: 'Hello', timestamp: '1:00' }],
      });

    expect(res.status).toBe(422);
  });

  it('returns 422 when participant email is invalid', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Authorization', TOKEN)
      .send({
        ...VALID_MEETING_PAYLOAD,
        participants: [{ name: 'Alice', email: 'not-an-email' }],
      });

    expect(res.status).toBe(422);
  });
});

// ─── List Meetings ────────────────────────────────────────────────────────────

describe('GET /api/meetings', () => {
  it('returns paginated meeting list', async () => {
    mockMeeting.count.mockResolvedValue(2);
    mockMeeting.findMany.mockResolvedValue([
      { ...SAMPLE_MEETING, _count: { actionItems: 3 } },
      { ...SAMPLE_MEETING, id: 'meeting-2', title: 'Team Sync', _count: { actionItems: 0 } },
    ] as never);

    const res = await request(app)
      .get('/api/meetings?page=1&limit=10')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.meetings).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.totalPages).toBe(1);
  });

  it('returns empty list when no meetings exist', async () => {
    mockMeeting.count.mockResolvedValue(0);
    mockMeeting.findMany.mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/meetings')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.meetings).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/meetings');
    expect(res.status).toBe(401);
  });
});

// ─── Get Single Meeting ───────────────────────────────────────────────────────

describe('GET /api/meetings/:id', () => {
  it('returns a meeting with analysis and action items', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      analysis: SAMPLE_ANALYSIS,
      actionItems: [SAMPLE_ACTION_ITEM],
      createdBy: { id: TEST_USER.id, name: TEST_USER.name, email: TEST_USER.email },
    } as never);

    const res = await request(app)
      .get(`/api/meetings/${SAMPLE_MEETING.id}`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(SAMPLE_MEETING.id);
    expect(res.body.data.analysis).toBeDefined();
    expect(res.body.data.actionItems).toHaveLength(1);
  });

  it('returns 404 when meeting does not exist', async () => {
    mockMeeting.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/meetings/nonexistent-id')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when meeting belongs to another user', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      createdById: OTHER_USER.id, // different user
      analysis: null,
      actionItems: [],
      createdBy: { id: OTHER_USER.id, name: OTHER_USER.name, email: OTHER_USER.email },
    } as never);

    const res = await request(app)
      .get(`/api/meetings/${SAMPLE_MEETING.id}`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Analyze Meeting ──────────────────────────────────────────────────────────

describe('POST /api/meetings/:id/analyze', () => {
  it('runs AI analysis and returns structured insights with citations', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      analysis: null, // not yet analyzed
    } as never);

    mockGemini.mockResolvedValue(AI_ANALYSIS_RESULT);

    // $transaction returns [analysis, ...rest]
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops)
    );
    mockAnalysis.create.mockResolvedValue(SAMPLE_ANALYSIS as never);
    (prisma.actionItem.create as jest.Mock).mockResolvedValue(SAMPLE_ACTION_ITEM as never);
    mockMeeting.update.mockResolvedValue({ ...SAMPLE_MEETING, analyzedAt: new Date() } as never);

    const res = await request(app)
      .post(`/api/meetings/${SAMPLE_MEETING.id}/analyze`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.actionItems).toBeDefined();
    expect(res.body.data.decisions).toBeDefined();
    expect(res.body.data.actionItemsCreated).toBe(1);

    // Verify AI was called with the correct meeting data
    expect(mockGemini).toHaveBeenCalledWith(
      expect.any(String),  // traceId
      SAMPLE_MEETING.id,
      SAMPLE_MEETING.title,
      SAMPLE_MEETING.meetingDate,
      expect.any(Array),   // participants
      expect.any(Array)    // transcript
    );
  });

  it('returns 409 when meeting has already been analyzed', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      analysis: SAMPLE_ANALYSIS, // already analyzed
    } as never);

    const res = await request(app)
      .post(`/api/meetings/${SAMPLE_MEETING.id}/analyze`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ANALYZED');
    // Gemini should NOT have been called
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it('returns 404 when meeting does not exist', async () => {
    mockMeeting.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/meetings/nonexistent-id/analyze')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(404);
  });

  it('returns 403 when meeting belongs to another user', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      createdById: OTHER_USER.id,
      analysis: null,
    } as never);

    const res = await request(app)
      .post(`/api/meetings/${SAMPLE_MEETING.id}/analyze`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(403);
  });
});
