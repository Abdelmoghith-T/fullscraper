import chalk from 'chalk';
import path from 'path';
import { ScraperInterface } from '../core/scraper-interface.js';

/**
 * LinkedIn Scraper Wrapper
 * Uses the enhanced scraper.js workflow with AI query generation and proper API key rotation
 */
export class LinkedInScraper extends ScraperInterface {
  constructor() {
    super('linkedin', 'LinkedIn');
    // Generate unique session ID for this scraping session
    this.sessionId = Date.now();
    this.sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Generate a unique 6-character code for this session
    this.sessionCode = this.generateSessionCode();
  }

  /**
   * Generate a unique 6-character session code
   */
  generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate niche for LinkedIn
   */
  validateNiche(niche) {
    if (!super.validateNiche(niche)) {
      return false;
    }
    
    // LinkedIn works best with professional niches
    const professionalKeywords = [
      'developer', 'engineer', 'manager', 'director', 'ceo', 'cto', 'cfo',
      'consultant', 'analyst', 'specialist', 'expert', 'professional',
      'designer', 'architect', 'lawyer', 'doctor', 'dentist', 'accountant',
      'marketer', 'sales', 'business', 'entrepreneur', 'founder', 'owner'
    ];
    
    const lowerNiche = niche.toLowerCase();
    const hasProfessionalContext = professionalKeywords.some(keyword => 
      lowerNiche.includes(keyword)
    );
    
    if (!hasProfessionalContext) {
      console.log(chalk.yellow(`⚠️  "${niche}" may not yield optimal LinkedIn results`));
      console.log(chalk.gray('   Consider adding professional terms like "manager", "consultant", "professional", etc.'));
    }
    
    return true;
  }

  /**
   * Main scraping method using enhanced scraper.js workflow
   */
  async scrape(niche, options = {}) {
    try {
      await this.setup(options);
      
      console.log(chalk.blue('💼 Starting LinkedIn scraping workflow...'));
      console.log(chalk.gray(`   Target: ${niche}`));
      console.log(chalk.gray(`   Data Type: ${options.dataType || 'complete'}`));
      
      console.log(chalk.blue('🔗 Searching LinkedIn profiles and company pages...'));
      
      // Use the same child process approach as Google Search wrapper
      // Pass API keys and session code to the scraper
      return await this.runOriginalLinkedInScraper({ 
        niche, 
        ...options,
        apiKeys: options.apiKeys,
        sessionCode: this.sessionCode
      });
      
    } catch (error) {
      await this.handleError(error, 'LinkedIn scraping');
    }
  }
  
