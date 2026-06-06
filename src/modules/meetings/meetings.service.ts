import { prisma } from '../../config/database';
import { createError } from '../../middleware/error';
import { analyzeMeeting } from '../../services/ai/gemini.service';
import { CreateMeetingInput } from './meetings.schema';
import { TranscriptEntry, Participant } from '../../types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function createMeeting(input: CreateMeetingInput, userId: string) {
  return prisma.meeting.create({
    data: {
      title: input.title,
      meetingDate: new Date(input.meetingDate),
      participants: input.participants,
      transcript: input.transcript,
      createdById: userId,
    },
    select: {
      id: true,
      title: true,
      participants: true,
      meetingDate: true,
      transcript: true,
      analyzedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getMeeting(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      analysis: true,
      actionItems: {
        orderBy: { createdAt: 'asc' },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!meeting) throw createError('Meeting not found', 404, 'NOT_FOUND');
  if (meeting.createdById !== userId) throw createError('Forbidden', 403, 'FORBIDDEN');

  return meeting;
}

export async function listMeetings(
  userId: string,
  page: number,
  limit: number,
  from?: string,
  to?: string
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const skip = (safePage - 1) * safeLimit;

  const where = {
    createdById: userId,
    ...(from || to
      ? {
          meetingDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [total, meetings] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      select: {
        id: true,
        title: true,
        participants: true,
        meetingDate: true,
        analyzedAt: true,
        createdAt: true,
        _count: { select: { actionItems: true } },
      },
      orderBy: { meetingDate: 'desc' },
      skip,
      take: safeLimit,
    }),
  ]);

  return {
    meetings,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function runAnalysis(meetingId: string, userId: string, traceId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { analysis: true },
  });

  if (!meeting) throw createError('Meeting not found', 404, 'NOT_FOUND');
  if (meeting.createdById !== userId) throw createError('Forbidden', 403, 'FORBIDDEN');
  if (meeting.analysis) throw createError('Meeting has already been analyzed', 409, 'ALREADY_ANALYZED');

  const participants = meeting.participants as unknown as Participant[];
  const transcript = meeting.transcript as unknown as TranscriptEntry[];

  const aiResult = await analyzeMeeting(
    traceId,
    meetingId,
    meeting.title,
    meeting.meetingDate,
    participants,
    transcript
  );

  // Persist analysis + action items in a single transaction
  const [analysis] = await prisma.$transaction([
    prisma.meetingAnalysis.create({
      data: {
        meetingId,
        summary: aiResult.summary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decisions: aiResult.decisions as unknown as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        followUpSuggestions: aiResult.followUpSuggestions as unknown as any,
      },
    }),
    prisma.meeting.update({
      where: { id: meetingId },
      data: { analyzedAt: new Date() },
    }),
    ...aiResult.actionItems.map((item) =>
      prisma.actionItem.create({
        data: {
          meetingId,
          title: item.title,
          description: item.description,
          assignee: item.assignee,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          citationText: item.citationText,
          citationTimestamp: item.citationTimestamp,
          citationSpeaker: item.citationSpeaker,
        },
      })
    ),
  ]);

  return {
    analysis,
    actionItemsCreated: aiResult.actionItems.length,
    summary: aiResult.summary,
    decisions: aiResult.decisions,
    followUpSuggestions: aiResult.followUpSuggestions,
    actionItems: aiResult.actionItems,
  };
}
