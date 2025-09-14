#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CODES_FILE = path.join(__dirname, 'codes.json');

/**
 * Admin CLI for managing WhatsApp scraper access codes
 * Usage:
 *   node manage_codes.js add <code> <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>
 *   node manage_codes.js list
 *   node manage_codes.js remove <code>
 *   node manage_codes.js info <code>
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
function addCode(args) {
  const [code, googleKey1, googleKey2, googleKey3, geminiKey1, geminiKey2, geminiKey3] = args;
  
  if (!code) {
    console.error('❌ Code is required');
    console.log('Usage: node manage_codes.js add <code> <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>');
    process.exit(1);
  }

  if (!googleKey1 || !googleKey2 || !googleKey3 || !geminiKey1 || !geminiKey2 || !geminiKey3) {
    console.error('❌ All API keys are required: Google Key 1, Google Key 2, Google Key 3, Gemini Key 1, Gemini Key 2, Gemini Key 3');
    console.log('Usage: node manage_codes.js add <code> <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>');
    process.exit(1);
  }

  try {
    // Validate API keys
    const validatedGoogleKey1 = validateApiKey(googleKey1, 'Google Search Key 1');
    const validatedGoogleKey2 = validateApiKey(googleKey2, 'Google Search Key 2');
    const validatedGoogleKey3 = validateApiKey(googleKey3, 'Google Search Key 3');
    const validatedGeminiKey1 = validateApiKey(geminiKey1, 'Gemini AI Key 1');
    const validatedGeminiKey2 = validateApiKey(geminiKey2, 'Gemini AI Key 2');
    const validatedGeminiKey3 = validateApiKey(geminiKey3, 'Gemini AI Key 3');

    const codes = loadCodes();
    
    if (codes[code]) {
      console.log(`⚠️  Code '${code}' already exists. Overwriting...`);
    }

    codes[code] = {
      apiKeys: {
        googleSearchKeys: [validatedGoogleKey1, validatedGoogleKey2, validatedGoogleKey3],
        geminiKeys: [validatedGeminiKey1, validatedGeminiKey2, validatedGeminiKey3]
      },
      createdAt: new Date().toISOString(),
      expiresAt: null,
      meta: {
        issuedBy: 'admin',
        lastUsed: null,
        useCount: 0
      },
      language: 'en' // Default language for new users
    };

    if (saveCodes(codes)) {
      console.log('✅ Code added successfully!');
      console.log(`📋 Code: ${code}`);
      console.log(`🔑 Google Search Keys: ${maskApiKey(validatedGoogleKey1)}, ${maskApiKey(validatedGoogleKey2)}`);
      console.log(`🤖 Gemini AI Keys: ${maskApiKey(validatedGeminiKey1)}, ${maskApiKey(validatedGeminiKey2)}`);
      console.log(`📅 Created: ${new Date().toLocaleString()}`);
    }
  } catch (error) {
    console.error('❌ Error adding code:', error.message);
    process.exit(1);
  }
}

function listCodes() {
  const codes = loadCodes();
  const codeList = Object.keys(codes);
  
  if (codeList.length === 0) {
    console.log('📋 No codes found. Use "add" command to create codes.');
    return;
  }

  console.log(`📋 Total Codes: ${codeList.length}\n`);
  
  codeList.forEach((code, index) => {
    const data = codes[code];
    console.log(`${index + 1}. Code: ${code}`);
    console.log(`   🔑 Google Keys: ${data.apiKeys.googleSearchKeys.map(maskApiKey).join(', ')}`);
    console.log(`   🤖 Gemini Keys: ${data.apiKeys.geminiKeys.map(maskApiKey).join(', ')}`);
    console.log(`   🌐 Language: ${data.language || 'en'} (default)`);
    console.log(`   📅 Created: ${new Date(data.createdAt).toLocaleString()}`);
    console.log(`   📊 Usage: ${data.meta.useCount} times`);
    if (data.meta.lastUsed) {
      console.log(`   ⏰ Last Used: ${new Date(data.meta.lastUsed).toLocaleString()}`);
    }
    if (data.expiresAt) {
      console.log(`   ⏳ Expires: ${new Date(data.expiresAt).toLocaleString()}`);
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

  delete codes[code];
  
  if (saveCodes(codes)) {
    console.log(`✅ Code '${code}' removed successfully!`);
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
  console.log(`📋 Code Information: ${code}`);
  console.log('─'.repeat(50));
  console.log(`🔑 Google Search Keys:`);
  data.apiKeys.googleSearchKeys.forEach((key, i) => {
    console.log(`   Key ${i + 1}: ${maskApiKey(key)}`);
  });
  console.log(`🤖 Gemini AI Keys:`);
  data.apiKeys.geminiKeys.forEach((key, i) => {
    console.log(`   Key ${i + 1}: ${maskApiKey(key)}`);
  });
  console.log(`🌐 Language: ${data.language || 'en'} (default)`);
  console.log(`📅 Created: ${new Date(data.createdAt).toLocaleString()}`);
  console.log(`📊 Usage Count: ${data.meta.useCount}`);
  console.log(`👤 Issued By: ${data.meta.issuedBy}`);
  
  if (data.meta.lastUsed) {
    console.log(`⏰ Last Used: ${new Date(data.meta.lastUsed).toLocaleString()}`);
  } else {
    console.log(`⏰ Last Used: Never`);
  }
  
  if (data.expiresAt) {
    const isExpired = new Date(data.expiresAt) < new Date();
    console.log(`⏳ Expires: ${new Date(data.expiresAt).toLocaleString()} ${isExpired ? '(EXPIRED)' : ''}`);
  } else {
    console.log(`⏳ Expires: Never`);
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

function generateCode(args) {
  const [googleKey1, googleKey2, googleKey3, geminiKey1, geminiKey2, geminiKey3] = args;
  
  if (!googleKey1 || !googleKey2 || !googleKey3 || !geminiKey1 || !geminiKey2 || !geminiKey3) {
    console.error('❌ All API keys are required: Google Key 1, Google Key 2, Google Key 3, Gemini Key 1, Gemini Key 2, Gemini Key 3');
    console.log('Usage: node manage_codes.js generate <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>');
    process.exit(1);
  }

  const randomCode = generateRandomCode();
  console.log(`🎲 Generated random code: ${randomCode}`);
  console.log('Adding with generated code...\n');
  
  addCode([randomCode, googleKey1, googleKey2, googleKey3, geminiKey1, geminiKey2, geminiKey3]);
}

function showHelp() {
  console.log('🛠️  WhatsApp Scraper - Admin Code Management');
  console.log('═'.repeat(50));
  console.log('');
  console.log('📋 Available Commands:');
  console.log('');
  console.log('  add <code> <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>');
  console.log('    Add a new access code with 3 API keys for each service');
  console.log('');
  console.log('  generate <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>');
  console.log('    Generate a random code and add it with 3 API keys for each service');
  console.log('');
  console.log('  list');
  console.log('    List all existing codes (with masked keys)');
  console.log('');
  console.log('  info <code>');
  console.log('    Show detailed information about a specific code');
  console.log('');
  console.log('  remove <code>');
  console.log('    Remove an existing code');
  console.log('');
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
  console.log('  node manage_codes.js add abc123 YOUR_GOOGLE_KEY_1 YOUR_GOOGLE_KEY_2 YOUR_GEMINI_KEY_1 YOUR_GEMINI_KEY_2');
  console.log('  node manage_codes.js generate YOUR_GOOGLE_KEY_1 YOUR_GOOGLE_KEY_2 YOUR_GEMINI_KEY_1 YOUR_GEMINI_KEY_2');
  console.log('  node manage_codes.js list');
  console.log('  node manage_codes.js info abc123');
  console.log('  node manage_codes.js remove abc123');
  console.log('  node manage_codes.js modify-code abc123 xyz789');
  console.log('  node manage_codes.js modify-language abc123 fr');
  console.log('  node manage_codes.js add-limit abc123 2');
  console.log('  node manage_codes.js reset-limit abc123');
  console.log('  node manage_codes.js limit-status abc123');
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
    case 'add':
      addCode(commandArgs);
      break;
    case 'generate':
      generateCode(commandArgs);
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
  maskApiKey
};
