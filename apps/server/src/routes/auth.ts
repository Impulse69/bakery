import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { JWT_SECRET, authMiddleware } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
// import { logger } from '../lib/logger.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
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

// POST /api/auth/change-password — current user changes their own password.
// Clears the mustChangePassword flag on success.
router.post(
  '/change-password',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = req.user!;

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new AppError(400, 'New password must differ from current');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    res.json({ message: 'Password changed' });
  }),
);

// POST /api/auth/forgot-password — stub. Email infra isn't set up yet, so we
// always 202 with a "contact your admin" message. The wire is here so we can
// swap in real email reset later without a client change.
router.post(
  '/forgot-password',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    forgotPasswordSchema.parse(req.body); // validate shape, ignore result
    res.status(202).json({
      message: 'Contact your admin to reset your password from Settings → Users.',
    });
  }),
);

export default router;
