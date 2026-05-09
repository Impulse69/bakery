import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

if (!process.env.JWT_SECRET) {
  console.error('CRITICAL ERROR: JWT_SECRET environment variable is not defined.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

export { JWT_SECRET };

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    prisma.user
      .findUnique({ where: { id: payload.userId } })
      .then((user) => {
        if (!user || !user.isActive) {
          res.status(401).json({ error: 'User not found or inactive' });
          return;
        }
        req.user = user;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
