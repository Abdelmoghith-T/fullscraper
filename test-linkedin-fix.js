#!/usr/bin/env node

import chalk from 'chalk';
import { LinkedInScraper } from './wrappers/linkedin-wrapper.js';

/**
 * Test script to verify LinkedIn wrapper fixes
 */
async function testLinkedInWrapper() {
  console.log(chalk.blue('🧪 Testing LinkedIn Wrapper Fixes...\n'));
  
  try {
    const linkedInScraper = new LinkedInScraper();
    
    // Test with a niche that matches existing files
    const testNiche = 'website agencies in fes';
    
    console.log(chalk.cyan(`🎯 Testing with niche: "${testNiche}"`));
    
    // Test the parseLinkedInResults method
    console.log(chalk.gray('📊 Testing parseLinkedInResults method...'));
    const results = await linkedInScraper.parseLinkedInResults(testNiche);
    
    if (results && results.length > 0) {
      console.log(chalk.green(`✅ Successfully parsed ${results.length} LinkedIn profiles`));
      console.log(chalk.gray('📋 Sample profile:'));
      console.log(chalk.gray(JSON.stringify(results[0], null, 2)));
    } else {
      console.log(chalk.yellow('⚠️  No results found - this may be normal if no files exist'));
    }
    
    // Test with a different niche that should have files
    console.log(chalk.cyan('\n🎯 Testing with alternative niche: "websites agencies in casablanca"'));
    const results2 = await linkedInScraper.parseLinkedInResults('websites agencies in casablanca');
    
    if (results2 && results2.length > 0) {
      console.log(chalk.green(`✅ Successfully parsed ${results2.length} LinkedIn profiles from alternative niche`));
    } else {
      console.log(chalk.yellow('⚠️  No results found for alternative niche either'));
    }
    
    console.log(chalk.green('\n✅ LinkedIn wrapper test completed'));
    
  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(chalk.gray(error.stack));
  }
}

// Run the test
testLinkedInWrapper();
