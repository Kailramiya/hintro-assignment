import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface ReminderPayload {
  to: string;
  assignee: string;
  actionItemTitle: string;
  actionItemDescription: string | null;
  dueDate: Date;
  meetingTitle?: string;
}

export async function sendOverdueReminder(payload: ReminderPayload): Promise<boolean> {
  if (!resend) {
    logger.warn('Resend not configured — skipping email notification');
    return false;
  }

  const dueDateStr = payload.dueDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 24px;">
    <h2 style="color: #dc3545; margin-top: 0;">⚠️ Overdue Action Item</h2>
    <p>Hi <strong>${payload.assignee}</strong>,</p>
    <p>You have an overdue action item that requires your attention:</p>
    <div style="background: white; border-left: 4px solid #dc3545; padding: 16px; border-radius: 4px; margin: 16px 0;">
      <h3 style="margin-top: 0;">${payload.actionItemTitle}</h3>
      ${payload.actionItemDescription ? `<p style="color: #666;">${payload.actionItemDescription}</p>` : ''}
      ${payload.meetingTitle ? `<p style="font-size: 0.85em; color: #888;">From meeting: <em>${payload.meetingTitle}</em></p>` : ''}
      <p style="color: #dc3545; font-weight: bold;">Due: ${dueDateStr}</p>
    </div>
    <p>Please update the status of this action item as soon as possible.</p>
    <p style="font-size: 0.8em; color: #999; margin-bottom: 0;">
      This is an automated reminder from Meeting Intelligence.
    </p>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: payload.to,
      subject: `[Overdue] ${payload.actionItemTitle}`,
      html,
    });

    if (error) {
      logger.error('Resend API error', { error: error.message });
      return false;
    }

    logger.info('Reminder email sent', { to: payload.to, title: payload.actionItemTitle });
    return true;
  } catch (err) {
    logger.error('Failed to send reminder email', { error: String(err) });
    return false;
  }
}
