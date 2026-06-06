import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createMeetingSchema } from './meetings.schema';
import {
  createMeetingController,
  getMeetingController,
  listMeetingsController,
  analyzeMeetingController,
} from './meetings.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createMeetingSchema), createMeetingController);
router.get('/', listMeetingsController);
router.get('/:id', getMeetingController);
router.post('/:id/analyze', analyzeMeetingController);

export default router;
