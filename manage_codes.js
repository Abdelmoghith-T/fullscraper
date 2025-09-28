#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import ApiPoolManager from './lib/api-pool-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CODES_FILE = path.join(__dirname, 'codes.json');

/**
 * Admin CLI for managing WhatsApp scraper access codes
 * Usage:
 *   node manage_codes.js add-trial <code>
 *   node manage_codes.js add-paid <code>
 *   node manage_codes.js list
 *   node manage_codes.js remove <code>
 *   node manage_codes.js info <code>
 *   node manage_codes.js add-google-key <key>
 *   node manage_codes.js add-gemini-key <key>
 *   node manage_codes.js remove-google-key <key>
 *   node manage_codes.js remove-gemini-key <key>
 *   node manage_codes.js list-keys
 *   node manage_codes.js show-api-data
 */

// Helper functions
function loadCodes() {
  if (!fs.existsSync(CODES_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Error reading codes.json:', error.message);
    return {};
  }
}

function saveCodes(codes) {
  try {
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving codes.json:', error.message);
    return false;
  }
}

function generateRandomCode() {
  return crypto.randomBytes(4).toString('hex');
}

function validateApiKey(key, type) {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(`${type} API key is required and cannot be empty`);
  }
  if (key.length < 10) {
    throw new Error(`${type} API key seems too short (minimum 10 characters)`);
  }
  return key.trim();
}

function maskApiKey(key) {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}

// Command handlers
function addTrialUser(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js add-trial <code>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    
    // Get available API keys for trial user
    const keysResult = apiPoolManager.getTrialUserKeys();
    if (!keysResult.success) {
      console.error(`❌ ${keysResult.error}`);
      console.log('💡 Add more API keys to the pool using:');
      console.log('   node manage_codes.js add-google-key <key>');
      console.log('   node manage_codes.js add-gemini-key <key>');
      process.exit(1);
    }

    const codes = loadCodes();
    
    if (codes[code]) {
      console.log(`⚠️  Code '${code}' already exists. Overwriting...`);
    }

    codes[code] = {
      apiKeys: {
        googleSearchKeys: keysResult.googleSearchKeys,
        geminiKeys: keysResult.geminiKeys
      },
      createdAt: new Date().toISOString(),
      expiresAt: null,
      meta: {
        issuedBy: 'admin',
        lastUsed: null,
        useCount: 0
      },
      language: 'en', // Default language for new users
      stage: 'free_trial', // Trial user
      trial: {
        triesUsed: 0,
        maxTries: 3
      },
      paid: {
        grantedAt: null,
        expiresAt: null
      },
      dailyScraping: {
        date: new Date().toDateString(),
        count: 0,
        lastReset: new Date().toISOString()
      }
    };

    // Assign keys to user in API pool
    const assignmentResult = apiPoolManager.assignKeysToUser(code, keysResult, 'trial');
    if (!assignmentResult.success) {
      console.error(`❌ Error assigning API keys: ${assignmentResult.error}`);
      process.exit(1);
    }

    if (saveCodes(codes)) {
      console.log('✅ Trial user added successfully!');
      console.log(`📋 Code: ${code}`);
      console.log(`🔑 Google Search Key: ${maskApiKey(keysResult.googleSearchKeys[0])}`);
      console.log(`🤖 Gemini AI Key: ${maskApiKey(keysResult.geminiKeys[0])}`);
      console.log(`📅 Created: ${new Date().toLocaleString()}`);
      console.log(`🎯 User Type: Trial (3 attempts max)`);
      console.log(`🔗 API Keys: Automatically assigned from pool`);
    }
  } catch (error) {
    console.error('❌ Error adding trial user:', error.message);
    process.exit(1);
  }
}

