import { Router, Request, Response, NextFunction } from 'express';
import { UserRepo, toSafeUser } from '../db/repositories/userRepo.js';
import { createUserSchema, updateUserSchema } from '../utils/validation.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Protect all /api/users routes for admins only
router.use(requireAdmin);

// List all users
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = UserRepo.findAll();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// Create new user (Admin action)
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createUserSchema.parse(req.body);
    const existing = UserRepo.findByEmail(validated.email);
    if (existing) {
      throw new BadRequestError('A user with this email address already exists');
    }

    const created = UserRepo.create({
      email: validated.email,
      name: validated.name,
      password: validated.password,
      role: validated.role
    });

    res.status(201).json({ success: true, data: toSafeUser(created) });
  } catch (err) {
    next(err);
  }
});

// Update user (Admin action)
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateUserSchema.parse(req.body);
    const targetUser = UserRepo.findById(req.params.id);
    if (!targetUser) throw new NotFoundError('User not found');

    if (validated.email && validated.email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const existing = UserRepo.findByEmail(validated.email);
      if (existing && existing.id !== targetUser.id) {
        throw new BadRequestError('Email address already in use by another account');
      }
    }

    // Prevent demoting the last admin
    if (targetUser.role === 'admin' && validated.role === 'user') {
      const allAdmins = UserRepo.findAll().filter(u => u.role === 'admin');
      if (allAdmins.length <= 1) {
        throw new BadRequestError('Cannot remove the last administrator account');
      }
    }

    const updated = UserRepo.update(req.params.id, {
      name: validated.name,
      email: validated.email,
      password: validated.password,
      role: validated.role
    });

    res.json({ success: true, data: toSafeUser(updated!) });
  } catch (err) {
    next(err);
  }
});

// Delete user (Admin action)
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUser = UserRepo.findById(req.params.id);
    if (!targetUser) throw new NotFoundError('User not found');

    // Prevent self-deletion
    if (req.user && req.user.id === targetUser.id) {
      throw new BadRequestError('You cannot delete your own account while logged in');
    }

    // Prevent deleting the primary seeded admin
    if (targetUser.id === 'usr-admin-0000-0000-000000000001') {
      throw new BadRequestError('The primary system administrator account cannot be deleted');
    }

    UserRepo.delete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
