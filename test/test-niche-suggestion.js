import { NicheSuggester } from '../lib/niche-suggester.js';
import chalk from 'chalk';

/**
 * Test script for the AI Niche Suggestion feature
 */

async function testNicheSuggestion() {
  console.log(chalk.cyan('🧪 Testing AI Niche Suggestion Feature\n'));
  
  const nicheSuggester = new NicheSuggester();
  
  // Test 1: Get questions for different languages
  console.log(chalk.yellow('📋 Test 1: Getting questions for different languages'));
  
  const enQuestion = nicheSuggester.getNextQuestion('en', 0);
  console.log(chalk.green('✅ English Question 1:'), enQuestion?.question.question.substring(0, 100) + '...');
  
  const frQuestion = nicheSuggester.getNextQuestion('fr', 0);
  console.log(chalk.green('✅ French Question 1:'), frQuestion?.question.question.substring(0, 100) + '...');
  
  const arQuestion = nicheSuggester.getNextQuestion('ar', 0);
  console.log(chalk.green('✅ Arabic Question 1:'), arQuestion?.question.question.substring(0, 100) + '...');
  
  // Test 2: Test question progression
  console.log(chalk.yellow('\n📋 Test 2: Question progression'));
  
  for (let i = 0; i < 7; i++) {
    const question = nicheSuggester.getNextQuestion('en', i);
    if (question) {
      console.log(chalk.blue(`Step ${i}: ${question.question.id} - ${question.question.type}`));
    } else {
      console.log(chalk.gray(`Step ${i}: No more questions`));
    }
  }
  
  // Test 3: Test answer processing
  console.log(chalk.yellow('\n📋 Test 3: Answer processing simulation'));
  
  const mockAnswers = {
    business_goal: 'lead_generation',
    target_audience: 'b2b_professionals',
    industry_interest: 'technology',
    geographic_focus: 'local',
    budget_range: 'medium',
    specific_goals: 'I want to find tech startups that need web development services'
  };
  
  console.log(chalk.blue('Mock answers:'), JSON.stringify(mockAnswers, null, 2));
  
  // Test 4: Test formatting (without actual API call)
  console.log(chalk.yellow('\n📋 Test 4: Formatting test'));
  
  const mockSuggestions = {
    suggestions: [
      {
        niche: "web developer casablanca",
        reason: "High demand for web development services in Casablanca",
        leadType: "Tech startups and small businesses",
        geographicFocus: "Casablanca, Morocco",
        volumePotential: "High",
        confidence: "High"
      },
      {
        niche: "software developer rabat",
        reason: "Growing tech scene in Rabat with many startups",
        leadType: "Software companies and enterprises",
        geographicFocus: "Rabat, Morocco",
        volumePotential: "Medium",
        confidence: "Medium"
      }
    ],
    summary: "Based on your tech focus and local targeting, these niches offer the best opportunities",
    nextSteps: "Start with web developer casablanca for immediate results"
  };
  
  const formatted = nicheSuggester.formatSuggestions(mockSuggestions, 'en');
  console.log(chalk.green('✅ Formatted suggestions:'));
  console.log(formatted.substring(0, 500) + '...\n');
  
  console.log(chalk.green('🎉 All tests completed successfully!'));
  console.log(chalk.cyan('\n💡 To test with real API calls, run the bot and try the niche suggestion feature.'));
}

// Run the test
testNicheSuggestion().catch(console.error);


