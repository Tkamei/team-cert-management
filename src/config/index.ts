/**
 * Centralized Configuration Management
 * 
 * This module loads all configuration from environment variables with sensible defaults.
 * It provides a single source of truth for application configuration.
 */

interface Config {
  port: number;
  nodeEnv: string;
  sessionSecret: string;
  dataDir: string;
  corsOrigin: string[];
  frontendBuildPath: string;
  logLevel: string;
  logFile: string;
  backupDir: string;
  backupRetentionDays: number;
  demoMode: boolean;
  demoAdminEmail: string;
  demoAdminPassword: string;
}

/**
 * Load configuration from environment variables with defaults
 */
function loadConfig(): Config {
  return {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Session configuration
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    
    // Data storage
    dataDir: process.env.DATA_DIR || './data',
    
    // CORS configuration (comma-separated list)
    corsOrigin: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:5173'],
    
    // Frontend build path (for production)
    frontendBuildPath: process.env.FRONTEND_BUILD_PATH || './client/build',
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || './logs/app.log',
    
    // Backup configuration
    backupDir: process.env.BACKUP_DIR || './backups',
    backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    
    // Demo mode
    demoMode: process.env.DEMO_MODE === 'true',
    demoAdminEmail: process.env.DEMO_ADMIN_EMAIL || 'admin@demo.com',
    demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || 'admin123',
  };
}

/**
 * Validate required configuration
 * Throws an error if required configuration is missing or invalid
 */
function validateConfig(config: Config): void {
  const errors: string[] = [];
  
  // Validate port
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }
  
  // Validate session secret in production
  if (config.nodeEnv === 'production') {
    if (!process.env.SESSION_SECRET || config.sessionSecret === 'dev-secret-change-in-production') {
      errors.push('SESSION_SECRET must be set in production environment');
    }
    
    if (config.sessionSecret.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters long');
    }
  }
  
  // Validate data directory
  if (!config.dataDir || config.dataDir.trim() === '') {
    errors.push('DATA_DIR must be specified');
  }
  
  // Validate CORS origins
  if (config.corsOrigin.length === 0) {
    errors.push('CORS_ORIGIN must contain at least one origin');
  }
  
  // Validate frontend build path in production
  if (config.nodeEnv === 'production') {
    if (!config.frontendBuildPath || config.frontendBuildPath.trim() === '') {
      errors.push('FRONTEND_BUILD_PATH must be specified in production');
    }
  }
  
  // If there are validation errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessage = [
      'Configuration validation failed:',
      ...errors.map(err => `  - ${err}`),
      '',
      'Please check your environment variables and try again.',
    ].join('\n');
    
    throw new Error(errorMessage);
  }
}

// Load and validate configuration
const config = loadConfig();

// Validate configuration on module load
try {
  validateConfig(config);
} catch (error) {
  console.error('❌ Configuration Error:', (error as Error).message);
  process.exit(1);
}

// Log configuration (excluding sensitive data)
if (config.nodeEnv === 'development') {
  console.log('📋 Configuration loaded:');
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - Data Directory: ${config.dataDir}`);
  console.log(`  - CORS Origins: ${config.corsOrigin.join(', ')}`);
  console.log(`  - Demo Mode: ${config.demoMode}`);
}

export default config;
export { Config, validateConfig };
