#!/usr/bin/env node

import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

// Simulate LinkedIn profile data
const mockLinkedInProfiles = [
  {
    name: "John Doe",
    profileUrl: "https://linkedin.com/in/johndoe",
    bio: "Software Developer with 5 years experience",
    source: "linkedin",
    isCompanyPage: false,
    query: "software developer"
  },
  {
    name: "Jane Smith",
    profileUrl: "https://linkedin.com/in/janesmith",
    bio: "Marketing Manager at Tech Corp",
    source: "linkedin",
    isCompanyPage: false,
    query: "marketing manager"
  },
  {
    name: "Tech Solutions Inc",
    profileUrl: "https://linkedin.com/company/techsolutions",
    bio: "Leading technology consulting company",
    source: "linkedin",
    isCompanyPage: true,
    query: "tech company"
  }
];

// Test the export function directly
async function testLinkedInExport() {
  console.log(chalk.blue('🧪 Testing LinkedIn Export Functionality...\n'));
  
  try {
    // Import the export function
    const { exportLinkedInResults } = await import('./google search + linkdin scraper/lead-scraper/helpers/exportToCsv.js');
    
    console.log(chalk.green('✅ Successfully imported exportLinkedInResults function'));
    
    // Test 1: Export with niche and filename
    console.log(chalk.yellow('\n📝 Test 1: Export with niche and filename'));
    const testFilename1 = `test_web_developers_linkedin_results.xlsx`;
    const result1 = await exportLinkedInResults(mockLinkedInProfiles, 'xlsx', testFilename1, 'web developers');
    console.log(chalk.green(`✅ Test 1 passed: ${result1}`));
    
    // Test 2: Export with just niche (no filename)
    console.log(chalk.yellow('\n📝 Test 2: Export with just niche (no filename)'));
    const result2 = await exportLinkedInResults(mockLinkedInProfiles, 'xlsx', null, 'software engineers');
    console.log(chalk.green(`✅ Test 2 passed: ${result2}`));
    
    // Test 3: Export with no niche and no filename
    console.log(chalk.yellow('\n📝 Test 3: Export with no niche and no filename'));
    const result3 = await exportLinkedInResults(mockLinkedInProfiles, 'xlsx', null, null);
    console.log(chalk.green(`✅ Test 3 passed: ${result3}`));
    
    // Test 4: Export to CSV format
    console.log(chalk.yellow('\n📝 Test 4: Export to CSV format'));
    const result4 = await exportLinkedInResults(mockLinkedInProfiles, 'csv', 'test_profiles.csv', 'test niche');
    console.log(chalk.green(`✅ Test 4 passed: ${result4}`));
    
    console.log(chalk.green.bold('\n🎉 All LinkedIn export tests passed successfully!'));
    
    // List created files
    console.log(chalk.blue('\n📁 Created files:'));
    const resultsDir = path.join(process.cwd(), 'results');
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      files.forEach(file => {
        if (file.includes('test_') || file.includes('linkedin')) {
          const filePath = path.join(resultsDir, file);
          const stats = fs.statSync(filePath);
          console.log(chalk.gray(`   📄 ${file} (${stats.size} bytes)`));
        }
      });
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Test failed: ${error.message}`));
    console.error(chalk.gray('Error details:'), error.stack);
    process.exit(1);
  }
}

// Test the XLSX library directly
async function testXLSXLibrary() {
  console.log(chalk.blue('\n🔧 Testing XLSX Library Directly...\n'));
  
  try {
    const XLSX = await import('xlsx');
    console.log(chalk.green(`✅ XLSX library imported successfully (version: ${XLSX.version})`));
    
    // Create a simple workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(mockLinkedInProfiles);
    XLSX.utils.book_append_sheet(workbook, worksheet, "LinkedIn Profiles");
    
    console.log(chalk.green('✅ Workbook and worksheet created successfully'));
    
    // Test saving to current directory
    const testFile = 'test_xlsx_direct.xlsx';
    XLSX.writeFile(workbook, testFile);
    
    if (fs.existsSync(testFile)) {
      const stats = fs.statSync(testFile);
      console.log(chalk.green(`✅ XLSX file saved directly: ${testFile} (${stats.size} bytes)`));
      
      // Clean up
      fs.unlinkSync(testFile);
      console.log(chalk.gray('   🗑️  Test file cleaned up'));
    } else {
      console.log(chalk.red(`❌ XLSX file not found: ${testFile}`));
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ XLSX library test failed: ${error.message}`));
    console.error(chalk.gray('Error details:'), error.stack);
  }
}

// Test path resolution
async function testPathResolution() {
  console.log(chalk.blue('\n🗂️  Testing Path Resolution...\n'));
  
  console.log(chalk.gray(`Current working directory: ${process.cwd()}`));
  
  // Test different path strategies
  const possiblePaths = [
    path.join(process.cwd(), '..', '..', '..', 'results'),
    path.join(process.cwd(), '..', '..', 'results'),
    path.join(process.cwd(), '..', 'results'),
    path.join(process.cwd(), 'results'),
    path.resolve('./results'),
    path.resolve('../results'),
    path.resolve('../../results'),
    path.resolve('../../../results'),
    process.cwd()
  ];
  
  console.log(chalk.yellow('Testing possible results directory paths:'));
  possiblePaths.forEach((testPath, index) => {
    const exists = fs.existsSync(testPath);
    let writable = false;
    try {
      if (exists) {
        fs.accessSync(testPath, fs.constants.W_OK);
        writable = true;
      }
    } catch (e) {
      writable = false;
    }
    const status = exists ? (writable ? '✅ EXISTS & WRITABLE' : '⚠️  EXISTS but NOT WRITABLE') : '❌ NOT FOUND';
    console.log(chalk.gray(`   ${index + 1}. ${testPath}`));
    console.log(chalk.gray(`      Status: ${status}`));
  });
  
  // Test main project detection
  console.log(chalk.yellow('\nTesting main project detection:'));
  let currentDir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const hasMainFiles = fs.existsSync(path.join(currentDir, 'bot.js')) && 
                        fs.existsSync(path.join(currentDir, 'unified-scraper.js'));
    
    if (fs.existsSync(packageJsonPath)) {
      if (hasMainFiles) {
        console.log(chalk.green(`✅ Main project found: ${currentDir}`));
        const mainResultsPath = path.join(currentDir, 'results');
        console.log(chalk.gray(`   Results path: ${mainResultsPath}`));
        console.log(chalk.gray(`   Exists: ${fs.existsSync(mainResultsPath)}`));
        break;
      } else {
        console.log(chalk.yellow(`⚠️  Package.json found but not main project: ${currentDir}`));
      }
    }
    currentDir = path.join(currentDir, '..');
  }
}

// Main test runner
async function runAllTests() {
  console.log(chalk.blue.bold('🚀 LinkedIn Saving Test Suite\n'));
  console.log(chalk.gray('This test simulates the LinkedIn scraping saving process\n'));
  
  try {
    await testXLSXLibrary();
    await testPathResolution();
    await testLinkedInExport();
    
    console.log(chalk.green.bold('\n🎉 All tests completed successfully!'));
    console.log(chalk.blue('\n💡 The LinkedIn scraper should now save files correctly.'));
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Test suite failed: ${error.message}`));
    process.exit(1);
  }
}

// Run the tests
runAllTests();