function addPaidUser(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js add-paid <code>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    
    // Get available API keys for paid user
    const keysResult = apiPoolManager.getPaidUserKeys();
    if (!keysResult.success) {
      console.error(`❌ ${keysResult.error}`);
      console.log('💡 Add more API keys to the pool using:');
      console.log('   node manage_codes.js add-google-key <key>');
      console.log('   node manage_codes.js add-gemini-key <key>');
      process.exit(1);
    }

    const codes = loadCodes();
    
    if (codes[code]) {
      console.log(`⚠️  Code '${code}' already exists. Overwriting...`);
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    codes[code] = {
      apiKeys: {
        googleSearchKeys: keysResult.googleSearchKeys,
        geminiKeys: keysResult.geminiKeys
      },
      createdAt: new Date().toISOString(),
      expiresAt: null,
      meta: {
        issuedBy: 'admin',
        lastUsed: null,
        useCount: 0
      },
      language: 'en', // Default language for new users
      stage: 'paid', // Paid user
      trial: {
        triesUsed: 0,
        maxTries: 3
      },
      paid: {
        grantedAt: now.toISOString(),
        expiresAt: expires.toISOString()
      },
      dailyScraping: {
        date: new Date().toDateString(),
        count: 0,
        lastReset: new Date().toISOString()
      }
    };

    // Assign keys to user in API pool
    const assignmentResult = apiPoolManager.assignKeysToUser(code, keysResult, 'paid');
    if (!assignmentResult.success) {
      console.error(`❌ Error assigning API keys: ${assignmentResult.error}`);
      process.exit(1);
    }

    if (saveCodes(codes)) {
      console.log('✅ Paid user added successfully!');
      console.log(`📋 Code: ${code}`);
      console.log(`🔑 Google Search Keys: ${keysResult.googleSearchKeys.map(k => maskApiKey(k)).join(', ')}`);
      console.log(`🤖 Gemini AI Keys: ${keysResult.geminiKeys.map(k => maskApiKey(k)).join(', ')}`);
      console.log(`📅 Created: ${new Date().toLocaleString()}`);
      console.log(`🎯 User Type: Paid (30 days access)`);
      console.log(`⏰ Expires: ${expires.toLocaleString()}`);
      console.log(`🔗 API Keys: Automatically assigned from pool`);
    }
  } catch (error) {
    console.error('❌ Error adding paid user:', error.message);
    process.exit(1);
  }
}

function listCodes() {
  const codes = loadCodes();
  const codeList = Object.keys(codes);
  
  if (codeList.length === 0) {
    console.log('📋 No codes found. Use "add-trial" or "add-paid" commands to create codes.');
    return;
  }

  console.log(`📋 Total Codes: ${codeList.length}\n`);
  
  codeList.forEach((code, index) => {
    const data = codes[code];
    const userType = data.stage === 'paid' ? '🎯 Paid' : '🆓 Trial';
    const keyCount = data.apiKeys.googleSearchKeys.length;
    
    console.log(`${index + 1}. Code: ${code}`);
    console.log(`   ${userType} User (${keyCount} API key${keyCount > 1 ? 's' : ''})`);
    console.log(`   🔑 Google Keys: ${data.apiKeys.googleSearchKeys.map(maskApiKey).join(', ')}`);
    console.log(`   🤖 Gemini Keys: ${data.apiKeys.geminiKeys.map(maskApiKey).join(', ')}`);
    console.log(`   🌐 Language: ${data.language || 'en'}`);
    console.log(`   📅 Created: ${new Date(data.createdAt).toLocaleString()}`);
    console.log(`   📊 Usage: ${data.meta.useCount} times`);
    
    if (data.stage === 'paid' && data.paid?.expiresAt) {
      const isExpired = new Date(data.paid.expiresAt) < new Date();
      console.log(`   ⏰ Paid Expires: ${new Date(data.paid.expiresAt).toLocaleString()} ${isExpired ? '(EXPIRED)' : ''}`);
    }
    
    if (data.trial) {
      console.log(`   🎯 Trial: ${data.trial.triesUsed}/${data.trial.maxTries} attempts used`);
    }
    
    if (data.meta.lastUsed) {
      console.log(`   ⏰ Last Used: ${new Date(data.meta.lastUsed).toLocaleString()}`);
    }
    console.log('');
  });
}

function removeCode(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js remove <code>');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  // Release API keys from pool before removing user
  try {
    const apiPoolManager = new ApiPoolManager();
    const releaseResult = apiPoolManager.releaseKeysFromUser(code);
    
    if (releaseResult.success) {
      console.log(`🔗 Released ${releaseResult.releasedCount.google} Google keys and ${releaseResult.releasedCount.gemini} Gemini keys`);
    }
  } catch (error) {
    console.error(`⚠️  Warning: Could not release API keys: ${error.message}`);
  }

  delete codes[code];
  
  if (saveCodes(codes)) {
    console.log(`✅ Code '${code}' removed successfully!`);
    console.log(`🔗 API keys have been returned to the available pool`);
  }
}

