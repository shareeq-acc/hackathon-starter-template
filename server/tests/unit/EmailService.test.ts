import 'reflect-metadata';
import { EmailService, EmailConfig } from '../../src/services/EmailService';
import { TemplateService } from '../../src/services/TemplateService';
import { SendEmailDto } from '../../src/dtos/email.dto';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    close: jest.fn()
  }))
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockConfig: EmailConfig;

  beforeEach(() => {
    mockConfig = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      user: 'test@test.com',
      pass: 'testpass',
      fromEmail: 'noreply@test.com',
      fromName: 'Test Service',
      maxRetries: 3,
      retryDelay: 1000
    };

    emailService = new EmailService(mockConfig);
  });

  afterEach(async () => {
    await emailService.close();
  });

  describe('Email Validation', () => {
    it('should validate email addresses correctly', async () => {
      const validationResult = await emailService.validateEmailAddress({
        email: 'test@example.com'
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.email).toBe('test@example.com');
    });

    it('should reject invalid email formats', async () => {
      const validationResult = await emailService.validateEmailAddress({
        email: 'invalid-email'
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.reason).toBe('Invalid email format');
    });

    it('should detect disposable email addresses', async () => {
      const validationResult = await emailService.validateEmailAddress({
        email: 'test@10minutemail.com'
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.isDisposable).toBe(true);
    });
  });

  describe('Email Sending', () => {
    it('should send email successfully', async () => {
      const emailData: SendEmailDto = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.recipient).toBe('test@example.com');
    });

    it('should validate email data before sending', async () => {
      const invalidEmailData: SendEmailDto = {
        to: '',
        subject: '',
        html: '',
        text: ''
      };

      await expect(emailService.sendEmail(invalidEmailData))
        .rejects
        .toThrow('Recipient email is required');
    });
  });

  describe('Template Emails', () => {
    it('should send password reset email', async () => {
      const resetData = {
        email: 'test@example.com',
        resetToken: 'test-token',
        userName: 'Test User'
      };

      const result = await emailService.sendPasswordReset(resetData);

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('test@example.com');
      expect(result.subject).toBe('Password Reset Request');
    });

    it('should send welcome email', async () => {
      const welcomeData = {
        email: 'test@example.com',
        name: 'Test User'
      };

      const result = await emailService.sendWelcomeEmail(welcomeData);

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('test@example.com');
      expect(result.subject).toBe('Welcome to TypeScript Backend API');
    });

    it('should send verification email', async () => {
      const verificationData = {
        email: 'test@example.com',
        verificationToken: 'test-token',
        userName: 'Test User'
      };

      const result = await emailService.sendVerificationEmail(verificationData);

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('test@example.com');
      expect(result.subject).toBe('Verify Your Email Address');
    });
  });

  describe('Configuration', () => {
    it('should return email configuration', () => {
      const config = emailService.getConfiguration();

      expect(config.host).toBe('smtp.test.com');
      expect(config.port).toBe(587);
      expect(config.fromEmail).toBe('noreply@test.com');
      expect(config.fromName).toBe('Test Service');
    });

    it('should test connection', async () => {
      const isConnected = await emailService.testConnection();
      expect(isConnected).toBe(true);
    });
  });

  describe('Email Queue', () => {
    it('should queue email for later processing', async () => {
      const emailData: SendEmailDto = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      };

      const queueId = await emailService.queueEmail(emailData);

      expect(queueId).toBeDefined();
      expect(typeof queueId).toBe('string');
    });

    it('should get queue status', async () => {
      const emailData: SendEmailDto = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      };

      await emailService.queueEmail(emailData);
      const queueStatus = await emailService.getQueueStatus();

      expect(Array.isArray(queueStatus)).toBe(true);
      expect(queueStatus.length).toBeGreaterThan(0);
    });
  });
});