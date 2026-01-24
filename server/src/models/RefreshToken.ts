import { Schema, model, Document, Types, Model } from 'mongoose';
import { IsString, IsBoolean, IsDate, IsOptional } from 'class-validator';

// RefreshToken interface for TypeScript typing
export interface IRefreshToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

// RefreshToken document interface extending Mongoose Document
export interface IRefreshTokenDocument extends IRefreshToken, Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  isExpired(): boolean;
  isActive(): boolean;
  revoke(): Promise<IRefreshTokenDocument>;
}

// RefreshToken model interface with static methods
export interface IRefreshTokenModel extends Model<IRefreshTokenDocument> {
  findByToken(token: string): Promise<IRefreshTokenDocument | null>;
  findActiveByUserId(userId: string | Types.ObjectId): Promise<IRefreshTokenDocument[]>;
  revokeAllUserTokens(userId: string | Types.ObjectId): Promise<any>;
  cleanupExpiredTokens(): Promise<any>;
  findExpiredTokens(): Promise<IRefreshTokenDocument[]>;
  getUserTokenCount(userId: string | Types.ObjectId): Promise<number>;
}

// RefreshToken validation class for DTO validation
export class RefreshTokenValidation {
  @IsString({ message: 'User ID must be a string' })
  userId!: string;

  @IsString({ message: 'Token must be a string' })
  token!: string;

  @IsDate({ message: 'Expiration date must be a valid date' })
  expiresAt!: Date;

  @IsOptional()
  @IsBoolean({ message: 'Revoked status must be a boolean' })
  isRevoked?: boolean;

  @IsOptional()
  @IsDate({ message: 'Created date must be a valid date' })
  createdAt?: Date;
}

// Mongoose schema definition
const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
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
    isRevoked: {
      type: Boolean,
      default: false,
      index: true // Index for filtering active tokens
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
    versionKey: false, // Disable __v field
    toJSON: {
      transform: function(doc, ret: any) {
        // Transform _id to id
        ret.id = ret._id;
        delete ret._id;
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
refreshTokenSchema.index({ userId: 1, isRevoked: 1 }); // For finding active user tokens
refreshTokenSchema.index({ token: 1, isRevoked: 1 }); // For token validation
refreshTokenSchema.index({ expiresAt: 1, isRevoked: 1 }); // For cleanup operations
refreshTokenSchema.index({ userId: 1, createdAt: -1 }); // For sorting user tokens by creation date

// TTL index to automatically delete expired tokens after 7 days of expiration
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Pre-save middleware for validation
refreshTokenSchema.pre('save', function(next) {
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
refreshTokenSchema.methods.isExpired = function(): boolean {
  return this.expiresAt <= new Date();
};

refreshTokenSchema.methods.isActive = function(): boolean {
  return !this.isRevoked && !this.isExpired();
};

refreshTokenSchema.methods.revoke = function() {
  this.isRevoked = true;
  return this.save();
};

// Static methods
refreshTokenSchema.statics.findByToken = function(token: string) {
  return this.findOne({ token, isRevoked: false });
};

refreshTokenSchema.statics.findActiveByUserId = function(userId: string | Types.ObjectId) {
  return this.find({ 
    userId, 
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

refreshTokenSchema.statics.revokeAllUserTokens = function(userId: string | Types.ObjectId) {
  return this.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

refreshTokenSchema.statics.cleanupExpiredTokens = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true, createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    ]
  });
};

refreshTokenSchema.statics.findExpiredTokens = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isRevoked: false
  });
};

refreshTokenSchema.statics.getUserTokenCount = function(userId: string | Types.ObjectId) {
  return this.countDocuments({ 
    userId, 
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  });
};

// Virtual for checking if token is valid
refreshTokenSchema.virtual('isValid').get(function() {
  return !this.isRevoked && this.expiresAt > new Date();
});

// Ensure virtual fields are serialized
refreshTokenSchema.set('toJSON', { virtuals: true });
refreshTokenSchema.set('toObject', { virtuals: true });

// Create and export the model
export const RefreshToken = model<IRefreshTokenDocument, IRefreshTokenModel>('RefreshToken', refreshTokenSchema);

// Export the schema for testing purposes
export { refreshTokenSchema };