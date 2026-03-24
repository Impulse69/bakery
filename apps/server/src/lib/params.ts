import type { Request } from 'express';
import { AppError } from '../middleware/errorHandler.js';

export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0];
  if (!value) throw new AppError(400, `Missing parameter: ${name}`);
  return value;
}
