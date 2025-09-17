#!/usr/bin/env node

import chalk from 'chalk';
import { decideBestSource, getSourceDisplayName } from '../lib/ai-source-decider.js';

// Sanitization function for testing (copied from ai-source-decider.js)
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
 * Test AI Source Decision functionality
 */
async function testAIDecision() {
  console.log(chalk.blue.bold('🤖 Testing AI Source Decision System'));
  console.log(chalk.gray('═'.repeat(50)));
  
  // Test cases with different niches
  const testCases = [
    {
      niche: 'dentist casablanca',
      expected: 'MAPS',
      description: 'Local business with location'
    },
    {
      niche: 'software engineer london',
      expected: 'LINKEDIN',
      description: 'Professional service'
    },
    {
      niche: 'web development company',
      expected: 'GOOGLE',
      description: 'General business service'
    },
    {
      niche: 'restaurant marrakech',
      expected: 'MAPS',
      description: 'Local restaurant'
    },
    {
      niche: 'marketing consultant',
      expected: 'LINKEDIN',
      description: 'Professional consultant'
    }
  ];
  
  // Mock API key for testing (you'll need to replace with a real one)
  const mockApiKey = 'YOUR_GEMINI_API_KEY_HERE';
  
  console.log(chalk.yellow('⚠️  Note: This test requires a valid Gemini API key'));
  console.log(chalk.yellow('   Replace mockApiKey with your actual API key to run full tests\n'));
  
  for (const testCase of testCases) {
    console.log(chalk.cyan(`\n🧪 Testing: "${testCase.niche}"`));
    console.log(chalk.gray(`   Expected: ${testCase.expected} (${testCase.description})`));
    
    try {
      // Test fallback logic (works without API key)
      console.log(chalk.gray('   Testing fallback logic...'));
      
      // Simulate the fallback function by calling it directly
      const fallbackResult = getFallbackRecommendation(testCase.niche);
      console.log(chalk.green(`   ✅ Fallback result: ${fallbackResult.source}`));
      console.log(chalk.gray(`   📝 Reason: ${fallbackResult.reason}`));
      
      // Test source display names
      const displayName = getSourceDisplayName(fallbackResult.source, 'en');
      console.log(chalk.gray(`   🏷️  Display name: ${displayName}`));
      
      // Check if result matches expectation
      if (fallbackResult.source === testCase.expected) {
        console.log(chalk.green('   ✅ Result matches expectation!'));
      } else {
        console.log(chalk.yellow(`   ⚠️  Result differs from expectation (got ${fallbackResult.source}, expected ${testCase.expected})`));
      }
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Error: ${error.message}`));
    }
  }
  
  // Test language support
  console.log(chalk.cyan('\n🌍 Testing Language Support (Privacy-Protected)'));
  const languages = ['en', 'fr', 'ar'];
  const sources = ['GOOGLE', 'LINKEDIN', 'MAPS'];
  
  for (const lang of languages) {
    console.log(chalk.gray(`\n   ${lang.toUpperCase()}:`));
    for (const source of sources) {
      const displayName = getSourceDisplayName(source, lang);
      console.log(chalk.gray(`     ${source}: ${displayName}`));
    }
  }
  
  // Test sanitization function
  console.log(chalk.cyan('\n🧹 Testing Sanitization Function (LinkedIn Exception)'));
  const testReasons = [
    'MAPS excels at providing location-based business data',
    'LinkedIn is best for professional profiles',
    'Google Search provides comprehensive contact information',
    'The niche targets dentists in Fes. MAPS excels at providing location-based business data',
    'For professional services, LinkedIn provides the most relevant data'
  ];
  
  for (const reason of testReasons) {
    const sanitized = sanitizeReasoning(reason);
    console.log(chalk.gray(`   Original: ${reason}`));
    console.log(chalk.green(`   Sanitized: ${sanitized}`));
    console.log('');
  }
  
  console.log(chalk.green.bold('\n✅ AI Decision System Test Completed!'));
  console.log(chalk.gray('\n💡 To test with real AI:'));
  console.log(chalk.gray('   1. Replace mockApiKey with your Gemini API key'));
  console.log(chalk.gray('   2. Run: node test/test-ai-decision.js'));
  console.log(chalk.gray('   3. The AI will analyze each niche and provide recommendations'));
}

/**
 * Fallback recommendation logic (copied from ai-source-decider.js for testing)
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

// Run the test
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  testAIDecision().catch(console.error);
}

export default testAIDecision;
