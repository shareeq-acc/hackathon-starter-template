import { IsString, IsEmail, IsOptional, IsObject, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';

// ============================================================================
// EMAIL REQUEST DTOs
// ============================================================================

export class SendEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  to!: string;

  @IsString({ message: 'Subject must be a string' })
  @Transform(({ value }) => value?.trim())
  subject!: string;

  @IsOptional()
  @IsString({ message: 'HTML content must be a string' })
  html?: string;

  @IsOptional()
  @IsString({ message: 'Text content must be a string' })
  text?: string;

  @IsOptional()
  @IsString({ message: 'Template name must be a string' })
  template?: string;

  @IsOptional()
  @IsObject({ message: 'Template data must be an object' })
  templateData?: Record<string, any>;

  @IsOptional()
  @IsArray({ message: 'Attachments must be an array' })
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];

  @IsOptional()
  @IsString({ message: 'Reply-to must be a string' })
  @IsEmail({}, { message: 'Invalid reply-to email address' })
  replyTo?: string;

  @IsOptional()
  @IsArray({ message: 'CC must be an array' })
  @IsEmail({}, { each: true, message: 'Invalid CC email address' })
  cc?: string[];

  @IsOptional()
  @IsArray({ message: 'BCC must be an array' })
  @IsEmail({}, { each: true, message: 'Invalid BCC email address' })
  bcc?: string[];
}

export class EmailAttachmentDto {
  @IsString({ message: 'Filename must be a string' })
  filename!: string;

  @IsOptional()
  @IsString({ message: 'Content must be a string' })
  content?: string;

  @IsOptional()
  @IsString({ message: 'Path must be a string' })
  path?: string;

  @IsOptional()
  @IsString({ message: 'Content type must be a string' })
  contentType?: string;

  @IsOptional()
  @IsString({ message: 'Content ID must be a string' })
  cid?: string;
}

export class SendPasswordResetEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString({ message: 'Reset token must be a string' })
  resetToken!: string;

  @IsOptional()
  @IsString({ message: 'User name must be a string' })
  userName?: string;
}

export class SendWelcomeEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString({ message: 'User name must be a string' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsOptional()
  @IsString({ message: 'Verification token must be a string' })
  verificationToken?: string;
}

export class SendVerificationEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString({ message: 'Verification token must be a string' })
  verificationToken!: string;

  @IsOptional()
  @IsString({ message: 'User name must be a string' })
  userName?: string;
}

export class TestEmailConnectionDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid test email address' })
  testEmail?: string;
}

// ============================================================================
// EMAIL RESPONSE DTOs
// ============================================================================

export class EmailResponseDto {
  @Expose()
  success!: boolean;

  @Expose()
  messageId!: string;

  @Expose()
  @IsOptional()
  message?: string;

  @Expose()
  timestamp!: string;

  @Expose()
  @IsOptional()
  recipient?: string;

  @Expose()
  @IsOptional()
  subject?: string;
}

export class EmailStatusDto {
  @Expose()
  messageId!: string;

  @Expose()
  status!: 'sent' | 'failed' | 'pending' | 'delivered' | 'bounced';

  @Expose()
  @IsOptional()
  error?: string;

  @Expose()
  @IsOptional()
  deliveredAt?: Date;

  @Expose()
  @IsOptional()
  attempts?: number;

  @Expose()
  @IsOptional()
  lastAttempt?: Date;
}

export class EmailStatsDto {
  @Expose()
  totalSent!: number;

  @Expose()
  totalFailed!: number;

  @Expose()
  totalPending!: number;

  @Expose()
  successRate!: number;

  @Expose()
  @IsOptional()
  lastEmailSent?: Date;

  @Expose()
  @IsOptional()
  averageDeliveryTime?: number; // in milliseconds
}

export class EmailTemplateDto {
  @Expose()
  name!: string;

  @Expose()
  subject!: string;

  @Expose()
  @IsOptional()
  htmlTemplate?: string;

