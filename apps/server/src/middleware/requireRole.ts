import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Owner can only use GET — read-only access
    if (user.role === 'owner' && req.method !== 'GET') {
      res.status(403).json({ error: 'Owner has read-only access' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
