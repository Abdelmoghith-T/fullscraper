#!/usr/bin/env node

// Quick test for LinkedIn export functionality
console.log('🧪 Quick LinkedIn Export Test...\n');

// Mock data
const mockData = [
  { name: "Test User", profileUrl: "https://linkedin.com/in/test", bio: "Test bio" }
];

async function quickTest() {
  try {
    // Import and test the export function
    const { exportLinkedInResults } = await import('./google search + linkdin scraper/lead-scraper/helpers/exportToCsv.js');
    console.log('✅ exportLinkedInResults imported successfully');
    
    // Quick export test
    const result = await exportLinkedInResults(mockData, 'xlsx', 'quick_test.xlsx', 'test niche');
    console.log(`✅ Export successful: ${result}`);
    
    console.log('\n🎉 Quick test passed! LinkedIn export is working.');
    
  } catch (error) {
    console.error(`❌ Quick test failed: ${error.message}`);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

quickTest();
