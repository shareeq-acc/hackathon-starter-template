import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { Transform, Exclude, Expose, Type } from 'class-transformer';

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name is required' })
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name is required' })
  @Transform(({ value }) => value?.trim())
  lastName!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token must be a string' })
  @MinLength(1, { message: 'Refresh token is required' })
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Reset token must be a string' })
  @MinLength(1, { message: 'Reset token is required' })
  token!: string;

  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword!: string;
}

export class GoogleOAuthDto {
  @IsString({ message: 'Authorization code must be a string' })
  @MinLength(1, { message: 'Authorization code is required' })
  code!: string;

  @IsOptional()
  @IsString({ message: 'State must be a string' })
  state?: string;
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
  @IsOptional()
  googleId?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  @IsOptional()
  lastLoginAt?: Date;

  // Exclude sensitive fields
  @Exclude()
  password?: string;

  @Exclude()
  _id?: string;

  @Exclude()
  __v?: number;

  // Virtual field for full name
  @Expose()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export class TokenResponseDto {
  @Expose()
  accessToken!: string;

  @Expose()
  refreshToken!: string;

  @Expose()
  expiresIn!: number; // in seconds

  @Expose()
  tokenType: string = 'Bearer';
}

export class AuthResponseDto {
  @Expose()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;

  @Expose()
  @Type(() => TokenResponseDto)
  tokens!: TokenResponseDto;

  @Expose()
  message?: string;
}

export class LogoutResponseDto {
  @Expose()
  message: string = 'Successfully logged out';

  @Expose()
  success: boolean = true;
}

// ============================================================================
// PROFILE UPDATE DTOs
// ============================================================================

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name cannot be empty' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name cannot be empty' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  profilePicture?: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'Current password must be a string' })
  @MinLength(1, { message: 'Current password is required' })
  currentPassword!: string;

  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword!: string;
}

// ============================================================================
// EMAIL VERIFICATION DTOs
// ============================================================================

export class VerifyEmailDto {
  @IsString({ message: 'Verification token must be a string' })
  @MinLength(1, { message: 'Verification token is required' })
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

// ============================================================================
// UTILITY RESPONSE DTOs
// ============================================================================

export class MessageResponseDto {
  @Expose()
  message!: string;

  @Expose()
  success: boolean = true;

  @Expose()
  @IsOptional()
  data?: any;
}

export class ErrorResponseDto {
  @Expose()
  success: boolean = false;

  @Expose()
  error!: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
  };
}