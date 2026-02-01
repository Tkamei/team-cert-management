import dotenv from 'dotenv';
import { App } from './app';
import { db } from '@/database/config';
import { logger } from '@/utils/logger';

// Load environment variables
dotenv.config();

async function startServer(): Promise<void> {
  try {
    // Test database connection
    const isDbConnected = await db.testConnection();
    if (!isDbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established successfully');

    // Create and start the Express app
    const app = new App();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || 'localhost';

    app.listen(port, () => {
      logger.info(`Server is running on http://${host}:${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Team Certification Management System started successfully');
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await db.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});