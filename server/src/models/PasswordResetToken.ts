import { Schema, model, Document, Types, Model } from 'mongoose';
import { IsString, IsDate, IsOptional } from 'class-validator';

// PasswordResetToken interface for TypeScript typing
export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isUsed: boolean;
}

// PasswordResetToken document interface extending Mongoose Document
export interface IPasswordResetTokenDocument extends IPasswordResetToken, Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  isExpired(): boolean;
  isValid(): boolean;
  markAsUsed(): Promise<IPasswordResetTokenDocument>;
}

// PasswordResetToken model interface with static methods
export interface IPasswordResetTokenModel extends Model<IPasswordResetTokenDocument> {
  findByToken(token: string): Promise<IPasswordResetTokenDocument | null>;
  findValidByToken(token: string): Promise<IPasswordResetTokenDocument | null>;
  findActiveByUserId(userId: string | Types.ObjectId): Promise<IPasswordResetTokenDocument[]>;
  invalidateAllUserTokens(userId: string | Types.ObjectId): Promise<any>;
  cleanupExpiredTokens(): Promise<any>;
  getUserTokenCount(userId: string | Types.ObjectId): Promise<number>;
}

// PasswordResetToken validation class for DTO validation
export class PasswordResetTokenValidation {
  @IsString({ message: 'User ID must be a string' })
  userId!: string;

  @IsString({ message: 'Token must be a string' })
  token!: string;

  @IsDate({ message: 'Expiration date must be a valid date' })
  expiresAt!: Date;

  @IsOptional()
  @IsDate({ message: 'Created date must be a valid date' })
  createdAt?: Date;
}

// Mongoose schema definition
const passwordResetTokenSchema = new Schema<IPasswordResetTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true // Index for fast user token lookups
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
      index: true // Index for fast token lookups
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true // Index for TTL and cleanup operations
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true // Index for filtering used tokens
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
    versionKey: false, // Disable __v field
    toJSON: {
      transform: function(doc, ret: any) {
        // Transform _id to id and exclude sensitive data
        ret.id = ret._id;
        delete ret._id;
        delete ret.token; // Don't expose token in JSON
        return ret;
      }
    },
    toObject: {
      transform: function(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    }
  }
);

// Compound indexes for performance optimization
passwordResetTokenSchema.index({ userId: 1, isUsed: 1 }); // For finding active user tokens
passwordResetTokenSchema.index({ token: 1, isUsed: 1 }); // For token validation
passwordResetTokenSchema.index({ expiresAt: 1, isUsed: 1 }); // For cleanup operations
passwordResetTokenSchema.index({ userId: 1, createdAt: -1 }); // For sorting user tokens by creation date

// TTL index to automatically delete expired tokens after 1 day of expiration
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

// Pre-save middleware for validation
passwordResetTokenSchema.pre('save', function(next) {
  // Ensure expiration date is in the future for new tokens
  if (this.isNew && this.expiresAt <= new Date()) {
    return next(new Error('Expiration date must be in the future'));
  }
  
  // Ensure token is not empty
  if (!this.token || this.token.trim().length === 0) {
    return next(new Error('Token cannot be empty'));
  }
  
  next();
});

// Instance methods
passwordResetTokenSchema.methods.isExpired = function(): boolean {
  return this.expiresAt <= new Date();
};

passwordResetTokenSchema.methods.isValid = function(): boolean {
  return !this.isUsed && !this.isExpired();
};

passwordResetTokenSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  return this.save();
};

// Static methods
passwordResetTokenSchema.statics.findByToken = function(token: string) {
  return this.findOne({ token, isUsed: false });
};

passwordResetTokenSchema.statics.findValidByToken = function(token: string) {
  return this.findOne({ 
    token, 
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
};

passwordResetTokenSchema.statics.findActiveByUserId = function(userId: string | Types.ObjectId) {
  return this.find({ 
    userId, 
    isUsed: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

passwordResetTokenSchema.statics.invalidateAllUserTokens = function(userId: string | Types.ObjectId) {
  return this.updateMany(
    { userId, isUsed: false },
    { $set: { isUsed: true } }
  );
};

passwordResetTokenSchema.statics.cleanupExpiredTokens = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isUsed: true, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    ]
  });
};

passwordResetTokenSchema.statics.getUserTokenCount = function(userId: string | Types.ObjectId) {
  return this.countDocuments({ 
    userId, 
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
};

// Virtual for checking if token is valid
passwordResetTokenSchema.virtual('isValidToken').get(function() {
  return !this.isUsed && this.expiresAt > new Date();
});

// Ensure virtual fields are serialized
passwordResetTokenSchema.set('toJSON', { virtuals: true });
passwordResetTokenSchema.set('toObject', { virtuals: true });

// Create and export the model
export const PasswordResetToken = model<IPasswordResetTokenDocument, IPasswordResetTokenModel>('PasswordResetToken', passwordResetTokenSchema);

// Export the schema for testing purposes
export { passwordResetTokenSchema };