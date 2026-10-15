import { Router } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
export function authRoutes() {
  const router = Router();
  router.get('/me', (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError('Please sign in to continue'));
    res.json({ success: true, data: req.user });
  });
  router.get('/switchable-users', (_req, res) => res.json({ success: true, data: [] }));
  router.post('/switch-user', (_req, _res, next) => next(new ForbiddenError('Sign in with the account you want to use')));
  return router;
}