function showCodeInfo(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js info <code>');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  const data = codes[code];
  const userType = data.stage === 'paid' ? '🎯 Paid User' : '🆓 Trial User';
  const keyCount = data.apiKeys.googleSearchKeys.length;
  
  console.log(`📋 Code Information: ${code}`);
  console.log('─'.repeat(50));
  console.log(`👤 User Type: ${userType} (${keyCount} API key${keyCount > 1 ? 's' : ''})`);
  console.log(`🔑 Google Search Keys:`);
  data.apiKeys.googleSearchKeys.forEach((key, i) => {
    console.log(`   Key ${i + 1}: ${maskApiKey(key)}`);
  });
  console.log(`🤖 Gemini AI Keys:`);
  data.apiKeys.geminiKeys.forEach((key, i) => {
    console.log(`   Key ${i + 1}: ${maskApiKey(key)}`);
  });
  console.log(`🌐 Language: ${data.language || 'en'}`);
  console.log(`📅 Created: ${new Date(data.createdAt).toLocaleString()}`);
  console.log(`📊 Usage Count: ${data.meta.useCount}`);
  console.log(`👤 Issued By: ${data.meta.issuedBy}`);
  
  if (data.stage === 'paid' && data.paid) {
    console.log(`💳 Paid Access:`);
    console.log(`   Granted: ${new Date(data.paid.grantedAt).toLocaleString()}`);
    if (data.paid.expiresAt) {
      const isExpired = new Date(data.paid.expiresAt) < new Date();
      console.log(`   Expires: ${new Date(data.paid.expiresAt).toLocaleString()} ${isExpired ? '(EXPIRED)' : ''}`);
    }
  }
  
  if (data.trial) {
    console.log(`🎯 Trial Status:`);
    console.log(`   Attempts Used: ${data.trial.triesUsed}/${data.trial.maxTries}`);
    const remaining = data.trial.maxTries - data.trial.triesUsed;
    console.log(`   Remaining: ${remaining} attempt${remaining !== 1 ? 's' : ''}`);
  }
  
  if (data.meta.lastUsed) {
    console.log(`⏰ Last Used: ${new Date(data.meta.lastUsed).toLocaleString()}`);
  } else {
    console.log(`⏰ Last Used: Never`);
  }

  // Show daily scraping info if available
  if (data.dailyScraping) {
    console.log(`📊 Daily Scraping:`);
    console.log(`   Date: ${data.dailyScraping.date}`);
    console.log(`   Count: ${data.dailyScraping.count}/4`);
    console.log(`   Last Reset: ${new Date(data.dailyScraping.lastReset).toLocaleString()}`);
  }
}

// New functions for modifying users
function modifyUserCode(args) {
  const [oldCode, newCode] = args;
  
  if (!oldCode || !newCode) {
    console.error('❌ Both old and new codes are required');
    console.log('Usage: node manage_codes.js modify-code <old_code> <new_code>');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[oldCode]) {
    console.error(`❌ Old code '${oldCode}' not found`);
    process.exit(1);
  }

  if (codes[newCode] && oldCode !== newCode) {
    console.error(`❌ New code '${newCode}' already exists`);
    process.exit(1);
  }

  // Copy user data to new code
  codes[newCode] = { ...codes[oldCode] };
  
  // Update meta information
  codes[newCode].meta = {
    ...codes[newCode].meta,
    modifiedBy: 'CLI',
    modifiedAt: new Date().toISOString(),
    previousCode: oldCode
  };

  // Remove old code
  delete codes[oldCode];
  
  if (saveCodes(codes)) {
    console.log(`✅ User code changed from '${oldCode}' to '${newCode}' successfully`);
  } else {
    console.error('❌ Failed to modify user code');
    process.exit(1);
  }
}

