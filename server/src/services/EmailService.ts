import nodemailer, { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';
import { config } from '../config/environment';
import { TemplateService, ITemplateService, createTemplateService } from './TemplateService';
import { 
  SendEmailDto, 
  EmailResponseDto, 
  SendPasswordResetEmailDto, 
  SendWelcomeEmailDto,
  SendVerificationEmailDto,
  EmailValidationDto,
  EmailValidationResponseDto,
  EmailConfigDto,
  EmailQueueDto,
  createEmailResponse,
  createEmailValidationResponse
} from '../dtos/email.dto';

// Email service interface
export interface IEmailService {
  sendEmail(emailData: SendEmailDto): Promise<EmailResponseDto>;
  sendPasswordReset(data: SendPasswordResetEmailDto): Promise<EmailResponseDto>;
  sendWelcomeEmail(data: SendWelcomeEmailDto): Promise<EmailResponseDto>;
  sendVerificationEmail(data: SendVerificationEmailDto): Promise<EmailResponseDto>;
  validateEmailAddress(data: EmailValidationDto): Promise<EmailValidationResponseDto>;
  testConnection(): Promise<boolean>;
  getConfiguration(): EmailConfigDto;
  queueEmail(emailData: SendEmailDto): Promise<string>;
  processEmailQueue(): Promise<void>;
  getQueueStatus(): Promise<EmailQueueDto[]>;
}

// Email configuration interface
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  maxRetries?: number;
  retryDelay?: number;
  fallbackEnabled?: boolean;
  fallbackConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

// Email queue item interface
interface EmailQueueItem {
  id: string;
  emailData: SendEmailDto;
  attempts: number;
  maxAttempts: number;
  nextRetry: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'retrying';
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

// Custom error classes
export class EmailError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'EmailError';
  }
}

export class EmailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailValidationError';
  }
}

export class EmailConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConnectionError';
  }
}

export class EmailService implements IEmailService {
  private transporter: Transporter;
  private fallbackTransporter?: Transporter;
  private config: EmailConfig;
  private templateService: ITemplateService;
  private isConnected: boolean = false;
  private isFallbackConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private emailQueue: EmailQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private queueProcessingInterval?: NodeJS.Timeout;

  constructor(emailConfig?: EmailConfig, templateService?: ITemplateService) {
    this.config = emailConfig || this.getDefaultConfig();
    this.templateService = templateService || createTemplateService();
    this.transporter = this.createTransporter();
    
    // Create fallback transporter if configured
    if (this.config.fallbackEnabled && this.config.fallbackConfig) {
      this.fallbackTransporter = this.createFallbackTransporter();
    }

    // Start queue processing
    this.startQueueProcessing();
  }

  /**
   * Get default email configuration from environment
   */
  private getDefaultConfig(): EmailConfig {
    return {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
      fromEmail: config.FROM_EMAIL,
      fromName: config.FROM_NAME,
      maxRetries: 3,
      retryDelay: 1000,
      fallbackEnabled: process.env.SMTP_FALLBACK_ENABLED === 'true',
      fallbackConfig: process.env.SMTP_FALLBACK_HOST ? {
        host: process.env.SMTP_FALLBACK_HOST,
        port: parseInt(process.env.SMTP_FALLBACK_PORT || '587'),
        secure: process.env.SMTP_FALLBACK_SECURE === 'true',
        user: process.env.SMTP_FALLBACK_USER || '',
        pass: process.env.SMTP_FALLBACK_PASS || ''
      } : undefined
    };
  }

