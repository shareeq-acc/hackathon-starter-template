import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';
import { QuoteSource } from '../models/Quote';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class GetQuoteByThemeDto {
  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  @MinLength(1, { message: 'Theme cannot be empty' })
  @MaxLength(50, { message: 'Theme cannot exceed 50 characters' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  theme?: string;
}

export class CreateQuoteDto {
  @IsString({ message: 'Quote text must be a string' })
  @MinLength(10, { message: 'Quote text must be at least 10 characters long' })
  @MaxLength(1000, { message: 'Quote text cannot exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  text!: string;

  @IsOptional()
  @IsString({ message: 'Author must be a string' })
  @MaxLength(100, { message: 'Author name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  author?: string;

  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  @MaxLength(50, { message: 'Theme cannot exceed 50 characters' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  theme?: string;

  @IsIn(['gemini', 'fallback'], { message: 'Source must be either "gemini" or "fallback"' })
  source!: QuoteSource;
}

export class SearchQuotesDto {
  @IsString({ message: 'Search term must be a string' })
  @MinLength(1, { message: 'Search term cannot be empty' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  searchTerm!: string;

  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  theme?: string;

  @IsOptional()
  @IsString({ message: 'Author must be a string' })
  @Transform(({ value }) => value?.trim())
  author?: string;
}

export class GenerateQuoteDto {
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

export class QuoteResponseDto {
  @Expose()
  id!: string;

  @Expose()
  text!: string;

  @Expose()
  @IsOptional()
  author?: string;

  @Expose()
  @IsOptional()
  theme?: string;

  @Expose()
  source!: QuoteSource;

  @Expose()
  createdAt!: Date;

  // Exclude internal fields
  @Exclude()
  _id?: string;

  @Exclude()
  __v?: number;

  // Virtual fields
  @Expose()
  get displayText(): string {
    let display = `"${this.text}"`;
    if (this.author) {
      display += ` - ${this.author}`;
    }
    return display;
  }

  @Expose()
  get isFromAI(): boolean {
    return this.source === 'gemini';
  }

  @Expose()
  get length(): number {
    return this.text ? this.text.length : 0;
  }
}

export class QuoteListResponseDto {
  @Expose()
  @Type(() => QuoteResponseDto)
  quotes!: QuoteResponseDto[];

  @Expose()
  total!: number;

  @Expose()
  @IsOptional()
  theme?: string;

  @Expose()
  @IsOptional()
  searchTerm?: string;
}

export class RandomQuoteResponseDto extends QuoteResponseDto {
  @Expose()
  @IsOptional()
  requestedTheme?: string;

  @Expose()
  @IsOptional()
  fallbackUsed?: boolean;
}

export class QuoteStatsResponseDto {
  @Expose()
  totalQuotes!: number;

  @Expose()
  aiGeneratedCount!: number;

  @Expose()
  fallbackCount!: number;

  @Expose()
  themes!: string[];

  @Expose()
  authors!: string[];

  @Expose()
  recentQuotesCount!: number; // quotes from last 7 days

  @Expose()
  averageLength!: number;
}

// ============================================================================
// GENERATION RESPONSE DTOs
// ============================================================================

export class GenerateQuoteResponseDto extends QuoteResponseDto {
  @Expose()
  generationTime!: number; // in milliseconds

  @Expose()
  @IsOptional()
  requestedTheme?: string;

  @Expose()
  @IsOptional()
  requestedStyle?: string;

  @Expose()
  @IsOptional()
  requestedContext?: string;

  @Expose()
  cached!: boolean; // whether this was retrieved from cache

  @Expose()
  @IsOptional()
  fallbackReason?: string; // reason if fallback was used
}

// ============================================================================
// CACHE MANAGEMENT DTOs
// ============================================================================

export class CacheStatsResponseDto {
  @Expose()
  totalCachedQuotes!: number;

  @Expose()
  cacheHitRate!: number; // percentage

  @Expose()
  oldestCacheEntry!: Date;

  @Expose()
  newestCacheEntry!: Date;

  @Expose()
  cacheSize!: number; // in bytes (approximate)

  @Expose()
  themesInCache!: string[];
}

export class ClearCacheDto {
  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  theme?: string;

  @IsOptional()
  @IsIn(['gemini', 'fallback'], { message: 'Source must be either "gemini" or "fallback"' })
  source?: QuoteSource;

  @IsOptional()
  @IsString({ message: 'Age must be a string representing days' })
  olderThanDays?: string; // e.g., "30" for quotes older than 30 days
}

// ============================================================================
// UTILITY DTOs
// ============================================================================

export class QuoteValidationResponseDto {
  @Expose()
  isValid!: boolean;

  @Expose()
  @IsOptional()
  errors?: string[];

  @Expose()
  @IsOptional()
  warnings?: string[];

  @Expose()
  @IsOptional()
  suggestions?: string[];
}

export class BulkQuoteOperationDto {
  @Expose()
  processed!: number;

  @Expose()
  successful!: number;

  @Expose()
  failed!: number;

  @Expose()
  @IsOptional()
  errors?: Array<{
    index: number;
    error: string;
    quote?: Partial<QuoteResponseDto>;
  }>;
}