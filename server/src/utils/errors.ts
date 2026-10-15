import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: any) {
    super(message, 400, details);
    this.name = 'BadRequestError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 422, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden: insufficient permissions') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('[Error Handler]', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        name: err.name,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // Handle generic error
  res.status(500).json({
    success: false,
    error: {
      name: 'InternalServerError',
      message: err.message || 'An unexpected error occurred'
    }
  });
}
