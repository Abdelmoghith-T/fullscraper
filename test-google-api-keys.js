#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

/**
 * Test Google Search API keys individually to check quota status
 */
async function testGoogleApiKeys() {
  console.log('🧪 Testing Google Search API Keys...\n');
  
  // Your API keys from codes.json
  const apiKeys = [
    'AIzaSyDB34zBGAHN4S-RxBKqlAX7UxuyIMWE-iM',
    'AIzaSyBROTG4GbDRwmiI_RJenS2nZ6MA4z949Gg'
  ];
  
  const searchEngineId = '4385aef0f424b4b5b'; // From your config
  const baseUrl = 'https://www.googleapis.com/customsearch/v1';
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const keyNumber = i + 1;
    
    console.log(chalk.blue(`🔑 Testing API Key ${keyNumber}: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`));
    
    try {
      // Test with a simple search query
      const params = new URLSearchParams({
        key: apiKey,
        cx: searchEngineId,
        q: 'test query',
        num: 1
      });
      
      console.log(chalk.gray(`   📡 Making test request...`));
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 10000
      });
      
      if (response.data && response.data.items) {
        console.log(chalk.green(`   ✅ API Key ${keyNumber} is working! Found ${response.data.items.length} results`));
        
        // Check if there are any quota warnings in the response
        if (response.data.queries && response.data.queries.request) {
          const request = response.data.queries.request[0];
          console.log(chalk.gray(`   📊 Quota info: ${request.totalResults} total results available`));
        }
        
      } else {
        console.log(chalk.yellow(`   ⚠️  API Key ${keyNumber} returned no results (but no error)`));
      }
      
    } catch (error) {
      console.log(chalk.red(`   ❌ API Key ${keyNumber} failed:`));
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        console.log(chalk.red(`      Status: ${status}`));
        
        if (data && data.error) {
          const errorMessage = data.error.message;
          console.log(chalk.red(`      Error: ${errorMessage}`));
          
          // Check for specific quota errors
          if (status === 403) {
            if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
              console.log(chalk.red(`      🚫 Daily quota exceeded for this API key`));
            } else if (errorMessage.includes('key')) {
              console.log(chalk.red(`      🔑 API key issue - check if key is valid`));
            } else if (errorMessage.includes('searchEngine')) {
              console.log(chalk.red(`      🔍 Search engine ID issue`));
            }
          } else if (status === 400) {
            console.log(chalk.red(`      📝 Bad request - check parameters`));
          } else if (status === 429) {
            console.log(chalk.red(`      ⏱️  Rate limit exceeded`));
          }
        }
      } else if (error.request) {
        console.log(chalk.red(`      🌐 Network error - no response received`));
      } else {
        console.log(chalk.red(`      💥 Error: ${error.message}`));
      }
    }
    
    console.log(''); // Empty line between keys
  }
  
  // Test with your actual search engine ID
  console.log(chalk.cyan('🔍 Testing with your actual search engine ID...'));
  console.log(chalk.gray(`   Search Engine ID: ${searchEngineId}`));
  
  // Test a working key with your search engine
  const workingKey = apiKeys[0]; // Use first key for this test
  
  try {
    const params = new URLSearchParams({
      key: workingKey,
      cx: searchEngineId,
      q: 'agence web Fès',
      num: 1
    });
    
    console.log(chalk.gray(`   📡 Testing search for "agence web Fès"...`));
    
    const response = await axios.get(`${baseUrl}?${params}`, {
      timeout: 10000
    });
    
    if (response.data && response.data.items) {
      console.log(chalk.green(`   ✅ Search successful! Found ${response.data.items.length} results`));
      
      // Show first result
      if (response.data.items[0]) {
        const firstResult = response.data.items[0];
        console.log(chalk.gray(`   📋 First result: ${firstResult.title}`));
        console.log(chalk.gray(`   🔗 URL: ${firstResult.link}`));
      }
      
    } else {
      console.log(chalk.yellow(`   ⚠️  Search returned no results`));
    }
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Search failed:`));
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.log(chalk.red(`      Status: ${status}`));
      
      if (data && data.error) {
        console.log(chalk.red(`      Error: ${data.error.message}`));
      }
    } else {
      console.log(chalk.red(`      Error: ${error.message}`));
    }
  }
  
  // Test with invalid search engine ID to see what error we get
  console.log(chalk.cyan('\n🔍 Testing with invalid search engine ID to see error pattern...'));
  
  try {
    const params = new URLSearchParams({
      key: workingKey,
      cx: 'INVALID_SEARCH_ENGINE_ID',
      q: 'test',
      num: 1
    });
    
    console.log(chalk.gray(`   📡 Testing with invalid search engine ID...`));
    
    const response = await axios.get(`${baseUrl}?${params}`, {
      timeout: 10000
    });
    
    console.log(chalk.green(`   ✅ Unexpected success with invalid search engine ID`));
    
  } catch (error) {
    console.log(chalk.yellow(`   ⚠️  Expected failure with invalid search engine ID:`));
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.log(chalk.yellow(`      Status: ${status}`));
      
      if (data && data.error) {
        console.log(chalk.yellow(`      Error: ${data.error.message}`));
      }
    }
  }
  
  // Test quota limits by making multiple requests
  console.log(chalk.cyan('\n🔍 Testing quota limits with multiple requests...'));
  
  const testQueries = ['test1', 'test2', 'test3', 'test4', 'test5'];
  let successfulRequests = 0;
  
  for (let i = 0; i < testQueries.length; i++) {
    try {
      const params = new URLSearchParams({
        key: workingKey,
        cx: searchEngineId,
        q: testQueries[i],
        num: 1
      });
      
      console.log(chalk.gray(`   📡 Request ${i + 1}/5: "${testQueries[i]}"`));
      
      const response = await axios.get(`${baseUrl}?${params}`, {
        timeout: 10000
      });
      
      if (response.data && response.data.items) {
        successfulRequests++;
        console.log(chalk.green(`      ✅ Success`));
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(chalk.red(`      ❌ Failed: ${error.response?.status || error.message}`));
      break; // Stop if we hit an error
    }
  }
  
  console.log(chalk.blue(`\n📊 Quota Test Results: ${successfulRequests}/${testQueries.length} requests successful`));
  
  console.log('\n' + chalk.cyan('📋 Summary:'));
  console.log(chalk.cyan('   • If you see "Daily quota exceeded", the API key has reached its limit'));
  console.log(chalk.cyan('   • If you see "API key issue", the key might be invalid or restricted'));
  console.log(chalk.cyan('   • If you see "Search engine ID issue", check your cx parameter'));
  console.log(chalk.cyan('   • If you see "Rate limit exceeded", wait a bit and try again'));
  console.log(chalk.cyan('   • If you see "Bad request (400)", there might be a parameter issue'));
}

// Run the test
testGoogleApiKeys().catch(console.error);
