import { Router, Request, Response, NextFunction } from 'express';
import { UserRepo, verifyPassword, toSafeUser } from '../db/repositories/userRepo.js';
import { loginSchema, registerSchema } from '../utils/validation.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Login
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);
    const user = UserRepo.findByEmail(validated.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = verifyPassword(validated.password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const session = UserRepo.createSession(user.id);

    res.json({
      success: true,
      data: {
        token: session.token,
        expiresAt: session.expiresAt,
        user: toSafeUser(user)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Register
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerSchema.parse(req.body);
    const existing = UserRepo.findByEmail(validated.email);
    if (existing) {
      throw new BadRequestError('A user with this email already exists');
    }

    // First user is admin, others default to user
    const users = UserRepo.findAll();
    const role = users.length === 0 ? 'admin' : 'user';

    const created = UserRepo.create({
      email: validated.email,
      name: validated.name,
      password: validated.password,
      role
    });

    const session = UserRepo.createSession(created.id);

    res.status(201).json({
      success: true,
      data: {
        token: session.token,
        expiresAt: session.expiresAt,
        user: toSafeUser(created)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get current user profile
router.get('/me', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      // Fallback to admin if not authenticated
      const defaultAdmin = UserRepo.findById('usr-admin-0000-0000-000000000001');
      if (defaultAdmin) {
        res.json({ success: true, data: toSafeUser(defaultAdmin) });
        return;
      }
      throw new UnauthorizedError('Not authenticated');
    }
    res.json({ success: true, data: toSafeUser(req.user) });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) UserRepo.deleteSession(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// Quick switch users list (for local testing & development)
router.get('/switchable-users', (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = UserRepo.findAll();
    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: u.avatar
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Quick switch to a user (generates a valid session for the requested user without needing password)
router.post('/switch-user', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new BadRequestError('userId is required');

    const targetUser = UserRepo.findById(userId);
    if (!targetUser) throw new NotFoundError('User not found');

    const session = UserRepo.createSession(targetUser.id);
    res.json({
      success: true,
      data: {
        token: session.token,
        expiresAt: session.expiresAt,
        user: toSafeUser(targetUser)
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
