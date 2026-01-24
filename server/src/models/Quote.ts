import { Schema, model, Document, Types } from 'mongoose';
import { IsString, IsOptional, IsIn, IsDate } from 'class-validator';

// Quote source types
export type QuoteSource = 'gemini' | 'fallback';

// Quote interface for TypeScript typing
export interface IQuote {
  _id: Types.ObjectId;
  text: string;
  author?: string;
  theme?: string;
  source: QuoteSource;
  createdAt: Date;
}

// Quote document interface extending Mongoose Document
export interface IQuoteDocument extends IQuote, Document {
  _id: Types.ObjectId;
}

// Quote validation class for DTO validation
export class QuoteValidation {
  @IsString({ message: 'Quote text must be a string' })
  text!: string;

  @IsOptional()
  @IsString({ message: 'Author must be a string' })
  author?: string;

  @IsOptional()
  @IsString({ message: 'Theme must be a string' })
  theme?: string;

  @IsIn(['gemini', 'fallback'], { message: 'Source must be either "gemini" or "fallback"' })
  source!: QuoteSource;

  @IsOptional()
  @IsDate({ message: 'Created date must be a valid date' })
  createdAt?: Date;
}

// Mongoose schema definition
const quoteSchema = new Schema<IQuoteDocument>(
  {
    text: {
      type: String,
      required: [true, 'Quote text is required'],
      trim: true,
      minlength: [10, 'Quote text must be at least 10 characters long'],
      maxlength: [1000, 'Quote text cannot exceed 1000 characters'],
      index: 'text' // Text index for search functionality
    },
    author: {
      type: String,
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters'],
      index: true // Index for filtering by author
    },
    theme: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [50, 'Theme cannot exceed 50 characters'],
      index: true // Index for filtering by theme
    },
    source: {
      type: String,
      required: [true, 'Quote source is required'],
      enum: {
        values: ['gemini', 'fallback'],
        message: 'Source must be either "gemini" or "fallback"'
      },
      index: true // Index for filtering by source
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
quoteSchema.index({ theme: 1, source: 1 }); // For theme-based quote retrieval
quoteSchema.index({ source: 1, createdAt: -1 }); // For source-based sorting
quoteSchema.index({ createdAt: -1 }); // For sorting by creation date
quoteSchema.index({ author: 1, theme: 1 }); // For author and theme filtering

// TTL index to automatically delete old cached quotes after 30 days
quoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Pre-save middleware for validation and sanitization
quoteSchema.pre('save', function(next) {
  // Sanitize quote text
  if (this.text) {
    // Remove excessive whitespace and normalize
    this.text = this.text.replace(/\s+/g, ' ').trim();
    
    // Ensure quote ends with proper punctuation
    if (!/[.!?]$/.test(this.text)) {
      this.text += '.';
    }
  }
  
  // Normalize theme to lowercase
  if (this.theme) {
    this.theme = this.theme.toLowerCase().trim();
  }
  
  // Normalize author name
  if (this.author) {
    this.author = this.author.trim();
    // Capitalize first letter of each word
    this.author = this.author.replace(/\b\w/g, l => l.toUpperCase());
  }
  
  next();
});

// Instance methods
quoteSchema.methods.isFromAI = function(): boolean {
  return this.source === 'gemini';
};

quoteSchema.methods.isFallback = function(): boolean {
  return this.source === 'fallback';
};

quoteSchema.methods.getDisplayText = function(): string {
  let display = `"${this.text}"`;
  if (this.author) {
    display += ` - ${this.author}`;
  }
  return display;
};

quoteSchema.methods.hasTheme = function(theme: string): boolean {
  return this.theme === theme.toLowerCase().trim();
};

// Static methods
quoteSchema.statics.findByTheme = function(theme: string) {
  return this.find({ theme: theme.toLowerCase().trim() }).sort({ createdAt: -1 });
};

quoteSchema.statics.findBySource = function(source: QuoteSource) {
  return this.find({ source }).sort({ createdAt: -1 });
};

quoteSchema.statics.findByAuthor = function(author: string) {
  return this.find({ 
    author: new RegExp(author.trim(), 'i') 
  }).sort({ createdAt: -1 });
};

quoteSchema.statics.getRandomQuote = function(theme?: string) {
  const matchStage: any = {};
  if (theme) {
    matchStage.theme = theme.toLowerCase().trim();
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $sample: { size: 1 } }
  ]);
};

quoteSchema.statics.getRecentQuotes = function(limit: number = 10, theme?: string) {
  const query: any = {};
  if (theme) {
    query.theme = theme.toLowerCase().trim();
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit);
};

quoteSchema.statics.getFallbackQuotes = function() {
  return this.find({ source: 'fallback' }).sort({ createdAt: -1 });
};

quoteSchema.statics.getAIQuotes = function() {
  return this.find({ source: 'gemini' }).sort({ createdAt: -1 });
};

quoteSchema.statics.searchQuotes = function(searchTerm: string) {
  return this.find({
    $or: [
      { text: new RegExp(searchTerm, 'i') },
      { author: new RegExp(searchTerm, 'i') },
      { theme: new RegExp(searchTerm, 'i') }
    ]
  }).sort({ createdAt: -1 });
};

quoteSchema.statics.getQuoteStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        themes: { $addToSet: '$theme' }
      }
    }
  ]);
};

quoteSchema.statics.cleanupOldQuotes = function(daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({ 
    createdAt: { $lt: cutoffDate },
    source: 'gemini' // Only cleanup AI-generated quotes, keep fallback quotes
  });
};

// Virtual for quote length
quoteSchema.virtual('length').get(function() {
  return this.text ? this.text.length : 0;
});

// Virtual for age in days
quoteSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Ensure virtual fields are serialized
quoteSchema.set('toJSON', { virtuals: true });
quoteSchema.set('toObject', { virtuals: true });

// Create and export the model
export const Quote = model<IQuoteDocument>('Quote', quoteSchema);

// Export the schema for testing purposes
export { quoteSchema };