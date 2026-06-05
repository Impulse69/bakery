import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// Map low-level SQLite/Prisma failures to a clear, human-readable cause so the
// desktop toast shows WHY a write failed instead of a generic 500. Never exposes
// a stack trace or secrets — only a short, safe explanation.
function classifyError(err: unknown): string | null {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code ?? e?.cause?.code;
  const text = `${e?.message ?? ''} ${e?.cause?.message ?? ''}`.toLowerCase();

  if (code === 'SQLITE_READONLY' || text.includes('readonly') || text.includes('read-only')) {
    return 'Database is read-only — the data file is not writable. Restart the app to let it repair itself; if it persists, the database file may be blocked by antivirus or marked read-only.';
  }
  if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || text.includes('database is locked') || text.includes('locked')) {
    return 'Database is locked by another program (often antivirus or a backup tool). Close other apps using the data and try again.';
  }
  if (code === 'SQLITE_FULL' || text.includes('disk is full') || text.includes('database or disk is full')) {
    return 'The disk is full. Free up some space and try again.';
  }
  if (code === 'SQLITE_CANTOPEN' || text.includes('unable to open database')) {
    return 'The database file could not be opened. Restart the app to let it repair the data folder.';
  }
  if (code === 'P2002' || text.includes('unique constraint')) {
    return 'That item already exists (a unique field is duplicated).';
  }
  return null;
}

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Request validation failures are client errors (400), not server errors.
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request' });
    return;
  }

  const code = (err as { code?: string })?.code;
  logger.error({ err, code }, 'Unhandled server error');

  const friendly = classifyError(err);
  res.status(500).json({ error: friendly ?? 'Internal server error', code });
}
