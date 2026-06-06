import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { createMeeting, getMeeting, listMeetings, runAnalysis } from './meetings.service';

export async function createMeetingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const meeting = await createMeeting(req.body, req.user!.userId);
    sendSuccess(res, meeting, 201);
  } catch (err) {
    next(err);
  }
}

export async function getMeetingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const meeting = await getMeeting(req.params['id'] as string, req.user!.userId);
    sendSuccess(res, meeting);
  } catch (err) {
    next(err);
  }
}

export async function listMeetingsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const result = await listMeetings(req.user!.userId, page, limit, from, to);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function analyzeMeetingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const traceId = req.traceId ?? 'unknown';
    const result = await runAnalysis(req.params['id'] as string, req.user!.userId, traceId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
