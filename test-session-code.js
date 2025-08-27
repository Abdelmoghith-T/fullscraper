#!/usr/bin/env node

import chalk from 'chalk';
import { LinkedInScraper } from './wrappers/linkedin-wrapper.js';

/**
 * Test script to verify session code generation and file naming
 */
async function testSessionCode() {
  console.log(chalk.blue('🧪 Testing LinkedIn Session Code System...\n'));
  
  try {
    // Create multiple LinkedIn scrapers to test unique session codes
    const scraper1 = new LinkedInScraper();
    const scraper2 = new LinkedInScraper();
    const scraper3 = new LinkedInScraper();
    
    console.log(chalk.cyan('🔑 Generated Session Codes:'));
    console.log(chalk.gray(`   Scraper 1: ${scraper1.sessionCode}`));
    console.log(chalk.gray(`   Scraper 2: ${scraper2.sessionCode}`));
    console.log(chalk.gray(`   Scraper 3: ${scraper3.sessionCode}`));
    
    // Check if all codes are unique
    const codes = [scraper1.sessionCode, scraper2.sessionCode, scraper3.sessionCode];
    const uniqueCodes = new Set(codes);
    
    if (codes.length === uniqueCodes.size) {
      console.log(chalk.green('✅ All session codes are unique!'));
    } else {
      console.log(chalk.red('❌ Duplicate session codes found!'));
    }
    
    // Test file naming
    const testNiche = 'website agencies in fes';
    console.log(chalk.cyan(`\n📁 Test File Naming for: "${testNiche}"`));
    console.log(chalk.gray(`   Expected filename: ${testNiche.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}_linkedin_results_SESSION_${scraper1.sessionCode}.xlsx`));
    
    // Test environment variable injection
    console.log(chalk.cyan('\n🔧 Testing Environment Variable Injection:'));
    console.log(chalk.gray(`   LINKEDIN_SESSION_CODE: ${scraper1.sessionCode}`));
    
    console.log(chalk.green('\n✅ Session code test completed'));
    
  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(chalk.gray(error.stack));
  }
}

// Run the test
testSessionCode();
