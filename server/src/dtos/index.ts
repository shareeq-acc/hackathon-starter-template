// ============================================================================
// AUTH DTOs
// ============================================================================
export {
  // Request DTOs
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleOAuthDto,
  UpdateProfileDto,
  ChangePasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  
  // Response DTOs
  UserResponseDto,
  TokenResponseDto,
  AuthResponseDto,
  LogoutResponseDto,
  MessageResponseDto,
  ErrorResponseDto
} from './auth.dto';

// ============================================================================
// USER DTOs
// ============================================================================
export {
  // Request DTOs
  CreateUserDto,
  UpdateUserDto,
  GetUserByEmailDto,
  GetUserByIdDto,
  UpdateUserStatusDto,
  SearchUsersDto,
  
  // Response DTOs
  UserResponseDto as UserDto,
  UserProfileResponseDto,
  UserListResponseDto,
  UserStatsResponseDto,
  AdminUserResponseDto,
  UserValidationResponseDto,
  BulkUserOperationDto
} from './user.dto';

// ============================================================================
// QUOTE DTOs
// ============================================================================
export {
  // Request DTOs
  GetQuoteByThemeDto,
  CreateQuoteDto,
  SearchQuotesDto,
  GenerateQuoteDto,
  ClearCacheDto,
  
  // Response DTOs
  QuoteResponseDto,
  QuoteListResponseDto,
  RandomQuoteResponseDto,
  QuoteStatsResponseDto,
  GenerateQuoteResponseDto,
  CacheStatsResponseDto,
  QuoteValidationResponseDto,
  BulkQuoteOperationDto
} from './quote.dto';

// ============================================================================
// EMAIL DTOs
// ============================================================================
export {
  // Request DTOs
  SendEmailDto,
  EmailAttachmentDto,
  SendPasswordResetEmailDto,
  SendWelcomeEmailDto,
  SendVerificationEmailDto,
  TestEmailConnectionDto,
  EmailValidationDto,
  BulkEmailDto,
  
  // Response DTOs
  EmailResponseDto,
  EmailStatusDto,
  EmailStatsDto,
  EmailTemplateDto,
  EmailConfigDto,
  EmailValidationResponseDto,
  EmailQueueDto,
  BulkEmailResponseDto,
  
  // Utility Functions
  createEmailResponse,
  createEmailValidationResponse
} from './email.dto';

// ============================================================================
// LLM DTOs
// ============================================================================
export {
  // Request DTOs
  GenerateTextDto,
  GenerateQuotePromptDto,
  
  // Response DTOs
  GenerateTextResponseDto,
  LLMHealthResponseDto,
  LLMStatsResponseDto,
  LLMConfigDto,
  LLMErrorResponseDto,
  RateLimitStatusDto,
  
  // Utility Functions
  createLLMErrorResponse,
  createGenerateTextResponse,
  createLLMHealthResponse
} from './llm.dto';

// ============================================================================
// COMMON DTOs
// ============================================================================
export {
  // Pagination
  PaginationDto,
  PaginationMetaDto,
  PaginatedResponseDto,
  
  // API Responses
  ApiResponseDto,
  ErrorDetailDto,
  SuccessResponseDto,
  ErrorResponseDto as CommonErrorResponseDto,
  
  // Search and Filter
  SearchDto,
  FilterDto,
  SortDto,
  
  // Validation
  ValidationErrorDto,
  ValidationResponseDto,
  
  // Health Check
  HealthCheckDto,
  ServiceHealthDto,
  
  // Rate Limiting
  RateLimitDto,
  
  // File Upload
  FileUploadDto,
  FileUploadResponseDto,
  
  // Audit Log
  AuditLogDto,
  
  // Utility Functions
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse
} from './common.dto';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Re-export types from models for convenience
export type { QuoteSource } from '../models/Quote';

// Common type aliases
export type SortOrder = 'asc' | 'desc';
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';

// ============================================================================
// DTO VALIDATION GROUPS
// ============================================================================

// Validation groups for different contexts
export const ValidationGroups = {
  CREATE: 'create',
  UPDATE: 'update',
  ADMIN: 'admin',
  PUBLIC: 'public',
  INTERNAL: 'internal'
} as const;

export type ValidationGroup = typeof ValidationGroups[keyof typeof ValidationGroups];

// ============================================================================
// DTO TRANSFORMATION OPTIONS
// ============================================================================

export const TransformOptions = {
  // Standard transformation options
  EXCLUDE_EXTRANEOUS: { excludeExtraneousValues: true },
  ENABLE_IMPLICIT_CONVERSION: { enableImplicitConversion: true },
  
  // Security-focused options
  SECURE: {
    excludeExtraneousValues: true,
    enableImplicitConversion: false,
    forbidNonWhitelisted: true,
    whitelist: true
  },
  
  // Performance-focused options
  FAST: {
    excludeExtraneousValues: false,
    enableImplicitConversion: true,
    skipMissingProperties: true
  }
} as const;