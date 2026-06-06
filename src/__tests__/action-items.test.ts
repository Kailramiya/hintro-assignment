import request from 'supertest';
import app from '../app';
import { generateToken, TEST_USER, OTHER_USER } from './helpers/auth.helper';
import { SAMPLE_MEETING, SAMPLE_ACTION_ITEM, MEETING_ID } from './helpers/fixtures';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../config/database', () => ({
  prisma: {
    meeting: { findUnique: jest.fn() },
    actionItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

import { prisma } from '../config/database';

const mockMeeting = prisma.meeting as jest.Mocked<typeof prisma.meeting>;
const mockActionItem = prisma.actionItem as jest.Mocked<typeof prisma.actionItem>;

const TOKEN = `Bearer ${generateToken()}`;

// ─── Create Action Item ───────────────────────────────────────────────────────

describe('POST /api/action-items', () => {
  it('creates a standalone action item (no meetingId) and returns 201', async () => {
    mockActionItem.create.mockResolvedValue(SAMPLE_ACTION_ITEM as never);

    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({
        title: 'Write unit tests',
        assignee: 'Alice Johnson',
        assigneeEmail: 'alice@example.com',
        dueDate: '2024-12-15T00:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('creates an action item linked to a meeting', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      createdById: TEST_USER.id,
    } as never);
    mockActionItem.create.mockResolvedValue(SAMPLE_ACTION_ITEM as never);

    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({
        title: 'Complete database schema',
        assignee: 'Bob Smith',
        meetingId: SAMPLE_MEETING.id,
      });

    expect(res.status).toBe(201);
  });

  it('returns 404 when linked meetingId does not exist', async () => {
    mockMeeting.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({
        title: 'Some task',
        assignee: 'Alice',
        meetingId: 'f6a7b8c9-d0e1-2345-fabc-d01234567892', // valid UUID, but not in DB
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when linked meeting belongs to another user', async () => {
    mockMeeting.findUnique.mockResolvedValue({
      ...SAMPLE_MEETING,
      createdById: OTHER_USER.id,
    } as never);

    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({
        title: 'Some task',
        assignee: 'Alice',
        meetingId: MEETING_ID,
      });

    expect(res.status).toBe(403);
  });

  it('returns 422 when title is missing', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({ assignee: 'Alice Johnson' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('title');
  });

  it('returns 422 when assignee is missing', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({ title: 'Do something' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('assignee');
  });

  it('returns 422 for invalid assigneeEmail format', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({ title: 'Task', assignee: 'Alice', assigneeEmail: 'notanemail' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('assigneeEmail');
  });

  it('returns 422 for invalid dueDate format', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({ title: 'Task', assignee: 'Alice', dueDate: 'next-friday' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid meetingId (not UUID)', async () => {
    const res = await request(app)
      .post('/api/action-items')
      .set('Authorization', TOKEN)
      .send({ title: 'Task', assignee: 'Alice', meetingId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });
});

// ─── List Action Items ────────────────────────────────────────────────────────

describe('GET /api/action-items', () => {
  it('returns paginated action item list', async () => {
    mockActionItem.count.mockResolvedValue(3);
    mockActionItem.findMany.mockResolvedValue([
      { ...SAMPLE_ACTION_ITEM, meeting: { id: SAMPLE_MEETING.id, title: SAMPLE_MEETING.title } },
      { ...SAMPLE_ACTION_ITEM, id: 'item-2', title: 'Another task', meeting: null },
      { ...SAMPLE_ACTION_ITEM, id: 'item-3', title: 'Third task', meeting: null },
    ] as never);

    const res = await request(app)
      .get('/api/action-items?page=1&limit=10')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.actionItems).toHaveLength(3);
    expect(res.body.data.pagination.total).toBe(3);
  });

  it('filters by status=PENDING', async () => {
    mockActionItem.count.mockResolvedValue(1);
    mockActionItem.findMany.mockResolvedValue([SAMPLE_ACTION_ITEM] as never);

    const res = await request(app)
      .get('/api/action-items?status=PENDING')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.actionItems[0].status).toBe('PENDING');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/action-items');
    expect(res.status).toBe(401);
  });
});

// ─── Overdue Action Items ─────────────────────────────────────────────────────

describe('GET /api/action-items/overdue', () => {
  it('returns all overdue action items', async () => {
    const overdueItem = {
      ...SAMPLE_ACTION_ITEM,
      dueDate: new Date('2024-01-01'), // in the past
      status: 'PENDING',
      meeting: { id: SAMPLE_MEETING.id, title: SAMPLE_MEETING.title },
    };
    mockActionItem.findMany.mockResolvedValue([overdueItem] as never);

    const res = await request(app)
      .get('/api/action-items/overdue')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.actionItems).toHaveLength(1);
    expect(res.body.data.count).toBe(1);
  });

  it('returns empty list when no overdue items exist', async () => {
    mockActionItem.findMany.mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/action-items/overdue')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/action-items/overdue');
    expect(res.status).toBe(401);
  });
});

// ─── Update Status ────────────────────────────────────────────────────────────

describe('PATCH /api/action-items/:id/status', () => {
  it('updates status to IN_PROGRESS', async () => {
    mockActionItem.findUnique.mockResolvedValue({
      ...SAMPLE_ACTION_ITEM,
      meeting: { ...SAMPLE_MEETING, createdById: TEST_USER.id },
    } as never);
    mockActionItem.update.mockResolvedValue({
      ...SAMPLE_ACTION_ITEM,
      status: 'IN_PROGRESS',
    } as never);

    const res = await request(app)
      .patch(`/api/action-items/${SAMPLE_ACTION_ITEM.id}/status`)
      .set('Authorization', TOKEN)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('updates status to COMPLETED', async () => {
    mockActionItem.findUnique.mockResolvedValue({
      ...SAMPLE_ACTION_ITEM,
      meeting: { ...SAMPLE_MEETING, createdById: TEST_USER.id },
    } as never);
    mockActionItem.update.mockResolvedValue({
      ...SAMPLE_ACTION_ITEM,
      status: 'COMPLETED',
    } as never);

    const res = await request(app)
      .patch(`/api/action-items/${SAMPLE_ACTION_ITEM.id}/status`)
      .set('Authorization', TOKEN)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  it('returns 422 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/action-items/${SAMPLE_ACTION_ITEM.id}/status`)
      .set('Authorization', TOKEN)
      .send({ status: 'DONE' }); // invalid

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when status is missing', async () => {
    const res = await request(app)
      .patch(`/api/action-items/${SAMPLE_ACTION_ITEM.id}/status`)
      .set('Authorization', TOKEN)
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns 404 when action item does not exist', async () => {
    mockActionItem.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/action-items/nonexistent-id/status')
      .set('Authorization', TOKEN)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when action item meeting belongs to another user', async () => {
    mockActionItem.findUnique.mockResolvedValue({
      ...SAMPLE_ACTION_ITEM,
      meeting: { ...SAMPLE_MEETING, createdById: OTHER_USER.id },
    } as never);

    const res = await request(app)
      .patch(`/api/action-items/${SAMPLE_ACTION_ITEM.id}/status`)
      .set('Authorization', TOKEN)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(403);
  });
});
