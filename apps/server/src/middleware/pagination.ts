import type { Request, Response, NextFunction } from 'express';

export function paginationMiddleware(req: Request, _res: Response, next: NextFunction) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };

  next();
}
