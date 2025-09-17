import axios from 'axios';
import chalk from 'chalk';

/**
 * AI Niche Suggester - Uses Gemini AI to help users discover the best business niches
 * for lead generation based on their goals and preferences
 */

export class NicheSuggester {
  constructor(errorHandler = null) {
    this.errorHandler = errorHandler;
    this.questions = {
      en: [
        {
          id: 'business_goal',
          question: "🎯 **What's your main business goal?**\n\n1️⃣ **Lead Generation** - Find potential customers\n2️⃣ **Market Research** - Study competitors and trends\n3️⃣ **Partnership Building** - Find business partners\n4️⃣ **Recruitment** - Find employees or freelancers\n5️⃣ **Sales Prospecting** - Find decision makers to sell to\n\n💬 **Reply with the number** corresponding to your choice.",
          type: 'single_choice'
        },
        {
          id: 'target_audience',
          question: "👥 **Who is your target audience?**\n\n1️⃣ **B2B Professionals** - Other businesses and professionals\n2️⃣ **B2C Consumers** - Individual customers\n3️⃣ **Local Businesses** - Small businesses in specific areas\n4️⃣ **Enterprise Companies** - Large corporations\n5️⃣ **Mixed** - Both B2B and B2C\n\n💬 **Reply with the number** corresponding to your choice.",
          type: 'single_choice'
        },
        {
          id: 'industry_interest',
          question: "🏢 **What industries interest you most?**\n\n1️⃣ **Technology** - Software, IT, digital services\n2️⃣ **Healthcare** - Medical, dental, wellness\n3️⃣ **Finance** - Banking, insurance, accounting\n4️⃣ **Real Estate** - Property, construction, architecture\n5️⃣ **Retail & E-commerce** - Shopping, fashion, consumer goods\n6️⃣ **Professional Services** - Legal, consulting, marketing\n7️⃣ **Other** - Specify your industry\n\n💬 **Reply with the number** corresponding to your choice.",
          type: 'single_choice'
        },
        {
          id: 'geographic_focus',
          question: "🌍 **What's your geographic focus?**\n\n1️⃣ **Local** - Specific city or region\n2️⃣ **National** - Country-wide\n3️⃣ **International** - Multiple countries\n4️⃣ **Global** - Worldwide\n\n💬 **Reply with the number** corresponding to your choice.",
          type: 'single_choice'
        },
        {
          id: 'budget_range',
          question: "💰 **What's your typical customer's budget range?**\n\n1️⃣ **Low** - Under $1,000\n2️⃣ **Medium** - $1,000 - $10,000\n3️⃣ **High** - $10,000 - $100,000\n4️⃣ **Enterprise** - Over $100,000\n5️⃣ **Mixed** - Various price ranges\n\n💬 **Reply with the number** corresponding to your choice.",
          type: 'single_choice'
        },
        {
          id: 'specific_goals',
          question: "🎯 **Tell me more about your specific goals or challenges**\n\n💬 **Describe in your own words:**\n• What problem are you trying to solve?\n• What type of people would be most valuable to you?\n• Any specific requirements or preferences?\n\n**Example:** \"I want to find small restaurants that need delivery services\" or \"I'm looking for tech startups that need funding\"\n\n💬 **Type your response below:**",
          type: 'text_input'
        }
      ],
      fr: [
        {
          id: 'business_goal',
          question: "🎯 **Quel est votre objectif commercial principal ?**\n\n1️⃣ **Génération de prospects** - Trouver des clients potentiels\n2️⃣ **Étude de marché** - Étudier les concurrents et tendances\n3️⃣ **Création de partenariats** - Trouver des partenaires commerciaux\n4️⃣ **Recrutement** - Trouver des employés ou freelances\n5️⃣ **Prospection commerciale** - Trouver des décideurs pour vendre\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
          type: 'single_choice'
        },
        {
          id: 'target_audience',
          question: "👥 **Qui est votre public cible ?**\n\n1️⃣ **Professionnels B2B** - Autres entreprises et professionnels\n2️⃣ **Consommateurs B2C** - Clients individuels\n3️⃣ **Entreprises locales** - Petites entreprises dans des zones spécifiques\n4️⃣ **Entreprises** - Grandes corporations\n5️⃣ **Mixte** - B2B et B2C\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
          type: 'single_choice'
        },
        {
          id: 'industry_interest',
          question: "🏢 **Quels secteurs vous intéressent le plus ?**\n\n1️⃣ **Technologie** - Logiciels, IT, services numériques\n2️⃣ **Santé** - Médical, dentaire, bien-être\n3️⃣ **Finance** - Banque, assurance, comptabilité\n4️⃣ **Immobilier** - Propriété, construction, architecture\n5️⃣ **Commerce de détail** - Shopping, mode, biens de consommation\n6️⃣ **Services professionnels** - Légal, conseil, marketing\n7️⃣ **Autre** - Spécifiez votre secteur\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
          type: 'single_choice'
        },
        {
          id: 'geographic_focus',
          question: "🌍 **Quelle est votre concentration géographique ?**\n\n1️⃣ **Local** - Ville ou région spécifique\n2️⃣ **National** - À l'échelle du pays\n3️⃣ **International** - Plusieurs pays\n4️⃣ **Mondial** - Dans le monde entier\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
          type: 'single_choice'
        },
        {
          id: 'budget_range',
          question: "💰 **Quelle est la gamme de budget de votre client typique ?**\n\n1️⃣ **Faible** - Moins de 1 000 $/€\n2️⃣ **Moyen** - 1 000 $/€ - 10 000 $/€\n3️⃣ **Élevé** - 10 000 $/€ - 100 000 $/€\n4️⃣ **Entreprise** - Plus de 100 000 $/€\n5️⃣ **Mixte** - Différentes gammes de prix\n\n💬 **Répondez avec le numéro** correspondant à votre choix.",
          type: 'single_choice'
        },
        {
          id: 'specific_goals',
          question: "🎯 **Parlez-moi plus de vos objectifs ou défis spécifiques**\n\n💬 **Décrivez dans vos propres mots :**\n• Quel problème essayez-vous de résoudre ?\n• Quel type de personnes vous serait le plus précieux ?\n• Des exigences ou préférences spécifiques ?\n\n**Exemple :** \"Je veux trouver de petits restaurants qui ont besoin de services de livraison\" ou \"Je cherche des startups tech qui ont besoin de financement\"\n\n💬 **Tapez votre réponse ci-dessous :**",
          type: 'text_input'
        }
      ],
      ar: [
        {
          id: 'business_goal',
          question: "🎯 **ما هو هدفك التجاري الرئيسي؟**\n\n1️⃣ **توليد العملاء المحتملين** - العثور على عملاء محتملين\n2️⃣ **بحث السوق** - دراسة المنافسين والاتجاهات\n3️⃣ **بناء الشراكات** - العثور على شركاء تجاريين\n4️⃣ **التوظيف** - العثور على موظفين أو مستقلين\n5️⃣ **الاستكشاف التجاري** - العثور على صانعي القرار للبيع لهم\n\n💬 **أجب برقم** يتوافق مع اختيارك.",
          type: 'single_choice'
        },
        {
          id: 'target_audience',
          question: "👥 **من هو جمهورك المستهدف؟**\n\n1️⃣ **المهنيون B2B** - الشركات والمهنيين الآخرين\n2️⃣ **المستهلكون B2C** - العملاء الأفراد\n3️⃣ **الشركات المحلية** - الشركات الصغيرة في مناطق محددة\n4️⃣ **الشركات الكبيرة** - الشركات الكبرى\n5️⃣ **مختلط** - B2B و B2C\n\n💬 **أجب برقم** يتوافق مع اختيارك.",
          type: 'single_choice'
        },
        {
          id: 'industry_interest',
          question: "🏢 **ما هي الصناعات التي تهمك أكثر؟**\n\n1️⃣ **التكنولوجيا** - البرمجيات، تقنية المعلومات، الخدمات الرقمية\n2️⃣ **الرعاية الصحية** - الطبية، طب الأسنان، العافية\n3️⃣ **المالية** - البنوك، التأمين، المحاسبة\n4️⃣ **العقارات** - الممتلكات، البناء، الهندسة المعمارية\n5️⃣ **التجارة الإلكترونية** - التسوق، الأزياء، السلع الاستهلاكية\n6️⃣ **الخدمات المهنية** - القانونية، الاستشارية، التسويق\n7️⃣ **أخرى** - حدد صناعتك\n\n💬 **أجب برقم** يتوافق مع اختيارك.",
          type: 'single_choice'
        },
        {
          id: 'geographic_focus',
          question: "🌍 **ما هو تركيزك الجغرافي؟**\n\n1️⃣ **محلي** - مدينة أو منطقة محددة\n2️⃣ **وطني** - على مستوى البلد\n3️⃣ **دولي** - عدة بلدان\n4️⃣ **عالمي** - في جميع أنحاء العالم\n\n💬 **أجب برقم** يتوافق مع اختيارك.",
          type: 'single_choice'
        },
        {
          id: 'budget_range',
          question: "💰 **ما هو نطاق ميزانية عميلك النموذجي؟**\n\n1️⃣ **منخفض** - أقل من 1,000 $/€\n2️⃣ **متوسط** - 1,000 $/€ - 10,000 $/€\n3️⃣ **عالي** - 10,000 $/€ - 100,000 $/€\n4️⃣ **الشركات** - أكثر من 100,000 $/€\n5️⃣ **مختلط** - نطاقات أسعار مختلفة\n\n💬 **أجب برقم** يتوافق مع اختيارك.",
          type: 'single_choice'
        },
        {
          id: 'specific_goals',
          question: "🎯 **أخبرني المزيد عن أهدافك أو تحدياتك المحددة**\n\n💬 **صف بكلماتك الخاصة:**\n• ما هي المشكلة التي تحاول حلها؟\n• أي نوع من الأشخاص سيكون الأكثر قيمة لك؟\n• أي متطلبات أو تفضيلات محددة؟\n\n**مثال:** \"أريد العثور على مطاعم صغيرة تحتاج خدمات التوصيل\" أو \"أبحث عن شركات ناشئة تقنية تحتاج تمويل\"\n\n💬 **اكتب إجابتك أدناه:**",
          type: 'text_input'
        }
      ]
    };
  }