function modifyUserLanguage(args) {
  const [code, language] = args;
  
  if (!code || !language) {
    console.error('❌ Both code and language are required');
    console.log('Usage: node manage_codes.js modify-language <code> <language>');
    console.log('Available languages: en, fr, ar');
    process.exit(1);
  }

  const validLanguages = ['en', 'fr', 'ar'];
  if (!validLanguages.includes(language)) {
    console.error(`❌ Invalid language '${language}'. Must be one of: ${validLanguages.join(', ')}`);
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  // Store old language for audit
  const oldLanguage = codes[code].language || 'en';
  
  // Update language
  codes[code].language = language;
  
  // Update meta information
  codes[code].meta = {
    ...codes[code].meta,
    modifiedBy: 'CLI',
    modifiedAt: new Date().toISOString(),
    previousLanguage: oldLanguage
  };
  
  if (saveCodes(codes)) {
    console.log(`✅ Language changed from '${oldLanguage}' to '${language}' for user '${code}' successfully`);
  } else {
    console.error('❌ Failed to update language');
    process.exit(1);
  }
}

function addDailyLimit(args) {
  const [code, amount] = args;
  
  if (!code || !amount) {
    console.error('❌ Both code and amount are required');
    console.log('Usage: node manage_codes.js add-limit <code> <amount>');
    process.exit(1);
  }

  const additionalLimit = parseInt(amount);
  if (isNaN(additionalLimit) || additionalLimit <= 0) {
    console.error('❌ Amount must be a positive integer');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  // Initialize dailyScraping if it doesn't exist
  if (!codes[code].dailyScraping) {
    codes[code].dailyScraping = {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };
  }

  // Add additional limit
  const currentLimit = codes[code].dailyScraping.count || 0;
  const newLimit = Math.max(0, currentLimit - additionalLimit); // Reduce count (increase remaining)
  
  codes[code].dailyScraping.count = newLimit;
  
  // Update meta information
  codes[code].meta = {
    ...codes[code].meta,
    modifiedBy: 'CLI',
    modifiedAt: new Date().toISOString(),
    dailyLimitModification: {
      previousCount: currentLimit,
      additionalLimit: additionalLimit,
      newCount: newLimit
    }
  };
  
  if (saveCodes(codes)) {
    console.log(`✅ Daily scraping limit updated for user '${code}'`);
    console.log(`   Previous: ${currentLimit}, Added: ${additionalLimit}, New: ${newLimit}`);
  } else {
    console.error('❌ Failed to update daily scraping limit');
    process.exit(1);
  }
}

function resetDailyLimit(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js reset-limit <code>');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  // Store old limit for audit
  const oldCount = codes[code].dailyScraping?.count || 0;
  
  // Reset daily limit
  codes[code].dailyScraping = {
    date: new Date().toDateString(),
    count: 0,
    lastReset: new Date().toISOString()
  };
  
  // Update meta information
  codes[code].meta = {
    ...codes[code].meta,
    modifiedBy: 'CLI',
    modifiedAt: new Date().toISOString(),
    dailyLimitReset: {
      previousCount: oldCount,
      resetAt: new Date().toISOString()
    }
  };
  
  if (saveCodes(codes)) {
    console.log(`✅ Daily scraping limit reset for user '${code}'`);
    console.log(`   Previous count: ${oldCount}, now reset to 0`);
  } else {
    console.error('❌ Failed to reset daily scraping limit');
    process.exit(1);
  }
}

function showDailyLimitStatus(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js limit-status <code>');
    process.exit(1);
  }

  const codes = loadCodes();
  
  if (!codes[code]) {
    console.error(`❌ Code '${code}' not found`);
    process.exit(1);
  }

  const dailyScraping = codes[code].dailyScraping || {
    date: new Date().toDateString(),
    count: 0,
    lastReset: new Date().toISOString()
  };

  const DAILY_SCRAPING_LIMIT = 4; // Default limit
  const remainingLimit = Math.max(0, DAILY_SCRAPING_LIMIT - dailyScraping.count);
  const isLimitReached = dailyScraping.count >= DAILY_SCRAPING_LIMIT;

  console.log(`📊 Daily Limit Status for ${code}`);
  console.log('─'.repeat(50));
  console.log(`📅 Current Date: ${dailyScraping.date}`);
  console.log(`🔢 Used Today: ${dailyScraping.count}/${DAILY_SCRAPING_LIMIT}`);
  console.log(`📈 Remaining Today: ${remainingLimit}`);
  console.log(`⚠️  Limit Reached: ${isLimitReached ? 'Yes' : 'No'}`);
  console.log(`🔄 Last Reset: ${new Date(dailyScraping.lastReset).toLocaleString()}`);
  console.log(`⏰ Next Reset: ${new Date(new Date(dailyScraping.lastReset).getTime() + 24 * 60 * 60 * 1000).toLocaleString()}`);
  
  if (isLimitReached) {
    console.log(`\n💡 User has reached daily limit. Use 'add-limit' command to give more attempts.`);
  } else {
    console.log(`\n💡 User can still perform ${remainingLimit} more scraping jobs today.`);
  }
}

// API Pool Management Functions
function addGoogleKey(args) {
  const [apiKey] = args;
  
  if (!apiKey) {
    console.error('❌ API key is required');
    console.log('Usage: node manage_codes.js add-google-key <key>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    const result = apiPoolManager.addGoogleSearchKey(apiKey, 'CLI');
    
    if (result.success) {
      console.log('✅ Google Search API key added successfully!');
      console.log(`🔑 Key: ${result.maskedKey}`);
      console.log(`📅 Added: ${new Date().toLocaleString()}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error adding Google Search API key:', error.message);
    process.exit(1);
  }
}

function addGeminiKey(args) {
  const [apiKey] = args;
  
  if (!apiKey) {
    console.error('❌ API key is required');
    console.log('Usage: node manage_codes.js add-gemini-key <key>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    const result = apiPoolManager.addGeminiKey(apiKey, 'CLI');
    
    if (result.success) {
      console.log('✅ Gemini API key added successfully!');
      console.log(`🤖 Key: ${result.maskedKey}`);
      console.log(`📅 Added: ${new Date().toLocaleString()}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error adding Gemini API key:', error.message);
    process.exit(1);
  }
}

function removeGoogleKey(args) {
  const [apiKey] = args;
  
  if (!apiKey) {
    console.error('❌ API key is required');
    console.log('Usage: node manage_codes.js remove-google-key <key>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    const result = apiPoolManager.removeGoogleSearchKey(apiKey);
    
    if (result.success) {
      console.log('✅ Google Search API key removed successfully!');
      console.log(`🔑 Key: ${result.maskedKey}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error removing Google Search API key:', error.message);
    process.exit(1);
  }
}

function removeGeminiKey(args) {
  const [apiKey] = args;
  
  if (!apiKey) {
    console.error('❌ API key is required');
    console.log('Usage: node manage_codes.js remove-gemini-key <key>');
    process.exit(1);
  }

  try {
    const apiPoolManager = new ApiPoolManager();
    const result = apiPoolManager.removeGeminiKey(apiKey);
    
    if (result.success) {
      console.log('✅ Gemini API key removed successfully!');
      console.log(`🤖 Key: ${result.maskedKey}`);
    } else {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error removing Gemini API key:', error.message);
    process.exit(1);
  }
}

function listApiKeys() {
  try {
    const apiPoolManager = new ApiPoolManager();
    const result = apiPoolManager.listApiKeys();
    
    if (!result.success) {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }

    console.log('🔑 **API Key Pool Status**');
    console.log('═'.repeat(50));
    
    // Google Search Keys
    console.log(`\n🔍 **Google Search Keys:**`);
    console.log(`   Total: ${result.googleSearchKeys.total}`);
    console.log(`   Available: ${result.googleSearchKeys.available}`);
    console.log(`   Used: ${result.googleSearchKeys.used}`);
    
    if (result.googleSearchKeys.keys.length > 0) {
      console.log('\n   **Keys:**');
      result.googleSearchKeys.keys.forEach((key, index) => {
        console.log(`   ${index + 1}. ${key.maskedKey} (${key.status})${key.assignedTo ? ` → ${key.assignedTo}` : ''}`);
      });
    }
    
    // Gemini Keys
    console.log(`\n🤖 **Gemini Keys:**`);
    console.log(`   Total: ${result.geminiKeys.total}`);
    console.log(`   Available: ${result.geminiKeys.available}`);
    console.log(`   Used: ${result.geminiKeys.used}`);
    
    if (result.geminiKeys.keys.length > 0) {
      console.log('\n   **Keys:**');
      result.geminiKeys.keys.forEach((key, index) => {
        console.log(`   ${index + 1}. ${key.maskedKey} (${key.status})${key.assignedTo ? ` → ${key.assignedTo}` : ''}`);
      });
    }

    // Pool Statistics
    const stats = apiPoolManager.getPoolStatistics();
    console.log(`\n📊 **Pool Statistics:**`);
    console.log(`   Can create trial users: ${stats.canCreateTrialUsers}`);
    console.log(`   Can create paid users: ${stats.canCreatePaidUsers}`);
    
  } catch (error) {
    console.error('❌ Error listing API keys:', error.message);
    process.exit(1);
  }
}

function showDetailedApiData() {
  try {
    const apiPoolManager = new ApiPoolManager();
    const apiPool = apiPoolManager.apiPool;
    
    console.log('📊 **Detailed API Pool Data**');
    console.log('═'.repeat(50));
    
    // Google Search Keys Details
    console.log(`\n🔍 **Google Search Keys (${apiPool.google_search_keys.length} total):**`);
    if (apiPool.google_search_keys.length === 0) {
      console.log('   No Google Search keys in pool.\n');
    } else {
      apiPool.google_search_keys.forEach((key, index) => {
        console.log(`\n   **${index + 1}. Key:** ${apiPoolManager.maskApiKey(key.key)}`);
        console.log(`   **Status:** ${key.status}`);
        console.log(`   **Added by:** ${key.addedBy || 'Unknown'}`);
        console.log(`   **Added at:** ${key.addedAt ? new Date(key.addedAt).toLocaleString() : 'Unknown'}`);
        if (key.status === 'used') {
          console.log(`   **Assigned to:** ${key.assignedTo || 'Unknown'}`);
          console.log(`   **Assigned at:** ${key.assignedAt ? new Date(key.assignedAt).toLocaleString() : 'Unknown'}`);
        }
      });
      console.log('');
    }
    
    // Gemini Keys Details
    console.log(`🤖 **Gemini Keys (${apiPool.gemini_keys.length} total):**`);
    if (apiPool.gemini_keys.length === 0) {
      console.log('   No Gemini keys in pool.\n');
    } else {
      apiPool.gemini_keys.forEach((key, index) => {
        console.log(`\n   **${index + 1}. Key:** ${apiPoolManager.maskApiKey(key.key)}`);
        console.log(`   **Status:** ${key.status}`);
        console.log(`   **Added by:** ${key.addedBy || 'Unknown'}`);
        console.log(`   **Added at:** ${key.addedAt ? new Date(key.addedAt).toLocaleString() : 'Unknown'}`);
        if (key.status === 'used') {
          console.log(`   **Assigned to:** ${key.assignedTo || 'Unknown'}`);
          console.log(`   **Assigned at:** ${key.assignedAt ? new Date(key.assignedAt).toLocaleString() : 'Unknown'}`);
        }
      });
      console.log('');
    }

    // Summary Statistics
    const availableGoogle = apiPool.google_search_keys.filter(k => k.status === 'available').length;
    const usedGoogle = apiPool.google_search_keys.filter(k => k.status === 'used').length;
    const availableGemini = apiPool.gemini_keys.filter(k => k.status === 'available').length;
    const usedGemini = apiPool.gemini_keys.filter(k => k.status === 'used').length;
    
    console.log(`📈 **Summary:**`);
    console.log(`   Google Keys: ${availableGoogle} available, ${usedGoogle} used`);
    console.log(`   Gemini Keys: ${availableGemini} available, ${usedGemini} used`);
    console.log(`   Can create trial users: ${Math.min(availableGoogle, availableGemini)}`);
    console.log(`   Can create paid users: ${Math.min(Math.floor(availableGoogle / 3), Math.floor(availableGemini / 3))}`);
    
  } catch (error) {
    console.error('❌ Error showing detailed API data:', error.message);
    process.exit(1);
  }
}

function generateTrialCode(args) {
  const randomCode = generateRandomCode();
  console.log(`🎲 Generated random trial code: ${randomCode}`);
  console.log('Adding trial user with generated code...\n');
  
  addTrialUser([randomCode]);
}

function generatePaidCode(args) {
  const randomCode = generateRandomCode();
  console.log(`🎲 Generated random paid code: ${randomCode}`);
  console.log('Adding paid user with generated code...\n');
  
  addPaidUser([randomCode]);
}

function showHelp() {
  console.log('🛠️  WhatsApp Scraper - Admin Code Management');
  console.log('═'.repeat(50));
  console.log('');
  console.log('📋 Available Commands:');
  console.log('');
  console.log('🔑 **API Pool Management:**');
  console.log('  add-google-key <key>');
  console.log('    Add a Google Search API key to the pool');
  console.log('');
  console.log('  add-gemini-key <key>');
  console.log('    Add a Gemini API key to the pool');
  console.log('');
  console.log('  remove-google-key <key>');
  console.log('    Remove a Google Search API key from the pool');
  console.log('');
  console.log('  remove-gemini-key <key>');
  console.log('    Remove a Gemini API key from the pool');
  console.log('');
  console.log('  list-keys');
  console.log('    List all API keys in the pool with their status');
  console.log('');
  console.log('  show-api-data');
  console.log('    Show detailed API pool data with metadata');
  console.log('');
  console.log('👥 **User Management:**');
  console.log('  add-trial <code>');
  console.log('    Add a new trial user (API keys assigned automatically)');
  console.log('');
  console.log('  add-paid <code>');
  console.log('    Add a new paid user (API keys assigned automatically)');
  console.log('');
  console.log('  generate-trial');
  console.log('    Generate a random code for trial user');
  console.log('');
  console.log('  generate-paid');
  console.log('    Generate a random code for paid user');
  console.log('');
  console.log('  list');
  console.log('    List all existing codes (with masked keys and user types)');
  console.log('');
  console.log('  info <code>');
  console.log('    Show detailed information about a specific code');
  console.log('');
  console.log('  remove <code>');
  console.log('    Remove an existing code (API keys returned to pool)');
  console.log('');
  console.log('🔧 **User Configuration:**');
  console.log('  modify-code <old_code> <new_code>');
  console.log('    Change a user\'s access code');
  console.log('');
  console.log('  modify-language <code> <language>');
  console.log('    Change a user\'s language preference (en, fr, ar)');
  console.log('');
  console.log('  add-limit <code> <amount>');
  console.log('    Add more daily scraping attempts for a user');
  console.log('');
  console.log('  reset-limit <code>');
  console.log('    Reset a user\'s daily scraping count to 0');
  console.log('');
  console.log('  limit-status <code>');
  console.log('    Check a user\'s daily scraping limit status');
  console.log('');
  console.log('  help');
  console.log('    Show this help message');
  console.log('');
  console.log('📝 Examples:');
  console.log('  # First, add API keys to the pool:');
  console.log('  node manage_codes.js add-google-key AIzaSy...');
  console.log('  node manage_codes.js add-gemini-key AIzaSy...');
  console.log('');
  console.log('  # Then create users (API keys assigned automatically):');
  console.log('  node manage_codes.js add-trial abc123');
  console.log('  node manage_codes.js add-paid xyz789');
  console.log('  node manage_codes.js generate-trial');
  console.log('  node manage_codes.js generate-paid');
  console.log('');
  console.log('  # Manage users:');
  console.log('  node manage_codes.js list');
  console.log('  node manage_codes.js info abc123');
  console.log('  node manage_codes.js remove abc123');
  console.log('');
  console.log('  # Check API pool status:');
  console.log('  node manage_codes.js list-keys');
  console.log('  node manage_codes.js show-api-data');
}

// Main CLI handler
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command) {
    showHelp();
    return;
  }

  switch (command.toLowerCase()) {
    // API Pool Management
    case 'add-google-key':
      addGoogleKey(commandArgs);
      break;
    case 'add-gemini-key':
      addGeminiKey(commandArgs);
      break;
    case 'remove-google-key':
      removeGoogleKey(commandArgs);
      break;
    case 'remove-gemini-key':
      removeGeminiKey(commandArgs);
      break;
    case 'list-keys':
      listApiKeys();
      break;
    case 'show-api-data':
      showDetailedApiData();
      break;
    
    // User Management
    case 'add-trial':
      addTrialUser(commandArgs);
      break;
    case 'add-paid':
      addPaidUser(commandArgs);
      break;
    case 'generate-trial':
      generateTrialCode(commandArgs);
      break;
    case 'generate-paid':
      generatePaidCode(commandArgs);
      break;
    case 'list':
      listCodes();
      break;
    case 'remove':
    case 'delete':
      removeCode(commandArgs);
      break;
    case 'info':
    case 'show':
      showCodeInfo(commandArgs);
      break;
    
    // User Configuration
    case 'modify-code':
      modifyUserCode(commandArgs);
      break;
    case 'modify-language':
      modifyUserLanguage(commandArgs);
      break;
    case 'add-limit':
      addDailyLimit(commandArgs);
      break;
    case 'reset-limit':
      resetDailyLimit(commandArgs);
      break;
    case 'limit-status':
      showDailyLimitStatus(commandArgs);
      break;
    
    // Help
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "node manage_codes.js help" for available commands');
      process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('manage_codes.js')) {
  main();
}

export {
  loadCodes,
  saveCodes,
  generateRandomCode,
  validateApiKey,
  maskApiKey,
  ApiPoolManager
};
