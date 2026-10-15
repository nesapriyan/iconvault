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


  if (err.name === 'MulterError') {
    res.status(413).json({ success: false, error: { message: 'The upload is too large or contains too many files. Please use a smaller batch.' } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, error: { message: 'The request body is not valid JSON.' } });
    return;
  }
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

  if (err.name === 'ZodError') {
    res.status(422).json({ success: false, error: { message: 'Please check the submitted fields.' } });
    return;
  }
  // Keep database internals and submitted values out of public error messages.
  res.status(500).json({
    success: false,
    error: {
      name: 'InternalServerError',
      message: 'An unexpected server error occurred. Please try again.'
    }
  });
}
