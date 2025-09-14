import chalk from 'chalk';
import { ScraperInterface } from '../core/scraper-interface.js';

/**
 * Google Maps Scraper Wrapper
 * Maintains the exact existing workflow while providing unified interface
 */
export class GoogleMapsScraper extends ScraperInterface {
  constructor() {
    super('google_maps', 'Google Maps');
    // Generate unique session ID for this scraping session
    this.sessionId = Date.now();
    this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Validate niche for Google Maps
   */
  validateNiche(niche) {
    if (!super.validateNiche(niche)) {
      return false;
    }
    
    const { businessType, location } = this.parseNiche(niche);
    
    // Google Maps requires both business type and location
    if (!businessType || !location) {
      console.log(chalk.yellow('⚠️  Google Maps works best with "business type + location" format'));
      console.log(chalk.gray('   Examples: "dentist casablanca", "restaurant fes", "lawyer rabat"'));
      return false;
    }
    
    // Warn if location seems too generic
    const genericLocations = ['morocco', 'maroc', 'country', 'city', 'town'];
    if (genericLocations.includes(location.toLowerCase())) {
      console.log(chalk.yellow(`⚠️  "${location}" is quite generic - consider using specific city names`));
      console.log(chalk.gray('   Examples: casablanca, rabat, fes, marrakech, agadir, tangier'));
    }
    
    return true;
  }

  /**
   * Main scraping method using existing Google Maps workflow
   */
  async scrape(niche, options = {}) {
    try {
      // Check for abort signal at the start
      if (options.abortSignal?.aborted) {
        console.log(chalk.yellow('🛑 Google Maps scraping aborted before start'));
        return [];
      }
      
      await this.setup(options);
      
      const { businessType, location } = this.parseNiche(niche);
      
      console.log(chalk.blue('🗺️  Starting Google Maps scraping workflow...'));
      console.log(chalk.gray(`   Business Type: ${businessType}`));
      console.log(chalk.gray(`   Location: ${location}`));
      console.log(chalk.gray(`   Data Type: ${options.dataType || 'complete'}`));
      
      // Dynamic import to avoid affecting other scrapers
      const FlexibleBusinessScraper = await this.loadGoogleMapsScraper();
      
      // Initialize the Maps scraper with exact same workflow
      const mapsScraper = new FlexibleBusinessScraper();
      
      console.log(chalk.blue('🏢 Discovering businesses on Google Maps...'));
      console.log(chalk.gray(`   Max results: ${options.maxResults || 100}`));
      
      // Use the original orchestrateScraping approach that generates multiple AI queries
      // This is what makes the original scraper so powerful
      const fullNiche = `${businessType} ${location}`;
      const maxResultsPerSubQuery = options.maxResults || 100;
      
      console.log(chalk.blue('🤖 Using AI to generate multiple search queries...'));
      console.log(chalk.gray(`   This will find many more businesses than a single search`));
      
      // Call the original orchestration function that uses AI to generate queries
      let results = await this.runOriginalOrchestration(fullNiche, maxResultsPerSubQuery, options.abortSignal);
      
      // Check for abort signal after orchestration
      if (options.abortSignal?.aborted) {
        console.log(chalk.yellow('🛑 Google Maps scraping aborted after orchestration'));
        return [];
      }
      
      console.log(chalk.blue(`✅ Found ${results.length} businesses`));
      
      // Transform results based on requested data type
      let transformedResults = this.transformResults(results, options.dataType);

      // Trial-mode enforcement at wrapper-level: dedupe and cap to trialLimit.
      if (options.trialMode) {
        const limit = Math.max(0, options.trialLimit || 20);
        // Basic dedupe by normalized phone + website + name
        const seen = new Set();
        transformedResults = transformedResults.filter(r => {
          const key = `${(r.phone||'').toString()}|${(r.website||'').toLowerCase()}|${(r.businessName||'').toLowerCase()}|${(r.emails||'').toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, limit);
        console.log(chalk.yellow(`🔒 Trial mode (Google Maps): returning ${transformedResults.length} results`));
      }
      
      await this.cleanup(transformedResults);
      
      return transformedResults;
      
    } catch (error) {
      await this.handleError(error, 'Google Maps scraping');
    }
  }

  /**
   * Load the existing Google Maps scraper
   */
  async loadGoogleMapsScraper() {
    try {
      // Import the existing Maps scraper module (UNCHANGED workflow)
      const mapsModule = await import('../maps_scraper/run.js');
      
      // Extract the FlexibleBusinessScraper class
      return mapsModule.FlexibleBusinessScraper || mapsModule.default;
      
    } catch (error) {
      throw new Error(`Failed to load Google Maps scraper: ${error.message}. Make sure the maps_scraper project is available.`);
    }
  }

  /**
   * Run the original orchestrateScraping logic that generates multiple AI queries
   */
  async runOriginalOrchestration(userQuery, maxResultsPerSubQuery, abortSignal) {
    try {
      // Since the original is CommonJS and this is ES modules, we need to spawn it as a child process
      const { spawn } = await import('child_process');
      const path = await import('path');
      
      const mapsScraperPath = path.join(process.cwd(), 'maps_scraper', 'run.js');
      
      console.log(chalk.blue('🚀 Starting original Google Maps orchestration...'));
      console.log(chalk.gray(`   Command: node run.js "${userQuery}" ${maxResultsPerSubQuery}`));
      
      // Note: Auto-save is handled by the Maps scraper itself (maps_scraper/run.js)
      // No need for wrapper-level auto-save since it's built into the orchestration
      
      return new Promise((resolve, reject) => {
        const child = spawn('node', ['run.js', userQuery, maxResultsPerSubQuery.toString()], {
          cwd: path.join(process.cwd(), 'maps_scraper'),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { 
            ...process.env, 
            FORCE_COLOR: '1',  // Enable colors in child process
            SESSION_ID: this.sessionId.toString(),  // Unique session ID
            SESSION_TIMESTAMP: this.sessionTimestamp,  // Human-readable timestamp
            // Pass multiple Gemini API keys for rotation
            GEMINI_API_KEY: this.getGeminiApiKey() || process.env.GEMINI_API_KEY,
            GEMINI_API_KEY_1: this.apiKeys?.geminiKeys?.[0] || process.env.GEMINI_API_KEY_1,
            GEMINI_API_KEY_2: this.apiKeys?.geminiKeys?.[1] || process.env.GEMINI_API_KEY_2,
            GEMINI_API_KEY_3: this.apiKeys?.geminiKeys?.[2] || process.env.GEMINI_API_KEY_3
          }
        });

        // Set up abort signal handler to kill child process
        let abortHandler = null;
        if (abortSignal) {
          abortHandler = () => {
            console.log(chalk.yellow('🛑 Abort signal received, terminating Google Maps scraper...'));
            child.kill('SIGTERM');
            reject(new Error('Google Maps scraping aborted by user'));
          };
          abortSignal.addEventListener('abort', abortHandler);
        }

        // Interruption handler for Ctrl+C  
        const handleInterruption = async () => {
          console.log(chalk.yellow('\n⚠️  Google Maps scraper interrupted by user'));
          
          // Try to save current partial results
          try {
            const partialResults = await this.parseOriginalScraperResults(userQuery).catch(() => []);
            if (partialResults.length > 0) {
              console.log(chalk.blue(`💾 Saving ${partialResults.length} partial Google Maps results...`));
              console.log(chalk.green(`✅ Partial results saved successfully`));
              console.log(chalk.cyan(`📁 File location: maps_scraper/scraping_results_session_${this.sessionId}.json`));
              console.log(chalk.blue('💡 These results include business names, addresses, phones, and emails'));
            } else {
              console.log(chalk.yellow('⚠️  No results to save - scraper was interrupted too early'));
            }
          } catch (error) {
            console.log(chalk.red(`❌ Failed to save partial results: ${error.message}`));
          }
          
          // Kill the child process
          child.kill('SIGTERM');
          console.log(chalk.gray('\nGoogle Maps scraper terminated by user.'));
          // Do NOT exit the parent process; allow close handler to resolve with partial results
        };

        // Set up interruption handlers
        process.on('SIGINT', handleInterruption);
        process.on('SIGTERM', handleInterruption);
        
        let stdout = '';
        let stderr = '';
        
        let trialInterrupted = false;
        child.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // Stream output to console for real-time feedback
          process.stdout.write(output);

          // Trial mode: detect autosave and stop immediately to capture first autosave
          if (!trialInterrupted && this.options?.trialMode && (output.toLowerCase().includes('auto-saving') || output.toLowerCase().includes('auto-saved'))) {
            trialInterrupted = true;
            setTimeout(() => {
              try { handleInterruption(); } catch (e) {}
            }, 6000);
          }
        });
        
        child.stderr.on('data', (data) => {
          const error = data.toString();
          stderr += error;
          process.stderr.write(error);
        });
        
        child.on('close', (code) => {
          // Clean up interruption handlers
          process.removeListener('SIGINT', handleInterruption);
          process.removeListener('SIGTERM', handleInterruption);
          
          // Clean up abort signal handler
          if (abortHandler && abortSignal) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
          
          // Check if this was an abort
          if (abortSignal?.aborted) {
            console.log(chalk.yellow('🛑 Google Maps scraper terminated by abort signal'));
            reject(new Error('Google Maps scraping aborted by user'));
            return;
          }
          
          if (code === 0 || (this.options?.trialMode && trialInterrupted)) {
            console.log(chalk.green('✅ Google Maps scraper completed successfully'));
            // Parse results from the generated file
            this.parseOriginalScraperResults(userQuery)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`Maps scraper exited with code ${code}. Error: ${stderr}`));
          }
        });

        // Handle child process errors
        child.on('error', (error) => {
          // Clean up interruption handlers on error
          process.removeListener('SIGINT', handleInterruption);
          process.removeListener('SIGTERM', handleInterruption);
          
          // Clean up abort signal handler
          if (abortHandler && abortSignal) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
          
          console.log(chalk.red(`❌ Google Maps scraper error: ${error.message}`));
          reject(new Error(`Failed to start maps scraper: ${error.message}`));
        });
      });
      
    } catch (error) {
      throw new Error(`Failed to run original orchestration: ${error.message}`);
    }
  }

  /**
   * Parse results from the original scraper's output file
   */
  async parseOriginalScraperResults(userQuery) {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      // Look for the most recent results file in results directory (where the scraper actually saves)
      const resultsDir = path.join(process.cwd(), 'results');
      const files = fs.readdirSync(resultsDir);
      
      // Prioritize current session results file, then fall back to other files
      const sessionResultsPattern = `SESSION_${this.sessionId}`;
      const sessionFiles = files.filter(f => f.includes(sessionResultsPattern));
      
             let jsonFiles;
       if (sessionFiles.length > 0) {
         // Use current session results file (most accurate)
         jsonFiles = sessionFiles;
         console.log(chalk.cyan('🎯 Found current session results file (most accurate)'));
       } else {
         // Don't fall back to previous sessions for interrupted early sessions
         console.log(chalk.yellow('⚠️  No current session results found - scraper was interrupted before completion'));
         console.log(chalk.gray('   This means no businesses were actually processed in the current session'));
         jsonFiles = [];  // Return empty instead of using old session data
       }
      
      if (jsonFiles.length === 0) {
        // Fallback: look for any Google Maps results file in the results directory
        console.log(chalk.yellow('⚠️  No current session results found - looking for any Google Maps results...'));
        try {
          const googleMapsFiles = files.filter(f => f.includes('google_maps') && f.endsWith('.json'));
          if (googleMapsFiles.length > 0) {
            // Get the most recent Google Maps file
            const mostRecent = googleMapsFiles
              .map(f => ({ 
                name: f, 
                time: fs.statSync(path.join(resultsDir, f)).mtime 
              }))
              .sort((a, b) => b.time - a.time)[0];
            
            const resultsPath = path.join(resultsDir, mostRecent.name);
            console.log(chalk.cyan(`🎯 Found Google Maps results file: ${mostRecent.name}`));
            const resultsContent = fs.readFileSync(resultsPath, 'utf8');
            const data = JSON.parse(resultsContent);
            const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            console.log(chalk.blue(`📊 Loaded ${results.length} results from Google Maps file`));
            return results;
          }
        } catch (fallbackErr) {
          console.log(chalk.yellow(`⚠️  Google Maps results lookup failed: ${fallbackErr.message}`));
        }
        throw new Error('No results file found from original maps scraper');
      }
      
      // Get the most recent file
      const mostRecent = jsonFiles
        .map(f => ({ 
          name: f, 
          time: fs.statSync(path.join(resultsDir, f)).mtime 
        }))
        .sort((a, b) => b.time - a.time)[0];
      
      const resultsPath = path.join(resultsDir, mostRecent.name);
      const resultsContent = fs.readFileSync(resultsPath, 'utf8');
      const data = JSON.parse(resultsContent);
      
      // Handle the structured JSON format with metadata and results
      let results;
      if (data.results && Array.isArray(data.results)) {
        results = data.results;
        console.log(chalk.blue(`📊 Loaded ${results.length} results from: ${mostRecent.name}`));
        if (data.metadata) {
          console.log(chalk.gray(`   📋 Business Type: ${data.metadata.businessType}`));
          console.log(chalk.gray(`   📍 Location: ${data.metadata.location}`));
          console.log(chalk.gray(`   ⏰ Scraped: ${data.metadata.scrapedAtLocal}`));
        }
      } else if (Array.isArray(data)) {
        // Fallback for simple array format
        results = data;
        console.log(chalk.blue(`📊 Loaded ${results.length} results from: ${mostRecent.name}`));
      } else {
        console.log(chalk.yellow('⚠️  Unexpected JSON structure, attempting to extract results...'));
        results = [];
      }
      
      return results;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to parse results: ${error.message}`));
      throw error;
    }
  }

  /**
   * Transform results based on data type
   */
  transformResults(results, dataType) {
    // Validate and ensure results is an array
    if (!results) {
      console.log(chalk.yellow('⚠️  No results provided to transform'));
      return [];
    }
    
    if (!Array.isArray(results)) {
      console.log(chalk.yellow('⚠️  Google Maps returned non-array results, converting...'));
      console.log(chalk.gray(`   Received type: ${typeof results}`));
      console.log(chalk.gray(`   Received value: ${JSON.stringify(results).substring(0, 100)}...`));
      return [];
    }
    
    console.log(chalk.blue(`📊 Transforming ${results.length} Google Maps results for dataType: ${dataType}`));
    
    switch (dataType) {
      case 'contacts':
        return results
          .map(business => {
            const result = { source: 'Google Maps' };
            
            if (business.phone) {
              const phone = this.sanitizePhone(business.phone);
              if (phone) result.phone = phone;
            }
            
            if (business.emails && Array.isArray(business.emails)) {
              const validEmails = business.emails
                .map(email => this.sanitizeEmail(email))
                .filter(email => email);
              
              if (validEmails.length > 0) {
                result.emails = validEmails.join(', ');
              }
            }
            
            // Only return if has contact info
            return (result.phone || result.emails) ? result : null;
          })
          .filter(r => r !== null);
          
      case 'profiles':
        return results.map(business => ({
          businessName: business.name || '',
          address: business.location || '',
          website: business.website || '',
          phone: business.phone ? this.sanitizePhone(business.phone) : '',
          source: 'Google Maps'
        }));
        
      case 'complete':
      default:
        return results.map(business => {
          const result = {
            businessName: business.name || '',
            address: business.location || '',
            website: business.website || '',
            source: 'Google Maps'
          };
          
          if (business.phone) {
            const phone = this.sanitizePhone(business.phone);
            if (phone) result.phone = phone;
          }
          
          if (business.emails && Array.isArray(business.emails)) {
            const validEmails = business.emails
              .map(email => this.sanitizeEmail(email))
              .filter(email => email);
            
            if (validEmails.length > 0) {
              result.emails = validEmails.join(', ');
            }
          }
          
          return result;
        });
    }
  }

  /**
   * Get configuration for Google Maps scraper
   */
  getConfig() {
    return {
      source: 'google_maps',
      name: 'Google Maps',
      description: 'Business Directory & Local Listings',
      dataTypes: ['profiles', 'contacts', 'complete'],
      maxResults: 100,
      supportsBatch: false,
      requiresApiKey: false, // Maps scraper doesn't require API key
      specialFeatures: ['addresses', 'businessNames', 'websites', 'locations', 'aiAddressSelection']
    };
  }

  /**
   * Setup for Google Maps scraping
   */
  async setup(options = {}) {
    await super.setup(options);
    
    // Store API keys for use in child process
    this.apiKeys = options.apiKeys || {};
    this.options = options;
    
    console.log(chalk.gray('⚙️  Configuring Google Maps scraper...'));
    
    // Validate that Google Maps dependencies are available
    try {
      await import('../maps_scraper/config.js');
      await import('../maps_scraper/utils.js');
      console.log(chalk.gray('✅ Google Maps configuration loaded'));
    } catch (error) {
      throw new Error('Google Maps scraper not found. Make sure the maps_scraper project is available.');
    }
    
    // Google Maps specific setup
    console.log(chalk.gray('🗺️  Optimizing for local business discovery...'));
    console.log(chalk.gray('🤖 AI address selection enabled'));
    
    // Log API key status (without exposing the actual key)
    if ((this.apiKeys && this.apiKeys.geminiKeys && this.apiKeys.geminiKeys.length > 0) || process.env.GEMINI_API_KEY) {
      console.log(chalk.gray('🔑 Gemini API keys: Available'));
    } else {
      console.log(chalk.yellow('⚠️  Gemini API keys: Not found - sub-query generation may fail'));
    }
  }

  /**
   * Enhanced error handling for Google Maps
   */
  async handleError(error, context = 'Google Maps scraping') {
    // Handle specific Google Maps errors
    if (error.message.includes('gemini') || error.message.includes('Gemini')) {
      console.error(chalk.red('❌ Gemini AI API issue'));
      console.error(chalk.yellow('💡 Check your Gemini API key configuration for address selection'));
    } else if (error.message.includes('maps')) {
      console.error(chalk.red('❌ Google Maps access issue'));
      console.error(chalk.yellow('💡 Google Maps scraper uses direct HTTP requests - check network connectivity'));
    } else if (error.message.includes('location')) {
      console.error(chalk.red('❌ Location parsing issue'));
      console.error(chalk.yellow('💡 Use format: "business type location" (e.g., "dentist casablanca")'));
    } else if (error.message.includes('concurrency')) {
      console.error(chalk.red('❌ Concurrent processing issue'));
      console.error(chalk.yellow('💡 Too many simultaneous requests - the scraper will auto-adjust'));
    }
    
    await super.handleError(error, context);
  }

  /**
   * Enhanced progress logging for Google Maps
   */
  logProgress(message, stats = {}) {
    super.logProgress(message, stats);
    
    // Google Maps specific progress information
    if (stats.businessesFound) {
      console.log(chalk.blue(`   🏢 Businesses discovered: ${stats.businessesFound}`));
    }
    
    if (stats.websitesScraped) {
      console.log(chalk.blue(`   🌐 Websites scraped: ${stats.websitesScraped}`));
    }
    
    if (stats.addressesResolved) {
      console.log(chalk.blue(`   📍 Addresses resolved: ${stats.addressesResolved}`));
    }
    
    if (stats.emailsExtracted) {
      console.log(chalk.blue(`   📧 Emails extracted: ${stats.emailsExtracted}`));
    }
  }

  /**
   * Enhanced niche parsing for Google Maps
   */
  parseNiche(niche) {
    const words = niche.trim().toLowerCase().split(/\s+/);
    
    // More sophisticated parsing for Maps
    const moroccanCities = [
      'casablanca', 'rabat', 'fes', 'fès', 'marrakech', 'agadir', 'tangier', 'tanger',
      'oujda', 'kenitra', 'tetouan', 'tétouan', 'meknes', 'meknès', 'safi', 'mohammedia',
      'khouribga', 'el jadida', 'larache', 'taza', 'settat', 'berrechid', 'khemisset',
      'inezgane', 'nador', 'berkane', 'taourirt', 'ouarzazate', 'tiznit', 'errachidia'
    ];
    
    // Find the best location match
    let locationIndex = -1;
    let location = '';
    
    for (let i = words.length - 1; i >= 0; i--) {
      if (moroccanCities.includes(words[i])) {
        locationIndex = i;
        location = words[i];
        break;
      }
    }
    
    // If no specific city found, use last word as location
    if (locationIndex === -1) {
      locationIndex = words.length - 1;
      location = words[locationIndex];
    }
    
    // Business type is everything before the location
    const businessType = words.slice(0, locationIndex).join(' ');
    
    return {
      businessType: businessType.trim(),
      location: location.trim(),
      originalNiche: niche.trim()
    };
  }

  /**
   * Get Gemini API key with rotation
   */
  getGeminiApiKey() {
    if (!this.apiKeys || !this.apiKeys.geminiKeys || this.apiKeys.geminiKeys.length === 0) {
      return process.env.GEMINI_API_KEY;
    }
    
    // Rotate through available Gemini keys
    const keyIndex = this.geminiKeyIndex || 0;
    const apiKey = this.apiKeys.geminiKeys[keyIndex];
    
    // Move to next key for next request
    this.geminiKeyIndex = (keyIndex + 1) % this.apiKeys.geminiKeys.length;
    
    return apiKey;
  }

  /**
   * Get Gemini configuration with API key rotation
   */
  getGeminiConfig() {
    const apiKey = this.getGeminiApiKey();
    
    return {
      gemini: {
        apiKey: apiKey || process.env.GEMINI_API_KEY || this.options?.geminiKey
      }
    };
  }
}
