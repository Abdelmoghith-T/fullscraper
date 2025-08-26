#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCESS_CODES_FILE = path.join(__dirname, 'codes.json');
const DAILY_SCRAPING_LIMIT = 4;

/**
 * Test script to verify daily limit enforcement
 */

// Load access codes
function loadJson(filePath, defaultValue = {}) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return defaultValue;
  }
}

// Check daily scraping limit (same function as in bot.js)
function checkDailyScrapingLimit(jid, sessions) {
  const session = sessions[jid];
  if (!session || !session.code) {
    return { canScrape: false, remaining: 0, resetTime: null };
  }

  // Load access codes to get daily limits
  const accessCodes = loadJson(ACCESS_CODES_FILE, {});
  const userCode = session.code;
  const userAccess = accessCodes[userCode];
  
  if (!userAccess) {
    console.log(`❌ Access code not found for user ${jid.split('@')[0]}: ${userCode}`);
    return { canScrape: false, remaining: 0, resetTime: null };
  }

  // Initialize daily tracking if not exists
  if (!userAccess.dailyScraping) {
    userAccess.dailyScraping = {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };
  }

  const today = new Date().toDateString();
  const lastReset = new Date(userAccess.dailyScraping.lastReset);
  const lastResetDate = lastReset.toDateString();

  // Check if it's a new day
  if (today !== lastResetDate) {
    // Reset daily count for new day
    userAccess.dailyScraping.date = today;
    userAccess.dailyScraping.count = 0;
    userAccess.dailyScraping.lastReset = new Date().toISOString();
    
    // Save updated access codes
    accessCodes[userCode] = userAccess;
    console.log(`🔄 Daily limit reset for access code ${userCode}: new day detected`);
  }

  const remaining = Math.max(0, DAILY_SCRAPING_LIMIT - userAccess.dailyScraping.count);
  const canScrape = remaining > 0;

  // Calculate next reset time (tomorrow at midnight)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetTime = tomorrow.toLocaleString();

  console.log(`🔍 Daily limit calculation for ${jid.split('@')[0]} (${userCode}): count=${userAccess.dailyScraping.count}, limit=${DAILY_SCRAPING_LIMIT}, remaining=${remaining}, canScrape=${canScrape}`);

  return { canScrape, remaining, resetTime };
}

// Test scenarios
function testDailyLimitEnforcement() {
  console.log('🧪 Testing Daily Limit Enforcement\n');

  // Test 1: User with 0/4 daily limit (can scrape)
  console.log('📋 Test 1: User with 0/4 daily limit (should be able to scrape)');
  const testSession1 = {
    code: 'testuser',
    language: 'en'
  };
  
  const testJid1 = 'testuser@test.com';
  const sessions1 = { [testJid1]: testSession1 };
  
  const limitInfo1 = checkDailyScrapingLimit(testJid1, sessions1);
  console.log(`✅ Result: canScrape=${limitInfo1.canScrape}, remaining=${limitInfo1.remaining}\n`);

  // Test 2: Simulate user reaching daily limit
  console.log('📋 Test 2: Simulating user reaching daily limit');
  
  // Load current codes and set testuser to 4/4
  const accessCodes = loadJson(ACCESS_CODES_FILE, {});
  if (accessCodes.testuser && accessCodes.testuser.dailyScraping) {
    accessCodes.testuser.dailyScraping.count = 4;
    console.log('✅ Set testuser daily count to 4/4');
  }
  
  const limitInfo2 = checkDailyScrapingLimit(testJid1, sessions1);
  console.log(`✅ Result: canScrape=${limitInfo2.canScrape}, remaining=${limitInfo2.remaining}\n`);

  // Test 3: Test with non-existent user
  console.log('📋 Test 3: Non-existent user (should not be able to scrape)');
  const testSession3 = {
    code: 'nonexistent',
    language: 'en'
  };
  
  const testJid3 = 'nonexistent@test.com';
  const sessions3 = { [testJid3]: testSession3 };
  
  const limitInfo3 = checkDailyScrapingLimit(testJid3, sessions3);
  console.log(`✅ Result: canScrape=${limitInfo3.canScrape}, remaining=${limitInfo3.remaining}\n`);

  // Test 4: Test with user1 (should have 4/4 based on current codes.json)
  console.log('📋 Test 4: User1 with 4/4 daily limit (should not be able to scrape)');
  const testSession4 = {
    code: 'user1',
    language: 'en'
  };
  
  const testJid4 = 'user1@test.com';
  const sessions4 = { [testJid4]: testSession4 };
  
  const limitInfo4 = checkDailyScrapingLimit(testJid4, sessions4);
  console.log(`✅ Result: canScrape=${limitInfo4.canScrape}, remaining=${limitInfo4.remaining}\n`);

  console.log('🎯 Test Summary:');
  console.log(`• Test 1 (0/4): ${limitInfo1.canScrape ? '✅ PASS' : '❌ FAIL'} - Should be able to scrape`);
  console.log(`• Test 2 (4/4): ${!limitInfo2.canScrape ? '✅ PASS' : '❌ FAIL'} - Should NOT be able to scrape`);
  console.log(`• Test 3 (nonexistent): ${!limitInfo3.canScrape ? '✅ PASS' : '❌ FAIL'} - Should NOT be able to scrape`);
  console.log(`• Test 4 (user1 4/4): ${!limitInfo4.canScrape ? '✅ PASS' : '❌ FAIL'} - Should NOT be able to scrape`);
}

// Run tests
testDailyLimitEnforcement();
