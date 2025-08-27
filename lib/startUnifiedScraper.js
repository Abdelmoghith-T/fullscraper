import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { SourceManager } from '../core/source-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Progress Simulator - Creates realistic loading bar experience
 */
class ProgressSimulator {
  constructor() {
    this.currentProgress = 0;
    this.isComplete = false;
    this.startTime = Date.now();
    this.intervalId = null;
    this.lastUpdateTime = 0;
    this.phase = 'querying';
  }

  /**
   * Start the progress simulation
   */
  start(onProgress) {
    this.onProgress = onProgress;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.lastUpdateTime = 0;
    
    // Start the progress simulation
    this.simulateProgress();
  }

  /**
   * Stop the progress simulation and jump to 100%
   */
  complete() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Jump to 100% immediately
    this.currentProgress = 100;
    this.isComplete = true;
    
    if (this.onProgress) {
      this.onProgress({
        processed: 100,
        total: 100,
        phase: this.phase,
        message: 'Progress: 100% — Scraping complete!'
      });
    }
  }

  /**
   * Simulate natural progress updates
   */
  simulateProgress() {
    const updateProgress = () => {
      if (this.isComplete) return;

      const now = Date.now();
      const elapsed = now - this.startTime;
      
      // Calculate natural progress based on elapsed time
      let newProgress = this.calculateNaturalProgress(elapsed);
      
      // Ensure progress doesn't go backwards and doesn't exceed 95% until completion
      if (newProgress > this.currentProgress && newProgress < 95) {
        this.currentProgress = newProgress;
        
        // Generate realistic progress message
        const message = this.generateProgressMessage(this.currentProgress);
        
        if (this.onProgress) {
          this.onProgress({
            processed: Math.floor(this.currentProgress),
            total: 100,
            phase: this.phase,
            message: message
          });
        }
      }
      
      this.lastUpdateTime = now;
    };

    // Update progress every 5-20 seconds with random intervals
    const scheduleNextUpdate = () => {
      if (this.isComplete) return;
      
      // Random interval between 5-20 seconds
      const minInterval = 5000;
      const maxInterval = 20000;
      const interval = Math.random() * (maxInterval - minInterval) + minInterval;
      
      this.intervalId = setTimeout(() => {
        updateProgress();
        scheduleNextUpdate();
      }, interval);
    };

    // Start the first update
    scheduleNextUpdate();
  }

  /**
   * Calculate natural progress that feels realistic
   */
  calculateNaturalProgress(elapsed) {
    const totalDuration = 1020000; // 17 minutes total estimated time (17 * 60 * 1000)
    
    if (elapsed >= totalDuration) {
      return 95; // Cap at 95% until completion
    }
    
    // Create a natural curve: fast start, slow middle, fast end
    const progressRatio = elapsed / totalDuration;
    
    // Sigmoid-like curve for natural feel
    let progress;
    if (progressRatio < 0.3) {
      // Fast start: 0-30% in first 30% of time
      progress = progressRatio * 2.5; // 0-75% of progress in first 30% of time
    } else if (progressRatio < 0.7) {
      // Slow middle: 30-70% in middle 40% of time
      const middleProgress = 0.75 + (progressRatio - 0.3) * 0.2; // 75-83% of progress
      progress = middleProgress;
    } else {
      // Fast end: 70-100% in last 30% of time
      const endProgress = 0.83 + (progressRatio - 0.7) * 0.4; // 83-95% of progress
      progress = endProgress;
    }
    
    // Add some randomness to make it feel more natural
    const randomness = (Math.random() - 0.5) * 0.1; // ±5% randomness
    progress = Math.max(0, Math.min(0.95, progress + randomness));
    
    return progress * 100;
  }

  /**
   * Generate realistic progress messages
   */
  generateProgressMessage(progress) {
    const messages = [
      `Progress: ${progress.toFixed(1)}% - Analyzing search results...`,
      `Progress: ${progress.toFixed(1)}% - Processing business data...`,
      `Progress: ${progress.toFixed(1)}% - Extracting contact information...`,
      `Progress: ${progress.toFixed(1)}% - Validating business profiles...`,
      `Progress: ${progress.toFixed(1)}% - Compiling results...`,
      `Progress: ${progress.toFixed(1)}% - Finalizing data...`
    ];
    
    // Rotate through messages based on progress
    const messageIndex = Math.floor((progress / 100) * messages.length);
    return messages[Math.min(messageIndex, messages.length - 1)];
  }
}

