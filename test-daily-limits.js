#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const DAILY_SCRAPING_LIMIT = 4;

/**
 * Test script for daily scraping limits
 * This script tests the daily limit functionality without running the full bot
 */

// Helper functions (copied from bot.js)
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

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Error saving ${filePath}:`, error.message);
    return false;
  }
}

function checkDailyScrapingLimit(jid, sessions) {
  const session = sessions[jid];
  if (!session) {
    return { canScrape: false, remaining: 0, resetTime: null };
  }

  // Initialize daily tracking if not exists
  if (!session.dailyScraping) {
    session.dailyScraping = {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };
  }

  const today = new Date().toDateString();
  const lastReset = new Date(session.dailyScraping.lastReset);
  const lastResetDate = lastReset.toDateString();

  // Check if it's a new day
  if (today !== lastResetDate) {
    // Reset daily count for new day
    session.dailyScraping.date = today;
    session.dailyScraping.count = 0;
    session.dailyScraping.lastReset = new Date().toISOString();
    
    // Save updated session
    sessions[jid] = session;
    saveJson(SESSIONS_FILE, sessions);
  }

  const remaining = Math.max(0, DAILY_SCRAPING_LIMIT - session.dailyScraping.count);
  const canScrape = remaining > 0;

  // Calculate next reset time (tomorrow at midnight)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetTime = tomorrow.toLocaleString();

  return { canScrape, remaining, resetTime };
}

function incrementDailyScrapingCount(jid, sessions) {
  try {
    const session = sessions[jid];
    if (!session) {
      return false;
    }

    // Initialize daily tracking if not exists
    if (!session.dailyScraping) {
      session.dailyScraping = {
        date: new Date().toDateString(),
        count: 0,
        lastReset: new Date().toISOString()
      };
    }

    const today = new Date().toDateString();
    const lastReset = new Date(session.dailyScraping.lastReset);
    const lastResetDate = lastReset.toDateString();

    // Check if it's a new day
    if (today !== lastResetDate) {
      // Reset daily count for new day
      session.dailyScraping.date = today;
      session.dailyScraping.count = 0;
      session.dailyScraping.lastReset = new Date().toISOString();
    }

    // Increment count
    session.dailyScraping.count += 1;
    
    // Save updated session
    sessions[jid] = session;
    saveJson(SESSIONS_FILE, sessions);
    
    console.log(`📊 Daily scraping count updated for ${jid}: ${session.dailyScraping.count}/${DAILY_SCRAPING_LIMIT}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating daily scraping count for ${jid}:`, error.message);
    return false;
  }
}

function getDailyScrapingStatusMessage(limitInfo) {
  if (limitInfo.canScrape) {
    return `📊 Daily Scraping Status: ${limitInfo.remaining}/${DAILY_SCRAPING_LIMIT} remaining\n⏰ Resets: Tomorrow at midnight`;
  } else {
    return `🚫 Daily Limit Reached\n\nYou have used all ${DAILY_SCRAPING_LIMIT} daily scrapings.\n⏰ Come back tomorrow to continue scraping.\n\n💡 Next reset: ${limitInfo.resetTime}`;
  }
}

// Test functions
function testDailyLimitInitialization() {
  console.log('\n🧪 Testing Daily Limit Initialization...');
  
  const testJid = 'test_user@s.whatsapp.net';
  const sessions = loadJson(SESSIONS_FILE, {});
  
  // Create a test session
  if (!sessions[testJid]) {
    sessions[testJid] = {
      prefs: { source: 'ALL', format: 'XLSX', limit: 300 },
      status: 'idle',
      currentStep: 'awaiting_niche',
      language: 'en',
      meta: { createdAt: new Date().toISOString(), totalJobs: 0 },
      security: { failedAuthAttempts: 0, isBlocked: false }
    };
  }
  
  // Test initial limit check
  const initialLimit = checkDailyScrapingLimit(testJid, sessions);
  console.log('✅ Initial limit check:', initialLimit);
  
  // Save test session
  saveJson(SESSIONS_FILE, sessions);
  
  return { sessions, testJid };
}

function testDailyLimitIncrement(sessions, testJid) {
  console.log('\n🧪 Testing Daily Limit Increment...');
  
  // Test multiple increments
  for (let i = 1; i <= 6; i++) {
    const beforeLimit = checkDailyScrapingLimit(testJid, sessions);
    console.log(`\n📊 Before increment ${i}:`, beforeLimit);
    
    if (beforeLimit.canScrape) {
      incrementDailyScrapingCount(testJid, sessions);
      const afterLimit = checkDailyScrapingLimit(testJid, sessions);
      console.log(`📊 After increment ${i}:`, afterLimit);
      
      if (!afterLimit.canScrape) {
        console.log('🚫 Limit reached after increment', i);
        break;
      }
    } else {
      console.log('🚫 Cannot scrape - limit reached');
      break;
    }
  }
  
  // Save updated sessions
  saveJson(SESSIONS_FILE, sessions);
}

function testDailyLimitReset() {
  console.log('\n🧪 Testing Daily Limit Reset...');
  
  const testJid = 'test_user@s.whatsapp.net';
  const sessions = loadJson(SESSIONS_FILE, {});
  
  if (sessions[testJid] && sessions[testJid].dailyScraping) {
    // Simulate yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    sessions[testJid].dailyScraping.date = yesterday.toDateString();
    sessions[testJid].dailyScraping.count = 4; // Max count
    sessions[testJid].dailyScraping.lastReset = yesterday.toISOString();
    
    console.log('📅 Simulated yesterday with max count');
    
    // Check limit (should reset)
    const limitAfterReset = checkDailyScrapingLimit(testJid, sessions);
    console.log('✅ Limit after reset:', limitAfterReset);
    
    // Save updated sessions
    saveJson(SESSIONS_FILE, sessions);
  }
}

function testMultipleUsers() {
  console.log('\n🧪 Testing Multiple Users...');
  
  const sessions = loadJson(SESSIONS_FILE, {});
  
  // Create multiple test users
  const testUsers = ['user1@s.whatsapp.net', 'user2@s.whatsapp.net', 'user3@s.whatsapp.net'];
  
  testUsers.forEach((jid, index) => {
    if (!sessions[jid]) {
      sessions[jid] = {
        prefs: { source: 'ALL', format: 'XLSX', limit: 300 },
        status: 'idle',
        currentStep: 'awaiting_niche',
        language: 'en',
        meta: { createdAt: new Date().toISOString(), totalJobs: 0 },
        security: { failedAuthAttempts: 0, isBlocked: false }
      };
    }
    
    // Test limit check for each user
    const limit = checkDailyScrapingLimit(jid, sessions);
    console.log(`📱 User ${index + 1} (${jid.split('@')[0]}):`, limit);
    
    // Increment count for some users
    if (index < 2) {
      incrementDailyScrapingCount(jid, sessions);
    }
  });
  
  // Save updated sessions
  saveJson(SESSIONS_FILE, sessions);
}

function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  const sessions = loadJson(SESSIONS_FILE, {});
  const testJids = [
    'test_user@s.whatsapp.net',
    'user1@s.whatsapp.net',
    'user2@s.whatsapp.net',
    'user3@s.whatsapp.net'
  ];
  
  testJids.forEach(jid => {
    if (sessions[jid]) {
      delete sessions[jid];
      console.log(`🗑️ Removed test session: ${jid}`);
    }
  });
  
  saveJson(SESSIONS_FILE, sessions);
  console.log('✅ Test data cleaned up');
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Daily Limit Tests...\n');
  
  try {
    // Test 1: Initialization
    const { sessions, testJid } = testDailyLimitInitialization();
    
    // Test 2: Increment
    testDailyLimitIncrement(sessions, testJid);
    
    // Test 3: Reset
    testDailyLimitReset();
    
    // Test 4: Multiple users
    testMultipleUsers();
    
    // Test 5: Final status check
    console.log('\n🧪 Final Status Check...');
    const finalSessions = loadJson(SESSIONS_FILE, {});
    const finalLimit = checkDailyScrapingLimit(testJid, finalSessions);
    console.log('📊 Final limit status:', finalLimit);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up test data
    cleanupTestData();
  }
}

// Run tests if this file is executed directly
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  runTests();
}

export { checkDailyScrapingLimit, incrementDailyScrapingCount, getDailyScrapingStatusMessage };
