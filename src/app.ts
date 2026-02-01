import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import path from 'path';
import * as fs from 'fs/promises';
import config from './config';
import { JSONStorage } from './data/storage';
import { logger, requestLogger } from './utils/logger';

const app = express();

// JSONストレージの初期化（configから取得）
export const storage = new JSONStorage();

// Security headers middleware for production
if (config.nodeEnv === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Additional security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
} else {
  // Development mode - relaxed CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      }
    }
  }));
}

// CORS configuration with environment variable support
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined'));
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// セッション設定
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24時間
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax'
  }
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// APIルートの設定（全て /api プレフィックス配下）
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import certificationRoutes from './routes/certifications';
import studyPlanRoutes from './routes/studyPlans';
import achievementRoutes from './routes/achievements';
import notificationRoutes from './routes/notifications';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/study-plans', studyPlanRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/notifications', notificationRoutes);

// 未実装のAPIエンドポイント（後続のタスクで実装）
app.use('/api/reports', (_req, res) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Reports API will be implemented in subsequent tasks',
      timestamp: new Date().toISOString()
    }
  });
});

// Serve static files from React frontend in production
if (config.nodeEnv === 'production') {
  const frontendPath = path.resolve(config.frontendBuildPath);
  
  // Serve static files
  app.use(express.static(frontendPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Serve index.html for all other routes
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  // Development mode - serve public directory
  app.use(express.static('public'));
  
  app.get('/', (_req, res) => {
    res.json({
      message: 'Team Certification Management API Server',
      environment: config.nodeEnv,
      demo: `http://localhost:${config.port}/demo.html`,
      api: `http://localhost:${config.port}/api`,
      health: `http://localhost:${config.port}/health`,
      frontend: 'http://localhost:5173 (Vite dev server)'
    });
  });
}

// 404エラーハンドリング（API routes only）
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Log error with full context
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Send appropriate error response
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: config.nodeEnv === 'production' 
        ? 'An internal server error occurred' 
        : err.message,
      timestamp: new Date().toISOString(),
      ...(config.nodeEnv === 'development' && { stack: err.stack })
    }
  });
});

// サーバー起動
async function startServer() {
  try {
    // Check if frontend build exists in production
    if (config.nodeEnv === 'production') {
      try {
        await fs.access(config.frontendBuildPath);
        logger.info(`✅ Frontend build directory found: ${config.frontendBuildPath}`);
      } catch {
        logger.error(`❌ Frontend build directory not found: ${config.frontendBuildPath}`);
        logger.error('Please run "cd client && npm run build" before starting in production mode');
        process.exit(1);
      }
    }
    
    // データディレクトリの初期化
    await storage.initializeDataDirectory();
    
    // Start server
    app.listen(config.port, () => {
      logger.info('='.repeat(60));
      logger.info(`🚀 Server started successfully`);
      logger.info(`📍 Port: ${config.port}`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
      logger.info(`📁 Data Directory: ${config.dataDir}`);
      logger.info(`🔒 CORS Origins: ${config.corsOrigin.join(', ')}`);
      logger.info(`🏥 Health Check: http://localhost:${config.port}/health`);
      if (config.demoMode) {
        logger.info(`🎭 Demo Mode: Enabled`);
      }
      logger.info('='.repeat(60));
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// サーバー起動
if (require.main === module) {
  startServer();
}

export default app;