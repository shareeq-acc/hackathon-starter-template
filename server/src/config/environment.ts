import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  // Server Configuration
  PORT: number;
  NODE_ENV: string;

  // Database Configuration
  MONGODB_URI: string;
  MONGODB_TEST_URI: string;

  // JWT Configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRES_IN: string;

  // Email Configuration
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  FROM_EMAIL: string;
  FROM_NAME: string;

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;

  // Google Gemini API Configuration
  GOOGLE_AI_API_KEY: string;
  GEMINI_MODEL: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // CORS Configuration
  CORS_ORIGIN: string;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue!;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value ? parseInt(value, 10) : defaultValue!;
};

const getEnvBoolean = (key: string, defaultValue?: boolean): boolean => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value ? value.toLowerCase() === 'true' : defaultValue!;
};

export const config: Config = {
  // Server Configuration
  PORT: getEnvNumber('PORT', 3000),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),

  // Database Configuration
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  MONGODB_TEST_URI: getEnvVar('MONGODB_TEST_URI'),

  // JWT Configuration
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '15m'),
  REFRESH_TOKEN_SECRET: getEnvVar('REFRESH_TOKEN_SECRET'),
  REFRESH_TOKEN_EXPIRES_IN: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', '7d'),

  // Email Configuration
  SMTP_HOST: getEnvVar('SMTP_HOST'),
  SMTP_PORT: getEnvNumber('SMTP_PORT', 587),
  SMTP_SECURE: getEnvBoolean('SMTP_SECURE', false),
  SMTP_USER: getEnvVar('SMTP_USER'),
  SMTP_PASS: getEnvVar('SMTP_PASS'),
  FROM_EMAIL: getEnvVar('FROM_EMAIL'),
  FROM_NAME: getEnvVar('FROM_NAME'),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
  GOOGLE_REDIRECT_URI: getEnvVar('GOOGLE_REDIRECT_URI'),

  // Google Gemini API Configuration
  GOOGLE_AI_API_KEY: getEnvVar('GOOGLE_AI_API_KEY'),
  GEMINI_MODEL: getEnvVar('GEMINI_MODEL', 'gemini-pro'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),

  // CORS Configuration
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
};

// Validate critical configuration
export const validateConfig = (): void => {
  const requiredVars = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'MONGODB_URI'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate JWT secrets are not default values in production
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET.includes('dev-') || config.REFRESH_TOKEN_SECRET.includes('dev-')) {
      throw new Error('Default JWT secrets detected in production environment');
    }
  }
};