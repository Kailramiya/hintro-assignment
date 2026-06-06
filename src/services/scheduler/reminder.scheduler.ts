import cron from 'node-cron';
import { prisma } from '../../config/database';
import { sendOverdueReminder } from '../notifications/email.service';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Meeting } from '@prisma/client';

async function processOverdueItems(): Promise<void> {
  const traceId = uuidv4();
  logger.info('Scheduler: checking for overdue action items', { traceId });

  try {
    const overdueItems = await prisma.actionItem.findMany({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() },
        assigneeEmail: { not: null },
      },
      include: { meeting: true },
    });

    if (overdueItems.length === 0) {
      logger.info('Scheduler: no overdue items found', { traceId });
      return;
    }

    logger.info('Scheduler: found overdue items', { traceId, count: overdueItems.length });

    for (const item of overdueItems) {
      if (!item.assigneeEmail) continue;

      const success = await sendOverdueReminder({
        to: item.assigneeEmail,
        assignee: item.assignee,
        actionItemTitle: item.title,
        actionItemDescription: item.description,
        dueDate: item.dueDate!,
        meetingTitle: (item.meeting as Meeting | null)?.title,
      });

      await prisma.reminderHistory.create({
        data: {
          actionItemId: item.id,
          channel: 'email',
          recipient: item.assigneeEmail,
          status: success ? 'sent' : 'failed',
          metadata: { traceId },
        },
      });

      if (success) {
        await prisma.actionItem.update({
          where: { id: item.id },
          data: { reminderSentAt: new Date() },
        });
      }
    }

    logger.info('Scheduler: reminder run complete', { traceId, processed: overdueItems.length });
  } catch (err) {
    logger.error('Scheduler: error processing overdue items', { traceId, error: String(err) });
  }
}

export function startScheduler(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', processOverdueItems, {
    timezone: 'UTC',
  });

  logger.info('Reminder scheduler started (runs every hour at :00)');
}
