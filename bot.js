import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { startUnifiedScraper } from './lib/startUnifiedScraper.js';
import { createRequire } from 'module';
import chalk from 'chalk';
import { getMessage } from './languages.js';

const require = createRequire(import.meta.url);
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Progress Simulator - Creates realistic loading bar experience for WhatsApp
 */
class ProgressSimulator {
  constructor() {
    this.currentProgress = 0;
    this.isComplete = false;
    this.isStarted = false;
    this.startTime = Date.now();
    this.intervalId = null;
    this.lastUpdateTime = 0;
    this.phase = 'querying';
    this.onProgress = null;
    this.jid = null;
    this.sock = null;
  }

  /**
   * Start the progress simulation
   */
  start(onProgress, jid, sock) {
    this.onProgress = onProgress;
    this.jid = jid;
    this.sock = sock;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.isStarted = true;
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
        
        console.log(chalk.gray(`📊 Progress: ${this.currentProgress.toFixed(1)}% (elapsed: ${Math.floor(elapsed/1000)}s)`));
        
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
      
      console.log(chalk.gray(`⏱️ Next progress update in ${Math.round(interval/1000)}s`));
      
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
 * WhatsApp Bot for Unified Business Scraper v2.0
 */

// File paths
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const CODES_FILE = path.join(__dirname, 'codes.json');
const AUTH_DIR = path.join(__dirname, 'auth_info');
const PENDING_RESULTS_FILE = path.join(__dirname, 'pending_results.json');

// Active jobs tracking with offline resilience
const activeJobs = new Map(); // jid -> { abort: AbortController, status: string, startTime: Date, results: any, progressSimulator: ProgressSimulator }
const pendingResults = new Map(); // jid -> { filePath: string, meta: any, timestamp: Date }

// Connection management
let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Offline job completion tracking
const completedJobs = new Map(); // jid -> { filePath: string, meta: any, completedAt: Date }

// Helper functions
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

async function sendChunkedMessage(sock, jid, text, maxChars = 4000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  
  for (const chunk of chunks) {
    try {
      await sock.sendMessage(jid, { text: chunk });
      // Small delay between chunks to avoid rate limiting
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error sending chunk:', error.message);
      
      // Check if it's a connection error
      if (error.message.includes('Connection Closed') || error.message.includes('Connection closed')) {
        console.log(chalk.red('❌ Connection lost during message sending'));
        throw new Error('Connection lost');
      }
    }
  }
}

// Check if WhatsApp connection is stable
function isConnectionStable(sock) {
  try {
    const hasSock = !!sock;
    const hasUser = !!sock?.user;
    
    // Baileys might not have a connection property, so we check if we can access user
    const canAccessUser = hasSock && hasUser;
    
    console.log(chalk.blue(`🔍 Connection check: sock=${hasSock}, user=${hasUser}, canAccess=${canAccessUser}`));
    
    return canAccessUser;
  } catch (error) {
    console.log(chalk.red(`❌ Connection check error: ${error.message}`));
    return false;
  }
}

// Helper function to get progress emoji based on percentage
function getProgressEmoji(percentage) {
  if (percentage < 25) return '🚀';
  else if (percentage < 50) return '⚡';
  else if (percentage < 75) return '📊';
  else if (percentage < 90) return '🎯';
  else return '✨';
}

// Test connection by checking WebSocket state and user info
async function testConnection(sock) {
  try {
    if (!sock) return false;
    
    // Simple connection check - just verify socket exists and has basic properties
    if (!sock.user || !sock.connection) return false;
    
    // Check if connection is open
    if (sock.connection !== 'open') return false;
    
    return true;
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Connection test error: ${error.message}`));
    return false;
  }
}

// Check and send pending results when user comes back online
async function checkAndSendPendingResults() {
  if (!sock) return;
  
  for (const [jid, pendingResult] of pendingResults.entries()) {
    try {
      console.log(chalk.blue(`📱 Checking pending results for ${jid}...`));
      
      // Check if file still exists
      if (fs.existsSync(pendingResult.filePath)) {
        console.log(chalk.blue(`📄 Found pending results file: ${pendingResult.filePath}`));
        
        // Send the results
        await sendResultsToUser(sock, jid, pendingResult.filePath, pendingResult.meta);
        
        // Remove from pending
        pendingResults.delete(jid);
        savePendingResults(); // Save updated pending results
        console.log(chalk.green(`✅ Pending results sent successfully to ${jid}`));
      } else {
        console.log(chalk.yellow(`⚠️ Pending results file not found: ${pendingResult.filePath}`));
        pendingResults.delete(jid);
        savePendingResults(); // Save updated pending results
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to send pending results to ${jid}: ${error.message}`));
    }
  }
}

// Save pending results to disk
function savePendingResults() {
  try {
    const data = {};
    for (const [jid, result] of pendingResults.entries()) {
      data[jid] = result;
    }
    fs.writeFileSync(PENDING_RESULTS_FILE, JSON.stringify(data, null, 2));
    console.log(chalk.blue(`💾 Pending results saved to disk`));
  } catch (error) {
    console.error('❌ Failed to save pending results:', error.message);
  }
}

// Load pending results from disk
function loadPendingResults() {
  try {
    if (fs.existsSync(PENDING_RESULTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PENDING_RESULTS_FILE, 'utf8'));
      for (const [jid, result] of Object.entries(data)) {
        pendingResults.set(jid, result);
      }
      console.log(chalk.blue(`📱 Loaded ${pendingResults.size} pending results from disk`));
    }
  } catch (error) {
    console.error('❌ Failed to load pending results:', error.message);
  }
}