  /**
   * Create nodemailer transporter
   */
  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 10, // Max 10 emails per second
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
    });
  }

  /**
   * Create fallback transporter
   */
  private createFallbackTransporter(): Transporter {
    if (!this.config.fallbackConfig) {
      throw new Error('Fallback configuration not provided');
    }

    return nodemailer.createTransport({
      host: this.config.fallbackConfig.host,
      port: this.config.fallbackConfig.port,
      secure: this.config.fallbackConfig.secure,
      auth: {
        user: this.config.fallbackConfig.user,
        pass: this.config.fallbackConfig.pass
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      rateLimit: 5, // More conservative for fallback
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  /**
   * Establish connection to SMTP server
   */
  private async establishConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.isConnected = true;
      this.connectionPromise = null;
      console.log('Email service connected successfully');
    } catch (error) {
      this.isConnected = false;
      this.connectionPromise = null;
      throw new EmailConnectionError(
        `Failed to connect to email server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure fallback connection is established
   */
  private async ensureFallbackConnection(): Promise<void> {
    if (!this.fallbackTransporter) {
      throw new EmailConnectionError('Fallback transporter not configured');
    }

    if (this.isFallbackConnected) {
      return;
    }

    try {
      await this.fallbackTransporter.verify();
      this.isFallbackConnected = true;
      console.log('Fallback email service connected successfully');
    } catch (error) {
      this.isFallbackConnected = false;
      throw new EmailConnectionError(
        `Failed to connect to fallback email server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Queue email for later processing
   */
  async queueEmail(emailData: SendEmailDto): Promise<string> {
    const queueItem: EmailQueueItem = {
      id: this.generateQueueId(),
      emailData,
      attempts: 0,
      maxAttempts: this.config.maxRetries || 3,
      nextRetry: new Date(Date.now() + (this.config.retryDelay || 1000)),
      status: 'pending',
      createdAt: new Date()
    };

    this.emailQueue.push(queueItem);
    console.log(`Email queued with ID: ${queueItem.id}`);
    
    return queueItem.id;
  }

  /**
   * Process email queue
   */
  async processEmailQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const pendingEmails = this.emailQueue.filter(
        item => (item.status === 'pending' || item.status === 'retrying') && 
                item.nextRetry <= new Date()
      );

      for (const queueItem of pendingEmails) {
        await this.processQueueItem(queueItem);
      }

      // Clean up completed items older than 24 hours
      this.cleanupQueue();
    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<EmailQueueDto[]> {
    return this.emailQueue.map(item => ({
      id: item.id,
      emailData: item.emailData,
      status: item.status,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      nextRetry: item.nextRetry,
      error: item.error,
      createdAt: item.createdAt,
      processedAt: item.processedAt
    }));
  }

  /**
   * Start queue processing interval
   */
  private startQueueProcessing(): void {
    // Process queue every 30 seconds
    this.queueProcessingInterval = setInterval(() => {
      this.processEmailQueue().catch(error => {
        console.error('Queue processing error:', error);
      });
    }, 30000);
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(queueItem: EmailQueueItem): Promise<void> {
    queueItem.status = 'processing';
    queueItem.attempts++;

    try {
      // Try to send the email
      const mailOptions = await this.prepareMailOptions(queueItem.emailData);
      
      // Try primary first, then fallback
      let result: SentMessageInfo;
      try {
        await this.ensureConnection();
        result = await this.sendWithRetry(mailOptions, this.transporter);
      } catch (primaryError) {
        if (this.fallbackTransporter) {
          await this.ensureFallbackConnection();
          result = await this.sendWithRetry(mailOptions, this.fallbackTransporter);
        } else {
          throw primaryError;
        }
      }

      // Success
      queueItem.status = 'sent';
      queueItem.processedAt = new Date();
      queueItem.error = undefined;
      
      this.logEmailSuccess(queueItem.emailData, result.messageId, 'queued');
      console.log(`Queued email ${queueItem.id} sent successfully`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      queueItem.error = errorMessage;
      
      if (queueItem.attempts >= queueItem.maxAttempts) {
        queueItem.status = 'failed';
        queueItem.processedAt = new Date();
        this.logEmailFailure(queueItem.emailData, error, 'queue_max_attempts');
        console.error(`Queued email ${queueItem.id} failed after ${queueItem.attempts} attempts:`, error);
      } else {
        queueItem.status = 'retrying';
        // Exponential backoff
        const delay = (this.config.retryDelay || 1000) * Math.pow(2, queueItem.attempts - 1);
        queueItem.nextRetry = new Date(Date.now() + delay);
        console.log(`Queued email ${queueItem.id} will retry in ${delay}ms (attempt ${queueItem.attempts}/${queueItem.maxAttempts})`);
      }
    }
  }

  /**
   * Clean up old queue items
   */
  private cleanupQueue(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const initialLength = this.emailQueue.length;
    
    this.emailQueue = this.emailQueue.filter(item => 
      item.status === 'pending' || 
      item.status === 'processing' || 
      item.status === 'retrying' ||
      (item.processedAt && item.processedAt > cutoffTime)
    );
    
    const removedCount = initialLength - this.emailQueue.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old queue items`);
    }
  }

  /**
   * Generate unique queue ID
   */
  private generateQueueId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send email with retry logic and fallback
   */
  async sendEmail(emailData: SendEmailDto): Promise<EmailResponseDto> {
    try {
      // Validate email data
      this.validateEmailData(emailData);

      // Try primary transporter first
      try {
        await this.ensureConnection();
        const mailOptions = await this.prepareMailOptions(emailData);
        const result = await this.sendWithRetry(mailOptions, this.transporter);

        this.logEmailSuccess(emailData, result.messageId, 'primary');
        
        return createEmailResponse(
          true,
          result.messageId,
          'Email sent successfully',
          emailData.to,
          emailData.subject
        );
      } catch (primaryError) {
        console.error('Primary email service failed:', primaryError);
        
        // Try fallback if available
        if (this.fallbackTransporter) {
          try {
            await this.ensureFallbackConnection();
            const mailOptions = await this.prepareMailOptions(emailData);
            const result = await this.sendWithRetry(mailOptions, this.fallbackTransporter);

            this.logEmailSuccess(emailData, result.messageId, 'fallback');
            
            return createEmailResponse(
              true,
              result.messageId,
              'Email sent successfully via fallback service',
              emailData.to,
              emailData.subject
            );
          } catch (fallbackError) {
            console.error('Fallback email service also failed:', fallbackError);
            
            // Queue email for later retry
            const queueId = await this.queueEmail(emailData);
            this.logEmailFailure(emailData, fallbackError, 'both_failed_queued');
            
            throw new EmailError(
              `Both primary and fallback email services failed. Email queued for retry. Queue ID: ${queueId}`
            );
          }
        } else {
          // No fallback available, queue for retry
          const queueId = await this.queueEmail(emailData);
          this.logEmailFailure(emailData, primaryError, 'primary_failed_queued');
          
          throw new EmailError(
            `Primary email service failed and no fallback configured. Email queued for retry. Queue ID: ${queueId}`
          );
        }
      }
    } catch (error) {
      if (error instanceof EmailError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logEmailFailure(emailData, error, 'validation_error');
      throw new EmailError(`Failed to send email: ${errorMessage}`);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: SendPasswordResetEmailDto): Promise<EmailResponseDto> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${data.resetToken}`;
      
      const emailData: SendEmailDto = {
        to: data.email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        templateData: {
          userName: data.userName || 'User',
          resetUrl,
          resetToken: data.resetToken,
          expiryTime: '1 hour'
        }
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      throw new EmailError(`Failed to send password reset email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(data: SendWelcomeEmailDto): Promise<EmailResponseDto> {
    try {
      const verificationUrl = data.verificationToken 
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${data.verificationToken}`
        : undefined;

      const emailData: SendEmailDto = {
        to: data.email,
        subject: 'Welcome to TypeScript Backend API',
        template: 'welcome',
        templateData: {
          userName: data.name,
          verificationUrl,
          verificationToken: data.verificationToken,
          supportEmail: this.config.fromEmail
        }
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      throw new EmailError(`Failed to send welcome email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(data: SendVerificationEmailDto): Promise<EmailResponseDto> {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${data.verificationToken}`;
      
      const emailData: SendEmailDto = {
        to: data.email,
        subject: 'Verify Your Email Address',
        template: 'email-verification',
        templateData: {
          userName: data.userName || 'User',
          verificationUrl,
          verificationToken: data.verificationToken,
          expiryTime: '24 hours'
        }
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      throw new EmailError(`Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate email address
   */
  async validateEmailAddress(data: EmailValidationDto): Promise<EmailValidationResponseDto> {
    try {
      const email = data.email.toLowerCase().trim();
      
      // Basic format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return createEmailValidationResponse(
          email,
          false,
          'Invalid email format',
          ['Check for typos in the email address']
        );
      }

      // Extract domain
      const domain = email.split('@')[1];
      
      // Check for common typos in popular domains
      const suggestions = this.getSuggestions(email);
      
      // Check for disposable email domains (basic list)
      const isDisposable = this.isDisposableEmail(domain);
      
      let hasMxRecord = true;
      if (data.checkMx) {
        hasMxRecord = await this.checkMxRecord(domain);
      }

      const isValid = !isDisposable && hasMxRecord;
      const reason = !isValid 
        ? (isDisposable ? 'Disposable email address' : 'Domain has no MX record')
        : undefined;

      return {
        email,
        isValid,
        reason,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        isDisposable,
        hasMxRecord,
        domain
      };
    } catch (error) {
      throw new EmailValidationError(`Email validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  /**
   * Get email service configuration
   */
  getConfiguration(): EmailConfigDto {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      user: this.config.user,
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      isConnected: this.isConnected
    };
  }

  /**
   * Validate email data
   */
  private validateEmailData(emailData: SendEmailDto): void {
    if (!emailData.to) {
      throw new EmailValidationError('Recipient email is required');
    }

    if (!emailData.subject) {
      throw new EmailValidationError('Email subject is required');
    }

    if (!emailData.html && !emailData.text && !emailData.template) {
      throw new EmailValidationError('Email must have HTML content, text content, or template');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to)) {
      throw new EmailValidationError('Invalid recipient email format');
    }

    // Validate CC emails if provided
    if (emailData.cc) {
      for (const ccEmail of emailData.cc) {
        if (!emailRegex.test(ccEmail)) {
          throw new EmailValidationError(`Invalid CC email format: ${ccEmail}`);
        }
      }
    }

    // Validate BCC emails if provided
    if (emailData.bcc) {
      for (const bccEmail of emailData.bcc) {
        if (!emailRegex.test(bccEmail)) {
          throw new EmailValidationError(`Invalid BCC email format: ${bccEmail}`);
        }
      }
    }
  }

  /**
   * Prepare mail options for nodemailer
   */
  private async prepareMailOptions(emailData: SendEmailDto): Promise<SendMailOptions> {
    const mailOptions: SendMailOptions = {
      from: `${this.config.fromName} <${this.config.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      replyTo: emailData.replyTo,
      cc: emailData.cc,
      bcc: emailData.bcc,
      attachments: emailData.attachments
    };

    // Handle template rendering or direct content
    if (emailData.template && emailData.templateData) {
      const renderedContent = await this.renderTemplate(emailData.template, emailData.templateData);
      mailOptions.html = renderedContent.html;
      mailOptions.text = renderedContent.text;
    } else {
      mailOptions.html = emailData.html;
      mailOptions.text = emailData.text;
    }

    return mailOptions;
  }

  /**
   * Send email with retry logic
   */
  private async sendWithRetry(mailOptions: SendMailOptions, transporter?: Transporter): Promise<SentMessageInfo> {
    const emailTransporter = transporter || this.transporter;
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await emailTransporter.sendMail(mailOptions);
      } catch (error) {
        console.error(`Email send attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        await this.delay(retryDelay * Math.pow(2, attempt - 1));
        
        // Reset connection for retry
        if (transporter === this.transporter) {
          this.isConnected = false;
          await this.ensureConnection();
        } else if (transporter === this.fallbackTransporter) {
          this.isFallbackConnected = false;
          await this.ensureFallbackConnection();
        }
      }
    }

    throw new EmailError('All retry attempts failed');
  }

  /**
   * Render email template
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<{ html: string; text: string }> {
    try {
      return await this.templateService.renderTemplate(templateName, data);
    } catch (error) {
      throw new EmailError(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get email templates (now uses TemplateService)
   */
  private async getTemplates(): Promise<Record<string, { html: string; text: string }>> {
    try {
      const availableTemplates = await this.templateService.getAvailableTemplates();
      const templates: Record<string, { html: string; text: string }> = {};

      for (const templateName of availableTemplates) {
        templates[templateName] = await this.templateService.loadTemplate(templateName);
      }

      return templates;
    } catch (error) {
      // Fallback to basic templates if template service fails
      console.warn('Template service failed, using fallback templates:', error);
      return {
        'password-reset': {
          html: '<h1>Password Reset</h1><p>Hello {{userName}}, click <a href="{{resetUrl}}">here</a> to reset your password.</p>',
          text: 'Hello {{userName}}, visit this link to reset your password: {{resetUrl}}'
        },
        'welcome': {
          html: '<h1>Welcome {{userName}}!</h1><p>Thank you for joining us.</p>',
          text: 'Welcome {{userName}}! Thank you for joining us.'
        },
        'email-verification': {
          html: '<h1>Verify Your Email</h1><p>Hello {{userName}}, click <a href="{{verificationUrl}}">here</a> to verify your email.</p>',
          text: 'Hello {{userName}}, visit this link to verify your email: {{verificationUrl}}'
        }
      };
    }
  }

  /**
   * Get email suggestions for common typos
   */
  private getSuggestions(email: string): string[] {
    const suggestions: string[] = [];
    const [localPart, domain] = email.split('@');
    
    // Common domain corrections
    const domainCorrections: Record<string, string> = {
      'gmail.co': 'gmail.com',
      'gmail.cm': 'gmail.com',
      'gmial.com': 'gmail.com',
      'yahoo.co': 'yahoo.com',
      'yahoo.cm': 'yahoo.com',
      'hotmail.co': 'hotmail.com',
      'hotmail.cm': 'hotmail.com',
      'outlook.co': 'outlook.com',
      'outlook.cm': 'outlook.com'
    };

    if (domainCorrections[domain]) {
      suggestions.push(`${localPart}@${domainCorrections[domain]}`);
    }

    return suggestions;
  }

  /**
   * Check if email domain is disposable
   */
  private isDisposableEmail(domain: string): boolean {
    // Basic list of disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'tempmail.org',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
      'temp-mail.org',
      'yopmail.com'
    ];

    return disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * Check MX record for domain (simplified version)
   */
  private async checkMxRecord(domain: string): Promise<boolean> {
    try {
      const dns = require('dns').promises;
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Log successful email sending
   */
  private logEmailSuccess(emailData: SendEmailDto, messageId: string, method: 'primary' | 'fallback' | 'queued'): void {
    console.log(`Email sent successfully via ${method}:`, {
      to: emailData.to,
      subject: emailData.subject,
      messageId,
      method,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log email sending failure
   */
  private logEmailFailure(emailData: SendEmailDto, error: any, context: string): void {
    console.error(`Email sending failed (${context}):`, {
      to: emailData.to,
      subject: emailData.subject,
      error: error instanceof Error ? error.message : String(error),
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close email service connections
   */
  async close(): Promise<void> {
    try {
      // Stop queue processing
      if (this.queueProcessingInterval) {
        clearInterval(this.queueProcessingInterval);
        this.queueProcessingInterval = undefined;
      }

      // Process any remaining queue items one last time
      await this.processEmailQueue();

      // Close transporters
      this.transporter.close();
      if (this.fallbackTransporter) {
        this.fallbackTransporter.close();
      }
      
      this.isConnected = false;
      this.isFallbackConnected = false;
      
      console.log('Email service connections closed');
    } catch (error) {
      console.error('Error closing email service:', error);
    }
  }
}

// Factory function to create EmailService with environment configuration
export function createEmailService(emailConfig?: EmailConfig, templateService?: ITemplateService): EmailService {
  return new EmailService(emailConfig, templateService);
}