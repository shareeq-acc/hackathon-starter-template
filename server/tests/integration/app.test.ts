import request from 'supertest';
import { App } from '../../src/app';

describe('App Integration Tests', () => {
  let app: App;

  beforeAll(async () => {
    app = new App();
    // Don't initialize database connection as it's handled in setup.ts
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          environment: expect.any(String),
          database: expect.any(String),
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Root Endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'TypeScript Backend API',
          version: '1.0.0',
          environment: expect.any(String),
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app.app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
          path: '/unknown-route',
          timestamp: expect.any(String),
        },
      });
    });

    it('should return 404 for unknown API routes', async () => {
      const response = await request(app.app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'API route not found',
          path: '/unknown',
          timestamp: expect.any(String),
        },
      });
    });
  });
});