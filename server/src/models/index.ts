// ============================================================================
// MODEL EXPORTS
// ============================================================================

// User Model
export {
  User,
  userSchema,
  type IUser,
  type IUserDocument,
  UserValidation
} from './User';

// RefreshToken Model
export {
  RefreshToken,
  refreshTokenSchema,
  type IRefreshToken,
  type IRefreshTokenDocument,
  RefreshTokenValidation
} from './RefreshToken';

// PasswordResetToken Model
export {
  PasswordResetToken,
  passwordResetTokenSchema,
  type IPasswordResetToken,
  type IPasswordResetTokenDocument,
  PasswordResetTokenValidation
} from './PasswordResetToken';

// Quote Model
export {
  Quote,
  quoteSchema,
  type IQuote,
  type IQuoteDocument,
  type QuoteSource,
  QuoteValidation
} from './Quote';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Re-export commonly used types
export type { Document, Types } from 'mongoose';

// ============================================================================
// MODEL COLLECTIONS
// ============================================================================

import { User } from './User';
import { RefreshToken } from './RefreshToken';
import { PasswordResetToken } from './PasswordResetToken';
import { Quote } from './Quote';
import { userSchema } from './User';
import { refreshTokenSchema } from './RefreshToken';
import { passwordResetTokenSchema } from './PasswordResetToken';
import { quoteSchema } from './Quote';
import { UserValidation } from './User';
import { RefreshTokenValidation } from './RefreshToken';
import { PasswordResetTokenValidation } from './PasswordResetToken';
import { QuoteValidation } from './Quote';

// Collection of all models for easy access
export const Models = {
  User,
  RefreshToken,
  PasswordResetToken,
  Quote
} as const;

// Collection of all schemas for testing purposes
export const Schemas = {
  userSchema,
  refreshTokenSchema,
  passwordResetTokenSchema,
  quoteSchema
} as const;

// Collection of all validation classes
export const Validations = {
  UserValidation,
  RefreshTokenValidation,
  PasswordResetTokenValidation,
  QuoteValidation
} as const;

// ============================================================================
// MODEL UTILITIES
// ============================================================================

// Helper function to get all model names
export function getModelNames(): string[] {
  return Object.keys(Models);
}

// Helper function to check if a model exists
export function hasModel(modelName: string): boolean {
  return modelName in Models;
}

// Helper function to get model by name
export function getModel(modelName: keyof typeof Models) {
  return Models[modelName];
}

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

// Helper function to drop all collections (useful for testing)
export async function dropAllCollections(): Promise<void> {
  const promises = Object.values(Models).map(model => 
    model.collection.drop().catch(() => {
      // Ignore errors if collection doesn't exist
    })
  );
  
  await Promise.all(promises);
}

// Helper function to create indexes for all models
export async function createAllIndexes(): Promise<void> {
  const promises = Object.values(Models).map(model => 
    model.createIndexes()
  );
  
  await Promise.all(promises);
}

// Helper function to get collection stats
export async function getCollectionStats() {
  const stats: Record<string, any> = {};
  
  for (const [name, model] of Object.entries(Models)) {
    try {
      const count = await model.countDocuments();
      const indexes = await model.collection.getIndexes();
      
      stats[name] = {
        documentCount: count,
        indexCount: Object.keys(indexes).length,
        indexes: Object.keys(indexes)
      };
    } catch (error) {
      stats[name] = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  return stats;
}