/**
 * Unified Scraper Entry Point
 * 
 * @param {Object} params - Scraping parameters
 * @param {string} params.niche - Target business niche
 * @param {string} params.source - Data source (google_search, linkedin, google_maps, all_sources)
 * @param {string} params.dataType - Type of data to extract
 * @param {string} params.format - Output format (xlsx, csv, json, txt)
 * @param {Object} params.apiKeys - API keys for different services
 * @param {string[]} params.apiKeys.googleSearchKeys - Google Custom Search API keys
 * @param {string[]} params.apiKeys.geminiKeys - Gemini AI API keys
 * @param {Object} params.options - Additional options
 * @param {number} params.options.maxResults - Maximum number of results
 * @param {AbortSignal} params.options.abortSignal - Abort signal for cancellation
 * @param {boolean} params.options.debug - Enable debug mode
 * @param {Function} params.options.onResult - Callback for individual results
 * @param {Function} params.options.onBatch - Callback for result batches
 * @param {Function} params.options.onProgress - Callback for progress updates
 * @returns {Promise<Object>} Scraping results with metadata
 */
async function startUnifiedScraper({
  niche,
  source,
  dataType = 'both',
  format,
  apiKeys,
  options = {}
}) {
  // Validate inputs
  if (!niche || typeof niche !== 'string') {
    throw new Error('Niche is required and must be a string');
  }

  const validSources = ['GOOGLE', 'LINKEDIN', 'MAPS', 'ALL'];
  if (!validSources.includes(source)) {
    throw new Error(`Source must be one of: ${validSources.join(', ')}`);
  }

  const validFormats = ['XLSX', 'CSV', 'JSON', 'TXT'];
  if (!validFormats.includes(format)) {
    throw new Error(`Format must be one of: ${validFormats.join(', ')}`);
  }

  if (!apiKeys || typeof apiKeys !== 'object') {
    throw new Error('API keys object is required');
  }

  // ✅ ENHANCED: Validate user API keys - NO FALLBACKS ALLOWED
  if (!apiKeys.googleSearchKeys || !Array.isArray(apiKeys.googleSearchKeys) || apiKeys.googleSearchKeys.length === 0) {
    throw new Error('User must provide valid Google Search API keys. No fallback keys allowed.');
  }

  if (!apiKeys.geminiKeys || !Array.isArray(apiKeys.geminiKeys) || apiKeys.geminiKeys.length === 0) {
    throw new Error('User must provide valid Gemini API keys. No fallback keys allowed.');
  }

  // Validate that API keys are not placeholder values
  const validGoogleKeys = apiKeys.googleSearchKeys.filter(key => key && key.trim() !== '' && !key.includes('YOUR_') && !key.includes('PLACEHOLDER'));
  const validGeminiKeys = apiKeys.geminiKeys.filter(key => key && key.trim() !== '' && !key.includes('YOUR_') && !key.includes('PLACEHOLDER'));

  if (validGoogleKeys.length === 0) {
    throw new Error('User must provide valid Google Search API keys. All provided keys are invalid or placeholder values.');
  }

  if (validGeminiKeys.length === 0) {
    throw new Error('User must provide valid Gemini API keys. All provided keys are invalid or placeholder values.');
  }

  console.log(`🔑 User API Keys Validated:`);
  console.log(`   📍 Google Search: ${validGoogleKeys.length} valid keys`);
  console.log(`   🤖 Gemini AI: ${validGeminiKeys.length} valid keys`);

  // Set default options
  const {
    onResult = () => {},
    onBatch = () => {},
    onProgress = () => {},
    maxResults = 300,
    abortSignal = null,
    debug = false
  } = options;

  // Validate max results
  if (maxResults < 1 || maxResults > 500) {
    throw new Error('Max results must be between 1 and 500');
  }

  // Progress tracking
  let processedCount = 0;
  let totalEstimate = 0;
  let currentPhase = 'init';
  
  // Store original environment for restoration
  const originalEnv = { ...process.env };
  
  // Initialize results array
  let allResults = [];
  
  // Initialize progress simulator
  const progressSimulator = new ProgressSimulator();
  
  const updateProgress = (phase, message = '', processed = processedCount, total = totalEstimate) => {
    currentPhase = phase;
    processedCount = processed;
    totalEstimate = total;
    onProgress({ processed, total, phase, message });
  };

  try {
    updateProgress('init', 'Initializing scraper...');

    // Check for abortion
    if (abortSignal?.aborted) {
      // Complete the progress simulation if aborted
      if (progressSimulator) {
        progressSimulator.complete();
      }
      throw new Error('Operation was aborted');
    }

    // Temporarily inject API keys into environment for existing scrapers
    
    // ✅ ENHANCED: Set Google Search API keys from user session ONLY (no fallbacks)
    if (validGoogleKeys && validGoogleKeys.length > 0) {
      // Clear any existing environment variables to prevent fallback to hard-coded keys
      delete process.env.GOOGLE_API_KEY_1;
      delete process.env.GOOGLE_API_KEY_2;
      delete process.env.GOOGLE_API_KEY_3;
      delete process.env.GOOGLE_API_KEY_4;
      delete process.env.GOOGLE_API_KEY_5;
      
      // Set user's validated keys
      validGoogleKeys.forEach((key, index) => {
        if (index < 5) { // Limit to 5 keys max
          process.env[`GOOGLE_API_KEY_${index + 1}`] = key;
        }
      });
      
      console.log(`🔑 Injected ${validGoogleKeys.length} Google Search API keys from user session`);
    }

    // ✅ ENHANCED: Set Gemini API key from user session ONLY (no fallbacks)
    if (validGeminiKeys && validGeminiKeys.length > 0) {
      // Clear any existing environment variable to prevent fallback to hard-coded keys
      delete process.env.GEMINI_API_KEY;
      
      // Set user's first validated Gemini key
      process.env.GEMINI_API_KEY = validGeminiKeys[0];
      
      console.log(`🤖 Injected Gemini API key from user session`);
      
      // Also update maps_scraper config file temporarily with user's key
      const configPath = path.join(__dirname, '../maps_scraper/config.js');
      try {
        const configContent = await fs.readFile(configPath, 'utf8');
        const updatedConfig = configContent.replace(
          /apiKey:\s*process\.env\.GEMINI_API_KEY\s*\|\|\s*\(\(\)\s*=>\s*\{[^}]*\}\)\(\)/,
          `apiKey: process.env.GEMINI_API_KEY`
        );
        await fs.writeFile(configPath, updatedConfig);
        console.log(`📝 Updated maps_scraper config with user's Gemini key`);
      } catch (error) {
        if (debug) console.log('Warning: Could not update maps config:', error.message);
      }
    }

    updateProgress('querying', 'Setting up data source...');

    // Convert source to the format expected by existing scrapers
    const sourceMapping = {
      'GOOGLE': 'google_search',
      'LINKEDIN': 'linkedin', 
      'MAPS': 'google_maps',
      'ALL': 'all_sources'
    };
    
    const scraperSource = sourceMapping[source];

    // Determine the appropriate format based on source (respect native formats)
    let scraperFormat;
    switch (source) {
      case 'GOOGLE':
        scraperFormat = 'txt'; // Google Search creates TXT files
        break;
      case 'LINKEDIN':
        scraperFormat = 'xlsx'; // LinkedIn creates XLSX files
        break;
      case 'MAPS':
        scraperFormat = format.toLowerCase(); // Maps can use JSON/CSV as requested
        break;
      case 'ALL':
        scraperFormat = format.toLowerCase(); // ALL sources use requested format
        break;
      default:
        scraperFormat = format.toLowerCase();
    }
    
    // Convert dataType to the format expected by ResultProcessor
    const dataTypeMapping = {
      'emails': 'emails',
      'phones': 'phones', 
      'contacts': 'contacts',
      'profiles': 'profiles',
      'complete': 'complete',
      'both': 'contacts'
    };
    
    const processorDataType = dataTypeMapping[dataType] || 'contacts';

    // Initialize source manager
    const sourceManager = new SourceManager();
    
    // Create results collector
    let batchBuffer = [];
    const batchSize = 15;

    // Start the progress simulator for the querying phase
    progressSimulator.start(onProgress);

    // Wrap the scraper execution to capture results
    const originalProcess = sourceManager.processAndSaveResults;
    sourceManager.processAndSaveResults = async function(results, source, dataType, niche, format) {
      // Don't save to file yet, just process and return
      updateProgress('scraping', `Processing ${results.length} results...`, processedCount, results.length);
      
      // Process each result through callbacks
      for (let i = 0; i < results.length; i++) {
        if (abortSignal?.aborted) {
          throw new Error('Operation was aborted');
        }

        const result = results[i];
        processedCount++;
        
        // Add to batch buffer
        batchBuffer.push(result);
        allResults.push(result);

        // Call onResult callback
        try {
          await onResult(result);
        } catch (error) {
          if (debug) console.log('onResult callback error:', error.message);
        }

        // Call onProgress callback
        try {
          await onProgress({ 
            processed: processedCount, 
            total: results.length, 
            phase: 'scraping', 
            message: `Processing result ${processedCount}/${results.length}` 
          });
        } catch (error) {
          if (debug) console.log('onProgress callback error:', error.message);
        }

        // Call onBatch when buffer is full
        if (batchBuffer.length >= batchSize) {
          try {
            await onBatch([...batchBuffer]);
          } catch (error) {
            if (debug) console.log('onBatch callback error:', error.message);
          }
          batchBuffer = [];
        }

        // Stop if we've reached max results
        if (processedCount >= maxResults) {
          updateProgress('scraping', `Reached max results limit (${maxResults})`);
          break;
        }
      }

      // Process remaining batch
      if (batchBuffer.length > 0) {
        try {
          await onBatch([...batchBuffer]);
        } catch (error) {
          if (debug) console.log('onBatch callback error:', error.message);
        }
      }

      // Trim results to max limit
      if (allResults.length > maxResults) {
        allResults = allResults.slice(0, maxResults);
      }

      return allResults;
    };

    updateProgress('scraping', 'Starting data extraction...');

    // Execute the scraper with callbacks to collect results
    console.log(`🔍 Debug: Starting sourceManager.run with callbacks`);
    console.log(`🔍 Debug: onResult callback exists: ${!!onResult}`);
    console.log(`🔍 Debug: onBatch callback exists: ${!!onBatch}`);
    console.log(`🔍 Debug: onProgress callback exists: ${!!onProgress}`);
    
    // Check for abortion before starting scraping
    if (abortSignal?.aborted) {
      if (progressSimulator) {
        progressSimulator.complete();
      }
      throw new Error('Operation was aborted');
    }
    
    const results = await sourceManager.run(niche, scraperSource, dataType, scraperFormat, {
      onResult,
      onBatch,
      onProgress,
      apiKeys // Pass the user's API keys to the source manager
    });
    
    // Complete the progress simulation
    progressSimulator.complete();
    
    // The results are collected via the callbacks and stored in allResults
    console.log(`🔍 Debug: sourceManager.run completed`);
    console.log(`🔍 Debug: allResults length: ${allResults.length}`);
    console.log(`🔍 Debug: sourceManager.run returned ${results.length} results`);
    
    // If sourceManager.run returned results, use them instead of the callback-collected ones
    if (results && results.length > 0) {
      allResults = results;
      console.log(`🔍 Debug: Using results from sourceManager.run: ${allResults.length}`);
    }

    updateProgress('exporting', 'Generating output file...');

    // Create output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const cleanNiche = niche.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
    
    let sourceLabel = source.toLowerCase();
    if (source === 'ALL') {
      sourceLabel = 'all_sources';
    } else if (source === 'GOOGLE') {
      sourceLabel = 'google_search';
    }
    
    const filename = `${cleanNiche}_${sourceLabel}_${timestamp}.${scraperFormat}`;
    const filePath = path.join(__dirname, '../results', filename);

    // Ensure results directory exists
    const resultsDir = path.dirname(filePath);
    await fs.mkdir(resultsDir, { recursive: true });

    let finalFilePath;
    
    // For LinkedIn we can reuse the file it generates; for Google we export fresh to ensure counts match
    if (source === 'LINKEDIN') {
      // LinkedIn creates files in the main results directory with specific naming pattern
      const resultsDir = path.join(__dirname, '../results');
      
      try {
        const files = await fs.readdir(resultsDir);
        const nicheNormalized = niche.replace(/\s+/g, '_').toLowerCase();
        
        // Look for LinkedIn-specific results files for this niche
        const resultFiles = files.filter(f => 
          f.includes(nicheNormalized) && 
          f.includes('_linkedin_results_') &&
          f.endsWith('.xlsx')
        );
        
        if (resultFiles.length > 0) {
          // Get the most recent file with async stat
          const fileStats = await Promise.all(
            resultFiles.map(async (f) => {
              const stat = await fs.stat(path.join(resultsDir, f));
              return { name: f, time: stat.mtime };
            })
          );
          
          const mostRecent = fileStats.sort((a, b) => b.time - a.time)[0];
          
          finalFilePath = path.join(resultsDir, mostRecent.name);
          console.log(`📁 Using existing LinkedIn Excel file: ${mostRecent.name}`);
        } else {
          throw new Error(`No LinkedIn results file found for ${niche}`);
        }
      } catch (error) {
        console.log(`⚠️ Could not find existing LinkedIn file, will export new one: ${error.message}`);
        // Fall back to exporting
        finalFilePath = await exportResults();
      }
    } else {
      // For Google, Maps and ALL sources, export using ResultProcessor to ensure file matches returned results
      finalFilePath = await exportResults();
    }
    
    // Helper function to export results
    async function exportResults() {
      const { ResultProcessor } = await import('../core/result-processor.js');
      const processor = new ResultProcessor();
      
      const exportedPath = await processor.exportResults(
        allResults || [],
        scraperSource,
        processorDataType,
        scraperFormat,
        niche
      );
      
      return path.join(__dirname, '../results', exportedPath);
    }

    updateProgress('done', `Completed successfully! Generated ${allResults.length} results.`);

    // Create metadata
    const meta = {
      niche,
      source,
      dataType,
      format: scraperFormat.toUpperCase(), // Use the actual format being sent
      totalResults: allResults.length,
      processedAt: new Date().toISOString(),
      maxResultsLimit: maxResults,
      phase: 'completed'
    };

    // Restore original environment
    Object.assign(process.env, originalEnv);
    
    return {
      results: allResults,
      meta,
      filePath: finalFilePath
    };

  } catch (error) {
    // Restore original environment on error
    // originalEnv is already declared above
    Object.assign(process.env, originalEnv);
    
    // Complete the progress simulation on error
    if (progressSimulator) {
      progressSimulator.complete();
    }
    
    updateProgress('error', `Error: ${error.message}`);
    
    // If we have partial results, still return them
    if (allResults.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const cleanNiche = niche.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
      const filename = `${cleanNiche}_partial_${timestamp}.json`;
      const filePath = path.join(__dirname, '../results', filename);
      
      try {
        await fs.writeFile(filePath, JSON.stringify({
          meta: {
            niche,
            source,
            dataType,
            format,
            totalResults: allResults.length,
            processedAt: new Date().toISOString(),
            isPartial: true,
            error: error.message
          },
          results: allResults
        }, null, 2));

        return {
          results: allResults,
          meta: {
            niche,
            source,
            dataType,
            format,
            totalResults: allResults.length,
            isPartial: true,
            error: error.message
          },
          filePath
        };
      } catch (saveError) {
        // If we can't save, just throw the original error
        throw error;
      }
    }
    
    throw error;
  } finally {
    // Ensure progress simulator is always cleaned up
    if (progressSimulator) {
      progressSimulator.complete();
    }
  }
}

export { startUnifiedScraper };
