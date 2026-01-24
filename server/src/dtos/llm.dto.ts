import { IsString, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class GenerateTextDto {
  @IsString({ message: 'Prompt must be a string' })
  @MinLength(1, { message: 'Prompt cannot be empty' })
  @MaxLength(8000, { message: 'Prompt cannot exceed 8000 characters' })
  @Transform(({ value }) => value?.trim())
  prompt!: string;

  @IsOptional()
  @IsNumber({}, { message: 'Max tokens must be a number' })
  @Min(1, { message: 'Max tokens must be at least 1' })
  @Max(8192, { message: 'Max tokens cannot exceed 8192' })
  maxTokens?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Temperature must be a number' })
  @Min(0, { message: 'Temperature must be at least 0' })
  @Max(2, { message: 'Temperature cannot exceed 2' })
  temperature?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Top P must be a number' })
  @Min(0, { message: 'Top P must be at least 0' })
  @Max(1, { message: 'Top P cannot exceed 1' })
  topP?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Top K must be a number' })
  @Min(1, { message: 'Top K must be at least 1' })
  @Max(100, { message: 'Top K cannot exceed 100' })
  topK?: number;
}

export class GenerateQuotePromptDto {
  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  @MinLength(1, { message: 'Theme cannot be empty' })
  @MaxLength(50, { message: 'Theme cannot exceed 50 characters' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  theme?: string;

  @IsOptional()
  @IsString({ message: 'Style must be a string' })
  @MaxLength(100, { message: 'Style cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  style?: string;

  @IsOptional()
  @IsString({ message: 'Context must be a string' })
  @MaxLength(200, { message: 'Context cannot exceed 200 characters' })
  @Transform(({ value }) => value?.trim())
  context?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export class GenerateTextResponseDto {
  @Expose()
  text!: string;

  @Expose()
  prompt!: string;

  @Expose()
  model!: string;

  @Expose()
  generationTime!: number; // in milliseconds

  @Expose()
  tokenCount!: number;

  @Expose()
  @IsOptional()
  finishReason?: string;

  @Expose()
  @IsOptional()
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;

  @Expose()
  createdAt!: Date;

  // Exclude internal fields
  @Exclude()
  _id?: string;

  @Exclude()
  __v?: number;
}

export class LLMHealthResponseDto {
  @Expose()
  isHealthy!: boolean;

  @Expose()
  model!: string;

  @Expose()
  responseTime!: number; // in milliseconds

  @Expose()
  @IsOptional()
  error?: string;

  @Expose()
  lastChecked!: Date;
}

export class LLMStatsResponseDto {
  @Expose()
  totalRequests!: number;

  @Expose()
  successfulRequests!: number;

  @Expose()
  failedRequests!: number;

  @Expose()
  averageResponseTime!: number; // in milliseconds

  @Expose()
  totalTokensGenerated!: number;

  @Expose()
  rateLimitHits!: number;

  @Expose()
  lastRequestTime!: Date;

  @Expose()
  uptime!: number; // in seconds
}

// ============================================================================
// CONFIGURATION DTOs
// ============================================================================

export class LLMConfigDto {
  @Expose()
  model!: string;

  @Expose()
  @Transform(({ value }) => value ? '***' + value.slice(-4) : undefined)
  apiKey!: string; // This will be masked in responses

  @Expose()
  maxTokens!: number;

  @Expose()
  temperature!: number;

  @Expose()
  topP!: number;

  @Expose()
  topK!: number;

  @Expose()
  maxRetries!: number;

  @Expose()
  retryDelay!: number;

  @Expose()
  rateLimitPerMinute!: number;

  @Expose()
  isConnected!: boolean;
}

// ============================================================================
// ERROR DTOs
// ============================================================================

export class LLMErrorResponseDto {
  @Expose()
  error!: string;

  @Expose()
  code!: string;

  @Expose()
  @IsOptional()
  details?: any;

  @Expose()
  retryable!: boolean;

  @Expose()
  @IsOptional()
  retryAfter?: number; // seconds

  @Expose()
  timestamp!: Date;
}

// ============================================================================
// RATE LIMITING DTOs
// ============================================================================

export class RateLimitStatusDto {
  @Expose()
  requestsRemaining!: number;

  @Expose()
  resetTime!: Date;

  @Expose()
  windowStart!: Date;

  @Expose()
  windowEnd!: Date;

  @Expose()
  isLimited!: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createLLMErrorResponse(
  error: string,
  code: string,
  retryable: boolean = false,
  details?: any,
  retryAfter?: number
): LLMErrorResponseDto {
  return {
    error,
    code,
    details,
    retryable,
    retryAfter,
    timestamp: new Date()
  };
}

export function createGenerateTextResponse(
  text: string,
  prompt: string,
  model: string,
  generationTime: number,
  tokenCount: number,
  finishReason?: string,
  safetyRatings?: Array<{ category: string; probability: string }>
): GenerateTextResponseDto {
  return {
    text,
    prompt,
    model,
    generationTime,
    tokenCount,
    finishReason,
    safetyRatings,
    createdAt: new Date()
  };
}

export function createLLMHealthResponse(
  isHealthy: boolean,
  model: string,
  responseTime: number,
  error?: string
): LLMHealthResponseDto {
  return {
    isHealthy,
    model,
    responseTime,
    error,
    lastChecked: new Date()
  };
}