  /**
   * Get the next question in the niche suggestion flow
   */
  getNextQuestion(language, currentStep) {
    const questions = this.questions[language] || this.questions.en;
    const stepIndex = parseInt(currentStep) || 0;
    
    if (stepIndex >= questions.length) {
      return null; // All questions completed
    }
    
    return {
      question: questions[stepIndex],
      stepIndex: stepIndex,
      totalSteps: questions.length
    };
  }

  /**
   * Generate niche suggestions using Gemini AI
   */
  async generateNicheSuggestions(answers, apiKey, language = 'en') {
    try {
      console.log(chalk.cyan(`🤖 AI Niche Suggester: Generating suggestions based on user answers`));
      
      if (!apiKey || apiKey.includes('YOUR_') || apiKey.includes('PLACEHOLDER')) {
        throw new Error('Invalid Gemini API key provided');
      }

      // Create the prompt based on language and answers
      const prompts = {
        en: `You are an expert business intelligence consultant. Based on the user's answers, suggest 3-5 specific business niches that would be excellent for lead generation.

User's Answers:
${JSON.stringify(answers, null, 2)}

Consider:
- The user's business goals and target audience
- Industry preferences and geographic focus
- Budget range and specific requirements
- Market opportunities and competition levels
- Lead generation potential and accessibility

For each niche suggestion, provide:
1. A specific, actionable niche (e.g., "dentist casablanca", "web developer fes", "restaurant marrakech")
2. Why this niche is perfect for their goals
3. What type of leads they can expect to find
4. Geographic focus (city/region/country)
5. Estimated lead volume potential (High/Medium/Low)

Respond with ONLY a JSON object in this exact format:
{
  "suggestions": [
    {
      "niche": "specific business type location",
      "reason": "Why this niche is perfect for their goals",
      "leadType": "Type of leads they can expect",
      "geographicFocus": "City/Region/Country",
      "volumePotential": "High/Medium/Low",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief summary of why these niches were chosen",
  "nextSteps": "Recommended next steps for the user"
}`,

        fr: `Vous êtes un consultant expert en intelligence d'affaires. Basé sur les réponses de l'utilisateur, suggérez 3-5 niches commerciales spécifiques qui seraient excellentes pour la génération de prospects.

Réponses de l'utilisateur:
${JSON.stringify(answers, null, 2)}

Considérez:
- Les objectifs commerciaux et le public cible de l'utilisateur
- Les préférences d'industrie et le focus géographique
- La gamme de budget et les exigences spécifiques
- Les opportunités de marché et les niveaux de concurrence
- Le potentiel de génération de prospects et l'accessibilité

Pour chaque suggestion de niche, fournissez:
1. Une niche spécifique et actionnable (ex: "dentiste casablanca", "développeur web fes", "restaurant marrakech")
2. Pourquoi cette niche est parfaite pour leurs objectifs
3. Quel type de prospects ils peuvent s'attendre à trouver
4. Focus géographique (ville/région/pays)
5. Potentiel de volume de prospects estimé (Élevé/Moyen/Faible)

Répondez avec UNIQUEMENT un objet JSON dans ce format exact:
{
  "suggestions": [
    {
      "niche": "type d'entreprise spécifique localisation",
      "reason": "Pourquoi cette niche est parfaite pour leurs objectifs",
      "leadType": "Type de prospects qu'ils peuvent s'attendre",
      "geographicFocus": "Ville/Région/Pays",
      "volumePotential": "Élevé/Moyen/Faible",
      "confidence": "Élevé/Moyen/Faible"
    }
  ],
  "summary": "Résumé bref de pourquoi ces niches ont été choisies",
  "nextSteps": "Prochaines étapes recommandées pour l'utilisateur"
}`,

        ar: `أنت مستشار خبير في ذكاء الأعمال. بناءً على إجابات المستخدم، اقترح 3-5 تخصصات تجارية محددة ستكون ممتازة لتوليد العملاء المحتملين.

إجابات المستخدم:
${JSON.stringify(answers, null, 2)}

ضع في الاعتبار:
- أهداف المستخدم التجارية والجمهور المستهدف
- تفضيلات الصناعة والتركيز الجغرافي
- نطاق الميزانية والمتطلبات المحددة
- فرص السوق ومستويات المنافسة
- إمكانات توليد العملاء المحتملين وإمكانية الوصول

لكل اقتراح تخصص، قدم:
1. تخصص محدد وقابل للتنفيذ (مثل: "طبيب أسنان الدار البيضاء"، "مطور ويب فاس"، "مطعم مراكش")
2. لماذا هذا التخصص مثالي لأهدافهم
3. أي نوع من العملاء المحتملين يمكنهم توقع العثور عليه
4. التركيز الجغرافي (مدينة/منطقة/دولة)
5. إمكانات حجم العملاء المحتملين المقدرة (عالي/متوسط/منخفض)

أجب بكائن JSON فقط بهذا التنسيق المحدد:
{
  "suggestions": [
    {
      "niche": "نوع عمل محدد موقع",
      "reason": "لماذا هذا التخصص مثالي لأهدافهم",
      "leadType": "نوع العملاء المحتملين الذين يمكنهم توقعه",
      "geographicFocus": "مدينة/منطقة/دولة",
      "volumePotential": "عالي/متوسط/منخفض",
      "confidence": "عالي/متوسط/منخفض"
    }
  ],
  "summary": "ملخص مختصر لسبب اختيار هذه التخصصات",
  "nextSteps": "الخطوات التالية الموصى بها للمستخدم"
}`
      };

      const prompt = prompts[language] || prompts.en;

      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          }
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      
      // Parse JSON response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      
      console.log(chalk.green(`✅ Generated ${suggestions.suggestions.length} niche suggestions`));
      return suggestions;

    } catch (error) {
      console.error(chalk.red(`❌ Error generating niche suggestions: ${error.message}`));
      
      // Use centralized error handler if available
      if (this.errorHandler) {
        await this.errorHandler(error, 'niche_suggestion_generation', {
          answers: answers,
          language: language,
          geminiApiKey: geminiApiKey ? 'available' : 'not_available'
        });
      }
      
      throw error;
    }
  }

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions, language = 'en') {
    const formats = {
      en: {
        header: "🎯 **AI Niche Suggestions**\n\nBased on your answers, here are the best business niches for lead generation:\n\n",
        item: (suggestion, index) => `**${index + 1}️⃣ {niche}**\n📍 **Location:** {geographicFocus}\n🎯 **Why Perfect:** {reason}\n👥 **Lead Type:** {leadType}\n📊 **Volume Potential:** {volumePotential}\n✅ **Confidence:** {confidence}\n\n`,
        summary: "📋 **Summary:** {summary}\n\n",
        nextSteps: "🚀 **Next Steps:** {nextSteps}\n\n",
        selection: "💬 **Reply with the number** (1-{count}) to select a niche, or type your own custom niche.\n\n0️⃣ **BACK** - Start over with new questions\n0️⃣0️⃣ **RESTART** - Return to main menu"
      },
      fr: {
        header: "🎯 **Suggestions de Niches IA**\n\nBasé sur vos réponses, voici les meilleures niches commerciales pour la génération de prospects :\n\n",
        item: (suggestion, index) => `**${index + 1}️⃣ {niche}**\n📍 **Localisation :** {geographicFocus}\n🎯 **Pourquoi Parfait :** {reason}\n👥 **Type de Prospects :** {leadType}\n📊 **Potentiel de Volume :** {volumePotential}\n✅ **Confiance :** {confidence}\n\n`,
        summary: "📋 **Résumé :** {summary}\n\n",
        nextSteps: "🚀 **Prochaines Étapes :** {nextSteps}\n\n",
        selection: "💬 **Répondez avec le numéro** (1-{count}) pour sélectionner une niche, ou tapez votre propre niche personnalisée.\n\n0️⃣ **RETOUR** - Recommencer avec de nouvelles questions\n0️⃣0️⃣ **RESTART** - Retourner au menu principal"
      },
      ar: {
        header: "🎯 **اقتراحات التخصصات بالذكاء الاصطناعي**\n\nبناءً على إجاباتك، إليك أفضل التخصصات التجارية لتوليد العملاء المحتملين:\n\n",
        item: (suggestion, index) => `**${index + 1}️⃣ {niche}**\n📍 **الموقع:** {geographicFocus}\n🎯 **لماذا مثالي:** {reason}\n👥 **نوع العملاء المحتملين:** {leadType}\n📊 **إمكانات الحجم:** {volumePotential}\n✅ **الثقة:** {confidence}\n\n`,
        summary: "📋 **الملخص:** {summary}\n\n",
        nextSteps: "🚀 **الخطوات التالية:** {nextSteps}\n\n",
        selection: "💬 **أجب برقم** (1-{count}) لاختيار تخصص، أو اكتب تخصصك المخصص.\n\n0️⃣ **رجوع** - ابدأ من جديد بأسئلة جديدة\n0️⃣0️⃣ **إعادة تشغيل** - العودة إلى القائمة الرئيسية"
      }
    };

    const format = formats[language] || formats.en;
    let message = format.header;

    // Add each suggestion
    suggestions.suggestions.forEach((suggestion, index) => {
      message += format.item(suggestion, index)
        .replace('{niche}', suggestion.niche)
        .replace('{geographicFocus}', suggestion.geographicFocus)
        .replace('{reason}', suggestion.reason)
        .replace('{leadType}', suggestion.leadType)
        .replace('{volumePotential}', suggestion.volumePotential)
        .replace('{confidence}', suggestion.confidence);
    });

    // Add summary and next steps
    message += format.summary.replace('{summary}', suggestions.summary);
    message += format.nextSteps.replace('{nextSteps}', suggestions.nextSteps);
    message += format.selection.replace('{count}', suggestions.suggestions.length);

    return message;
  }
}

export default NicheSuggester;


