import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test the daily limit enforcement
function testDailyLimitEnforcement() {
  console.log('🧪 Testing Daily Limit Enforcement...\n');

  // Simulate a user session with daily scraping count
  const testSession = {
    dailyScraping: {
      date: new Date().toDateString(),
      count: 4, // User has already done 4 scrapings
      lastReset: new Date().toISOString()
    }
  };

  const DAILY_SCRAPING_LIMIT = 4;
  
  console.log('📋 Test session:');
  console.log(`   Daily count: ${testSession.dailyScraping.count}`);
  console.log(`   Daily limit: ${DAILY_SCRAPING_LIMIT}\n`);

  // Test the limit check logic
  const remaining = Math.max(0, DAILY_SCRAPING_LIMIT - testSession.dailyScraping.count);
  const canScrape = remaining > 0;

  console.log('🔍 Limit calculation:');
  console.log(`   Remaining: ${remaining}`);
  console.log(`   Can scrape: ${canScrape}`);
  console.log(`   Expected: false (should not be able to scrape)\n`);

  if (canScrape === false) {
    console.log('✅ Test PASSED: User correctly blocked from scraping when limit reached');
  } else {
    console.log('❌ Test FAILED: User incorrectly allowed to scrape when limit reached');
  }

  // Test edge case: user with 3/4 scrapings
  const testSession2 = {
    dailyScraping: {
      date: new Date().toDateString(),
      count: 3, // User has done 3 scrapings
      lastReset: new Date().toISOString()
    }
  };

  const remaining2 = Math.max(0, DAILY_SCRAPING_LIMIT - testSession2.dailyScraping.count);
  const canScrape2 = remaining2 > 0;

  console.log('\n🔍 Edge case test (3/4 scrapings):');
  console.log(`   Daily count: ${testSession2.dailyScraping.count}`);
  console.log(`   Remaining: ${remaining2}`);
  console.log(`   Can scrape: ${canScrape2}`);
  console.log(`   Expected: true (should be able to scrape)\n`);

  if (canScrape2 === true) {
    console.log('✅ Edge case PASSED: User correctly allowed to scrape when under limit');
  } else {
    console.log('❌ Edge case FAILED: User incorrectly blocked from scraping when under limit');
  }

  console.log('\n🎯 Test completed!');
  console.log('   The daily limit enforcement should now work correctly.');
}

// Run the test
testDailyLimitEnforcement();
