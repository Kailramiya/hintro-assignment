import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import {
  createActionItem,
  listActionItems,
  getOverdueActionItems,
  updateActionItemStatus,
} from './action-items.service';
import { CreateActionItemInput, UpdateStatusInput } from './action-items.schema';

export async function createActionItemController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const item = await createActionItem(req.body as CreateActionItemInput, req.user!.userId);
    sendSuccess(res, item, 201);
  } catch (err) {
    next(err);
  }
}

export async function listActionItemsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const assignee = req.query.assignee as string | undefined;
    const meetingId = req.query.meetingId as string | undefined;

    const result = await listActionItems(req.user!.userId, page, limit, status, assignee, meetingId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getOverdueController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await getOverdueActionItems(req.user!.userId);
    sendSuccess(res, { actionItems: items, count: items.length });
  } catch (err) {
    next(err);
  }
}

export async function updateStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const item = await updateActionItemStatus(
      req.params['id'] as string,
      req.body as UpdateStatusInput,
      req.user!.userId
    );
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
}
