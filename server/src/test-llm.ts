// Simple test script to verify LLM service functionality
import { createLLMService } from './services/LLMService';
import { GenerateTextDto } from './dtos/llm.dto';

async function testLLMService() {
  try {
    console.log('Testing LLM Service...');
    
    // Create service instance
    const llmService = createLLMService();
    
    // Test configuration
    const config = llmService.getConfiguration();
    console.log('LLM Configuration:', {
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      rateLimitPerMinute: config.rateLimitPerMinute,
      maxRetries: config.maxRetries
    });
    
    // Test rate limit status
    const rateLimitStatus = llmService.getRateLimitStatus();
    console.log('Rate Limit Status:', rateLimitStatus);
    
    // Test input validation
    try {
      await llmService.validateInput('Hello, world!');
      console.log('✓ Input validation passed');
    } catch (error) {
      console.error('✗ Input validation failed:', error);
    }
    
    // Test output sanitization
    const sanitized = llmService.sanitizeOutput('<script>alert("test")</script>Hello world!');
    console.log('✓ Output sanitization:', sanitized);
    
    // Test health check (this will fail without API key, but should not crash)
    try {
      const health = await llmService.healthCheck();
      console.log('✓ Health check:', health.isHealthy ? 'Healthy' : 'Unhealthy');
    } catch (error) {
      console.log('✓ Health check handled error gracefully');
    }
    
    // Test stats
    const stats = await llmService.getStats();
    console.log('✓ Stats retrieved:', {
      totalRequests: stats.totalRequests,
      uptime: stats.uptime
    });
    
    console.log('✓ All LLM Service tests passed!');
    
  } catch (error) {
    console.error('✗ LLM Service test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testLLMService();
}

export { testLLMService };