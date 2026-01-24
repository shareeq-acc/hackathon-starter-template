import { Schema, model, Document, Types, Model } from 'mongoose';
import { IsEmail, IsString, MinLength, IsBoolean, IsOptional, IsUrl, IsDate } from 'class-validator';

// User interface for TypeScript typing
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  password?: string; // Optional for OAuth users
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  googleId?: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// User document interface extending Mongoose Document
export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

// User model interface with static methods
export interface IUserModel extends Model<IUserDocument> {
  findByEmail(email: string): Promise<IUserDocument | null>;
  findVerifiedUsers(): Promise<IUserDocument[]>;
  findByGoogleId(googleId: string): Promise<IUserDocument | null>;
}

// User validation class for DTO validation
export class UserValidation {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name is required' })
  firstName!: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name is required' })
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

  @IsOptional()
  @IsDate({ message: 'Last login date must be a valid date' })
  lastLoginAt?: Date;
}

// Mongoose schema definition
const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(email: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Please provide a valid email address'
      },
      index: true // Index for fast email lookups
    },
    password: {
      type: String,
      required: function(this: IUserDocument) {
        // Password is required only if googleId is not present
        return !this.googleId;
      },
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true // Index for filtering verified users
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      index: true // Index for OAuth lookups
    },
    profilePicture: {
      type: String,
      validate: {
        validator: function(url: string) {
          if (!url) return true; // Optional field
          return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
        },
        message: 'Profile picture must be a valid image URL'
      }
    },
    lastLoginAt: {
      type: Date,
      index: true // Index for analytics and user activity tracking
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false, // Disable __v field
    toJSON: {
      transform: function(doc, ret: any) {
        // Transform _id to id and remove sensitive fields
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        return ret;
      }
    },
    toObject: {
      transform: function(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        return ret;
      }
    }
  }
);

// Compound indexes for performance optimization
userSchema.index({ email: 1, isEmailVerified: 1 }); // For verified user lookups
userSchema.index({ googleId: 1 }, { sparse: true }); // For OAuth user lookups
userSchema.index({ createdAt: -1 }); // For sorting by registration date
userSchema.index({ lastLoginAt: -1 }); // For sorting by activity

// Pre-save middleware for additional validation
userSchema.pre('save', function(next) {
  // Ensure either password or googleId is present
  if (!this.password && !this.googleId) {
    return next(new Error('Either password or Google ID must be provided'));
  }
  
  // Auto-verify email for Google OAuth users
  if (this.googleId && !this.isEmailVerified) {
    this.isEmailVerified = true;
  }
  
  next();
});

// Instance methods
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Static methods
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findVerifiedUsers = function() {
  return this.find({ isEmailVerified: true });
};

userSchema.statics.findByGoogleId = function(googleId: string) {
  return this.findOne({ googleId });
};

// Create and export the model
export const User = model<IUserDocument, IUserModel>('User', userSchema);

// Export the schema for testing purposes
export { userSchema };