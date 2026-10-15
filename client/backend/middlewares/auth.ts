import type { Request, Response, NextFunction } from 'express';
import type { UserRecord } from '../db/repositories/userRepo.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
declare global { namespace Express { interface Request { user?: UserRecord; } } }
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError('Please sign in to continue');
  next();
}
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError('Please sign in to continue');
  if (req.user.role !== 'admin') throw new ForbiddenError('Administrator privileges required');
  next();
}
