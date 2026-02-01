import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/types';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ErrorHandler {
  public static handle = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    let statusCode = 500;
    let apiError: ApiError = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    // Handle known application errors
    if (error instanceof AppError) {
      statusCode = error.statusCode;
      apiError = {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
    // Handle database errors
    else if (error.message.includes('duplicate key value')) {
      statusCode = 409;
      apiError = {
        code: 'DUPLICATE_RESOURCE',
        message: 'Resource already exists',
        timestamp: new Date().toISOString()
      };
    }
    else if (error.message.includes('foreign key constraint')) {
      statusCode = 400;
      apiError = {
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
        timestamp: new Date().toISOString()
      };
    }
    else if (error.message.includes('not-null constraint')) {
      statusCode = 400;
      apiError = {
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Required field is missing',
        timestamp: new Date().toISOString()
      };
    }
    // Handle validation errors
    else if (error.name === 'ValidationError') {
      statusCode = 400;
      apiError = {
        code: 'VALIDATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
    // Handle JWT errors
    else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      apiError = {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        timestamp: new Date().toISOString()
      };
    }
    else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      apiError = {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        timestamp: new Date().toISOString()
      };
    }

    // Log error for debugging
    console.error('Error occurred:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: apiError,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  };

  public static notFound = (req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  };

  public static asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
}