async function sendFile(sock, jid, filePath, caption = '') {
  try {
    console.log(chalk.blue(`🔍 sendFile: Starting file send process...`));
    console.log(chalk.blue(`🔍 sendFile: File path: ${filePath}`));
    console.log(chalk.blue(`🔍 sendFile: JID: ${jid}`));
    console.log(chalk.blue(`🔍 sendFile: Caption: ${caption}`));
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    const fileExt = path.extname(fileName).toLowerCase();
    
    console.log(chalk.blue(`🔍 sendFile: File name: ${fileName}`));
    console.log(chalk.blue(`🔍 sendFile: File size: ${fileData.length} bytes`));
    console.log(chalk.blue(`🔍 sendFile: File extension: ${fileExt}`));
    
    // Check file size limit (WhatsApp has limits)
    const maxSize = 16 * 1024 * 1024; // 16MB limit
    if (fileData.length > maxSize) {
      console.log(chalk.red(`❌ File too large for WhatsApp: ${(fileData.length / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`));
      await sock.sendMessage(jid, { 
        text: `⚠️ **File too large!** The results file (${(fileData.length / 1024 / 1024).toFixed(2)}MB) exceeds WhatsApp's 16MB limit. Please contact support to retrieve your results.`
      });
      return false; // Indicate failure to send
    }
    
    let mimetype;
    switch (fileExt) {
      case '.xlsx':
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.csv':
        mimetype = 'text/csv';
        break;
      case '.json':
        mimetype = 'application/json';
        break;
      case '.txt':
        mimetype = 'text/plain';
        break;
      default:
        mimetype = 'application/octet-stream';
    }
    
    console.log(chalk.blue(`🔍 sendFile: MIME type: ${mimetype}`));

    console.log(chalk.blue(`🔍 sendFile: Attempting to send message with document...`));
    
    // Simple connection check
    if (!isConnectionStable(sock)) {
      throw new Error('Connection not stable');
    }
    
    const messageResult = await sock.sendMessage(jid, {
      document: fileData,
      fileName: fileName,
      mimetype: mimetype,
      caption: caption
    });
    
    console.log(chalk.blue(`🔍 sendFile: Message result: ${JSON.stringify(messageResult)}`));
    console.log(chalk.green(`📎 File sent successfully: ${fileName}`));
    
    // Verify the message was sent
    if (messageResult && messageResult.key) {
      console.log(chalk.green(`✅ Message confirmed sent with key: ${messageResult.key.id}`));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error sending file:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Don't try to send error message if connection is lost
    if (isConnectionStable(sock)) {
      try {
        await sock.sendMessage(jid, { 
          text: `❌ Could not send file: ${error.message}` 
        });
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError.message);
      }
    }
    return false;
  }
}

// Dedicated function to send results to user with proper format handling
async function sendResultsToUser(sock, jid, filePath, meta) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Results file not found: ${filePath}`);
    }
    
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Create appropriate caption based on source and format
    let caption = `📄 **Results File: ${fileName}**\n\n`;
    caption += `📊 **Summary:** ${meta.totalResults || 'Unknown'} results\n`;
    caption += `🎯 **Source:** ${meta.source || 'Unknown'}\n`;
    caption += `📋 **Format:** ${meta.format || fileExtension.toUpperCase()}\n`;
    
    // Add source-specific information
    if (meta.source === 'GOOGLE') {
      caption += `🔍 **Type:** Google Search Results\n`;
    } else if (meta.source === 'LINKEDIN') {
      caption += `💼 **Type:** LinkedIn Profiles\n`;
    } else if (meta.source === 'MAPS') {
      caption += `🗺️ **Type:** Google Maps Businesses\n`;
    }
    
    console.log(chalk.blue(`📤 Sending results to ${jid}: ${fileName}`));
    
    // Try to send file with retry mechanism
    let fileSent = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!fileSent && retryCount < maxRetries) {
      try {
        retryCount++;
        console.log(chalk.blue(`🔄 Attempt ${retryCount}/${maxRetries} to send results file...`));
        
        // Simple connection check
        if (!isConnectionStable(sock)) {
          throw new Error('Connection not stable');
        }
        
        // Small delay between attempts
        if (retryCount > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Try to send file as document attachment
        fileSent = await sendFile(sock, jid, filePath, caption);
        
        if (fileSent) {
          console.log(chalk.green(`📄 Results file sent successfully as attachment: ${fileName}`));
          break;
        }
      } catch (fileError) {
        console.log(chalk.yellow(`⚠️ Attempt ${retryCount} failed: ${fileError.message}`));
        
        if (retryCount < maxRetries) {
          console.log(chalk.blue(`⏳ Waiting 2 seconds before retry...`));
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // If all retries failed, use fallback
    if (!fileSent) {
      console.log(chalk.red(`❌ All ${maxRetries} attempts failed or file was too large. No fallback attempted.`));
      // No text fallback for oversized files or general send failures, as sendFile already handles user notification
    }
    
    return fileSent;
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to send results to user: ${error.message}`));
    throw error;
  }
}

