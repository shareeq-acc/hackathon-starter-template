import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { User, IUserDocument } from '../models/User';
import { PasswordResetToken, IPasswordResetTokenDocument } from '../models/PasswordResetToken';
import { TokenService, ITokenService, TokenPair } from './TokenService';
import { 
  RegisterDto, 
  LoginDto, 
  AuthResponseDto, 
  UserResponseDto, 
  TokenResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto
} from '../dtos/auth.dto';
import { CreateUserDto } from '../dtos/user.dto';

// Auth service interface
export interface IAuthService {
  register(userData: RegisterDto): Promise<AuthResponseDto>;
  login(credentials: LoginDto): Promise<AuthResponseDto>;
  refreshToken(refreshToken: string): Promise<TokenResponseDto>;
  logout(refreshToken: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
  validateUser(userId: string): Promise<UserResponseDto>;
  forgotPassword(email: string): Promise<string>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  validateResetToken(token: string): Promise<string>;
}

// Custom error classes
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class AuthService implements IAuthService {
  private tokenService: ITokenService;

  constructor(tokenService: ITokenService) {
    this.tokenService = tokenService;
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Validate password strength
      this.validatePasswordStrength(userData.password);

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user data
      const createUserData: CreateUserDto = {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isEmailVerified: false // Email verification required
      };

      // Create user
      const user = new User(createUserData);
      const savedUser = await user.save();

      // Generate tokens
      const tokens = await this.tokenService.generateTokens(
        savedUser._id.toString(),
        savedUser.email
      );

      // Update last login
      savedUser.lastLoginAt = new Date();
      await savedUser.save();

      // Prepare response
      const userResponse = this.mapUserToResponse(savedUser);
      const tokenResponse = this.mapTokensToResponse(tokens);

      return {
        user: userResponse,
        tokens: tokenResponse,
        message: 'User registered successfully. Please verify your email.'
      };
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginDto): Promise<AuthResponseDto> {
    try {
      // Find user by email (include password for verification)
      const user = await User.findOne({ email: credentials.email }).select('+password');
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      if (!user.password) {
        throw new AuthenticationError('Invalid login method. Please use Google OAuth.');
      }

      const isPasswordValid = await this.verifyPassword(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokens(
        user._id.toString(),
        user.email
      );

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Prepare response
      const userResponse = this.mapUserToResponse(user);
      const tokenResponse = this.mapTokensToResponse(tokens);

      return {
        user: userResponse,
        tokens: tokenResponse,
        message: 'Login successful'
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      // Verify refresh token and get user ID
      const userId = await this.tokenService.verifyRefreshToken(refreshToken);

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Revoke old refresh token
      await this.tokenService.revokeRefreshToken(refreshToken);

      // Generate new token pair
      const tokens = await this.tokenService.generateTokens(
        user._id.toString(),
        user.email
      );

      return this.mapTokensToResponse(tokens);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await this.tokenService.revokeRefreshToken(refreshToken);
    } catch (error) {
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logout user from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      await this.tokenService.revokeAllUserTokens(userId);
    } catch (error) {
      throw new Error(`Logout all failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate user and return user data
   */
  async validateUser(userId: string): Promise<UserResponseDto> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      return this.mapUserToResponse(user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error(`User validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Password verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new ValidationError('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new ValidationError('Password is too common. Please choose a stronger password');
    }
  }

  /**
   * Map user document to response DTO
   */
  private mapUserToResponse(user: IUserDocument): UserResponseDto {
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }
    };
  }

  /**
   * Map token pair to response DTO
   */
  private mapTokensToResponse(tokens: TokenPair): TokenResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * Create user from OAuth data
   */
  async createOAuthUser(oauthData: {
    email: string;
    firstName: string;
    lastName: string;
    googleId: string;
    profilePicture?: string;
  }): Promise<IUserDocument> {
    try {
      const createUserData: CreateUserDto = {
        email: oauthData.email,
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        googleId: oauthData.googleId,
        profilePicture: oauthData.profilePicture,
        isEmailVerified: true // OAuth users are pre-verified
      };

      const user = new User(createUserData);
      return await user.save();
    } catch (error) {
      throw new Error(`OAuth user creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
    } catch (error) {
      throw new Error(`Failed to update last login: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const user = await User.findByEmail(email);
      return !!user;
    } catch (error) {
      throw new Error(`Email check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUserDocument | null> {
    try {
      return await User.findByEmail(email);
    } catch (error) {
      throw new Error(`Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUserDocument | null> {
    try {
      return await User.findById(userId);
    } catch (error) {
      throw new Error(`Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate password reset token
   */
  async forgotPassword(email: string): Promise<string> {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        throw new AuthenticationError('If the email exists, a password reset link has been sent');
      }

      // Check if user has a password (not OAuth-only user)
      if (!user.password) {
        throw new ValidationError('This account uses Google OAuth. Please sign in with Google.');
      }

      // Invalidate any existing reset tokens for this user
      await PasswordResetToken.invalidateAllUserTokens(user._id);

      // Generate secure reset token
      const resetToken = this.generateSecureResetToken();
      
      // Set expiration time (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Save reset token to database
      const passwordResetToken = new PasswordResetToken({
        userId: user._id,
        token: resetToken,
        expiresAt,
        isUsed: false
      });

      await passwordResetToken.save();

      return resetToken;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Password reset request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      // Find and validate reset token
      const resetToken = await PasswordResetToken.findValidByToken(token);
      if (!resetToken) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Get user
      const user = await User.findById(resetToken.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user password
      user.password = hashedPassword;
      await user.save();

      // Mark reset token as used
      await resetToken.markAsUsed();

      // Revoke all existing refresh tokens for security
      await this.tokenService.revokeAllUserTokens(user._id.toString());

    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate reset token without using it
   */
  async validateResetToken(token: string): Promise<string> {
    try {
      const resetToken = await PasswordResetToken.findValidByToken(token);
      if (!resetToken) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      const user = await User.findById(resetToken.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      return user.email;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a cryptographically secure reset token
   */
  private generateSecureResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Change user password (for authenticated users)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Check if user has a password (not OAuth-only user)
      if (!user.password) {
        throw new ValidationError('This account uses Google OAuth and cannot change password');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Validate new password strength
      this.validatePasswordStrength(newPassword);

      // Check if new password is different from current
      const isSamePassword = await this.verifyPassword(newPassword, user.password);
      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user password
      user.password = hashedPassword;
      await user.save();

      // Revoke all existing refresh tokens for security
      await this.tokenService.revokeAllUserTokens(userId);

    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Password change failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired reset tokens (utility method)
   */
  async cleanupExpiredResetTokens(): Promise<number> {
    try {
      const result = await PasswordResetToken.cleanupExpiredTokens();
      return result.deletedCount || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup expired reset tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Factory function to create AuthService with dependencies
export function createAuthService(tokenService?: ITokenService): AuthService {
  const tokenSvc = tokenService || new (require('./TokenService').TokenService)({
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  });

  return new AuthService(tokenSvc);
}