  /**
   * Run the original LinkedIn scraper with enhanced output capturing
   */
  async runOriginalLinkedInScraper(options) {
    const { spawn } = await import('child_process');
    const fs = await import('fs');
    
    const niche = options.niche || 'business professionals';
    const apiKeys = options.apiKeys || {};
    
    // Debug: Log what API keys we received
    console.log(chalk.yellow(`🔍 DEBUG: Received apiKeys:`, JSON.stringify(apiKeys, null, 2)));
    
    console.log(chalk.blue('🚀 Starting original LinkedIn scraper...'));
    console.log(chalk.blue(`   🎯 Target Niche: "${niche}"`));
    console.log(chalk.gray('   🤖 AI Query Generation: ENABLED'));
    console.log(chalk.gray('   📊 Expected: 12+ LinkedIn-specific queries'));
    console.log(chalk.gray('   🔄 API Key Rotation: ENABLED (4 keys available)'));
    console.log(chalk.gray('   💾 Auto-save: ENABLED (every 120 seconds)'));
    console.log(chalk.blue('   🚀 Starting with full detailed logging...'));
    console.log('');
    
          return new Promise((resolve, reject) => {
        // Check for abortion at the start
        if (options.abortSignal?.aborted) {
          reject(new Error('Operation was aborted'));
          return;
        }
        
        // Set up abort signal listener
        const abortHandler = () => {
          if (!isResolved) {
            console.log(chalk.yellow('\n🛑 LinkedIn scraper aborted by user'));
            console.log(chalk.blue('💾 Sending interruption signal to child process...'));
            
            try {
              child.kill('SIGINT');
              console.log(chalk.gray('   📡 SIGINT signal sent to child process'));
            } catch (e) {
              console.log(chalk.red('❌ Failed to send SIGINT, trying SIGTERM...'));
              try {
                child.kill('SIGTERM');
                console.log(chalk.gray('   📡 SIGTERM signal sent to child process'));
              } catch (e2) {
                console.log(chalk.red('❌ Failed to send SIGTERM, forcing kill...'));
                child.kill('SIGKILL');
              }
            }
            
            reject(new Error('Operation was aborted'));
          }
        };
        
        // Add abort signal listener
        if (options.abortSignal) {
          options.abortSignal.addEventListener('abort', abortHandler);
        }
        
        // Run the standalone scraper with special environment for detailed logging
        // Inject user's API keys into child process environment
      const childEnv = { 
        ...process.env, 
        FORCE_COLOR: '1',  // Enable colors in child process
        UNIFIED_SCRAPER: '1',  // Tell scraper to use detailed console logging
        SESSION_ID: this.sessionId.toString(),  // Unique session ID
        SESSION_TIMESTAMP: this.sessionTimestamp  // Human-readable timestamp
      };
      
      // Inject Google Search API keys if available (LinkedIn scraper also uses them)
      if (apiKeys.googleSearchKeys && apiKeys.googleSearchKeys.length > 0) {
        apiKeys.googleSearchKeys.forEach((key, index) => {
          if (index < 5) { // Limit to 5 keys max
            childEnv[`GOOGLE_API_KEY_${index + 1}`] = key;
          }
        });
        console.log(`   🔑 Injected ${apiKeys.googleSearchKeys.length} Google Search API keys into child process`);
      } else {
        console.log(chalk.red(`   ❌ No Google Search API keys found in apiKeys:`, apiKeys));
      }
      
      // Inject Gemini API key if available
      if (apiKeys.geminiKeys && apiKeys.geminiKeys.length > 0) {
        childEnv.GEMINI_API_KEY = apiKeys.geminiKeys[0];
        console.log(`   🤖 Injected Gemini API key into child process`);
      } else {
        console.log(chalk.red(`   ❌ No Gemini API keys found in apiKeys:`, apiKeys));
      }
      
      // Inject session code for unique file naming
      if (options.sessionCode) {
        childEnv.LINKEDIN_SESSION_CODE = options.sessionCode;
        console.log(`   🔑 Injected LinkedIn session code: ${options.sessionCode}`);
      } else {
        console.log(chalk.red(`   ❌ No session code found in options:`, options));
      }
      
      // Debug: Log the final child environment
      console.log(chalk.yellow(`🔍 DEBUG: Child environment API keys:`));
      console.log(chalk.yellow(`   GEMINI_API_KEY: ${childEnv.GEMINI_API_KEY || 'NOT SET'}`));
      console.log(chalk.yellow(`   GOOGLE_API_KEY_1: ${childEnv.GOOGLE_API_KEY_1 || 'NOT SET'}`));
      console.log(chalk.yellow(`   GOOGLE_API_KEY_2: ${childEnv.GOOGLE_API_KEY_2 || 'NOT SET'}`));
      
      const child = spawn('node', ['scraper.js'], {
        cwd: './google search + linkdin scraper/lead-scraper',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv
      });
      
      // Feed the answers via stdin for LinkedIn scraping
      const answers = [
        niche,     // Business niche
        '2',       // LinkedIn (Professional Profiles)
      ];
      
      let currentAnswer = 0;
      setTimeout(() => {
        if (currentAnswer < answers.length) {
          child.stdin.write(answers[currentAnswer] + '\n');
          currentAnswer++;
        }
      }, 1000);
      
      setTimeout(() => {
        if (currentAnswer < answers.length) {
          child.stdin.write(answers[currentAnswer] + '\n');
          currentAnswer++;
        }
      }, 2000);
      
      let stdout = '';
      let stderr = '';
      let isResolved = false;
      
      // Set up interruption handling with graceful shutdown
      const handleInterruption = () => {
        if (!isResolved) {
          console.log(chalk.yellow('\n⚠️  LinkedIn scraper interrupted by user'));
          console.log(chalk.blue('💾 Sending interruption signal to child process and waiting for save...'));
          
          // Send SIGINT to child process to trigger its own interruption handler
          try {
            child.kill('SIGINT');
            console.log(chalk.gray('   📡 SIGINT signal sent to child process'));
          } catch (e) {
            console.log(chalk.red('❌ Failed to send SIGINT, trying SIGTERM...'));
            try {
              child.kill('SIGTERM');
              console.log(chalk.gray('   📡 SIGTERM signal sent to child process'));
            } catch (e2) {
              console.log(chalk.red('❌ Failed to send SIGTERM, force killing...'));
              child.kill('SIGKILL');
            }
          }
          
          // Give the child process time to save then always try to recover results
          setTimeout(() => {
            if (!isResolved) {
              console.log(chalk.blue('💾 Attempting to recover partial LinkedIn results...'));
              cleanup();
              
              // Always try to parse results - even if child didn't respond properly
              this.parseLinkedInResults(niche)
                .then(results => {
                  if (results && results.length > 0) {
                    console.log(chalk.green(`✅ Recovered ${results.length} LinkedIn profiles from auto-save`));
                    console.log(chalk.cyan(`📁 File location: google search + linkdin scraper/lead-scraper/`));
                    console.log(chalk.gray(`   📄 XLSX file: ${results[0].savedInFile}`));
                    console.log(chalk.blue(`💡 Auto-save file contains complete processed data - skipping additional processing`));
                    
                    // Mark results as pre-processed to skip unified processing
                    results.forEach(result => {
                      result._preProcessed = true;
                      result._autoSaveRecovery = true;
                    });
                  } else {
                    console.log(chalk.yellow('⚠️  No partial LinkedIn results found to recover'));
                    console.log(chalk.gray('   The scraper may have been interrupted too early'));
                  }
                  cleanup();
                  resolve(results || []);
                })
                .catch(() => {
                  console.log(chalk.yellow('⚠️  No auto-save file found - scraper was interrupted before first auto-save'));
                  cleanup();
                  resolve([]);
                });
            }
          }, 10000); // Increased to 10 seconds for child to save
        }
      };
      
      process.on('SIGINT', handleInterruption);
      process.on('SIGTERM', handleInterruption);
      
      const cleanup = () => {
        isResolved = true;
        process.removeListener('SIGINT', handleInterruption);
        process.removeListener('SIGTERM', handleInterruption);
        
        // Remove abort signal listener if it exists
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }
        
        // Kill child process if it's still running
        if (child && !child.killed) {
          try {
            child.kill('SIGTERM');
          } catch (e) {
            // Ignore errors if process already terminated
          }
        }
      };
      
      // Enhanced output forwarding with spinner recreation
      let currentSpinner = null;
      let querySpinner = null;
      let ora = null;
      
      // Import ora dynamically
      import('ora').then(module => {
        ora = module.default;
      });
      
      let trialInterrupted = false;
      // Trial watchdog: if autosave never appears, stop after ~150s to recover partials
      let trialWatchdog = null;
      if (options.trialMode) {
        trialWatchdog = setTimeout(() => {
          if (!isResolved) {
            console.log(chalk.yellow('⏰ Trial watchdog: stopping LinkedIn after 150s to capture autosave'));
            try { handleInterruption(); } catch (e) {}
          }
        }, 150000);
      }

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Process each line to detect spinner updates
        const lines = output.split('\n');
        lines.forEach((line, index) => {
          if (line.trim()) {
            // Check for LinkedIn query spinner start
            if (line.includes('🔍 LinkedIn Query ') && line.includes('"')) {
              if (querySpinner) {
                querySpinner.stop();
              }
              if (ora) {
                querySpinner = ora(line.trim()).start();
              } else {
                console.log(line);
              }
            }
            // Check for LinkedIn query completion
            else if (line.includes('✅ LinkedIn query "') && line.includes('" completed')) {
              if (currentSpinner) {
                currentSpinner.stop();
                currentSpinner = null;
              }
              if (querySpinner) {
                querySpinner.succeed(line.trim());
                querySpinner = null;
              } else {
                console.log(line);
              }
            }
            // Check for LinkedIn query warning
            else if (line.includes('⚠️') && line.includes('No LinkedIn profiles found')) {
              if (currentSpinner) {
                currentSpinner.stop();
                currentSpinner = null;
              }
              if (querySpinner) {
                querySpinner.warn(line.trim());
                querySpinner = null;
              } else {
                console.log(line);
              }
            }
            // Regular output (not spinner related)
            else {
              // Stop current spinners if we're showing regular output that's not status updates
              if (!line.includes('🔍 LinkedIn Query')) {
                if (currentSpinner && (line.includes('❌') || line.includes('⚠️') || line.includes('📊'))) {
                  currentSpinner.stop();
                  currentSpinner = null;
                }
              }
              
              // Monitor for auto-save messages to know when results are available
              if (line.includes('💾 Auto-saving') && line.includes('results')) {
                // Extract the actual count from auto-save message
                const countMatch = line.match(/Auto-saving (\d+) results/);
                if (countMatch) {
                  const actualCount = countMatch[1];
                  console.log(chalk.green(`📋 LinkedIn auto-save: ${actualCount} profiles being saved`));
                }
              } else if (line.includes('Auto-saved LinkedIn results to:')) {
                console.log(chalk.green('📋 LinkedIn results auto-saved successfully - interruption will recover data'));
                // Trial mode: stop shortly after confirmed autosave so XLSX finishes writing
                if (options.trialMode && !isResolved) {
                  setTimeout(() => {
                    try { handleInterruption(); } catch (e) {}
                  }, 4000);
                }
              } else if (line.includes('💾 Saving') && line.includes('LinkedIn profiles')) {
                // Extract count from partial save message  
                const countMatch = line.match(/Saving (\d+) LinkedIn profiles/);
                if (countMatch) {
                  const actualCount = countMatch[1];
                  console.log(chalk.blue(`💾 Child process saving ${actualCount} LinkedIn profiles...`));
                }
              } else if (line.includes('exportLinkedInResults') || line.includes('LinkedIn partial results saved')) {
                console.log(chalk.green('📋 Child process export operation detected'));
              } else if (line.includes('✅') && line.includes('saved to:')) {
                console.log(chalk.green('✅ Child process reports successful save'));
              }
              
              console.log(line);
            }
          }
        });
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Forward stderr immediately
        process.stderr.write(output);
      });
      
