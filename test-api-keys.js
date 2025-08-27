#!/usr/bin/env node

import { initializeConfig, config } from './google search + linkdin scraper/lead-scraper/config.js';

/**
 * Test script to verify API key configuration
 */
async function testApiKeyConfiguration() {
  try {
    console.log('🧪 Testing API key configuration...\n');
    
    // Test with environment variables
    process.env.GOOGLE_API_KEY_1 = 'AIzaSyAyj4AstBsA8z3_kOIXOIaYv6Bv57krIUs';
    process.env.GOOGLE_API_KEY_2 = 'AIzaSyDr3PnZTocarHxtJbRrSwW-SAmraq5nXn4';
    process.env.GEMINI_API_KEY = 'AIzaSyBq0DPKpULM37IwrpFstMLB6bBtj_kOj88';
    
    console.log('🔑 Environment variables set:');
    console.log(`   GOOGLE_API_KEY_1: ${process.env.GOOGLE_API_KEY_1 ? 'SET' : 'NOT SET'}`);
    console.log(`   GOOGLE_API_KEY_2: ${process.env.GOOGLE_API_KEY_2 ? 'SET' : 'NOT SET'}`);
    console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}\n`);
    
    // Initialize configuration
    await initializeConfig();
    
    console.log('✅ Configuration loaded successfully!');
    console.log(`🔑 Google Search API keys: ${config.googleSearch.apiKeys.length}`);
    console.log(`🤖 Gemini API key: ${config.gemini.apiKey ? 'SET' : 'NOT SET'}`);
    
    // Display API keys (first few characters only for security)
    if (config.googleSearch.apiKeys.length > 0) {
      console.log('\n📋 Google Search API Keys:');
      config.googleSearch.apiKeys.forEach((key, index) => {
        const maskedKey = key.substring(0, 10) + '...' + key.substring(key.length - 4);
        console.log(`   ${index + 1}. ${maskedKey}`);
      });
    }
    
    if (config.gemini.apiKey) {
      const maskedKey = config.gemini.apiKey.substring(0, 10) + '...' + config.gemini.apiKey.substring(config.gemini.apiKey.length - 4);
      console.log(`\n🤖 Gemini API Key: ${maskedKey}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testApiKeyConfiguration();
