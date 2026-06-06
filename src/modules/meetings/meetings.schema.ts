import { z } from 'zod';

const participantSchema = z.object({
  name: z.string().min(1, 'Participant name is required'),
  email: z.string().email('Invalid participant email').optional(),
});

const transcriptEntrySchema = z.object({
  speaker: z.string().min(1, 'Speaker name is required'),
  text: z.string().min(1, 'Transcript text is required'),
  timestamp: z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, 'Timestamp must be in HH:MM:SS format'),
});

export const createMeetingSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  meetingDate: z.string().datetime('meetingDate must be a valid ISO 8601 datetime'),
  participants: z
    .array(participantSchema)
    .min(1, 'At least one participant is required'),
  transcript: z
    .array(transcriptEntrySchema)
    .min(1, 'Transcript must have at least one entry'),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
