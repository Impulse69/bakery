import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // If 'owner' is NOT explicitly listed in allowed roles,
    // then owner is read-only for this route.
    if (user.role === 'owner' && !roles.includes('owner') && req.method !== 'GET') {
      res.status(403).json({ error: 'Owner has read-only access to this resource' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
