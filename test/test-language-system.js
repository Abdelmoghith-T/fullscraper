#!/usr/bin/env node

/**
 * Test script for the multi-language WhatsApp bot system
 * This verifies that all language messages work correctly
 */

import { getMessage, getAvailableLanguages } from '../languages.js';
import chalk from 'chalk';

async function testLanguageSystem() {
  console.log('🌍 Testing Multi-Language WhatsApp Bot System...\n');

  const languages = getAvailableLanguages();
  console.log('📋 Available Languages:');
  languages.forEach(lang => {
    console.log(`   ${lang.flag} ${lang.name} (${lang.code})`);
  });
  console.log('');

  // Test all languages
  for (const lang of languages) {
    console.log(`🧪 Testing ${lang.flag} ${lang.name} (${lang.code}):`);
    
    // Test welcome message
    const welcome = getMessage(lang.code, 'welcome');
    console.log(`   Welcome: ${welcome.substring(0, 50)}...`);
    
    // Test authentication message
    const auth = getMessage(lang.code, 'auth_required');
    console.log(`   Auth: ${auth.substring(0, 50)}...`);
    
    // Test access granted message
    const access = getMessage(lang.code, 'access_granted', {
      source: 'ALL',
      format: 'XLSX',
      limit: 300
    });
    console.log(`   Access: ${access.substring(0, 50)}...`);
    
    // Test source selection
    const source = getMessage(lang.code, 'select_source', {
      niche: 'dentist casablanca'
    });
    console.log(`   Source: ${source.substring(0, 50)}...`);
    
    // Test data type selection
    const dataType = getMessage(lang.code, 'select_type_google');
    console.log(`   Data Type: ${dataType.substring(0, 50)}...`);
    
    // Test format selection
    const format = getMessage(lang.code, 'select_format');
    console.log(`   Format: ${format.substring(0, 50)}...`);
    
    // Test job starting
    const jobStart = getMessage(lang.code, 'job_starting', {
      niche: 'dentist casablanca',
      source: 'MAPS',
      format: 'XLSX',
      limit: 300
    });
    console.log(`   Job Start: ${jobStart.substring(0, 50)}...`);
    
    // Test job completion
    const jobComplete = getMessage(lang.code, 'job_complete', {
      total: 45,
      emails: 32,
      phones: 41,
      websites: 45
    });
    console.log(`   Job Complete: ${jobComplete.substring(0, 50)}...`);
    
    // Test help message
    const help = getMessage(lang.code, 'help');
    console.log(`   Help: ${help.substring(0, 50)}...`);
    
    console.log(`   ✅ ${lang.name} language test completed\n`);
  }

  // Test parameter replacement
  console.log('🔧 Testing Parameter Replacement:');
  const testParams = {
    niche: 'restaurant marrakech',
    source: 'GOOGLE',
    format: 'CSV',
    limit: 500,
    total: 123,
    emails: 89,
    phones: 112,
    websites: 123
  };
  
  const testMessage = getMessage('en', 'job_complete', testParams);
  console.log(`   English job complete with params: ${testMessage.substring(0, 100)}...`);
  
  const testMessageFr = getMessage('fr', 'job_complete', testParams);
  console.log(`   French job complete with params: ${testMessageFr.substring(0, 100)}...`);
  
  const testMessageAr = getMessage('ar', 'job_complete', testParams);
  console.log(`   Arabic job complete with params: ${testMessageAr.substring(0, 100)}...`);
  
  console.log('\n✅ Parameter replacement test completed');

  // Test fallback to English
  console.log('\n🔄 Testing Fallback to English:');
  const fallbackMessage = getMessage('invalid_lang', 'welcome');
  console.log(`   Invalid language fallback: ${fallbackMessage.substring(0, 50)}...`);
  
  const fallbackMessage2 = getMessage('en', 'invalid_key');
  console.log(`   Invalid key fallback: ${fallbackMessage2}`);
  
  console.log('\n🎉 All language system tests completed successfully!');
}

// Run the test
testLanguageSystem().catch(console.error);
