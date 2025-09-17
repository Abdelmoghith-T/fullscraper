import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';

/**
 * Niche Validator - Uses Gemini AI to validate business niches
 * Helps users understand what constitutes a valid business niche
 */
export class NicheValidator {
  constructor(errorHandler = null) {
    this.genAI = null;
    this.isInitialized = false;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize Gemini AI with API key
   */
  initialize(geminiApiKey) {
    if (!geminiApiKey || geminiApiKey.includes('YOUR_') || geminiApiKey.includes('PLACEHOLDER')) {
      console.log(chalk.yellow('⚠️  Niche validator: No valid Gemini API key provided'));
      return false;
    }

    try {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
      this.isInitialized = true;
      console.log(chalk.green('✅ Niche validator initialized with Gemini AI'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize niche validator:', error.message));
      return false;
    }
  }

  /**
   * Validate a business niche using Gemini AI
   * @param {string} niche - The niche to validate
   * @param {string} language - User's language preference (en, fr, ar)
   * @returns {Promise<Object>} Validation result with isValid, reason, and suggestions
   */
  async validateNiche(niche, language = 'en') {
    if (!this.isInitialized) {
      return {
        isValid: true, // Default to valid if validator not initialized
        reason: 'Validator not initialized',
        suggestions: []
      };
    }

    if (!niche || niche.trim().length < 3) {
      return {
        isValid: false,
        reason: this.getInvalidReason('too_short', language),
        suggestions: this.getSuggestions('too_short', language)
      };
    }

    try {
      const prompt = this.buildValidationPrompt(niche, language);
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseGeminiResponse(text, language);
      
    } catch (error) {
      console.error(chalk.red('❌ Niche validation error:', error.message));
      
      // Use centralized error handler if available
      if (this.errorHandler) {
        await this.errorHandler(error, 'niche_validation', {
          niche,
          language,
          geminiApiKey: this.genAI ? 'available' : 'not_available'
        });
      }
      
      // Fallback to basic validation if Gemini fails
      return this.basicValidation(niche, language);
    }
  }

  /**
   * Build the validation prompt for Gemini
   */
  buildValidationPrompt(niche, language) {
    const languageInstructions = {
      en: {
        system: "You are a business or service validator. Your job is to determine if a user's input is a valid business or service for lead generation and business intelligence.",
        criteria: "A valid business or service should:",
        examples: "Good examples: 'dentist casablanca', 'web developer fes', 'restaurant marrakech', 'lawyer rabat', 'accountant agadir'",
        badExamples: "Bad examples: 'eigeugf', 'asdfgh', '123456', 'hello world', 'test', 'random text'",
        response: "Respond with ONLY a JSON object in this exact format: {\"isValid\": true/false, \"reason\": \"explanation\", \"suggestions\": [\"suggestion1\", \"suggestion2\"]}"
      },
      fr: {
        system: "Vous êtes un validateur d'entreprises ou de services. Votre travail est de déterminer si l'entrée d'un utilisateur est une entreprise ou un service valide pour la génération de prospects et l'intelligence d'affaires.",
        criteria: "Une entreprise ou un service valide devrait:",
        examples: "Bons exemples: 'dentiste casablanca', 'développeur web fes', 'restaurant marrakech', 'avocat rabat', 'comptable agadir'",
        badExamples: "Mauvais exemples: 'eigeugf', 'asdfgh', '123456', 'bonjour monde', 'test', 'texte aléatoire'",
        response: "Répondez avec UNIQUEMENT un objet JSON dans ce format exact: {\"isValid\": true/false, \"reason\": \"explication\", \"suggestions\": [\"suggestion1\", \"suggestion2\"]}"
      },
      ar: {
        system: "أنت مدقق للشركات أو الخدمات. مهمتك هي تحديد ما إذا كان إدخال المستخدم هو شركة أو خدمة صالحة لتوليد العملاء المحتملين وذكاء الأعمال.",
        criteria: "يجب أن تكون الشركة أو الخدمة الصالحة:",
        examples: "أمثلة جيدة: 'طبيب أسنان الدار البيضاء'، 'مطور ويب فاس'، 'مطعم مراكش'، 'محامي الرباط'، 'محاسب أكادير'",
        badExamples: "أمثلة سيئة: 'eigeugf'، 'asdfgh'، '123456'، 'مرحبا بالعالم'، 'اختبار'، 'نص عشوائي'",
        response: "أجب بـ JSON object فقط بهذا التنسيق الدقيق: {\"isValid\": true/false, \"reason\": \"شرح\", \"suggestions\": [\"اقتراح1\", \"اقتراح2\"]}"
      }
    };

    const lang = languageInstructions[language] || languageInstructions.en;

    return `${lang.system}

${lang.criteria}
1. Describe a specific business type or profession
2. Include a location (city, region, or country)
3. Be relevant for business lead generation
4. Be clear and understandable
5. Not be random text, numbers, or gibberish

${lang.examples}

${lang.badExamples}

User input to validate: "${niche}"

${lang.response}`;
  }

  /**
   * Parse Gemini's response and extract validation result
   */
  parseGeminiResponse(text, language) {
    try {
      // Clean the response text
      const cleanText = text.trim().replace(/```json|```/g, '').trim();
      
      // Try to parse as JSON
      const result = JSON.parse(cleanText);
      
      // Validate the response structure
      if (typeof result.isValid === 'boolean' && result.reason && Array.isArray(result.suggestions)) {
        return {
          isValid: result.isValid,
          reason: result.reason,
          suggestions: result.suggestions.slice(0, 3) // Limit to 3 suggestions
        };
      } else {
        throw new Error('Invalid response structure');
      }
      
    } catch (error) {
      console.error(chalk.yellow('⚠️  Failed to parse Gemini response, using fallback validation'));
      
      // Fallback: analyze the text for validation keywords
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('valid') && lowerText.includes('true')) {
        return {
          isValid: true,
          reason: this.getValidReason(language),
          suggestions: []
        };
      } else if (lowerText.includes('invalid') || lowerText.includes('false')) {
        return {
          isValid: false,
          reason: this.getInvalidReason('gemini_invalid', language),
          suggestions: this.getSuggestions('gemini_invalid', language)
        };
      } else {
        // Default to basic validation
        return this.basicValidation(text, language);
      }
    }
  }

  /**
   * Basic validation fallback when Gemini is not available
   */
  basicValidation(niche, language) {
    const trimmed = niche.trim().toLowerCase();
    
    // Check for obvious invalid patterns
    const invalidPatterns = [
      /^[a-z]{1,6}$/, // Short random text (1-6 chars)
      /^[0-9]+$/, // Only numbers
      /^[^a-z0-9\s]+$/, // Only special characters
      /^(test|hello|world|asdf|qwerty|random|eigeugf|asdfgh|qwertyuiop|zxcvbnm)$/i, // Common test/random words
      /^.{1,2}$/, // Too short
      /^[a-z]{3,6}$/ // Short random text without spaces (3-6 chars)
    ];
    
    const isInvalid = invalidPatterns.some(pattern => pattern.test(trimmed));
    
    if (isInvalid) {
      return {
        isValid: false,
        reason: this.getInvalidReason('basic_invalid', language),
        suggestions: this.getSuggestions('basic_invalid', language)
      };
    }
    
    return {
      isValid: true,
      reason: this.getValidReason(language),
      suggestions: []
    };
  }

  /**
   * Get validation reason messages by language
   */
  getValidReason(language) {
    const reasons = {
      en: "This looks like a valid business or service!",
      fr: "Cela ressemble à une entreprise ou un service valide !",
      ar: "هذا يبدو وكأنه شركة أو خدمة صالحة!"
    };
    return reasons[language] || reasons.en;
  }

  getInvalidReason(type, language) {
    const reasons = {
      en: {
        too_short: "The input is too short. Please provide at least 3 characters.",
        gemini_invalid: "This doesn't appear to be a valid business or service.",
        basic_invalid: "This input doesn't look like a proper business or service."
      },
      fr: {
        too_short: "L'entrée est trop courte. Veuillez fournir au moins 3 caractères.",
        gemini_invalid: "Cela ne semble pas être une entreprise ou un service valide.",
        basic_invalid: "Cette entrée ne ressemble pas à une entreprise ou un service approprié."
      },
      ar: {
        too_short: "الإدخال قصير جداً. يرجى تقديم 3 أحرف على الأقل.",
        gemini_invalid: "هذا لا يبدو وكأنه شركة أو خدمة صالحة.",
        basic_invalid: "هذا الإدخال لا يبدو وكأنه شركة أو خدمة مناسبة."
      }
    };
    
    return reasons[language]?.[type] || reasons.en[type] || reasons.en.gemini_invalid;
  }

  getSuggestions(type, language) {
    const suggestions = {
      en: {
        too_short: [
          "Try: 'dentist casablanca'",
          "Try: 'web developer fes'",
          "Try: 'restaurant marrakech'"
        ],
        gemini_invalid: [
          "Try: 'lawyer rabat'",
          "Try: 'accountant agadir'",
          "Try: 'marketing agency tangier'"
        ],
        basic_invalid: [
          "Try: 'dentist casablanca'",
          "Try: 'web developer fes'",
          "Try: 'restaurant marrakech'"
        ]
      },
      fr: {
        too_short: [
          "Essayez: 'dentiste casablanca'",
          "Essayez: 'développeur web fes'",
          "Essayez: 'restaurant marrakech'"
        ],
        gemini_invalid: [
          "Essayez: 'avocat rabat'",
          "Essayez: 'comptable agadir'",
          "Essayez: 'agence marketing tanger'"
        ],
        basic_invalid: [
          "Essayez: 'dentiste casablanca'",
          "Essayez: 'développeur web fes'",
          "Essayez: 'restaurant marrakech'"
        ]
      },
      ar: {
        too_short: [
          "جرب: 'طبيب أسنان الدار البيضاء'",
          "جرب: 'مطور ويب فاس'",
          "جرب: 'مطعم مراكش'"
        ],
        gemini_invalid: [
          "جرب: 'محامي الرباط'",
          "جرب: 'محاسب أكادير'",
          "جرب: 'وكالة تسويق طنجة'"
        ],
        basic_invalid: [
          "جرب: 'طبيب أسنان الدار البيضاء'",
          "جرب: 'مطور ويب فاس'",
          "جرب: 'مطعم مراكش'"
        ]
      }
    };
    
    return suggestions[language]?.[type] || suggestions.en[type] || suggestions.en.basic_invalid;
  }
}

// Export singleton instance
export const nicheValidator = new NicheValidator();

// Function to set error handler for the singleton
export function setNicheValidatorErrorHandler(errorHandler) {
  nicheValidator.errorHandler = errorHandler;
}
