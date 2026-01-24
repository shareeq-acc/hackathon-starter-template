import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from '@google/generative-ai';
import { config } from '../config/environment';
import {
  GenerateTextDto,
  GenerateTextResponseDto,
  GenerateQuotePromptDto,
  LLMHealthResponseDto,
  LLMStatsResponseDto,
  LLMConfigDto,
  LLMErrorResponseDto,
  RateLimitStatusDto,
  createLLMErrorResponse,
  createGenerateTextResponse,
  createLLMHealthResponse
} from '../dtos/llm.dto';
import { QuoteResponseDto } from '../dtos/quote.dto';

// LLM service interface
export interface ILLMService {
  generateText(request: GenerateTextDto): Promise<GenerateTextResponseDto>;
  generateQuote(request?: GenerateQuotePromptDto): Promise<QuoteResponseDto>;
  healthCheck(): Promise<LLMHealthResponseDto>;
  getStats(): Promise<LLMStatsResponseDto>;
  getConfiguration(): LLMConfigDto;
  getRateLimitStatus(): RateLimitStatusDto;
  validateInput(text: string): Promise<boolean>;
  sanitizeOutput(text: string): string;
  checkQuotaStatus(): Promise<{ available: boolean; resetTime?: Date; message?: string }>;
}

// Generation options interface
export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

// Retry configuration interface
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// Rate limiting interface
interface RateLimitWindow {
  requests: number;
  windowStart: Date;
  resetTime: Date;
}

// Statistics tracking interface
interface LLMStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  totalTokensGenerated: number;
  rateLimitHits: number;
  lastRequestTime: Date;
  startTime: Date;
}

// Custom error classes
export class LLMError extends Error {
  constructor(message: string, public readonly code: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMValidationError extends LLMError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', false);
    this.name = 'LLMValidationError';
  }
}

export class LLMConnectionError extends LLMError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR', true);
    this.name = 'LLMConnectionError';
  }
}

