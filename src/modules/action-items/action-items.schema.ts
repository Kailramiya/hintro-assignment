import { z } from 'zod';

export const createActionItemSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(300),
  description: z.string().max(2000).optional(),
  assignee: z.string().min(1, 'Assignee name is required').max(100),
  assigneeEmail: z.string().email('Invalid assignee email').optional(),
  dueDate: z.string().datetime('dueDate must be a valid ISO 8601 datetime').optional(),
  meetingId: z.string().uuid('meetingId must be a valid UUID').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be PENDING, IN_PROGRESS, or COMPLETED' }),
  }),
});

export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
