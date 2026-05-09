import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { logger } from '../lib/logger.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    if (!user.isActive) throw new AppError(403, 'Account is disabled');

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  }),
);

// GET /api/auth/me
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { passwordHash: _, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  }),
);

export default router;
