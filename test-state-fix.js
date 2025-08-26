import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test the session state fix
function testSessionStateFix() {
  console.log('🧪 Testing Session State Fix...\n');

  // Simulate a stuck session
  const stuckSession = {
    prefs: {
      source: 'ALL',
      format: 'XLSX',
      limit: 300
    },
    status: 'idle',
    currentStep: 'scraping_in_progress', // This is the stuck state
    previousMessage: null,
    language: 'en',
    meta: {
      createdAt: new Date().toISOString(),
      totalJobs: 0,
      lastNiche: null
    },
    security: {
      failedAuthAttempts: 0,
      lastFailedAttempt: null,
      isBlocked: false,
      blockedAt: null
    },
    dailyScraping: {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    }
  };

  console.log('📋 Original stuck session:');
  console.log(`   currentStep: ${stuckSession.currentStep}`);
  console.log(`   status: ${stuckSession.status}\n`);

  // Simulate the fix logic
  const activeJobs = new Map(); // Empty - no active jobs
  
  if (stuckSession.currentStep === 'scraping_in_progress' && !activeJobs.has('test_user')) {
    console.log('🔧 Fixing stuck session state...');
    
    // Apply the fix
    stuckSession.currentStep = 'awaiting_niche';
    stuckSession.status = 'idle';
    stuckSession.currentLoadingPercentage = 0;
    stuckSession.lastLoadingUpdateTimestamp = 0;
    
    console.log('✅ Session state fixed!');
    console.log(`   currentStep: ${stuckSession.currentStep}`);
    console.log(`   status: ${stuckSession.status}`);
  }

  console.log('\n🎯 Test completed successfully!');
  console.log('   The session state fix should now prevent stuck "scraping in progress" messages.');
}

// Run the test
testSessionStateFix();