  @Expose()
  @IsOptional()
  textTemplate?: string;

  @Expose()
  @IsOptional()
  variables?: string[];

  @Expose()
  @IsOptional()
  description?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

export class EmailConfigDto {
  @Expose()
  host!: string;

  @Expose()
  port!: number;

  @Expose()
  secure!: boolean;

  @Expose()
  @IsOptional()
  user?: string;

  @Expose()
  fromEmail!: string;

  @Expose()
  fromName!: string;

  @Expose()
  @IsOptional()
  maxRetries?: number;

  @Expose()
  @IsOptional()
  retryDelay?: number;

  @Expose()
  isConnected!: boolean;
}

// ============================================================================
// EMAIL VALIDATION DTOs
// ============================================================================

export class EmailValidationDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsOptional()
  @IsBoolean({ message: 'Check MX record must be a boolean' })
  checkMx?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Check disposable must be a boolean' })
  checkDisposable?: boolean;
}

export class EmailValidationResponseDto {
  @Expose()
  email!: string;

  @Expose()
  isValid!: boolean;

  @Expose()
  @IsOptional()
  reason?: string;

  @Expose()
  @IsOptional()
  suggestions?: string[];

  @Expose()
  @IsOptional()
  isDisposable?: boolean;

  @Expose()
  @IsOptional()
  hasMxRecord?: boolean;

  @Expose()
  @IsOptional()
  domain?: string;
}

// ============================================================================
// EMAIL QUEUE DTOs
// ============================================================================

export class EmailQueueDto {
  @Expose()
  id!: string;

  @Expose()
  @Type(() => SendEmailDto)
  emailData!: SendEmailDto;

  @Expose()
  status!: 'pending' | 'processing' | 'sent' | 'failed' | 'retrying';

  @Expose()
  @IsOptional()
  attempts?: number;

  @Expose()
  @IsOptional()
  maxAttempts?: number;

  @Expose()
  @IsOptional()
  nextRetry?: Date;

  @Expose()
  @IsOptional()
  error?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  @IsOptional()
  processedAt?: Date;
}

// ============================================================================
// BULK EMAIL DTOs
// ============================================================================

export class BulkEmailDto {
  @IsArray({ message: 'Recipients must be an array' })
  @IsEmail({}, { each: true, message: 'Invalid recipient email address' })
  recipients!: string[];

  @IsString({ message: 'Subject must be a string' })
  @Transform(({ value }) => value?.trim())
  subject!: string;

  @IsOptional()
  @IsString({ message: 'HTML content must be a string' })
  html?: string;

  @IsOptional()
  @IsString({ message: 'Text content must be a string' })
  text?: string;

  @IsOptional()
  @IsString({ message: 'Template name must be a string' })
  template?: string;

  @IsOptional()
  @IsObject({ message: 'Template data must be an object' })
  templateData?: Record<string, any>;

  @IsOptional()
  @IsObject({ message: 'Per-recipient data must be an object' })
  perRecipientData?: Record<string, Record<string, any>>;
}

export class BulkEmailResponseDto {
  @Expose()
  totalRecipients!: number;

  @Expose()
  successfulSends!: number;

  @Expose()
  failedSends!: number;

  @Expose()
  @IsOptional()
  results?: EmailResponseDto[];

  @Expose()
  @IsOptional()
  errors?: Array<{ recipient: string; error: string }>;

  @Expose()
  batchId!: string;

  @Expose()
  timestamp!: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createEmailResponse(
  success: boolean,
  messageId: string,
  message?: string,
  recipient?: string,
  subject?: string
): EmailResponseDto {
  return {
    success,
    messageId,
    message,
    timestamp: new Date().toISOString(),
    recipient,
    subject
  };
}

export function createEmailValidationResponse(
  email: string,
  isValid: boolean,
  reason?: string,
  suggestions?: string[]
): EmailValidationResponseDto {
  return {
    email,
    isValid,
    reason,
    suggestions
  };
}