      child.on('close', (code) => {
        if (isResolved) return;
        
        // Clean up any active spinners
        if (currentSpinner) {
          currentSpinner.stop();
          currentSpinner = null;
        }
        if (querySpinner) {
          querySpinner.stop();
          querySpinner = null;
        }
        
        // Clear watchdog if set
        if (trialWatchdog) {
          clearTimeout(trialWatchdog);
          trialWatchdog = null;
        }
        cleanup();
        
        if (code === 0 || options.trialMode) {
          console.log(chalk.green('\n✅ LinkedIn scraper completed successfully!'));
          console.log(chalk.blue('📊 Processing results from XLSX file...'));
          
          this.parseLinkedInResults(niche)
            .then(results => {
              if (results && results.length > 0) {
                console.log(chalk.green(`✅ Successfully parsed ${results.length} LinkedIn profiles from results file`));
                console.log(chalk.cyan(`📁 Results saved in: google search + linkdin scraper/lead-scraper/`));
                console.log(chalk.gray(`   📄 LinkedIn file: ${niche.replace(/\s+/g, '_')}_linkedin_results.xlsx`));
              } else {
                console.log(chalk.yellow('⚠️  No LinkedIn profiles found in results file'));
              }
              cleanup();
              resolve(results);
            })
            .catch(error => {
              console.log(chalk.yellow(`⚠️  Could not parse LinkedIn results: ${error.message}`));
              cleanup();
              resolve([]);
            });
        } else if (code === null || code === 130) {
          console.log(chalk.yellow('\n⚠️  LinkedIn scraper was interrupted by user'));
          console.log(chalk.blue('💾 Attempting to recover partial results...'));
          
          this.parseLinkedInResults(niche)
            .then(results => {
              if (results && results.length > 0) {
                console.log(chalk.green(`✅ Recovered ${results.length} partial LinkedIn results before interruption`));
                console.log(chalk.cyan(`📁 Partial results saved in: google search + linkdin scraper/lead-scraper/`));
                console.log(chalk.gray(`   📄 LinkedIn file: ${niche.replace(/\s+/g, '_')}_linkedin_results.xlsx`));
                console.log(chalk.blue('💡 These results include AI validation and profile enrichment'));
                
                // Mark results as pre-processed to skip unified processing
                results.forEach(result => {
                  result._preProcessed = true;
                  result._autoSaveRecovery = true;
                });
              } else {
                console.log(chalk.yellow('⚠️  No partial LinkedIn results found to recover'));
                console.log(chalk.gray('   The scraper may have been interrupted too early'));
              }
              cleanup();
              resolve(results || []);
            })
            .catch(() => {
              console.log(chalk.yellow('⚠️  No LinkedIn results file found for recovery'));
              console.log(chalk.gray('   Auto-save may not have been triggered yet'));
              cleanup();
              resolve([]);
            });
        } else {
          console.log(chalk.red(`❌ LinkedIn scraper failed with exit code ${code}`));
          if (stderr) {
            console.log(chalk.red('Error details:', stderr));
          }
          cleanup();
          reject(new Error(`LinkedIn scraper exited with code ${code}. Error: ${stderr}`));
        }
      });
      
