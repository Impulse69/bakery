import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      pagination: { skip: number; take: number; page: number; limit: number };
    }
  }
}
