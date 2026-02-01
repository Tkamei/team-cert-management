import { Request, Response, NextFunction } from 'express';
import { db } from '@/database/config';

export interface AuditLogData {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditMiddleware {
  public static async logOperation(data: AuditLogData): Promise<void> {
    try {
      await db.query(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, 
          old_values, new_values, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        data.userId || null,
        data.action,
        data.resourceType,
        data.resourceId || null,
        data.oldValues ? JSON.stringify(data.oldValues) : null,
        data.newValues ? JSON.stringify(data.newValues) : null,
        data.ipAddress || null,
        data.userAgent || null
      ]);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  public static auditRequest = (action: string, resourceType: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Store audit info in request for later use
      req.auditInfo = {
        action,
        resourceType,
        userId: req.user?.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      next();
    };
  };

  public static logAfterResponse = (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function(data: unknown) {
      // Log the operation after response is sent
      if (req.auditInfo && res.statusCode < 400) {
        setImmediate(() => {
          AuditMiddleware.logOperation({
            ...req.auditInfo,
            newValues: req.body || undefined
          }).catch(error => {
            console.error('Audit logging failed:', error);
          });
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

// Extend Express Request interface to include audit info
declare global {
  namespace Express {
    interface Request {
      auditInfo?: {
        action: string;
        resourceType: string;
        userId?: string;
        ipAddress?: string;
        userAgent?: string;
      };
    }
  }
}