      child.on('error', (error) => {
        if (isResolved) return;
        cleanup();
        reject(error);
      });
    });
  }
  
  /**
   * Parse results from LinkedIn scraper output
   */
  async parseLinkedInResults(niche = '') {
    const fs = await import('fs');
    const path = await import('path');
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule && xlsxModule.readFile ? xlsxModule : (xlsxModule.default || xlsxModule);
    
    try {
      // Look for results files in the main results directory
      const resultsDir = path.join(process.cwd(), 'results');
      const files = fs.readdirSync(resultsDir);
      
      // Find the most recent LinkedIn results file for this specific niche
      const nicheNormalized = niche.replace(/\s+/g, '_').toLowerCase();
      const nicheVariations = [
        nicheNormalized,
        niche.replace(/\s+/g, '_'),
        niche.replace(/\s+/g, '_').toLowerCase(),
        niche.toLowerCase().replace(/\s+/g, '_')
      ];
      
             // Look for current session files using the unique session code
      const sessionCodePattern = `_SESSION_${this.sessionCode}`;
      const sessionFiles = files.filter(f => 
        f.includes('_linkedin_results_') && 
        f.includes(sessionCodePattern) &&
        f.endsWith('.xlsx')
      );
      
      // Also look for final results files with session code
      const finalResultsPattern = `_linkedin_results_SESSION_${this.sessionCode}`;
      const finalResultsFiles = files.filter(f => f.includes(finalResultsPattern));
      
      let resultFiles;
      if (sessionFiles.length > 0) {
        // Use current session autosave file (most accurate)
        resultFiles = sessionFiles;
        console.log(chalk.cyan('🎯 Found current session autosave file (most accurate)'));
      } else if (finalResultsFiles.length > 0) {
        // Use final results file if no autosave found
        resultFiles = finalResultsFiles;
        console.log(chalk.cyan('🎯 Found final results file'));
      } else {
        // Look for any LinkedIn results files for this niche
        const nicheLinkedInFiles = files.filter(f => 
          f.includes('_linkedin_results_') && 
          f.includes(nicheNormalized.replace(/_/g, '')) &&
          f.endsWith('.xlsx')
        );
        
        if (nicheLinkedInFiles.length > 0) {
          resultFiles = nicheLinkedInFiles;
          console.log(chalk.cyan('🎯 Found LinkedIn results files for this niche'));
        } else {
          console.log(chalk.yellow('⚠️  No LinkedIn results files found for this niche'));
          resultFiles = [];
        }
      }
      
      if (resultFiles.length === 0) {
        console.log(chalk.yellow('⚠️  No LinkedIn results file found'));
        return [];
      }
      
      // Get the most recent file
      const mostRecent = resultFiles
        .map(f => ({ 
          name: f, 
          time: fs.statSync(path.join(resultsDir, f)).mtime,
          size: fs.statSync(path.join(resultsDir, f)).size
        }))
        .sort((a, b) => b.time - a.time)[0];
      
      console.log(chalk.green(`✅ Found LinkedIn results file: ${mostRecent.name}`));
      console.log(chalk.blue(`📊 File size: ${mostRecent.size} bytes`));
      
      // Read the actual Excel file to get real data
      const excelFilePath = path.join(resultsDir, mostRecent.name);
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert Excel data to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Skip header row and process data
      const headers = rawData[0] || [];
      const dataRows = rawData.slice(1);
      
      console.log(chalk.green(`📊 Found ${dataRows.length} LinkedIn profiles in Excel file`));
      console.log(chalk.cyan(`📁 File location: ${resultsDir}/${mostRecent.name}`));
      console.log(chalk.blue(`💡 Successfully parsed Excel data with headers: ${headers.join(', ')}`));
      
      // Convert Excel rows to proper LinkedIn profile objects
      let linkedInProfiles = dataRows.map((row, index) => {
        const profile = {};
        
        // Map Excel columns to profile properties
        headers.forEach((header, colIndex) => {
          const value = row[colIndex] || '';
          switch (header.toLowerCase()) {
            case 'name':
              profile.name = value;
              break;
            case 'profileurl':
              profile.profileUrl = value;
              break;
            case 'bio':
              profile.bio = value;
              break;
            case 'source':
              profile.source = value || 'LinkedIn';
              break;
            case 'iscompanypage':
              profile.isCompanyPage = value === 'true' || value === true;
              break;
            case 'query':
              profile.query = value;
              break;
            case 'type':
              profile.type = value || 'Individual';
              break;
            default:
              profile[header] = value;
          }
        });
        
        // Ensure required fields exist
        if (!profile.name) profile.name = `LinkedIn Profile ${index + 1}`;
        if (!profile.source) profile.source = 'LinkedIn';
        if (!profile.profileUrl) profile.profileUrl = 'Profile URL not available';
        
        return profile;
      });
      
      console.log(chalk.green(`✅ Successfully parsed ${linkedInProfiles.length} LinkedIn profiles from Excel file`));
      
      // Trial-mode limits are applied upstream (source manager / unified orchestrator)

      return linkedInProfiles;
             
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not parse LinkedIn results:', error.message));
      return [];
    }
  }

  /**
   * Transform results based on data type
   */
  transformResults(results, dataType) {
    if (dataType === 'emails_only') {
      return results.filter(r => r.email).map(r => ({ email: r.email, source: 'LinkedIn' }));
    } else if (dataType === 'phones_only') {
      return results.filter(r => r.phone).map(r => ({ phone: r.phone, source: 'LinkedIn' }));
    } else {
      return results.map(r => ({ ...r, source: 'LinkedIn' }));
    }
  }

  /**
   * Get configuration for LinkedIn scraper
   */
  getConfig() {
    return {
      source: 'linkedin',
      name: 'LinkedIn',
      description: 'Professional Profiles & Company Pages',
      dataTypes: ['profiles', 'contacts', 'complete'],
      maxQueries: 12, // LinkedIn uses 12 queries instead of 25
      supportsBatch: true,
      requiresApiKey: true,
      specialFeatures: ['profileLinks', 'companyPages', 'professionalBios', 'aiQueryGeneration']
    };
  }

  /**
   * Setup for LinkedIn scraping
   */
  async setup(options = {}) {
    await super.setup(options);
    
    console.log(chalk.gray('⚙️  Configuring LinkedIn search parameters...'));
    
    // Validate that LinkedIn dependencies are available
    try {
      await import('../google search + linkdin scraper/lead-scraper/helpers/multiSourceSearch.js');
      console.log(chalk.gray('✅ LinkedIn search configuration loaded'));
    } catch (error) {
      throw new Error('LinkedIn scraper configuration not found. Make sure the google search + linkdin scraper project is available.');
    }
    
    // LinkedIn-specific setup
    console.log(chalk.gray('🔗 Optimizing for LinkedIn profile discovery...'));
  }

  /**
   * Enhanced error handling for LinkedIn
   */
  async handleError(error, context = 'LinkedIn scraping') {
    // Handle specific LinkedIn errors
    if (error.message.includes('quota')) {
      console.error(chalk.red('❌ Google API quota exceeded (LinkedIn uses Google Search)'));
      console.error(chalk.yellow('💡 Try adding more Google API keys or wait for quota reset'));
    } else if (error.message.includes('linkedin')) {
      console.error(chalk.red('❌ LinkedIn access issue'));
      console.error(chalk.yellow('💡 LinkedIn profiles are searched via Google - check API configuration'));
    } else if (error.message.includes('profiles')) {
      console.error(chalk.red('❌ Profile extraction issue'));
      console.error(chalk.yellow('💡 Try adjusting the search query to be more specific'));
    }
    
    await super.handleError(error, context);
  }

  /**
   * Enhanced progress logging for LinkedIn
   */
  logProgress(message, stats = {}) {
    super.logProgress(message, stats);
    
    // LinkedIn-specific progress information
    if (stats.profilesFound) {
      console.log(chalk.blue(`   👤 Profiles discovered: ${stats.profilesFound}`));
    }
    
    if (stats.companyPages) {
      console.log(chalk.blue(`   🏢 Company pages found: ${stats.companyPages}`));
    }
  }
}
