#!/usr/bin/env node

/**
 * Test script for dual Gemini API key rotation
 * This verifies that the new dual API key system works correctly
 */

import { GoogleMapsScraper } from '../wrappers/google-maps-wrapper.js';

async function testDualGeminiKeys() {
  console.log('🧪 Testing Dual Gemini API Key System...\n');

  // Test data structure
  const testApiKeys = {
    googleSearchKeys: ['test_google_key_1', 'test_google_key_2'],
    geminiKeys: ['test_gemini_key_1', 'test_gemini_key_2', 'test_gemini_key_3']
  };

  // Create scraper instance
  const scraper = new GoogleMapsScraper();
  scraper.apiKeys = testApiKeys;

  console.log('📋 Test API Keys:');
  console.log(`   Google Search: ${testApiKeys.googleSearchKeys.length} keys`);
  console.log(`   Gemini AI: ${testApiKeys.geminiKeys.length} keys\n`);

  // Test API key rotation
  console.log('🔄 Testing API Key Rotation:');
  
  for (let i = 0; i < 10; i++) {
    const key = scraper.getGeminiApiKey();
    console.log(`   Request ${i + 1}: ${key}`);
  }

  // Test configuration generation
  console.log('\n⚙️ Testing Configuration Generation:');
  const config1 = scraper.getGeminiConfig();
  const config2 = scraper.getGeminiConfig();
  const config3 = scraper.getGeminiConfig();
  
  console.log(`   Config 1: ${config1.gemini.apiKey}`);
  console.log(`   Config 2: ${config2.gemini.apiKey}`);
  console.log(`   Config 3: ${config3.gemini.apiKey}`);

  // Verify rotation pattern
  console.log('\n✅ Verification:');
  const uniqueKeys = new Set([config1.gemini.apiKey, config2.gemini.apiKey, config3.gemini.apiKey]);
  console.log(`   Unique keys used: ${uniqueKeys.size}/${testApiKeys.geminiKeys.length}`);
  
  if (uniqueKeys.size === testApiKeys.geminiKeys.length) {
    console.log('   ✅ Rotation working correctly!');
  } else {
    console.log('   ❌ Rotation not working as expected');
  }

  console.log('\n🎯 Test completed successfully!');
}

// Run the test
testDualGeminiKeys().catch(console.error);
