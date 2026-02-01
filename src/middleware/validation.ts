import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '@/types';

export class ValidationMiddleware {
  public static validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        };

        res.status(400).json({
          success: false,
          error: apiError,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Replace req.body with validated and sanitized data
      req.body = value;
      next();
    };
  };

  public static validateQuery = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const apiError: ApiError = {
          code: 'QUERY_VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        };

        res.status(400).json({
          success: false,
          error: apiError,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Replace req.query with validated and sanitized data
      req.query = value;
      next();
    };
  };

  public static validateParams = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const apiError: ApiError = {
          code: 'PARAMS_VALIDATION_ERROR',
          message: 'URL parameter validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          timestamp: new Date().toISOString()
        };

        res.status(400).json({
          success: false,
          error: apiError,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      // Replace req.params with validated and sanitized data
      req.params = value;
      next();
    };
  };
}