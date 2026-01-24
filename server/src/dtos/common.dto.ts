import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';

// ============================================================================
// PAGINATION DTOs
// ============================================================================

export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit: number = 10;

  @IsOptional()
  @IsString({ message: 'Sort by must be a string' })
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort order must be either "asc" or "desc"' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationMetaDto {
  @Expose()
  page!: number;

  @Expose()
  limit!: number;

  @Expose()
  total!: number;

  @Expose()
  totalPages!: number;

  @Expose()
  hasNext!: boolean;

  @Expose()
  hasPrev!: boolean;

  @Expose()
  @IsOptional()
  sortBy?: string;

  @Expose()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class PaginatedResponseDto<T> {
  @Expose()
  data!: T[];

  @Expose()
  @Type(() => PaginationMetaDto)
  pagination!: PaginationMetaDto;

  @Expose()
  success: boolean = true;

  @Expose()
  @IsOptional()
  message?: string;
}

// ============================================================================
// API RESPONSE DTOs
// ============================================================================

export class ApiResponseDto<T = any> {
  @Expose()
  success!: boolean;

  @Expose()
  @IsOptional()
  data?: T;

  @Expose()
  @IsOptional()
  message?: string;

  @Expose()
  @IsOptional()
  error?: ErrorDetailDto;

  @Expose()
  timestamp: string = new Date().toISOString();

  @Expose()
  @IsOptional()
  path?: string;
}

export class ErrorDetailDto {
  @Expose()
  code!: string;

  @Expose()
  message!: string;

  @Expose()
  @IsOptional()
  details?: any;

  @Expose()
  timestamp!: string;

  @Expose()
  @IsOptional()
  path?: string;

  @Expose()
  @IsOptional()
  stack?: string; // Only in development
}

export class SuccessResponseDto<T = any> extends ApiResponseDto<T> {
  @Expose()
  success: boolean = true;

  constructor(data?: T, message?: string) {
    super();
    this.data = data;
    this.message = message;
  }
}

export class ErrorResponseDto extends ApiResponseDto {
  @Expose()
  success: boolean = false;

  @Expose()
  @Type(() => ErrorDetailDto)
  error!: ErrorDetailDto;

  constructor(error: ErrorDetailDto) {
    super();
    this.error = error;
  }
}

// ============================================================================
// SEARCH AND FILTER DTOs
// ============================================================================

export class SearchDto {
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @Transform(({ value }) => value?.trim())
  q?: string; // query term

  @IsOptional()
  @IsString({ message: 'Search field must be a string' })
  field?: string; // specific field to search

  @IsOptional()
  @IsBoolean({ message: 'Case sensitive must be a boolean' })
  caseSensitive?: boolean = false;

  @IsOptional()
  @IsBoolean({ message: 'Exact match must be a boolean' })
  exactMatch?: boolean = false;
}

export class FilterDto {
  @IsOptional()
  @IsString({ message: 'Filter field must be a string' })
  field?: string;

  @IsOptional()
  @IsString({ message: 'Filter operator must be a string' })
  @IsIn(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'regex'], {
    message: 'Filter operator must be one of: eq, ne, gt, gte, lt, lte, in, nin, regex'
  })
  operator?: string;

  @IsOptional()
  value?: any;
}

export class SortDto {
  @IsOptional()
  @IsString({ message: 'Sort field must be a string' })
  field?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort direction must be either "asc" or "desc"' })
  direction?: 'asc' | 'desc' = 'asc';
}

// ============================================================================
// VALIDATION DTOs
// ============================================================================

export class ValidationErrorDto {
  @Expose()
  field!: string;

  @Expose()
  message!: string;

  @Expose()
  @IsOptional()
  value?: any;

  @Expose()
  @IsOptional()
  constraint?: string;
}

export class ValidationResponseDto {
  @Expose()
  isValid!: boolean;

  @Expose()
  @Type(() => ValidationErrorDto)
  @IsOptional()
  errors?: ValidationErrorDto[];

  @Expose()
  @IsOptional()
  warnings?: string[];

  @Expose()
  @IsOptional()
  suggestions?: string[];
}

// ============================================================================
// HEALTH CHECK DTOs
// ============================================================================

export class HealthCheckDto {
  @Expose()
  status!: 'healthy' | 'unhealthy' | 'degraded';

  @Expose()
  timestamp!: string;

  @Expose()
  uptime!: number; // in seconds

  @Expose()
  version!: string;

  @Expose()
  environment!: string;

  @Expose()
  services!: ServiceHealthDto[];
}

export class ServiceHealthDto {
  @Expose()
  name!: string;

  @Expose()
  status!: 'healthy' | 'unhealthy' | 'degraded';

  @Expose()
  @IsOptional()
  responseTime?: number; // in milliseconds

  @Expose()
  @IsOptional()
  message?: string;

  @Expose()
  @IsOptional()
  details?: any;
}

// ============================================================================
// RATE LIMITING DTOs
// ============================================================================

export class RateLimitDto {
  @Expose()
  limit!: number;

  @Expose()
  remaining!: number;

  @Expose()
  reset!: number; // timestamp

  @Expose()
  @IsOptional()
  retryAfter?: number; // seconds
}

// ============================================================================
// FILE UPLOAD DTOs
// ============================================================================

export class FileUploadDto {
  @IsString({ message: 'Filename must be a string' })
  filename!: string;

  @IsString({ message: 'MIME type must be a string' })
  mimetype!: string;

  @IsNumber({}, { message: 'File size must be a number' })
  size!: number;

  @IsOptional()
  @IsString({ message: 'File path must be a string' })
  path?: string;

  @IsOptional()
  @IsString({ message: 'File URL must be a string' })
  url?: string;
}

export class FileUploadResponseDto {
  @Expose()
  @Type(() => FileUploadDto)
  file!: FileUploadDto;

  @Expose()
  success: boolean = true;

  @Expose()
  message: string = 'File uploaded successfully';

  @Expose()
  uploadId!: string;
}

// ============================================================================
// AUDIT LOG DTOs
// ============================================================================

export class AuditLogDto {
  @Expose()
  id!: string;

  @Expose()
  action!: string;

  @Expose()
  resource!: string;

  @Expose()
  resourceId!: string;

  @Expose()
  @IsOptional()
  userId?: string;

  @Expose()
  @IsOptional()
  userEmail?: string;

  @Expose()
  @IsOptional()
  ipAddress?: string;

  @Expose()
  @IsOptional()
  userAgent?: string;

  @Expose()
  @IsOptional()
  changes?: any;

  @Expose()
  @IsOptional()
  metadata?: any;

  @Expose()
  timestamp!: Date;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createSuccessResponse<T>(data?: T, message?: string): SuccessResponseDto<T> {
  return new SuccessResponseDto(data, message);
}

export function createErrorResponse(code: string, message: string, details?: any, path?: string): ErrorResponseDto {
  const error: ErrorDetailDto = {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    path
  };
  return new ErrorResponseDto(error);
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMetaDto,
  message?: string
): PaginatedResponseDto<T> {
  return {
    data,
    pagination,
    success: true,
    message
  };
}