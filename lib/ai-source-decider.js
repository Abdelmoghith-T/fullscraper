import axios from 'axios';
import chalk from 'chalk';

/**
 * AI Source Decider - Uses Gemini AI to recommend the best data source for a given niche
 * @param {string} niche - The business niche to analyze
 * @param {string} apiKey - Gemini API key
 * @param {string} language - User's language preference
 * @returns {Promise<Object>} Recommendation object with source and reason
 */
export async function decideBestSource(niche, apiKey, language = 'en') {
  try {
    console.log(chalk.cyan(`🤖 AI Source Decider: Analyzing niche "${niche}"`));
    
    if (!apiKey || apiKey.includes('YOUR_') || apiKey.includes('PLACEHOLDER')) {
      throw new Error('Invalid Gemini API key provided');
    }

    // Create the prompt based on language
    const prompts = {
      en: `You are an expert business intelligence analyst. Analyze the following business niche and recommend the BEST data source for lead generation:

Niche: "${niche}"

Available data sources:
1. GOOGLE - Best for: Contact information (emails, phones) from business websites
2. LINKEDIN - Best for: Professional profiles, job titles, company information
3. MAPS - Best for: Local businesses with addresses, phone numbers, websites

Consider:
- Business type (professional services, local businesses, online services)
- Location specificity (local vs global)
- Target audience (B2B professionals vs general consumers)
- Data availability (which source likely has the most relevant data)

IMPORTANT: In your reasoning, avoid mentioning GOOGLE and MAPS. You may mention LinkedIn if recommending professional profiles, as users already know this option provides LinkedIn URLs.

Respond with ONLY a JSON object in this exact format:
{
  "source": "GOOGLE|LINKEDIN|MAPS",
  "reason": "Brief explanation focusing on the type of data and results. You may mention LinkedIn for professional profiles, but avoid mentioning GOOGLE or MAPS."
}`,

      fr: `Vous êtes un expert en intelligence d'affaires. Analysez la niche commerciale suivante et recommandez la MEILLEURE source de données pour la génération de prospects :

Niche : "${niche}"

Sources de données disponibles :
1. GOOGLE - Meilleur pour : Informations de contact (emails, téléphones) des sites web d'entreprises
2. LINKEDIN - Meilleur pour : Profils professionnels, titres de poste, informations d'entreprise
3. MAPS - Meilleur pour : Entreprises locales avec adresses, numéros de téléphone, sites web

Considérez :
- Type d'entreprise (services professionnels, entreprises locales, services en ligne)
- Spécificité de localisation (local vs global)
- Public cible (professionnels B2B vs consommateurs généraux)
- Disponibilité des données (quelle source a probablement les données les plus pertinentes)

IMPORTANT: Dans votre raisonnement, évitez de mentionner GOOGLE et MAPS. Vous pouvez mentionner LinkedIn si vous recommandez des profils professionnels, car les utilisateurs savent déjà que cette option fournit des URLs LinkedIn.

Répondez avec UNIQUEMENT un objet JSON dans ce format exact :
{
  "source": "GOOGLE|LINKEDIN|MAPS",
  "reason": "Explication brève se concentrant sur le type de données et résultats. Vous pouvez mentionner LinkedIn pour les profils professionnels, mais évitez de mentionner GOOGLE ou MAPS."
}`,

      ar: `أنت خبير في ذكاء الأعمال. حلل المجال التجاري التالي واوصي بأفضل مصدر بيانات لتوليد العملاء المحتملين:

المجال: "${niche}"

مصادر البيانات المتاحة:
1. GOOGLE - الأفضل لـ: معلومات الاتصال (الإيميلات، الهواتف) من مواقع الشركات
2. LINKEDIN - الأفضل لـ: الملفات الشخصية المهنية، ألقاب الوظائف، معلومات الشركة
3. MAPS - الأفضل لـ: الشركات المحلية مع العناوين، أرقام الهواتف، المواقع الإلكترونية

ضع في الاعتبار:
- نوع العمل (الخدمات المهنية، الشركات المحلية، الخدمات الإلكترونية)
- خصوصية الموقع (محلي مقابل عالمي)
- الجمهور المستهدف (المهنيون B2B مقابل المستهلكين العامين)
- توفر البيانات (أي مصدر يحتوي على البيانات الأكثر صلة)

مهم: في شرحك، تجنب ذكر GOOGLE و MAPS. يمكنك ذكر LinkedIn إذا كنت توصي بالملفات الشخصية المهنية، لأن المستخدمين يعرفون بالفعل أن هذا الخيار يوفر روابط LinkedIn.

أجب بـ JSON object فقط بهذا التنسيق المحدد:
{
  "source": "GOOGLE|LINKEDIN|MAPS",
  "reason": "شرح مختصر يركز على نوع البيانات والنتائج. يمكنك ذكر LinkedIn للملفات الشخصية المهنية، لكن تجنب ذكر GOOGLE أو MAPS."
}`
    };

    const prompt = prompts[language] || prompts.en;

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 200
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: apiKey
        },
        timeout: 10000
      }
    );

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = response.data.candidates[0].content.parts[0].text.trim();
    console.log(chalk.gray(`🤖 AI Response: ${aiResponse}`));

    // Parse the JSON response
    let recommendation;
    try {
      // Clean the response to extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      recommendation = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(chalk.red(`❌ Failed to parse AI response: ${parseError.message}`));
      throw new Error('Failed to parse AI recommendation');
    }

    // Validate the recommendation
    if (!recommendation.source || !recommendation.reason) {
      throw new Error('Invalid recommendation format from AI');
    }

    const validSources = ['GOOGLE', 'LINKEDIN', 'MAPS'];
    if (!validSources.includes(recommendation.source)) {
      throw new Error(`Invalid source recommendation: ${recommendation.source}`);
    }

    // Sanitize the reasoning to remove any source names that might have leaked through
    const sanitizedReason = sanitizeReasoning(recommendation.reason);
    
    console.log(chalk.green(`✅ AI Recommendation: ${recommendation.source} - ${sanitizedReason}`));
    
    return {
      source: recommendation.source,
      reason: sanitizedReason,
      confidence: 'high' // We can add confidence scoring later
    };

  } catch (error) {
    console.error(chalk.red(`❌ AI Source Decider Error: ${error.message}`));
    
    // Check for specific API errors
    if (error.response && error.response.status === 503) {
      console.error(chalk.red(`🚨 GEMINI API SERVICE UNAVAILABLE (503) - Using fallback recommendation`));
    } else if (error.response && error.response.status === 429) {
      console.error(chalk.red(`🚨 GEMINI API RATE LIMITED (429) - Using fallback recommendation`));
    } else if (error.response && error.response.status === 403) {
      console.error(chalk.red(`🚨 GEMINI API QUOTA EXCEEDED (403) - Using fallback recommendation`));
    }
    
    // Fallback logic based on niche analysis
    const fallbackRecommendation = getFallbackRecommendation(niche);
    console.log(chalk.yellow(`⚠️ Using fallback recommendation: ${fallbackRecommendation.source}`));
    
    return fallbackRecommendation;
  }
}

