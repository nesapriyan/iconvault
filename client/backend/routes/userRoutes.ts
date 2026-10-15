import { Router } from 'express';
import { admin } from '@netlify/identity';
import { UserRepo } from '../db/repositories/userRepo.js';
import { requireAdmin } from '../middlewares/auth.js';
import { createUserSchema, updateUserSchema } from '../utils/validation.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
export function userRoutes() {
  const router = Router();
  router.use(requireAdmin);
  router.get('/', async (_req, res, next) => {
    try { res.json({ success: true, data: await UserRepo.findAll() }); } catch (err) { next(err); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await admin.createUser({ email: data.email, password: data.password,
        data: { user_metadata: { full_name: data.name }, app_metadata: { roles: data.role === 'admin' ? ['admin'] : [] } } });
      res.status(201).json({ success: true, data: await UserRepo.sync(user) });
    } catch (err) { next(err); }
  });
  router.put('/:id', async (req, res, next) => {
    try {
      const data = updateUserSchema.parse(req.body);
      const current = await UserRepo.findById(req.params.id);
      if (!current) throw new NotFoundError('User not found');
      if (current.role === 'admin' && data.role === 'user' && (await UserRepo.findAll()).filter(u => u.role === 'admin').length <= 1)
        throw new BadRequestError('Cannot remove the last administrator');
      const identity = await admin.getUser(current.id);
      const roles = (identity.roles || []).filter(role => role !== 'admin');
      if ((data.role || current.role) === 'admin') roles.push('admin');
      const user = await admin.updateUser(current.id, { email: data.email, password: data.password || undefined,
        user_metadata: { ...identity.userMetadata, full_name: data.name || current.name },
        app_metadata: { ...identity.appMetadata, roles } });
      res.json({ success: true, data: await UserRepo.sync(user) });
    } catch (err) { next(err); }
  });
  router.delete('/:id', async (req, res, next) => {
    try {
      if (req.params.id === req.user?.id) throw new BadRequestError('You cannot delete your own account');
      await admin.deleteUser(req.params.id);
      await UserRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (err) { next(err); }
  });
  return router;
}
