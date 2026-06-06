import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createActionItemSchema, updateStatusSchema } from './action-items.schema';
import {
  createActionItemController,
  listActionItemsController,
  getOverdueController,
  updateStatusController,
} from './action-items.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createActionItemSchema), createActionItemController);
// /overdue MUST be registered before /:id to avoid collision
router.get('/overdue', getOverdueController);
router.get('/', listActionItemsController);
router.patch('/:id/status', validate(updateStatusSchema), updateStatusController);

export default router;
