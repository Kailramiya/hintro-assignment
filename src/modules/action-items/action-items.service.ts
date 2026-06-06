import { ActionItemStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { createError } from '../../middleware/error';
import { CreateActionItemInput, UpdateStatusInput } from './action-items.schema';

const MAX_PAGE_SIZE = 100;

export async function createActionItem(input: CreateActionItemInput, userId: string) {
  // If meetingId provided, verify the meeting belongs to this user
  if (input.meetingId) {
    const meeting = await prisma.meeting.findUnique({ where: { id: input.meetingId } });
    if (!meeting) throw createError('Meeting not found', 404, 'NOT_FOUND');
    if (meeting.createdById !== userId) throw createError('Forbidden', 403, 'FORBIDDEN');
  }

  return prisma.actionItem.create({
    data: {
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      assigneeEmail: input.assigneeEmail,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      meetingId: input.meetingId,
    },
  });
}

export async function listActionItems(
  userId: string,
  page: number,
  limit: number,
  status?: string,
  assignee?: string,
  meetingId?: string
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const skip = (safePage - 1) * safeLimit;

  // Base where: items from meetings created by this user OR standalone items
  const where = {
    OR: [
      { meeting: { createdById: userId } },
      { meetingId: null }, // standalone items — no meeting ownership to check
    ],
    ...(status ? { status: status as ActionItemStatus } : {}),
    ...(assignee ? { assignee: { contains: assignee, mode: 'insensitive' as const } } : {}),
    ...(meetingId ? { meetingId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.actionItem.count({ where }),
    prisma.actionItem.findMany({
      where,
      include: { meeting: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
  ]);

  return {
    actionItems: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getOverdueActionItems(userId: string) {
  return prisma.actionItem.findMany({
    where: {
      OR: [
        { meeting: { createdById: userId } },
        { meetingId: null },
      ],
      status: { not: 'COMPLETED' },
      dueDate: { lt: new Date() },
    },
    include: { meeting: { select: { id: true, title: true } } },
    orderBy: { dueDate: 'asc' },
  });
}

export async function updateActionItemStatus(
  itemId: string,
  input: UpdateStatusInput,
  userId: string
) {
  const item = await prisma.actionItem.findUnique({
    where: { id: itemId },
    include: { meeting: true },
  });

  if (!item) throw createError('Action item not found', 404, 'NOT_FOUND');

  if (item.meeting && item.meeting.createdById !== userId) {
    throw createError('Forbidden', 403, 'FORBIDDEN');
  }

  return prisma.actionItem.update({
    where: { id: itemId },
    data: { status: input.status },
  });
}