export class LLMService implements ILLMService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;
  private apiKey: string;
  private defaultOptions: GenerationOptions;
  private retryConfig: RetryConfig;
  private rateLimitWindow: RateLimitWindow;
  private rateLimitPerMinute: number;
  private stats: LLMStats;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date = new Date();

  constructor(
    apiKey?: string,
    modelName?: string,
    options?: GenerationOptions,
    rateLimitPerMinute: number = 60,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.apiKey = apiKey || config.GOOGLE_AI_API_KEY;
    this.modelName = modelName || config.GEMINI_MODEL;
    this.rateLimitPerMinute = rateLimitPerMinute;

    if (!this.apiKey) {
      throw new LLMConnectionError('Google AI API key is required');
    }

    // Initialize Google Generative AI
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    // Set default generation options
    this.defaultOptions = {
      maxTokens: options?.maxTokens || 1024,
      temperature: options?.temperature || 0.7,
      topP: options?.topP || 0.8,
      topK: options?.topK || 40
    };

    // Set retry configuration
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries || 3,
      baseDelay: retryConfig?.baseDelay || 1000,
      maxDelay: retryConfig?.maxDelay || 30000,
      backoffMultiplier: retryConfig?.backoffMultiplier || 2,
      jitter: retryConfig?.jitter !== false // Default to true
    };

    // Initialize rate limiting
    this.rateLimitWindow = {
      requests: 0,
      windowStart: new Date(),
      resetTime: new Date(Date.now() + 60000) // 1 minute from now
    };

    // Initialize statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      totalTokensGenerated: 0,
      rateLimitHits: 0,
      lastRequestTime: new Date(),
      startTime: new Date()
    };

    // Perform initial health check
    this.performHealthCheck().catch(error => {
      console.error('Initial LLM health check failed:', error);
    });
  }

  /**
   * Generate text using Gemini API
   */
  async generateText(request: GenerateTextDto): Promise<GenerateTextResponseDto> {
    const startTime = Date.now();

    try {
      // Validate input
      await this.validateInput(request.prompt);

      // Check rate limiting
      this.checkRateLimit();

      // Prepare generation options
      const options = {
        maxTokens: request.maxTokens || this.defaultOptions.maxTokens,
        temperature: request.temperature || this.defaultOptions.temperature,
        topP: request.topP || this.defaultOptions.topP,
        topK: request.topK || this.defaultOptions.topK
      };

      // Generate content
      const result = await this.generateWithRetry(request.prompt, options);

      // Extract and sanitize response
      const generatedText = this.extractTextFromResult(result);
      const sanitizedText = this.sanitizeOutput(generatedText);

      // Calculate metrics
      const generationTime = Date.now() - startTime;
      const tokenCount = this.estimateTokenCount(sanitizedText);

      // Update statistics
      this.updateStats(true, generationTime, tokenCount);

      // Create response
      return createGenerateTextResponse(
        sanitizedText,
        request.prompt,
        this.modelName,
        generationTime,
        tokenCount,
        result.response.candidates?.[0]?.finishReason,
        this.extractSafetyRatings(result)
      );

    } catch (error) {
      const generationTime = Date.now() - startTime;
      this.updateStats(false, generationTime, 0);

      if (error instanceof LLMError) {
        throw error;
      }

      // Handle specific Gemini API errors
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('rate limit')) {
          throw new LLMRateLimitError('Rate limit exceeded. Please try again later.');
        }
        
        if (error.message.includes('safety') || error.message.includes('blocked')) {
          throw new LLMValidationError('Content was blocked due to safety policies');
        }

        if (error.message.includes('network') || error.message.includes('connection')) {
          throw new LLMConnectionError(`Network error: ${error.message}`);
        }
      }

      throw new LLMError(
        `Text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_ERROR',
        true
      );
    }
  }

  /**
   * Generate a quote using predefined prompts
   */
  async generateQuote(request?: GenerateQuotePromptDto): Promise<QuoteResponseDto> {
    try {
      const prompt = this.buildQuotePrompt(request);
      
      const generateRequest: GenerateTextDto = {
        prompt,
        maxTokens: 200,
        temperature: 0.8,
        topP: 0.9
      };

      const response = await this.generateText(generateRequest);
      
      // Parse the generated text to extract quote and author
      const { text, author } = this.parseQuoteResponse(response.text);

      // Create a proper QuoteResponseDto object
      const quote = new QuoteResponseDto();
      quote.id = ''; // Will be set by the Quote service
      quote.text = text;
      quote.author = author;
      quote.theme = request?.theme;
      quote.source = 'gemini';
      quote.createdAt = new Date();

      return quote;

    } catch (error) {
      throw new LLMError(
        `Quote generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QUOTE_GENERATION_ERROR',
        true
      );
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<LLMHealthResponseDto> {
    const startTime = Date.now();

    try {
      // Simple test prompt
      const testPrompt = 'Say "OK" if you can respond.';
      
      const result = await this.model.generateContent(testPrompt);
      const responseTime = Date.now() - startTime;
      
      if (result.response.text()) {
        this.isHealthy = true;
        this.lastHealthCheck = new Date();
        return createLLMHealthResponse(true, this.modelName, responseTime);
      } else {
        throw new Error('No response received');
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createLLMHealthResponse(false, this.modelName, responseTime, errorMessage);
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<LLMStatsResponseDto> {
    const uptime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000);
    const averageResponseTime = this.stats.totalRequests > 0 
      ? this.stats.totalResponseTime / this.stats.totalRequests 
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      averageResponseTime,
      totalTokensGenerated: this.stats.totalTokensGenerated,
      rateLimitHits: this.stats.rateLimitHits,
      lastRequestTime: this.stats.lastRequestTime,
      uptime
    };
  }

  /**
   * Get service configuration
   */
  getConfiguration(): LLMConfigDto {
    return {
      model: this.modelName,
      apiKey: this.apiKey,
      maxTokens: this.defaultOptions.maxTokens!,
      temperature: this.defaultOptions.temperature!,
      topP: this.defaultOptions.topP!,
      topK: this.defaultOptions.topK!,
      maxRetries: this.retryConfig.maxRetries,
      retryDelay: this.retryConfig.baseDelay,
      rateLimitPerMinute: this.rateLimitPerMinute,
      isConnected: this.isHealthy
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): RateLimitStatusDto {
    const now = new Date();
    
    // Reset window if expired
    if (now >= this.rateLimitWindow.resetTime) {
      this.resetRateLimitWindow();
    }

    const requestsRemaining = Math.max(0, this.rateLimitPerMinute - this.rateLimitWindow.requests);
    
    return {
      requestsRemaining,
      resetTime: this.rateLimitWindow.resetTime,
      windowStart: this.rateLimitWindow.windowStart,
      windowEnd: this.rateLimitWindow.resetTime,
      isLimited: requestsRemaining === 0
    };
  }

  /**
   * Validate input text
   */
  async validateInput(text: string): Promise<boolean> {
    if (!text || text.trim().length === 0) {
      throw new LLMValidationError('Input text cannot be empty');
    }

    if (text.length > 8000) {
      throw new LLMValidationError('Input text exceeds maximum length of 8000 characters');
    }

    // Check for potentially harmful content patterns
    const harmfulPatterns = [
      /\b(hack|exploit|malware|virus)\b/i,
      /\b(password|secret|token|key)\s*[:=]/i,
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(text)) {
        throw new LLMValidationError('Input contains potentially harmful content');
      }
    }

    return true;
  }

  /**
   * Sanitize output text
   */
  sanitizeOutput(text: string): string {
    if (!text) return '';

    // Remove potential HTML/script tags
    let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove other potentially harmful tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Remove excessive punctuation
    sanitized = sanitized.replace(/[!?]{3,}/g, '!!!');
    sanitized = sanitized.replace(/\.{4,}/g, '...');
    
    return sanitized;
  }

  /**
   * Generate content with retry logic and exponential backoff
   */
  private async generateWithRetry(prompt: string, options: GenerationOptions): Promise<GenerateContentResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`LLM generation attempt ${attempt}/${this.retryConfig.maxRetries}`);
        
        // Configure generation parameters
        const generationConfig = {
          maxOutputTokens: options.maxTokens,
          temperature: options.temperature,
          topP: options.topP,
          topK: options.topK
        };

        // Generate content
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        });

        console.log(`LLM generation successful on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`LLM generation attempt ${attempt} failed:`, lastError.message);

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          console.log('Error is not retryable, throwing immediately');
          throw lastError;
        }

        // Don't wait after the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        console.log(`Waiting ${delay}ms before retry attempt ${attempt + 1}`);
        
        await this.delay(delay);
      }
    }

    // All retries exhausted
    throw new LLMError(
      `Generation failed after ${this.retryConfig.maxRetries} attempts. Last error: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED',
      false
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Network and connection errors are retryable
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('econnreset') ||
        errorMessage.includes('enotfound') ||
        errorMessage.includes('socket')) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (errorMessage.includes('500') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('504') ||
        errorMessage.includes('internal server error') ||
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('gateway timeout')) {
      return true;
    }

    // Rate limiting errors are retryable
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('429')) {
      return true;
    }

    // Temporary API errors are retryable
    if (errorMessage.includes('temporarily unavailable') ||
        errorMessage.includes('try again later') ||
        errorMessage.includes('overloaded')) {
      return true;
    }

    // Authentication, validation, and safety errors are NOT retryable
    if (errorMessage.includes('authentication') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('safety') ||
        errorMessage.includes('blocked') ||
        errorMessage.includes('400') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403')) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    // Calculate base delay with exponential backoff
    let delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.retryConfig.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.retryConfig.jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    // Ensure delay is positive
    return Math.max(delay, 100);
  }

  /**
   * Enhanced rate limiting with quota management
   */
  private checkRateLimit(): void {
    const now = new Date();
    
    // Reset window if expired
    if (now >= this.rateLimitWindow.resetTime) {
      this.resetRateLimitWindow();
    }

    // Check if limit exceeded
    if (this.rateLimitWindow.requests >= this.rateLimitPerMinute) {
      this.stats.rateLimitHits++;
      const retryAfter = Math.ceil((this.rateLimitWindow.resetTime.getTime() - now.getTime()) / 1000);
      
      console.warn(`Rate limit exceeded. Requests: ${this.rateLimitWindow.requests}/${this.rateLimitPerMinute}`);
      
      throw new LLMRateLimitError(
        `Rate limit exceeded. ${this.rateLimitWindow.requests} requests made in current window. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    // Increment request count
    this.rateLimitWindow.requests++;
    
    // Log rate limit status
    const remaining = this.rateLimitPerMinute - this.rateLimitWindow.requests;
    if (remaining <= 5) {
      console.warn(`Rate limit warning: Only ${remaining} requests remaining in current window`);
    }
  }

  /**
   * Enhanced rate limit window reset with logging
   */
  private resetRateLimitWindow(): void {
    const now = new Date();
    const previousRequests = this.rateLimitWindow.requests;
    
    this.rateLimitWindow = {
      requests: 0,
      windowStart: now,
      resetTime: new Date(now.getTime() + 60000) // 1 minute from now
    };
    
    if (previousRequests > 0) {
      console.log(`Rate limit window reset. Previous window had ${previousRequests} requests.`);
    }
  }

  /**
   * Enhanced quota management
   */
  async checkQuotaStatus(): Promise<{ available: boolean; resetTime?: Date; message?: string }> {
    try {
      // Perform a minimal test request to check quota
      const testResult = await this.model.generateContent('Test');
      
      return {
        available: true,
        message: 'Quota available'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        // Try to extract reset time from error message if available
        const resetTimeMatch = errorMessage.match(/try again (?:in )?(\d+)\s*(second|minute|hour)s?/);
        let resetTime: Date | undefined;
        
        if (resetTimeMatch) {
          const value = parseInt(resetTimeMatch[1]);
          const unit = resetTimeMatch[2];
          const multiplier = unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 1;
          resetTime = new Date(Date.now() + (value * multiplier * 1000));
        }
        
        return {
          available: false,
          resetTime,
          message: `Quota exceeded: ${errorMessage}`
        };
      }
      
      // Other errors don't necessarily mean quota issues
      return {
        available: true,
        message: 'Quota status unknown due to other error'
      };
    }
  }

  /**
   * Adaptive rate limiting based on API response patterns
   */
  private adaptRateLimit(responseTime: number, success: boolean): void {
    // If responses are consistently slow or failing, reduce rate limit
    if (!success || responseTime > 10000) { // 10 seconds
      const reductionFactor = 0.8;
      this.rateLimitPerMinute = Math.max(
        Math.floor(this.rateLimitPerMinute * reductionFactor),
        10 // Minimum 10 requests per minute
      );
      console.log(`Rate limit reduced to ${this.rateLimitPerMinute} requests/minute due to performance issues`);
    }
    
    // If responses are consistently fast and successful, gradually increase rate limit
    else if (success && responseTime < 2000 && this.stats.successfulRequests % 10 === 0) { // 2 seconds
      const maxRateLimit = 120; // Maximum 120 requests per minute
      if (this.rateLimitPerMinute < maxRateLimit) {
        this.rateLimitPerMinute = Math.min(
          Math.floor(this.rateLimitPerMinute * 1.1),
          maxRateLimit
        );
        console.log(`Rate limit increased to ${this.rateLimitPerMinute} requests/minute due to good performance`);
      }
    }
  }

  /**
   * Update service statistics with adaptive rate limiting
   */
  private updateStats(success: boolean, responseTime: number, tokenCount: number): void {
    this.stats.totalRequests++;
    this.stats.totalResponseTime += responseTime;
    this.stats.lastRequestTime = new Date();

    if (success) {
      this.stats.successfulRequests++;
      this.stats.totalTokensGenerated += tokenCount;
    } else {
      this.stats.failedRequests++;
    }

    // Apply adaptive rate limiting
    this.adaptRateLimit(responseTime, success);
  }

  /**
   * Extract text from Gemini API result
   */
  private extractTextFromResult(result: GenerateContentResult): string {
    try {
      return result.response.text() || '';
    } catch (error) {
      console.error('Error extracting text from result:', error);
      return '';
    }
  }

  /**
   * Extract safety ratings from result
   */
  private extractSafetyRatings(result: GenerateContentResult): Array<{ category: string; probability: string }> | undefined {
    try {
      const candidate = result.response.candidates?.[0];
      if (candidate?.safetyRatings) {
        return candidate.safetyRatings.map(rating => ({
          category: rating.category || 'unknown',
          probability: rating.probability || 'unknown'
        }));
      }
    } catch (error) {
      console.error('Error extracting safety ratings:', error);
    }
    return undefined;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Build quote generation prompt
   */
  private buildQuotePrompt(request?: GenerateQuotePromptDto): string {
    let prompt = 'Generate an inspirational quote';
    
    if (request?.theme) {
      prompt += ` about ${request.theme}`;
    }
    
    if (request?.style) {
      prompt += ` in a ${request.style} style`;
    }
    
    if (request?.context) {
      prompt += `. Context: ${request.context}`;
    }
    
    prompt += '. Format the response as: "Quote text" - Author Name (if known, otherwise omit the author part). Keep it concise and meaningful.';
    
    return prompt;
  }

  /**
   * Parse quote response to extract text and author
   */
  private parseQuoteResponse(response: string): { text: string; author?: string } {
    // Try to parse format: "Quote text" - Author Name
    const quoteMatch = response.match(/^"([^"]+)"\s*(?:-\s*(.+))?$/);
    
    if (quoteMatch) {
      return {
        text: quoteMatch[1].trim(),
        author: quoteMatch[2]?.trim()
      };
    }
    
    // Fallback: treat entire response as quote text
    return {
      text: response.replace(/^["']|["']$/g, '').trim()
    };
  }

  /**
   * Perform health check (internal method)
   */
  private async performHealthCheck(): Promise<void> {
    try {
      await this.healthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function to create LLMService with environment configuration
export function createLLMService(
  apiKey?: string,
  modelName?: string,
  options?: GenerationOptions,
  rateLimitPerMinute?: number,
  retryConfig?: Partial<RetryConfig>
): LLMService {
  return new LLMService(apiKey, modelName, options, rateLimitPerMinute, retryConfig);
}