/**
 * Fallback recommendation logic when AI fails
 * @param {string} niche - The business niche
 * @returns {Object} Fallback recommendation
 */
function getFallbackRecommendation(niche) {
  const lowerNiche = niche.toLowerCase();
  
  // Professional services and B2B keywords
  const professionalKeywords = [
    'lawyer', 'attorney', 'consultant', 'advisor', 'manager', 'director', 'ceo', 'cto', 'cfo',
    'developer', 'engineer', 'designer', 'architect', 'analyst', 'specialist', 'expert',
    'avocat', 'conseiller', 'consultant', 'directeur', 'développeur', 'ingénieur',
    'محامي', 'مستشار', 'مدير', 'مهندس', 'مطور'
  ];
  
  // Local business keywords
  const localKeywords = [
    'restaurant', 'hotel', 'shop', 'store', 'clinic', 'hospital', 'school', 'gym',
    'dentist', 'doctor', 'pharmacy', 'bank', 'salon', 'barber', 'cafe', 'bakery',
    'restaurant', 'hôtel', 'magasin', 'clinique', 'hôpital', 'école', 'salle de sport',
    'مطعم', 'فندق', 'متجر', 'عيادة', 'مستشفى', 'مدرسة', 'صالة رياضية'
  ];
  
  // Location keywords
  const locationKeywords = [
    'casablanca', 'rabat', 'fes', 'marrakech', 'agadir', 'tangier', 'meknes', 'oujda',
    'الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'أكادير', 'طنجة', 'مكناس', 'وجدة'
  ];
  
  const hasProfessionalKeywords = professionalKeywords.some(keyword => lowerNiche.includes(keyword));
  const hasLocalKeywords = localKeywords.some(keyword => lowerNiche.includes(keyword));
  const hasLocationKeywords = locationKeywords.some(keyword => lowerNiche.includes(keyword));
  
  if (hasProfessionalKeywords) {
    return {
      source: 'LINKEDIN',
      reason: 'Professional services are best found through professional profiles with detailed contact information',
      confidence: 'medium'
    };
  } else if (hasLocalKeywords && hasLocationKeywords) {
    return {
      source: 'MAPS',
      reason: 'Local businesses with specific locations are best found through local business directories with complete information',
      confidence: 'medium'
    };
  } else {
    return {
      source: 'GOOGLE',
      reason: 'General business searches are best handled through business contact databases for comprehensive information',
      confidence: 'medium'
    };
  }
}

/**
 * Sanitize AI reasoning to remove any source names that might have leaked through
 * @param {string} reason - AI reasoning text
 * @returns {string} Sanitized reasoning without source names
 */
function sanitizeReasoning(reason) {
  if (!reason || typeof reason !== 'string') {
    return reason;
  }
  
  // Replace source names with generic terms (LinkedIn is allowed to pass through)
  let sanitized = reason
    .replace(/\bGOOGLE\b/gi, 'business contact databases')
    .replace(/\bMAPS\b/gi, 'local business directories')
    .replace(/\bGoogle\b/g, 'business contact databases')
    .replace(/\bMaps\b/g, 'local business directories')
    .replace(/\bgoogle\b/g, 'business contact databases')
    .replace(/\bmaps\b/g, 'local business directories');
  
  return sanitized;
}

/**
 * Get privacy-protected source display name in user's language
 * @param {string} source - Source code (GOOGLE, LINKEDIN, MAPS)
 * @param {string} language - User's language
 * @returns {string} Privacy-protected localized source name
 */
export function getSourceDisplayName(source, language = 'en') {
  const sourceNames = {
    en: {
      GOOGLE: 'Business Contacts',
      LINKEDIN: 'Professional Profiles',
      MAPS: 'Local Businesses'
    },
    fr: {
      GOOGLE: 'Contacts d\'Entreprise',
      LINKEDIN: 'Profils Professionnels',
      MAPS: 'Entreprises Locales'
    },
    ar: {
      GOOGLE: 'جهات اتصال الأعمال',
      LINKEDIN: 'الملفات الشخصية المهنية',
      MAPS: 'الشركات المحلية'
    }
  };
  
  return sourceNames[language]?.[source] || sourceNames.en[source] || source;
}
