import 'reflect-metadata';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { database } from './config/database';

export class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          timestamp: new Date().toISOString(),
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
      });
      
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const dbHealth = await database.healthCheck();
        
        res.status(200).json({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config.NODE_ENV,
            database: dbHealth ? 'connected' : 'disconnected',
          },
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          error: {
            code: 'HEALTH_CHECK_FAILED',
            message: 'Service health check failed',
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    // API routes will be added here
    this.app.use('/api', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'API route not found',
          path: req.path,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          message: 'TypeScript Backend API',
          version: '1.0.0',
          environment: config.NODE_ENV,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
          path: req.originalUrl,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', error);

      // Default error response
      const errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: config.NODE_ENV === 'production' 
            ? 'An internal server error occurred' 
            : error.message,
          timestamp: new Date().toISOString(),
          path: req.path,
          ...(config.NODE_ENV !== 'production' && { stack: error.stack }),
        },
      };

      res.status(500).json(errorResponse);
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Connect to database only if not in test environment or if not already connected
      if (config.NODE_ENV !== 'test' || !database.getConnectionStatus()) {
        await database.connect();
        console.log('Database connection established');
      }
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await database.disconnect();
      console.log('Application shutdown complete');
    } catch (error) {
      console.error('Error during application shutdown:', error);
      throw error;
    }
  }
}