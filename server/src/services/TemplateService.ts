import fs from 'fs/promises';
import path from 'path';

// Template data interface
export interface TemplateData {
  [key: string]: any;
}

// Template result interface
export interface TemplateResult {
  html: string;
  text: string;
}

// Template service interface
export interface ITemplateService {
  renderTemplate(templateName: string, data: TemplateData): Promise<TemplateResult>;
  loadTemplate(templateName: string): Promise<{ html: string; text: string }>;
  getAvailableTemplates(): Promise<string[]>;
}

// Custom error classes
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(templateName: string) {
    super(`Template '${templateName}' not found`);
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateService implements ITemplateService {
  private templatesPath: string;
  private templateCache: Map<string, { html: string; text: string }> = new Map();
  private cacheEnabled: boolean;

  constructor(templatesPath?: string, cacheEnabled: boolean = true) {
    this.templatesPath = templatesPath || path.join(__dirname, '../templates/email');
    this.cacheEnabled = cacheEnabled;
  }

  /**
   * Render template with data
   */
  async renderTemplate(templateName: string, data: TemplateData): Promise<TemplateResult> {
    try {
      // Load template
      const template = await this.loadTemplate(templateName);
      
      // Add common template variables
      const templateData = {
        ...data,
        currentYear: new Date().getFullYear(),
        currentDate: new Date().toLocaleDateString(),
        currentDateTime: new Date().toLocaleString()
      };

      // Render HTML and text versions
      const html = this.renderString(template.html, templateData);
      const text = this.renderString(template.text, templateData);

      return { html, text };
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      throw new TemplateError(`Failed to render template '${templateName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load template from filesystem
   */
  async loadTemplate(templateName: string): Promise<{ html: string; text: string }> {
    try {
      // Check cache first
      if (this.cacheEnabled && this.templateCache.has(templateName)) {
        return this.templateCache.get(templateName)!;
      }

      // Load HTML template
      const htmlPath = path.join(this.templatesPath, `${templateName}.html`);
      const textPath = path.join(this.templatesPath, `${templateName}.txt`);

      let html: string;
      let text: string;

      try {
        html = await fs.readFile(htmlPath, 'utf-8');
      } catch (error) {
        throw new TemplateNotFoundError(templateName);
      }

      try {
        text = await fs.readFile(textPath, 'utf-8');
      } catch (error) {
        // If text template doesn't exist, create a basic version from HTML
        text = this.htmlToText(html);
      }

      const template = { html, text };

      // Cache the template
      if (this.cacheEnabled) {
        this.templateCache.set(templateName, template);
      }

      return template;
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }
      throw new TemplateError(`Failed to load template '${templateName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templates = new Set<string>();

      for (const file of files) {
        if (file.endsWith('.html') || file.endsWith('.txt')) {
          const templateName = path.basename(file, path.extname(file));
          templates.add(templateName);
        }
      }

      return Array.from(templates).sort();
    } catch (error) {
      throw new TemplateError(`Failed to get available templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render string template with data
   */
  private renderString(template: string, data: TemplateData): string {
    let result = template;

    // Handle simple variable substitution {{variable}}
    result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      return data[key] ? content : '';
    });

    // Handle negative conditional blocks {{#unless variable}}...{{/unless}}
    result = result.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, key, content) => {
      return !data[key] ? content : '';
    });

    // Handle loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, content) => {
      const array = data[key];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        let itemContent = content;
        
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{\s*this\s*\}\}/g, String(item));
        
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{\s*@index\s*\}\}/g, String(index));
        
        // If item is an object, replace {{property}} with item.property
        if (typeof item === 'object' && item !== null) {
          for (const [prop, value] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{\\s*${prop}\\s*\\}\\}`, 'g');
            itemContent = itemContent.replace(regex, String(value));
          }
        }
        
        return itemContent;
      }).join('');
    });

    return result;
  }

  /**
   * Convert HTML to basic text (fallback)
   */
  private htmlToText(html: string): string {
    return html
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Replace HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Trim whitespace
      .trim();
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; templates: string[] } {
    return {
      size: this.templateCache.size,
      templates: Array.from(this.templateCache.keys())
    };
  }

  /**
   * Validate template syntax
   */
  async validateTemplate(templateName: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const template = await this.loadTemplate(templateName);
      const errors: string[] = [];

      // Check for unclosed template tags
      const htmlErrors = this.validateTemplateSyntax(template.html, 'HTML');
      const textErrors = this.validateTemplateSyntax(template.text, 'Text');

      errors.push(...htmlErrors, ...textErrors);

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Validate template syntax for a single template string
   */
  private validateTemplateSyntax(template: string, type: string): string[] {
    const errors: string[] = [];

    // Check for unmatched opening tags
    const openingTags = template.match(/\{\{#(if|unless|each)\s+\w+\}\}/g) || [];
    const closingTags = template.match(/\{\{\/(if|unless|each)\}\}/g) || [];

    if (openingTags.length !== closingTags.length) {
      errors.push(`${type} template has unmatched opening/closing tags`);
    }

    // Check for invalid variable syntax
    const invalidVars = template.match(/\{\{[^}]*\{\{|\}\}[^{]*\}\}/g);
    if (invalidVars) {
      errors.push(`${type} template has invalid variable syntax: ${invalidVars.join(', ')}`);
    }

    return errors;
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateName: string, sampleData?: TemplateData): Promise<TemplateResult> {
    const defaultSampleData: TemplateData = {
      userName: 'John Doe',
      resetUrl: 'https://example.com/reset?token=sample-token',
      verificationUrl: 'https://example.com/verify?token=sample-token',
      resetToken: 'sample-reset-token',
      verificationToken: 'sample-verification-token',
      expiryTime: '1 hour',
      supportEmail: 'support@example.com'
    };

    const data = { ...defaultSampleData, ...sampleData };
    return await this.renderTemplate(templateName, data);
  }
}

// Factory function to create TemplateService
export function createTemplateService(templatesPath?: string, cacheEnabled: boolean = true): TemplateService {
  return new TemplateService(templatesPath, cacheEnabled);
}