function formatResultSummary(results, meta) {
  let summary = `✅ **Scraping Complete!**\n\n`;
  summary += `📊 **Results Summary:**\n`;
  summary += `• Total Results: ${meta.totalResults}\n`;
  summary += `• Source: ${meta.source}\n`;
  summary += `• Format: ${meta.format}\n`;
  summary += `• Niche: "${meta.niche}"\n`;
  summary += `• Processed: ${new Date(meta.processedAt).toLocaleString()}\n\n`;

  if (results && results.length > 0) {
    // Count different types of data
    let emails = 0, phones = 0, websites = 0;
    
    results.forEach(result => {
      if (result.emails && Array.isArray(result.emails)) {
        emails += result.emails.length;
      } else if (result.email && result.email !== 'Not found') {
        emails++;
      }
      
      if (result.phones && Array.isArray(result.phones)) {
        phones += result.phones.length;
      } else if (result.phone && result.phone !== 'Not found') {
        phones++;
      }
      
      if (result.website && result.website !== 'Not found') {
        websites++;
      }
    });

    summary += `📈 **Data Breakdown:**\n`;
    summary += `• 📧 Emails: ${emails}\n`;
    summary += `• 📞 Phones: ${phones}\n`;
    summary += `• 🌐 Websites: ${websites}\n\n`;
  }

  summary += `💾 **File Information:**\n`;
  summary += `• Format: ${meta.format}\n`;
  summary += `• Ready for download below ⬇️\n\n`;
  
  if (meta.isPartial) {
    summary += `⚠️ **Note:** This is a partial result due to interruption or error.\n`;
  }

  return summary;
}

function getHelpMessage() {
   return `🤖 **WhatsApp Business Scraper Bot**\n\n` +
          `📋 **Available Commands:**\n\n` +
          `🔐 **CODE: <your_code>**\n` +
          `   Authenticate with your access code\n\n` +
          `🎯 **Search Query**\n` +
          `   Send any text as a search niche\n` +
          `   Example: "dentist casablanca"\n\n` +
          `📏 **LIMIT: <number>**\n` +
          `   Set max results (1-500). Default: 300\n\n` +
          `📊 **STATUS**\n` +
          `   Check current job status\n\n` +
          `🛑 **STOP**\n` +
          `   Cancel current scraping job\n\n` +
          `♻️ **RESET**\n` +
          `   Reset all preferences\n\n` +
          `🔄 **RESTART** (00)\n` +
          `   Restart the entire process from niche selection\n\n` +
          `❓ **HELP**\n` +
          `   Show this help message\n\n` +
          `💡 **Getting Started:**\n` +
          `1. Get your access code from admin\n` +
          `2. Send: CODE: your_code_here\n` +
          `3. Send your search query (e.g., "restaurant casablanca")\n` +
          `4. Follow the numbered prompts to configure source, type, and format.\n` +
          `5. Send: START to begin scraping\n` +
          `6. Receive real-time progress updates!\n\n` +
          `**Navigation Tip:** At any numbered selection step, reply with \`0\` to go back to the previous step.`;
 }



