import 'reflect-metadata';
import { TemplateService } from '../../src/services/TemplateService';
import path from 'path';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    // Use the actual templates directory for testing
    const templatesPath = path.join(__dirname, '../../src/templates/email');
    templateService = new TemplateService(templatesPath, false); // Disable cache for testing
  });

  describe('Template Loading', () => {
    it('should load available templates', async () => {
      const templates = await templateService.getAvailableTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates).toContain('password-reset');
      expect(templates).toContain('welcome');
      expect(templates).toContain('email-verification');
    });

    it('should load individual template', async () => {
      const template = await templateService.loadTemplate('password-reset');
      
      expect(template).toHaveProperty('html');
      expect(template).toHaveProperty('text');
      expect(template.html).toContain('{{userName}}');
      expect(template.text).toContain('{{userName}}');
    });

    it('should throw error for non-existent template', async () => {
      await expect(templateService.loadTemplate('non-existent'))
        .rejects
        .toThrow('Template \'non-existent\' not found');
    });
  });

  describe('Template Rendering', () => {
    it('should render template with data', async () => {
      const data = {
        userName: 'John Doe',
        resetUrl: 'https://example.com/reset?token=abc123',
        expiryTime: '1 hour'
      };

      const result = await templateService.renderTemplate('password-reset', data);
      
      expect(result.html).toContain('John Doe');
      expect(result.html).toContain('https://example.com/reset?token=abc123');
      expect(result.text).toContain('John Doe');
      expect(result.text).toContain('https://example.com/reset?token=abc123');
    });

    it('should handle conditional blocks', async () => {
      const data = {
        userName: 'John Doe',
        verificationUrl: 'https://example.com/verify'
      };

      const result = await templateService.renderTemplate('welcome', data);
      
      // Should include verification content when verificationUrl is provided
      expect(result.html).toContain('verify');
    });

    it('should add common template variables', async () => {
      const data = {
        userName: 'John Doe'
      };

      const result = await templateService.renderTemplate('welcome', data);
      
      // Should include current year
      expect(result.html).toContain(new Date().getFullYear().toString());
    });
  });

  describe('Template Validation', () => {
    it('should validate template syntax', async () => {
      const validation = await templateService.validateTemplate('password-reset');
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Template Preview', () => {
    it('should preview template with sample data', async () => {
      const preview = await templateService.previewTemplate('password-reset');
      
      expect(preview.html).toContain('John Doe'); // Default sample data
      expect(preview.text).toContain('John Doe');
    });

    it('should preview template with custom sample data', async () => {
      const customData = {
        userName: 'Jane Smith'
      };

      const preview = await templateService.previewTemplate('welcome', customData);
      
      expect(preview.html).toContain('Jane Smith');
      expect(preview.text).toContain('Jane Smith');
    });
  });

  describe('Cache Management', () => {
    it('should manage template cache', () => {
      const cacheStats = templateService.getCacheStats();
      
      expect(cacheStats).toHaveProperty('size');
      expect(cacheStats).toHaveProperty('templates');
      expect(Array.isArray(cacheStats.templates)).toBe(true);
    });

    it('should clear template cache', () => {
      templateService.clearCache();
      const cacheStats = templateService.getCacheStats();
      
      expect(cacheStats.size).toBe(0);
      expect(cacheStats.templates).toHaveLength(0);
    });
  });
});