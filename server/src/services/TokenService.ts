import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { RefreshToken, IRefreshTokenDocument } from '../models/RefreshToken';

// Token configuration interface
export interface TokenConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Token pair interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Token service interface
export interface ITokenService {
  generateTokens(userId: string, email: string): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<string>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
  generateSecureToken(): string;
}

export class TokenService implements ITokenService {
  private config: TokenConfig;

  constructor(config: TokenConfig) {
    this.config = config;
    
    // Validate configuration
    if (!config.accessTokenSecret || !config.refreshTokenSecret) {
      throw new Error('Token secrets must be provided');
    }
  }

  /**
   * Generate access and refresh token pair for a user
   */
  async generateTokens(userId: string, email: string): Promise<TokenPair> {
    try {
      // Generate access token (JWT)
      const accessTokenPayload: JwtPayload = {
        userId,
        email
      };

      const signOptions: jwt.SignOptions = {
        expiresIn: this.config.accessTokenExpiry as StringValue,
        issuer: 'typescript-backend-api',
        audience: 'api-users'
      };

      const accessToken = jwt.sign(
        accessTokenPayload,
        this.config.accessTokenSecret,
        signOptions
      );

      // Generate refresh token (secure random string)
      const refreshTokenValue = this.generateSecureToken();
      
      // Calculate expiration time for refresh token
      const refreshTokenExpiryMs = this.parseExpiryToMs(this.config.refreshTokenExpiry);
      const expiresAt = new Date(Date.now() + refreshTokenExpiryMs);

      // Store refresh token in database
      await this.storeRefreshToken(userId, refreshTokenValue, expiresAt);

      // Calculate access token expiry in seconds
      const accessTokenExpiryMs = this.parseExpiryToMs(this.config.accessTokenExpiry);
      const expiresIn = Math.floor(accessTokenExpiryMs / 1000);

      return {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn
      };
    } catch (error) {
      throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, this.config.accessTokenSecret, {
        issuer: 'typescript-backend-api',
        audience: 'api-users'
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Verify refresh token and return associated user ID
   */
  async verifyRefreshToken(token: string): Promise<string> {
    try {
      // Find refresh token in database
      const refreshToken = await RefreshToken.findByToken(token);
      
      if (!refreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (refreshToken.isRevoked) {
        throw new Error('Refresh token has been revoked');
      }

      if (refreshToken.isExpired()) {
        // Clean up expired token
        await refreshToken.revoke();
        throw new Error('Refresh token has expired');
      }

      return refreshToken.userId.toString();
    } catch (error) {
      throw new Error(`Refresh token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const refreshToken = await RefreshToken.findByToken(token);
      
      if (refreshToken && !refreshToken.isRevoked) {
        await refreshToken.revoke();
      }
    } catch (error) {
      throw new Error(`Failed to revoke refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      await RefreshToken.revokeAllUserTokens(userId);
    } catch (error) {
      throw new Error(`Failed to revoke user tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a cryptographically secure random token
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: string, token: string, expiresAt: Date): Promise<IRefreshTokenDocument> {
    try {
      const refreshToken = new RefreshToken({
        userId: new Types.ObjectId(userId),
        token,
        expiresAt,
        isRevoked: false
      });

      return await refreshToken.save();
    } catch (error) {
      throw new Error(`Failed to store refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse expiry string to milliseconds
   */
  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }

  /**
   * Clean up expired tokens (utility method)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await RefreshToken.cleanupExpiredTokens();
      return result.deletedCount || 0;
    } catch (error) {
      throw new Error(`Failed to cleanup expired tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token statistics for a user
   */
  async getUserTokenStats(userId: string): Promise<{
    activeTokens: number;
    totalTokens: number;
    lastTokenCreated?: Date;
  }> {
    try {
      const activeTokens = await RefreshToken.getUserTokenCount(userId);
      const allUserTokens = await RefreshToken.find({ userId }).sort({ createdAt: -1 });
      
      return {
        activeTokens,
        totalTokens: allUserTokens.length,
        lastTokenCreated: allUserTokens[0]?.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to get user token stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Factory function to create TokenService with environment configuration
export function createTokenService(): TokenService {
  const config: TokenConfig = {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  };

  return new TokenService(config);
}