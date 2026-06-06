import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './auth.schema';
import { registerController, loginController } from './auth.controller';

const router = Router();

router.post('/register', validate(registerSchema), registerController);
router.post('/login', validate(loginSchema), loginController);

export default router;
