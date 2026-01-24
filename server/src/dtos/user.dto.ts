import { IsEmail, IsString, IsOptional, IsBoolean, IsUrl, IsDate, MinLength, MaxLength } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsOptional()
  @IsBoolean({ message: 'Email verification status must be a boolean' })
  isEmailVerified?: boolean;

  @IsOptional()
  @IsString({ message: 'Google ID must be a string' })
  googleId?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  profilePicture?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name cannot be empty' })
  @MaxLength(50, { message: 'First name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name cannot be empty' })
  @MaxLength(50, { message: 'Last name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  profilePicture?: string;
}

export class GetUserByEmailDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class GetUserByIdDto {
  @IsString({ message: 'User ID must be a string' })
  @MinLength(1, { message: 'User ID is required' })
  id!: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  isEmailVerified!: boolean;

  @Expose()
  @IsOptional()
  profilePicture?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  @IsOptional()
  lastLoginAt?: Date;

  // Exclude sensitive and internal fields
  @Exclude()
  password?: string;

  @Exclude()
  googleId?: string;

  @Exclude()
  _id?: string;

  @Exclude()
  __v?: number;

  // Virtual fields
  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @Expose()
  get initials(): string {
    return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
  }
}

export class UserProfileResponseDto extends UserResponseDto {
  // Include additional fields for profile view
  @Expose()
  @IsOptional()
  googleId?: string;

  @Expose()
  updatedAt!: Date;

  // Additional profile-specific virtual fields
  @Expose()
  get accountAge(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  @Expose()
  get hasProfilePicture(): boolean {
    return !!this.profilePicture;
  }

  @Expose()
  get isGoogleUser(): boolean {
    return !!this.googleId;
  }
}

export class UserListResponseDto {
  @Expose()
  @Type(() => UserResponseDto)
  users!: UserResponseDto[];

  @Expose()
  total!: number;

  @Expose()
  page!: number;

  @Expose()
  limit!: number;

  @Expose()
  totalPages!: number;

  @Expose()
  hasNext!: boolean;

  @Expose()
  hasPrev!: boolean;
}

export class UserStatsResponseDto {
  @Expose()
  totalUsers!: number;

  @Expose()
  verifiedUsers!: number;

  @Expose()
  unverifiedUsers!: number;

  @Expose()
  googleUsers!: number;

  @Expose()
  regularUsers!: number;

  @Expose()
  recentRegistrations!: number; // last 7 days

  @Expose()
  activeUsers!: number; // logged in within last 30 days

  @Expose()
  verificationRate!: number; // percentage
}

// ============================================================================
// ADMIN DTOs (for administrative operations)
// ============================================================================

export class AdminUserResponseDto extends UserProfileResponseDto {
  // Include all fields for admin view
  @Expose()
  googleId?: string;

  @Expose()
  updatedAt!: Date;

  // Admin-specific fields
  @Expose()
  get registrationSource(): string {
    return this.googleId ? 'Google OAuth' : 'Email Registration';
  }

  @Expose()
  get lastActivity(): string {
    if (!this.lastLoginAt) return 'Never';
    
    const daysSince = Math.floor((Date.now() - this.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) return 'Today';
    if (daysSince === 1) return 'Yesterday';
    return `${daysSince} days ago`;
  }
}

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'Email verification status must be a boolean' })
  isEmailVerified!: boolean;

  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;
}

// ============================================================================
// SEARCH AND FILTER DTOs
// ============================================================================

export class SearchUsersDto {
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MinLength(1, { message: 'Search term cannot be empty' })
  @MaxLength(100, { message: 'Search term cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  searchTerm?: string;

  @IsOptional()
  @IsBoolean({ message: 'Verified filter must be a boolean' })
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Google user filter must be a boolean' })
  isGoogleUser?: boolean;

  @IsOptional()
  @IsString({ message: 'Sort by must be a string' })
  sortBy?: 'createdAt' | 'lastLoginAt' | 'email' | 'firstName' | 'lastName';

  @IsOptional()
  @IsString({ message: 'Sort order must be a string' })
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}

// ============================================================================
// UTILITY DTOs
// ============================================================================

export class UserValidationResponseDto {
  @Expose()
  isValid!: boolean;

  @Expose()
  @IsOptional()
  errors?: string[];

  @Expose()
  @IsOptional()
  warnings?: string[];
}

export class BulkUserOperationDto {
  @Expose()
  processed!: number;

  @Expose()
  successful!: number;

  @Expose()
  failed!: number;

  @Expose()
  @IsOptional()
  errors?: Array<{
    userId: string;
    error: string;
    email?: string;
  }>;
}