async function handleMessage(sock, message) {
  const jid = message.key.remoteJid;
  const text = (message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '').trim();
  
  if (!text || message.key.fromMe) return;

  // Simple colored message log
  const shortText = text.length > 30 ? text.substring(0, 30) + '...' : text;
  console.log(chalk.blue(`📱 ${jid.split('@')[0]}: ${shortText}`));

  // Load session data
  let sessions = loadJson(SESSIONS_FILE, {});
  const codesDb = loadJson(CODES_FILE, {});

  // Initialize session if not exists
  if (!sessions[jid]) {
    sessions[jid] = {
      prefs: {
        source: 'ALL',
        format: 'XLSX',
        limit: 300
      },
      status: 'idle',
      currentStep: 'awaiting_language', // New: Start with language selection
      previousMessage: null, // New: Stores the previous message content for "go back" functionality
      language: 'en', // Default language
      meta: {
        createdAt: new Date().toISOString(),
        totalJobs: 0,
        lastNiche: null
      }
    };
    saveJson(SESSIONS_FILE, sessions);
    
    // Send welcome message for new users
    await sock.sendMessage(jid, { 
      text: getMessage('en', 'welcome') // Default to English for welcome
    });
  }

  const session = sessions[jid];

  try {
    // Handle language selection first for new users
    if (session.currentStep === 'awaiting_language') {
      const langNumber = parseInt(text);
      const langMap = { 1: 'en', 2: 'fr', 3: 'ar' };
      
      if (langNumber >= 1 && langNumber <= 3) {
        session.language = langMap[langNumber];
        session.currentStep = 'awaiting_auth';
        saveJson(SESSIONS_FILE, sessions);
        
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'auth_required')
        });
        return;
      } else {
        // Resend welcome message for any invalid input until language is selected
        await sock.sendMessage(jid, { 
          text: getMessage('en', 'welcome') // Always use English for welcome message
        });
        return;
      }
    }

    // Command: CODE
    if (/^CODE:?\s+/i.test(text)) {
      const code = text.replace(/^CODE:?\s+/i, '').trim();
      
      if (!codesDb[code]) {
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'invalid_code')
        });
        return;
      }

      // Update usage statistics
      codesDb[code].meta.lastUsed = new Date().toISOString();
      codesDb[code].meta.useCount = (codesDb[code].meta.useCount || 0) + 1;
      saveJson(CODES_FILE, codesDb);

      // Assign API keys to session
      session.code = code;
      session.apiKeys = codesDb[code].apiKeys;
      sessions[jid] = session;
      saveJson(SESSIONS_FILE, sessions);

      await sock.sendMessage(jid, { 
        text: getMessage(session.language, 'access_granted', {
          source: session.prefs.source,
          format: session.prefs.format,
          limit: session.prefs.limit
        })
      });
      
      session.currentStep = 'awaiting_niche';
      session.previousMessage = null;
      saveJson(SESSIONS_FILE, sessions);
      return;
    }

    // Handle incoming messages based on conversation step
    const inputNumber = parseInt(text);

    // Check for authentication first, regardless of step
    if (!session.apiKeys && !/^CODE:?\s+/i.test(text)) {
      // Check if user wants to change language (option 0)
      if (text === '0') {
        session.currentStep = 'awaiting_language';
        session.language = 'en'; // Reset to default
        saveJson(SESSIONS_FILE, sessions);
        
        await sock.sendMessage(jid, { 
          text: getMessage('en', 'welcome') // Always use English for welcome
        });
        return;
      }
      
      await sock.sendMessage(jid, { 
        text: getMessage(session.language, 'auth_required')
      });
      return;
    }

    // Handle messages based on current conversation step
    if (session.currentStep === 'awaiting_niche') {
        if (isNaN(inputNumber)) { // Treat non-numeric input as niche
            session.pendingNiche = text;
            session.currentStep = 'awaiting_source';
            session.previousMessage = getMessage(session.language, 'select_source', {
              niche: session.pendingNiche
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'invalid_niche')
            });
            return;
        }
    } else if (session.currentStep === 'awaiting_source') {
        const sourceOptions = ['GOOGLE', 'LINKEDIN', 'MAPS', 'ALL'];
        if (text === '00') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid);
            }
            session.currentStep = 'awaiting_niche';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            return;
        } else if (inputNumber === 0) {
            session.currentStep = 'awaiting_niche';
            session.pendingNiche = null;
            session.previousMessage = null;
            await sock.sendMessage(jid, { text: getMessage(session.language, 'go_back') });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else if (inputNumber >= 1 && inputNumber <= sourceOptions.length) {
            session.prefs.source = sourceOptions[inputNumber - 1];
            session.currentStep = 'awaiting_type';
            let dataTypeChoices;
            switch (session.prefs.source) {
                case 'GOOGLE':
                    dataTypeChoices = getMessage(session.language, 'select_type_google');
                    break;
                case 'LINKEDIN':
                    dataTypeChoices = getMessage(session.language, 'select_type_linkedin');
                    break;
                case 'MAPS':
                    dataTypeChoices = getMessage(session.language, 'select_type_maps');
                    break;
                case 'ALL':
                    dataTypeChoices = getMessage(session.language, 'select_type_all');
                    break;
            }
            session.previousMessage = dataTypeChoices;
            await sock.sendMessage(jid, { text: dataTypeChoices });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'invalid_selection', { max: sourceOptions.length })
            });
            await sock.sendMessage(jid, { text: session.previousMessage }); // Resend previous message
            return;
        }
    } else if (session.currentStep === 'awaiting_type') {
        let validTypes = [];
        switch (session.prefs.source) {
            case 'GOOGLE':
                validTypes = ['EMAILS', 'PHONES', 'CONTACTS'];
                break;
            case 'LINKEDIN':
                validTypes = ['PROFILES', 'CONTACTS', 'COMPLETE'];
                break;
            case 'MAPS':
                validTypes = ['PROFILES', 'CONTACTS', 'COMPLETE'];
                break;
            case 'ALL':
                validTypes = ['CONTACTS', 'COMPLETE'];
                break;
        }

        if (text === '00') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid);
            }
            session.currentStep = 'awaiting_niche';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            return;
        } else if (inputNumber === 0) {
            session.currentStep = 'awaiting_source';
            session.previousMessage = getMessage(session.language, 'select_source', {
              niche: session.pendingNiche
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else if (inputNumber >= 1 && inputNumber <= validTypes.length) {
            session.prefs.dataType = validTypes[inputNumber - 1];
            session.currentStep = 'awaiting_format';
            let formatChoices;
            switch (session.prefs.source) {
                case 'GOOGLE':
                    formatChoices = getMessage(session.language, 'select_format_google');
                    break;
                case 'LINKEDIN':
                    formatChoices = getMessage(session.language, 'select_format_linkedin');
                    break;
                case 'MAPS':
                    formatChoices = getMessage(session.language, 'select_format_maps');
                    break;
                case 'ALL':
                    formatChoices = getMessage(session.language, 'select_format_all');
                    break;
            }
            session.previousMessage = formatChoices;
            await sock.sendMessage(jid, { text: formatChoices });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'invalid_selection', { max: validTypes.length })
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            return;
        }
    } else if (session.currentStep === 'awaiting_format') {
        let validFormats = [];
        switch (session.prefs.source) {
            case 'GOOGLE':
                validFormats = ['TXT'];
                break;
            case 'LINKEDIN':
                validFormats = ['XLSX'];
                break;
            case 'MAPS':
                validFormats = ['JSON', 'XLSX']; // Changed from CSV to XLSX
                break;
            case 'ALL':
                validFormats = ['XLSX', 'CSV', 'JSON'];
                break;
        }

        if (text === '00') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid);
            }
            session.currentStep = 'awaiting_niche';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            return;
        } else if (inputNumber === 0) {
            session.currentStep = 'awaiting_type';
            let dataTypeChoices;
            switch (session.prefs.source) {
                case 'GOOGLE':
                    dataTypeChoices = getMessage(session.language, 'select_type_google');
                    break;
                case 'LINKEDIN':
                    dataTypeChoices = getMessage(session.language, 'select_type_linkedin');
                    break;
                case 'MAPS':
                    dataTypeChoices = getMessage(session.language, 'select_type_maps');
                    break;
                case 'ALL':
                    dataTypeChoices = getMessage(session.language, 'select_type_all');
                    break;
            }
            session.previousMessage = dataTypeChoices;
            await sock.sendMessage(jid, { text: dataTypeChoices });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else if (inputNumber >= 1 && inputNumber <= validFormats.length) {
            session.prefs.format = validFormats[inputNumber - 1];
            session.currentStep = 'ready_to_start';
            session.previousMessage = getMessage(session.language, 'format_set', {
              format: session.prefs.format
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'invalid_selection', { max: validFormats.length })
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            return;
        }
    } else if (session.currentStep === 'ready_to_start') {
        if (text === '00') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                // Complete the progress simulator if it exists
                if (activeJob.progressSimulator) {
                    activeJob.progressSimulator.complete();
                }
                activeJobs.delete(jid); // Ensure job is cleared
            }
            session.currentStep = 'awaiting_niche';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            return;
        } else if (text.toUpperCase() === 'START') {
            if (!session.pendingNiche || !session.prefs.source || !session.prefs.dataType || !session.prefs.format) {
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'error_generic')
                });
                return;
            }

            // Now start the actual scraping job
            const niche = session.pendingNiche;
            const { source, dataType, format, limit } = session.prefs;
            
            // Clear pending niche
            delete session.pendingNiche;
            session.currentStep = 'scraping_in_progress';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            // Start the scraping job
            console.log(chalk.cyan(`🔍 Job started: "${niche}" (${source}/${dataType}/${format}/${limit})`));

            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'job_starting', {
                  niche: niche,
                  source: source,
                  format: format,
                  limit: limit
                })
            });
            
            console.log(chalk.cyan(`🚀 Progress tracking initialized for ${jid}: 0%`));
            
            // Continue with the existing scraping logic...
            // Create abort controller
            const abortController = new AbortController();

            session.status = 'running';
            session.meta.lastNiche = niche;
            
            // Initialize progress simulator for this job
            const progressSimulator = new ProgressSimulator();
            activeJobs.set(jid, {
                abort: abortController,
                status: 'initializing',
                startTime: new Date(),
                results: null,
                progressSimulator: progressSimulator
            });

            session.status = 'running';
            session.meta.lastNiche = niche;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);

            let resultCount = 0;
            
            try {
                const result = await startUnifiedScraper({
                    niche,
                    source: source, // Use original uppercase values
                    dataType: dataType.toLowerCase(), // Convert to lowercase for internal use
                    format,
                    apiKeys: session.apiKeys,
                    options: {
                        maxResults: limit,
                        abortSignal: abortController.signal,
                        debug: false,
                        
                        onResult: async (item) => {
                            resultCount++;
                            // Update job status but don't send messages during querying phase
                            const jobStatus = activeJobs.get(jid);
                            if (jobStatus) {
                                jobStatus.status = `Processing: ${resultCount} results found`;
                                // Don't send any messages here - only the simulated progress bar should show
                            }
                        },

                        onBatch: async (batch) => {
                            // Update job status but don't send messages during querying phase
                            const jobStatus = activeJobs.get(jid);
                            if (jobStatus) {
                                // Don't send any messages here - only the simulated progress bar should show
                            }
                        },

                        onProgress: async ({ processed, total, phase, message }) => {
                            const jobStatus = activeJobs.get(jid);
                            if (jobStatus && jobStatus.progressSimulator) {
                                // Store progress in job status
                                jobStatus.lastProgress = { processed, total, phase, timestamp: new Date() };

                                // Handle different phases
                                if (phase === 'querying') {
                                    // Start the progress simulator only once
                                    if (!jobStatus.progressSimulator.isComplete && !jobStatus.progressSimulator.isStarted) {
                                        console.log(chalk.cyan(`🚀 Starting progress simulator for ${jid}`));
                                        jobStatus.progressSimulator.isStarted = true;
                                        jobStatus.progressSimulator.start(async (progressData) => {
                                            try {
                                                // Send progress update to user
                                                const progressEmoji = getProgressEmoji(progressData.processed);
                                                const progressMessage = `${progressEmoji} **${progressData.message}**`;
                                                
                                                await sock.sendMessage(jid, { text: progressMessage });
                                                console.log(chalk.blue(`📱 Progress update sent to ${jid}: ${progressData.processed}%`));
                                            } catch (error) {
                                                console.error('Failed to send progress update:', error.message);
                                            }
                                        }, jid, sock);
                                    } else if (jobStatus.progressSimulator.isStarted) {
                                        console.log(chalk.gray(`⏳ Progress simulator already running for ${jid}`));
                                    }
                                } else if (phase === 'scraping') {
                                    // Don't show scraping phase messages - only progress bar should be visible
                                } else if (phase === 'exporting') {
                                    try {
                                        await sock.sendMessage(jid, { text: '💾 **Exporting results...**' });
                                    } catch (error) {
                                        console.error('Failed to send export message:', error.message);
                                    }
                                } else if (phase === 'done') {
                                    // Complete the progress simulator
                                    jobStatus.progressSimulator.complete();
                                    
                                    try {
                                        await sock.sendMessage(jid, { text: getMessage(session.language, 'progress_complete') });
                                    } catch (error) {
                                        console.error('Failed to send completion message:', error.message);
                                    }
                                }
                            }
                        }
                    }
                });

                // Introduce a small delay to allow the 100% progress message to be sent first
                await new Promise(resolve => setTimeout(resolve, 500));

                // Job completed successfully - perform cleanup and reset session state
                activeJobs.delete(jid);
                session.status = 'idle';
                session.currentStep = 'awaiting_niche'; // Reset step after job completion
                session.meta.totalJobs++;


                
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);



                console.log(chalk.blue(`[DEBUG] Scraper result: ${JSON.stringify(result)}`)); // Added debug log
                console.log(chalk.blue(`[DEBUG] Result filePath exists: ${!!result.filePath}`)); // Added debug log

                // Send results summary
                const summary = formatResultSummary(result.results, result.meta);
                await sendChunkedMessage(sock, jid, summary);

                // Send the file using the dedicated function
                if (result.filePath) {
                    try {
                        // Convert to absolute path if it's relative
                        const absoluteFilePath = path.isAbsolute(result.filePath) 
                            ? result.filePath 
                            : path.resolve(result.filePath);
                        
                        console.log(chalk.blue(`📎 Sending results file: ${absoluteFilePath}`));
                        
                        // Use the dedicated function for reliable file sending
                        const fileSent = await sendResultsToUser(sock, jid, absoluteFilePath, result.meta);
                        
                        if (fileSent) {
                            console.log(chalk.green(`✅ Results file sent successfully to ${jid}`));
                            // Send follow-up message to start a new search
                            await sock.sendMessage(jid, { 
                                text: getMessage(session.language, 'job_complete', {
                                  total: result.meta.totalResults || 0,
                                  emails: result.meta.emails || 0,
                                  phones: result.meta.phones || 0,
                                  websites: result.meta.websites || 0
                                })
                            });
                        } else {
                            console.log(chalk.red(`❌ Results file not sent to ${jid} (sendFile returned false).`));
                        }
                        
                        // File sent successfully - no need to store as pending
                        
                    } catch (error) {
                        console.log(chalk.red(`❌ Failed to send results file: ${error.message}`));
                        
                        // Only store as pending if immediate sending failed and not due to size (sendFile handles size message)
                        if (result && result.filePath && result.meta && !error.message.includes('File too large')) {
                            const absoluteFilePath = path.isAbsolute(result.filePath) 
                                ? result.filePath 
                                : path.resolve(result.filePath);
                            
                            // Store in pending results for offline delivery
                            pendingResults.set(jid, {
                                filePath: absoluteFilePath,
                                meta: result.meta,
                                timestamp: new Date()
                            });
                            
                            // Save pending results to disk
                            savePendingResults();
                            
                            console.log(chalk.blue(`📱 Results stored for offline delivery: ${absoluteFilePath}`));
                        }
                        
                        await sock.sendMessage(jid, { 
                            text: `⚠️ **File sending failed.** Results are saved and will be sent when you're back online.`
                        });
                    }
                } else {
                    console.log(chalk.red(`❌ No file path provided in result`));
                }

                console.log(chalk.green(`✅ Job completed: ${result.meta.totalResults} results`));

            } catch (error) {
                console.error(chalk.red(`❌ Job failed: ${error.message}`));
                console.error(chalk.red(`❌ Job failed stack: ${error.stack}`)); // Added error stack log
                
                // Clean up
                activeJobs.delete(jid);
                session.status = 'idle';
                session.currentStep = 'awaiting_niche'; // Reset step on error
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);

                if (error.message.includes('aborted')) {
                    await sock.sendMessage(jid, { 
                        text: '🛑 **Job was cancelled.** You can send a new search query when ready.'
                    });
                } else {
                    await sock.sendMessage(jid, { 
                        text: `❌ **Error occurred:** ${error.message}\n\n` +
                              `💡 Please try again with a different niche or contact support if the issue persists.`
                    });
                }
            }
            
            return;
        } else if (text.toUpperCase() === 'STOP') { // Allow STOP during ready_to_start
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid); // Ensure job is cleared
                session.status = 'idle';
                session.currentStep = 'awaiting_niche';
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                await sock.sendMessage(jid, { text: '🛑 **Job cancelled successfully.** You can send a new search query when ready.' });
            } else {
                await sock.sendMessage(jid, { text: '📊 No active job to cancel.' });
            }
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: '⚠️ Please type START to begin scraping, or 0 to go back.'
            });
            await sock.sendMessage(jid, { text: session.previousMessage });
            return;
        }
    } else if (session.currentStep === 'scraping_in_progress') {
        if (text.toUpperCase() === 'STOP') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                // State will be reset in the catch block of startUnifiedScraper
            }
            return;
        } else if (text.toUpperCase() === 'STATUS') {
            // Handled below by the general STATUS command
        } else {
            await sock.sendMessage(jid, { 
                text: '⏳ A scraping job is currently in progress. You can type STATUS to check its progress or STOP to cancel it.'
            });
            return;
        }
    }

    // Existing general commands (STATUS, STOP, RESET, HELP, LIMIT) - re-evaluate their placement
    // These commands should ideally work regardless of step, but interact differently.
    // The step-specific handling above should take precedence.
    
    if (/^STATUS$/i.test(text)) {
      const activeJob = activeJobs.get(jid);
      
      if (activeJob) {
        await sock.sendMessage(jid, { 
          text: `📊 **Current Status:** ${activeJob.status || 'Processing...'}\n\n` +
                `🎯 Source: ${session.prefs.source}\n` +
                `📄 Format: ${session.prefs.format}\n` +
                `📏 Limit: ${session.prefs.limit}\n\n` +
                `💡 Send STOP to cancel the current job.`
        });
      } else {
        await sock.sendMessage(jid, { 
          text: `📊 **Status:** Idle\n\n` +
                `🎯 Source: ${session.prefs.source}\n` +
                `📄 Format: ${session.prefs.format}\n` +
                `📏 Limit: ${session.prefs.limit}\n\n` +
                `💡 Send a search query to start scraping.`
        });
      }
      session.currentStep = 'awaiting_niche'; // Reset after status check
      session.previousMessage = null;
      session.currentLoadingPercentage = 0; // Reset after status check
      session.lastLoadingUpdateTimestamp = 0; // Reset after status check
      saveJson(SESSIONS_FILE, sessions);
      return;
    }

    if (/^STOP$/i.test(text)) {
      const activeJob = activeJobs.get(jid);
      
      if (activeJob && activeJob.abort) {
        activeJob.abort.abort();
        activeJobs.delete(jid);
        
        session.status = 'idle';
        session.currentStep = 'awaiting_niche'; // Reset step on stop
        session.currentLoadingPercentage = 0; // Reset on stop
        session.lastLoadingUpdateTimestamp = 0; // Reset on stop
        sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);

        await sock.sendMessage(jid, { 
          text: '🛑 **Job cancelled successfully.** You can send a new search query when ready.'
        });
      } else {
        await sock.sendMessage(jid, { 
          text: '📊 No active job to cancel. You can send a search query to start scraping.'
        });
      }
      return;
    }

    if (/^RESET$/i.test(text)) {
      session.prefs = {
        source: 'ALL',
        format: 'XLSX',
        limit: 300
      };
      session.currentStep = 'awaiting_niche'; // Reset step on reset
      session.pendingNiche = null;
      session.currentLoadingPercentage = 0; // Reset on reset
      session.lastLoadingUpdateTimestamp = 0; // Reset on reset
      sessions[jid] = session;
      saveJson(SESSIONS_FILE, sessions);

      await sock.sendMessage(jid, { 
        text: `♻️ **Preferences reset to defaults:**\n\n` +
              `🎯 Source: ALL\n` +
              `📄 Format: XLSX\n` +
              `📏 Limit: 300\n\n` +
              `Please send a new search query to begin.`
      });
      return;
    }

    if (/^LIMIT:?\s+/i.test(text)) {
      const limitStr = text.replace(/^LIMIT:?\s+/i, '').trim();
      const limit = parseInt(limitStr, 10);
      
      if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
        await sock.sendMessage(jid, { 
          text: '⚠️ Invalid limit. Please enter a number between 1 and 500.'
        });
        return;
      }

      session.prefs.limit = limit;
      session.currentStep = 'awaiting_niche'; // Reset step after limit change
      session.pendingNiche = null;
      session.currentLoadingPercentage = 0; // Reset after limit change
      session.lastLoadingUpdateTimestamp = 0; // Reset after limit change
      sessions[jid] = session;
      saveJson(SESSIONS_FILE, sessions);

      await sock.sendMessage(jid, { 
        text: `📏 Results limit set to: **${limit}**`
      });
      return;
    }

    if (/^HELP$/i.test(text)) {
      await sendChunkedMessage(sock, jid, getMessage(session.language, 'help'));
      session.currentStep = 'awaiting_niche'; // Reset step after help
      session.previousMessage = null;
      saveJson(SESSIONS_FILE, sessions);
      return;
    }

    // Check if there are pending results for this user (should be handled outside conversation flow if possible)
    if (pendingResults.has(jid)) {
      const pendingResult = pendingResults.get(jid);
      const wantsSend = /^SEND(\s+RESULTS)?$/i.test(text);
      const wantsSkip = /^(DISMISS|SKIP|IGNORE)$/i.test(text);

      if (wantsSend) {
        console.log(chalk.blue(`📱 User requested to send pending results for ${jid}: ${pendingResult.filePath}`));
        try {
          await sendResultsToUser(sock, jid, pendingResult.filePath, pendingResult.meta);
          pendingResults.delete(jid);
          savePendingResults();
          console.log(chalk.green(`✅ Pending results sent and cleared for ${jid}`));
          return;
        } catch (error) {
          console.log(chalk.red(`❌ Failed to send pending results: ${error.message}`));
          await sock.sendMessage(jid, { 
            text: `⚠️ **Error sending pending results.** Please try again or contact support.`
          });
        }
      } else if (wantsSkip) {
        pendingResults.delete(jid);
        savePendingResults();
        await sock.sendMessage(jid, { 
          text: `🧹 **Pending results dismissed.** You can start a new search now.`
        });
      } else {
        // Only inform if not already in a specific state and not a common command
        if (!['awaiting_niche', 'awaiting_source', 'awaiting_type', 'awaiting_format', 'ready_to_start', 'scraping_in_progress'].includes(session.currentStep) &&
            !['STATUS', 'STOP', 'RESET', 'LIMIT', 'HELP'].some(cmd => text.toUpperCase().startsWith(cmd))) {
            await sock.sendMessage(jid, { 
                text: `📎 **You have pending results.** Reply \`SEND\` to receive them, or \`SKIP\` to discard. Continuing with your new message...`
            });
        }
      }
    }

    // Fallback for unhandled messages when not in a specific conversational step
    if (!activeJobs.has(jid) && session.currentStep !== 'awaiting_niche' && isNaN(inputNumber) && text.toUpperCase() !== 'START') {
        // If not in awaiting_niche and no job running, re-send the previous prompt for numerical input
        if (session.previousMessage) {
            await sock.sendMessage(jid, { text: '⚠️ Invalid input. Please choose a number from the list, or 0 to go back.' });
            await sock.sendMessage(jid, { text: session.previousMessage });
        } else {
            // This case should ideally not be reached if previousMessage is correctly managed
            await sock.sendMessage(jid, { text: getMessage(session.language, 'error_generic') });
        }
    } else if (!activeJobs.has(jid) && session.currentStep === 'awaiting_niche' && !isNaN(inputNumber)) {
        await sock.sendMessage(jid, { text: getMessage(session.language, 'invalid_niche') });
    } else if (!activeJobs.has(jid) && isNaN(inputNumber) && text.toUpperCase() !== 'START') {
        // Generic invalid input if not caught by specific steps or other commands
        await sock.sendMessage(jid, { text: getMessage(session.language, 'error_generic') });
    }

  } catch (error) {
    console.error('❌ Error handling message:', error.message);
    await sock.sendMessage(jid, { 
      text: '❌ Internal error occurred. Please try again or contact support.'
    });
  }
}

async function startBot() {
  console.log(chalk.cyan.bold('\n🤖 Starting WhatsApp Business Scraper Bot...\n'));

  try {
    // Initialize authentication
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Load pending results from disk
    loadPendingResults();
    
    // Create socket
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // We'll handle QR display manually
      browser: ['Business Scraper Bot', 'Chrome', '1.0.0'],
      defaultQueryTimeoutMs: 120000, // Increased timeout
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000, // Even more frequent keep-alive
      retryRequestDelayMs: 500, // Faster retry
      maxRetries: 10, // More retries
      shouldIgnoreJid: jid => jid.includes('@broadcast'),
      patchMessageBeforeSending: (msg) => {
        const requiresPatch = !!(
          msg.buttonsMessage 
          || msg.templateMessage
          || msg.listMessage
        );
        if (requiresPatch) {
          msg = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...msg,
              },
            },
          };
        }
        return msg;
      },
      logger: {
        level: 'silent', // Disable verbose Baileys logs
        child: () => ({ 
          level: 'silent',
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
          trace: () => {}
        }),
        error: () => {}, // Disable error logging
        warn: () => {},  // Disable warning logging
        info: () => {},  // Disable info logging
        debug: () => {}, // Disable debug logging
        trace: () => {}  // Disable trace logging
      }
    });

    // QR Code handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log(chalk.yellow('\n📱 Scan this QR code with WhatsApp:\n'));
        qrcode.generate(qr, { small: true });
        console.log(chalk.blue('\n💡 Instructions:'));
        console.log(chalk.gray('   1. Open WhatsApp → Settings → Linked Devices'));
        console.log(chalk.gray('   2. Tap "Link a Device"'));
        console.log(chalk.gray('   3. Scan the QR code above\n'));
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(chalk.red('\n❌ Connection closed'));
        
        if (shouldReconnect) {
          console.log(chalk.yellow('🔄 Reconnecting in 3 seconds...\n'));
          setTimeout(startBot, 3000);
        } else {
          console.log(chalk.red('🚪 Logged out. Restart bot to reconnect.\n'));
        }
      } else if (connection === 'open') {
        console.log(chalk.green.bold('\n✅ WhatsApp Bot Connected Successfully!'));
        console.log(chalk.green('📱 Ready to receive messages...\n'));
        console.log(chalk.cyan('🛠️  Quick Admin Commands:'));
        console.log(chalk.gray('   npm run admin:list    - List access codes'));
        console.log(chalk.gray('   npm run admin:add     - Add new user'));
        console.log(chalk.gray('   npm run admin:remove  - Remove user\n'));
        
        // Check for pending results to send when user comes back online
        await checkAndSendPendingResults();
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    // Keep connection alive with periodic status checks
    const connectionCheckInterval = setInterval(() => {
      if (sock && sock.user) {
        // Just log connection status
        console.log(chalk.gray('📡 Connection status: Active'));
      }
    }, 60000); // Every 60 seconds

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key && message.message) {
          await handleMessage(sock, message);
        }
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down bot...'));
      
      // Clear connection check interval
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      
      // Cancel all active jobs
      for (const [jid, job] of activeJobs.entries()) {
        if (job.abort) {
          job.abort.abort();
        }
      }
      activeJobs.clear();
      
      console.log(chalk.green('✅ Bot shut down gracefully'));
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ Failed to start bot:'), error.message);
    process.exit(1);
  }
}

// Start the bot
if (import.meta.url === `file://${process.argv[1]}` || 
    import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  startBot();
}

export { startBot };
