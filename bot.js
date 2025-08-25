import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { startUnifiedScraper } from './lib/startUnifiedScraper.js';
import { createRequire } from 'module';
import chalk from 'chalk';
import { getMessage } from './languages.js';

import AdminManager from './lib/admin-manager.js';

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
   * Stop the progress simulation without sending completion message
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isComplete = true;
    this.isStarted = false;
    // Don't send any progress message - just stop silently
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


// Admin management
const adminManager = new AdminManager();
const adminSessions = new Map(); // jid -> { adminCode: string, role: string, permissions: string[], authenticatedAt: Date }

// Load admin sessions from disk
function loadAdminSessions() {
  try {
    const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
    if (fs.existsSync(adminSessionsFile)) {
      const data = JSON.parse(fs.readFileSync(adminSessionsFile, 'utf8'));
      for (const [jid, session] of Object.entries(data)) {
        // Convert string dates back to Date objects
        if (session.authenticatedAt) {
          session.authenticatedAt = new Date(session.authenticatedAt);
        }
        adminSessions.set(jid, session);
      }
      console.log(chalk.blue(`📱 Loaded ${adminSessions.size} admin sessions from disk`));
      console.log(chalk.blue(`📊 Admin sessions loaded:`, Array.from(adminSessions.keys()).map(k => k.split('@')[0])));
    } else {
      console.log(chalk.blue(`📱 No admin sessions file found, starting with empty sessions`));
    }
  } catch (error) {
    console.error('❌ Failed to load admin sessions:', error.message);
    console.log(chalk.blue(`📱 Starting with empty admin sessions`));
  }
}

// Save admin sessions to disk
function saveAdminSessions() {
  try {
    const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
    const data = {};
    for (const [jid, session] of adminSessions.entries()) {
      data[jid] = session;
    }
    fs.writeFileSync(adminSessionsFile, JSON.stringify(data, null, 2));
    console.log(chalk.blue(`💾 Admin sessions saved to disk`));
  } catch (error) {
    console.error('❌ Failed to save admin sessions:', error.message);
  }
}

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


// Helper function to format API keys for display
function formatApiKey(key, maxLength = 20) {
  if (!key) return '❌ MISSING';
  if (key.length <= maxLength) return `\`${key}\``;


  const prefix = key.substring(0, 8);
  const suffix = key.substring(key.length - 8);
  return `\`${prefix}...${suffix}\` (${key.length} chars)`;
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


  // Initialize session if not exists (but don't send welcome message yet)
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

      },
      security: {
        failedAuthAttempts: 0,
        lastFailedAttempt: null,
        isBlocked: false,
        blockedAt: null
      }
    };
    saveJson(SESSIONS_FILE, sessions);
    

    // DON'T send welcome message for new users - they must authenticate first
    // The welcome message will only be sent after they provide a valid CODE
    console.log(chalk.yellow(`🔒 New user ${jid.split('@')[0]} created session - awaiting authentication`));
    return; // Exit without any response
  }

  const session = sessions[jid];

  // ADMIN AUTHENTICATION: Check if user is trying to authenticate as admin
  // Only run this if there's no active admin session for this user
  if (/^ADMIN:?\s+/i.test(text) && !adminSessions.has(jid)) {
    const adminCode = text.replace(/^ADMIN:?\s+/i, '').trim();
    
    if (!adminCode) {
    await sock.sendMessage(jid, { 

        text: `🔐 **Admin Authentication Required**\n\nUsage: ADMIN: <admin_code>\nExample: ADMIN: admin123`
      });
      return;
    }

    const authResult = adminManager.authenticateAdmin(adminCode);
    
    if (authResult.success) {
      // Store admin session
      adminSessions.set(jid, {
        adminCode: adminCode,
        role: authResult.admin.role,
        permissions: authResult.admin.permissions,
        authenticatedAt: new Date()
      });

      // Save admin sessions to disk
      saveAdminSessions();

      console.log(chalk.green(`🔓 Admin access granted to ${jid.split('@')[0]} with role: ${authResult.admin.role}`));
      console.log(chalk.blue(`📊 Admin sessions Map now contains ${adminSessions.size} sessions:`, Array.from(adminSessions.keys()).map(k => k.split('@')[0])));

      await sock.sendMessage(jid, { 
        text: `🔐 **Admin Access Granted!**\n\n👑 **Role:** ${authResult.admin.role}\n📝 **Description:** ${authResult.admin.roleDescription}\n🔑 **Permissions:** ${authResult.admin.permissions.join(', ')}\n\n💡 **Available Commands:**\n• ADMIN USERS - List all users with their API keys\n• ADMIN ADD USER <code> <google_key1> <google_key2> <gemini_key1> <gemini_key2> - Add new user with API keys (any format)\n• ADMIN REMOVE USER <code>\n• ADMIN ADMINS - List all admins\n• ADMIN ADD ADMIN <code> <role>\n• ADMIN REMOVE ADMIN <code>\n• ADMIN STATUS - System status\n• ADMIN HELP - Show detailed admin help`
      });
      return;
    } else {
      await sock.sendMessage(jid, { 
        text: `❌ **Admin Authentication Failed**\n\n${authResult.error}\n\n💡 Please check your admin code and try again.`
      });
      return;
    }
  }

  // ADMIN COMMANDS: Process admin commands before strict authentication check
  const adminSession = adminSessions.get(jid);
  console.log(chalk.blue(`🔍 Admin command check for ${jid.split('@')[0]}: adminSession=${!!adminSession}, text="${text}"`));
  console.log(chalk.blue(`📊 Admin sessions Map contents:`, Array.from(adminSessions.entries()).map(([k, v]) => `${k.split('@')[0]}: ${v.adminCode}`)));
  
  if (adminSession) {
    console.log(chalk.green(`✅ Admin session found for ${jid.split('@')[0]} with code: ${adminSession.adminCode}`));
    // Admin command: List users
    if (text.toUpperCase() === 'ADMIN USERS') {
      try {
        const result = adminManager.listUsers(adminSession.adminCode);
        console.log(chalk.blue(`🔍 ADMIN USERS result:`, JSON.stringify(result, null, 2)));
        
        if (result.success) {
          let message = `👥 **User Codes List**\n\n`;
          if (result.users.length === 0) {
            message += `No user codes found.`;
          } else {
            result.users.forEach((user, index) => {
              message += `${index + 1}. **${user.code}**\n`;
              message += `   📅 Created: ${new Date(user.createdAt).toLocaleString()}\n`;
              message += `   👤 Issued by: ${user.issuedBy}\n`;
              message += `   🔑 **Google Search API Keys:**\n`;
              message += `      • Key 1: ${formatApiKey(user.googleSearchKeys[0])}\n`;
              message += `      • Key 2: ${formatApiKey(user.googleSearchKeys[1])}\n`;
              message += `   🤖 **Gemini API Keys:**\n`;
              message += `      • Key 1: ${formatApiKey(user.geminiKeys[0])}\n`;
              message += `      • Key 2: ${formatApiKey(user.geminiKeys[1])}\n`;
              message += `   📊 Use count: ${user.useCount}\n`;
              if (user.lastUsed) {
                message += `   ⏰ Last used: ${new Date(user.lastUsed).toLocaleString()}\n`;
              }
              if (user.expiresAt) {
                message += `   ⏳ Expires: ${new Date(user.expiresAt).toLocaleString()}\n`;
              }
              message += '\n';
            });
          }
          message += `**Total User Codes:** ${result.users.length}`;
          await sock.sendMessage(jid, { text: message });
        } else {
          await sock.sendMessage(jid, { text: `❌ **Error:** ${result.error}` });
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN USERS command:`, error.message));
        await sock.sendMessage(jid, { text: `❌ **Internal Error:** ${error.message}` });
      }
      return;
    }

    // Admin command: Add user
    if (text.toUpperCase().startsWith('ADMIN ADD USER')) {
      const parts = text.split(' ');
      if (parts.length < 7) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid Format!**\n\n📝 **Correct Usage:** ADMIN ADD USER <code> <google_key1> <google_key2> <gemini_key1> <gemini_key2>\n\n💡 **Example:** ADMIN ADD USER abc123 google_key1 google_key2 gemini_key1 gemini_key2\n\n⚠️ **Please provide:**\n• User code\n• 2 Google Search API keys\n• 2 Gemini API keys\n\n🔄 **Try again with the correct format!**`
        });
        return;
      }

      const userCode = parts[3];
      const googleKey1 = parts[4];
      const googleKey2 = parts[5];
      const geminiKey1 = parts[6];
      const geminiKey2 = parts[7];

      // Validate that all keys are provided and not empty
      if (!userCode || !googleKey1 || !googleKey2 || !geminiKey1 || !geminiKey2) {
        await sock.sendMessage(jid, { 
          text: `❌ **Missing Required Information!**\n\n📝 **You provided:**\n• Code: ${userCode || '❌ MISSING'}\n• Google Key 1: ${formatApiKey(googleKey1)}\n• Google Key 2: ${formatApiKey(googleKey2)}\n• Gemini Key 1: ${formatApiKey(geminiKey1)}\n• Gemini Key 2: ${formatApiKey(geminiKey2)}\n\n💡 **Please provide all 5 required fields and try again!**`
        });
        return;
      }

      // Validate key formats (basic validation)
      if (googleKey1 === googleKey2) {
        await sock.sendMessage(jid, { 
          text: `❌ **Duplicate Google Keys!**\n\n⚠️ Google Key 1 and Google Key 2 must be different.\n\n🔄 **Please provide different Google API keys and try again!**`
        });
        return;
      }

      if (geminiKey1 === geminiKey2) {
        await sock.sendMessage(jid, { 
          text: `❌ **Duplicate Gemini Keys!**\n\n⚠️ Gemini Key 1 and Gemini Key 2 must be different.\n\n🔄 **Please provide different Gemini API keys and try again!**`
        });
        return;
      }

      // Basic validation: ensure keys are not empty strings
      if (googleKey1.trim() === '' || googleKey2.trim() === '' || geminiKey1.trim() === '' || geminiKey2.trim() === '') {
        await sock.sendMessage(jid, { 
          text: `❌ **Empty Keys Not Allowed!**\n\n⚠️ All API keys must contain actual values.\n\n🔍 **Your keys:**\n• Google Key 1: ${formatApiKey(googleKey1)}\n• Google Key 2: ${formatApiKey(googleKey2)}\n• Gemini Key 1: ${formatApiKey(geminiKey1)}\n• Gemini Key 2: ${formatApiKey(geminiKey2)}\n\n🔄 **Please provide non-empty keys and try again!**`
        });
        return;
      }

      // Check if user code already exists
      const existingUser = adminManager.getUserDetails(userCode);
      if (existingUser) {
        await sock.sendMessage(jid, { 
          text: `❌ **User Code Already Exists!**\n\n⚠️ The user code \`${userCode}\` is already registered.\n\n💡 **Options:**\n• Use a different user code\n• Use \`ADMIN REMOVE USER ${userCode}\` to remove the existing one first\n• Use \`ADMIN USERS\` to see all existing user codes\n\n🔄 **Please try again with a different code!**`
        });
        return;
      }

      const apiKeys = {
        googleSearchKeys: [googleKey1, googleKey2],
        geminiKeys: [geminiKey1, geminiKey2]
      };

      const result = adminManager.addUser(adminSession.adminCode, userCode, apiKeys);
      
      if (result.success) {
        // Get the newly added user details to display
        const userDetails = adminManager.getUserDetails(userCode);
        if (userDetails) {
          // Get total user count for the success message
          const totalUsers = Object.keys(adminManager.codes).length;
          
          let successMessage = `✅ **User Added Successfully!**\n\n`;
          successMessage += `👤 **User Code:** ${userCode}\n`;
          successMessage += `📅 **Created:** ${new Date(userDetails.createdAt).toLocaleString()}\n`;
          successMessage += `👑 **Issued by:** ${userDetails.meta?.issuedBy || 'unknown'}\n\n`;
          successMessage += `🔑 **Google Search API Keys:**\n`;
          successMessage += `   • Key 1: ${formatApiKey(userDetails.apiKeys.googleSearchKeys[0])}\n`;
          successMessage += `   • Key 2: ${formatApiKey(userDetails.apiKeys.googleSearchKeys[1])}\n\n`;
          successMessage += `🤖 **Gemini API Keys:**\n`;
          successMessage += `   • Key 1: ${formatApiKey(userDetails.apiKeys.geminiKeys[0])}\n`;
          successMessage += `   • Key 2: ${formatApiKey(userDetails.apiKeys.geminiKeys[1])}\n\n`;
          successMessage += `📊 **Status:** Active\n`;
          successMessage += `⏰ **Expires:** Never\n`;
          successMessage += `🔄 **Use Count:** 0\n\n`;
          successMessage += `📈 **Total Users:** ${totalUsers}`;
          
          await sock.sendMessage(jid, { text: successMessage });
        } else {
          await sock.sendMessage(jid, { text: `✅ **${result.message}**` });
        }
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ **Error Adding User:** ${result.error}\n\n🔄 **Please check the error and try again!**`
        });
      }
      return;
    }

    // Admin command: Remove user
    if (text.toUpperCase().startsWith('ADMIN REMOVE USER')) {
      const parts = text.split(' ');
      if (parts.length < 4) {
        await sock.sendMessage(jid, { 
          text: `❌ **Usage:** ADMIN REMOVE USER <code>\n\n💡 **Example:** ADMIN REMOVE USER abc123`
        });
        return;
      }

      const userCode = parts[3];
      const result = adminManager.removeUser(adminSession.adminCode, userCode);
      await sock.sendMessage(jid, { 
        text: result.success ? `✅ **${result.message}**` : `❌ **Error:** ${result.error}`
      });
      return;
    }

    // Admin command: List admins
    if (text.toUpperCase() === 'ADMIN ADMINS') {
      const result = adminManager.listAdmins(adminSession.adminCode);
      if (result.success) {
        let message = `👑 **Admin List**\n\n`;
        if (result.admins.length === 0) {
          message += `No admins found.`;
        } else {
          result.admins.forEach((admin, index) => {
            message += `${index + 1}. **${admin.code}** - ${admin.role}\n`;
            message += `   Description: ${admin.roleDescription}\n`;
            message += `   Permissions: ${admin.permissions.join(', ')}\n`;
            message += `   Created: ${new Date(admin.createdAt).toLocaleString()}\n`;
            message += `   Use count: ${admin.useCount}\n\n`;
          });
        }
        message += `**Total Admins:** ${result.admins.length}`;
        await sock.sendMessage(jid, { text: message });
      } else {
        await sock.sendMessage(jid, { text: `❌ **Error:** ${result.error}` });
      }
      return;
    }

    // Admin command: Add admin
    if (text.toUpperCase().startsWith('ADMIN ADD ADMIN')) {
      const parts = text.split(' ');
      if (parts.length < 5) {
        const availableRoles = adminManager.getAvailableRoles().join(', ');
        await sock.sendMessage(jid, { 
          text: `❌ **Usage:** ADMIN ADD ADMIN <code> <role>\n\n💡 **Available roles:** ${availableRoles}\n\n💡 **Example:** ADMIN ADD ADMIN mod123 moderator`
        });
        return;
      }

      const newAdminCode = parts[3];
      const role = parts[4];

      const result = adminManager.addAdmin(adminSession.adminCode, newAdminCode, role);
      await sock.sendMessage(jid, { 
        text: result.success ? `✅ **${result.message}**` : `❌ **Error:** ${result.error}`
      });
      return;
    }

    // Admin command: Remove admin
    if (text.toUpperCase().startsWith('ADMIN REMOVE ADMIN')) {
      const parts = text.split(' ');
      if (parts.length < 4) {
        await sock.sendMessage(jid, { 
          text: `❌ **Usage:** ADMIN REMOVE ADMIN <code>\n\n💡 **Example:** ADMIN REMOVE ADMIN mod123`
        });
        return;
      }

      const targetAdminCode = parts[3];
      const result = adminManager.removeAdmin(adminSession.adminCode, targetAdminCode);
      await sock.sendMessage(jid, { 
        text: result.success ? `✅ **${result.message}**` : `❌ **Error:** ${result.error}`
      });
      return;
    }

    // Admin command: System status
    if (text.toUpperCase() === 'ADMIN STATUS') {
      console.log(chalk.blue(`🔍 Processing ADMIN STATUS command for ${adminSession.adminCode}`));
      try {
        const result = adminManager.getSystemStatus(adminSession.adminCode);
        console.log(chalk.blue(`🔍 ADMIN STATUS result:`, JSON.stringify(result, null, 2)));
        
        if (result.success) {
          const status = result.status;
          let message = `📊 **System Status**\n\n`;
          message += `👥 **Users:** ${status.totalUsers} total, ${status.authenticatedUsers} active, ${status.blockedUsers} blocked\n`;
          message += `🔑 **Codes:** ${status.totalCodes} user codes\n`;
          message += `👑 **Admins:** ${status.totalAdmins} admin codes\n\n`;
          message += `⚙️ **System Settings:**\n`;
          message += `• Max failed attempts: ${status.systemSettings.max_failed_auth_attempts}\n`;
          message += `• Auto-unblock hours: ${status.systemSettings.auto_unblock_hours}\n`;
          message += `• Session timeout: ${status.systemSettings.session_timeout_hours} hours\n`;
          message += `• Max users per admin: ${status.systemSettings.max_users_per_admin}\n`;
          
          await sock.sendMessage(jid, { text: message });
        } else {
          await sock.sendMessage(jid, { text: `❌ **Error:** ${result.error}` });
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN STATUS command:`, error.message));
        await sock.sendMessage(jid, { text: `❌ **Internal Error:** ${error.message}` });
      }
      return;
    }

    // Admin command: Help
    if (text.toUpperCase() === 'ADMIN HELP') {
      const permissions = adminSession.permissions;
      let message = `🔐 **Admin Commands Help**\n\n`;
      message += `👑 **Your Role:** ${adminSession.role}\n`;
      message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
      
      message += `📋 **Available Commands:**\n\n`;
      
      if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
        message += `• **ADMIN USERS** - List all users and their status\n`;
      }
      
      if (permissions.includes('manage_users')) {
        message += `• **ADMIN ADD USER <code> <google_key1> <google_key2> <gemini_key1> <gemini_key2>** - Add new user with API keys (any format)\n`;
        message += `• **ADMIN REMOVE USER <code>** - Remove user code\n`;
      }
      
      if (permissions.includes('manage_admins')) {
        message += `• **ADMIN ADMINS** - List all admin codes\n`;
        message += `• **ADMIN ADD ADMIN <code> <role>** - Add new admin\n`;
        message += `• **ADMIN REMOVE ADMIN <code>** - Remove admin code\n`;
      }
      
      if (permissions.includes('system_control')) {
        message += `• **ADMIN STATUS** - View system status and statistics\n`;
      }
      
      message += `• **ADMIN HELP** - Show this help message\n`;
      message += `• **ADMIN SESSIONS** - Show current admin sessions (debug)\n`;
      message += `• **ADMIN USERSESSIONS** - Show all user sessions\n`;
      message += `• **ADMIN FILES** - Check admin system files\n`;
      message += `• **ADMIN DEBUG** - Run admin system diagnostics\n`;
      message += `• **ADMIN LOG** - Show admin system logs\n`;
      message += `• **ADMIN SESSIONSFILE** - Show admin sessions file content\n`;
      message += `• **ADMIN USERSESSIONSFILE** - Show user sessions file content\n`;
      message += `• **ADMIN ADMINSESSIONSFILE** - Show admin sessions file content\n`;
      message += `• **ADMIN RESET** - Reset admin system completely\n`;
      message += `• **ADMIN CONFIGFILE** - Show admin config file content\n`;
      message += `• **ADMIN CODESFILE** - Show user codes file content\n`;
      message += `• **ADMIN SESSIONSFILE** - Show user sessions file content\n`;
      message += `• **ADMIN REFRESH** - Refresh admin data from disk\n`;
      message += `• **ADMIN CLEAR** - Clear all admin sessions (debug)\n`;
              message += `• **ADMIN AUTH <code>** - Re-authenticate with admin code\n`;
        message += `• **ADMIN LOGOUT** - Logout from admin session (switch to user mode)\n`;
        message += `• **ADMIN ME** - Show your current admin session details\n`;
      message += `• **ADMIN INFO** - Show system information and version\n`;
      message += `• **ADMIN TEST** - Test your admin permissions\n`;
      message += `• **ADMIN RELOAD** - Reload admin manager completely\n`;
      message += `• **ADMIN CONFIG** - Show admin configuration details\n`;
      message += `• **ADMIN CODES** - Show all user codes\n`;
      message += `• **ADMIN SESSIONS** - Show all user sessions\n\n`;
      
      message += `💡 **Note:** You can only use commands that match your permissions.`;
      
      await sock.sendMessage(jid, { text: message });
      return;
    }

    // Admin command: Show current admin sessions (debug)
    if (text.toUpperCase() === 'ADMIN SESSIONS') {
      let message = `🔐 **Current Admin Sessions**\n\n`;
      if (adminSessions.size === 0) {
        message += `No active admin sessions.`;
      } else {
        for (const [sessionJid, sessionData] of adminSessions.entries()) {
          const phone = sessionJid.split('@')[0];
          const timeSinceAuth = Math.floor((Date.now() - sessionData.authenticatedAt) / 1000 / 60);
          message += `📱 **${phone}**\n`;
          message += `   Code: ${sessionData.adminCode}\n`;
          message += `   Role: ${sessionData.role}\n`;
          message += `   Authenticated: ${timeSinceAuth} minutes ago\n`;
          message += `   Permissions: ${sessionData.permissions.join(', ')}\n\n`;
        }
      }
      message += `**Total Active Sessions:** ${adminSessions.size}`;
      await sock.sendMessage(jid, { text: message });
      return;
    }

    // Admin command: Refresh admin data from disk
    if (text.toUpperCase() === 'ADMIN REFRESH') {
      try {
        // Refresh admin manager data
        adminManager.adminConfig = adminManager.loadAdminConfig();
        adminManager.codes = adminManager.loadCodes();
        adminManager.sessions = adminManager.loadSessions();
        
        // Reload admin sessions from disk
        loadAdminSessions();
        
        await sock.sendMessage(jid, { 
          text: `🔄 **Admin Data Refreshed**\n\n✅ Admin configuration reloaded\n✅ User codes reloaded\n✅ User sessions reloaded\n✅ Admin sessions reloaded\n\n📊 Current admin sessions: ${adminSessions.size}`
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error refreshing admin data:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Error refreshing admin data:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show admin sessions file content
    if (text.toUpperCase() === 'ADMIN ADMINSESSIONSFILE') {
      try {
        let message = `📄 **Admin Sessions File Content**\n\n`;
        
        const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
        
        if (fs.existsSync(adminSessionsFile)) {
          try {
            const content = fs.readFileSync(adminSessionsFile, 'utf8');
            const data = JSON.parse(content);
            
            message += `📁 **File:** admin_sessions.json\n`;
            message += `📏 **Size:** ${(content.length / 1024).toFixed(2)} KB\n`;
            message += `🔐 **Sessions:** ${Object.keys(data).length}\n\n`;
            
            if (Object.keys(data).length > 0) {
              message += `🔐 **Session Details:**\n`;
              for (const [sessionJid, sessionData] of Object.entries(data)) {
                const phone = sessionJid.split('@')[0];
                message += `• **${phone}**\n`;
                message += `  Admin Code: ${sessionData.adminCode}\n`;
                message += `  Role: ${sessionData.role}\n`;
                message += `  Permissions: ${sessionData.permissions.join(', ')}\n`;
                if (sessionData.authenticatedAt) {
                  const authTime = new Date(sessionData.authenticatedAt);
                  message += `  Auth Time: ${authTime.toLocaleString()}\n`;
                }
                message += '\n';
              }
            } else {
              message += `🔐 **Session Details:** No sessions found`;
            }
            
          } catch (error) {
            message += `❌ **Error reading file:** ${error.message}`;
          }
        } else {
          message += `❌ **File not found:** admin_sessions.json`;
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN ADMINSESSIONSFILE command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show user sessions file content
    if (text.toUpperCase() === 'ADMIN USERSESSIONSFILE') {
      try {
        let message = `📄 **User Sessions File Content**\n\n`;
        
        const sessionsFile = path.join(__dirname, 'sessions.json');
        
        if (fs.existsSync(sessionsFile)) {
          try {
            const content = fs.readFileSync(sessionsFile, 'utf8');
            const data = JSON.parse(content);
            
            message += `📁 **File:** sessions.json\n`;
            message += `📏 **Size:** ${(content.length / 1024).toFixed(2)} KB\n`;
            message += `📱 **Sessions:** ${Object.keys(data).length}\n\n`;
            
            if (Object.keys(data).length > 0) {
              message += `📱 **Session Details:**\n`;
              for (const [sessionJid, sessionData] of Object.entries(data)) {
                const phone = sessionJid.split('@')[0];
                message += `• **${phone}**\n`;
                message += `  Status: ${sessionData.status || 'unknown'}\n`;
                message += `  Current Step: ${sessionData.currentStep || 'unknown'}\n`;
                message += `  Authenticated: ${sessionData.apiKeys ? '✅ Yes' : '❌ No'}\n`;
                message += `  Created: ${new Date(sessionData.meta?.createdAt || Date.now()).toLocaleString()}\n`;
                if (sessionData.security?.isBlocked) {
                  message += `  🔒 Blocked: Yes\n`;
                }
                if (sessionData.security?.failedAuthAttempts > 0) {
                  message += `  ⚠️ Failed attempts: ${sessionData.security.failedAuthAttempts}/5\n`;
                }
                if (sessionData.meta?.totalJobs > 0) {
                  message += `  📈 Total jobs: ${sessionData.meta.totalJobs}\n`;
                }
                message += '\n';
              }
            } else {
              message += `📱 **Session Details:** No sessions found`;
            }
            
          } catch (error) {
            message += `❌ **Error reading file:** ${error.message}`;
          }
        } else {
          message += `❌ **File not found:** sessions.json`;
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN USERSESSIONSFILE command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show user codes file content
    if (text.toUpperCase() === 'ADMIN CODESFILE') {
      try {
        let message = `📄 **User Codes File Content**\n\n`;
        
        const codesFile = path.join(__dirname, 'codes.json');
        
        if (fs.existsSync(codesFile)) {
          try {
            const content = fs.readFileSync(codesFile, 'utf8');
            const data = JSON.parse(content);
            
            message += `📁 **File:** codes.json\n`;
            message += `📏 **Size:** ${(content.length / 1024).toFixed(2)} KB\n`;
            message += `🔑 **Codes:** ${Object.keys(data).length}\n\n`;
            
            if (Object.keys(data).length > 0) {
              message += `🔑 **Code Details:**\n`;
              for (const [code, codeData] of Object.entries(data)) {
                message += `• **${code}**\n`;
                message += `  Google Keys: ${codeData.apiKeys.googleSearchKeys.length} keys\n`;
                message += `  Gemini Keys: ${codeData.apiKeys.geminiKeys.length} keys\n`;
                message += `  Created: ${new Date(codeData.createdAt).toLocaleString()}\n`;
                if (codeData.meta?.issuedBy) {
                  message += `  Issued by: ${codeData.meta.issuedBy}\n`;
                }
                if (codeData.meta?.useCount) {
                  message += `  Use count: ${codeData.meta.useCount}\n`;
                }
                if (codeData.meta?.lastUsed) {
                  message += `  Last used: ${new Date(codeData.meta.lastUsed).toLocaleString()}\n`;
                }
                message += '\n';
              }
            } else {
              message += `🔑 **Code Details:** No codes found`;
            }
            
          } catch (error) {
            message += `❌ **Error reading file:** ${error.message}`;
          }
        } else {
          message += `❌ **File not found:** codes.json`;
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN CODESFILE command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show admin config file content
    if (text.toUpperCase() === 'ADMIN CONFIGFILE') {
      try {
        let message = `📄 **Admin Config File Content**\n\n`;
        
        const adminConfigFile = path.join(__dirname, 'admin_config.json');
        
        if (fs.existsSync(adminConfigFile)) {
          try {
            const content = fs.readFileSync(adminConfigFile, 'utf8');
            const data = JSON.parse(content);
            
            message += `📁 **File:** admin_config.json\n`;
            message += `📏 **Size:** ${(content.length / 1024).toFixed(2)} KB\n\n`;
            
            // Show admin codes
            if (data.admin_codes) {
              message += `👑 **Admin Codes:**\n`;
              for (const [code, adminData] of Object.entries(data.admin_codes)) {
                message += `• **${code}**\n`;
                message += `  Role: ${adminData.role}\n`;
                message += `  Permissions: ${adminData.permissions.join(', ')}\n`;
                message += `  Created: ${new Date(adminData.createdAt).toLocaleString()}\n`;
                message += `  Use count: ${adminData.useCount}\n\n`;
              }
            }
            
            // Show roles
            if (data.admin_roles) {
              message += `🎭 **Roles:**\n`;
              for (const [role, roleData] of Object.entries(data.admin_roles)) {
                message += `• **${role}**\n`;
                message += `  Description: ${roleData.description}\n`;
                message += `  Permissions: ${roleData.permissions.join(', ')}\n\n`;
              }
            }
            
            // Show system settings
            if (data.system_settings) {
              message += `⚙️ **System Settings:**\n`;
              const settings = data.system_settings;
              message += `• Max failed attempts: ${settings.max_failed_auth_attempts}\n`;
              message += `• Auto-unblock hours: ${settings.auto_unblock_hours}\n`;
              message += `• Session timeout: ${settings.session_timeout_hours} hours\n`;
              message += `• Max users per admin: ${settings.max_users_per_admin}`;
            }
            
          } catch (error) {
            message += `❌ **Error reading file:** ${error.message}`;
          }
        } else {
          message += `❌ **File not found:** admin_config.json`;
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN CONFIGFILE command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show admin sessions file content
    if (text.toUpperCase() === 'ADMIN SESSIONSFILE') {
      try {
        let message = `📄 **Admin Sessions File Content**\n\n`;
        
        const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
        
        if (fs.existsSync(adminSessionsFile)) {
          try {
            const content = fs.readFileSync(adminSessionsFile, 'utf8');
            const data = JSON.parse(content);
            
            message += `📁 **File:** admin_sessions.json\n`;
            message += `📏 **Size:** ${(content.length / 1024).toFixed(2)} KB\n`;
            message += `🔑 **Sessions:** ${Object.keys(data).length}\n\n`;
            
            if (Object.keys(data).length > 0) {
              message += `📱 **Session Details:**\n`;
              for (const [sessionJid, sessionData] of Object.entries(data)) {
                const phone = sessionJid.split('@')[0];
                message += `• **${phone}**\n`;
                message += `  Code: ${sessionData.adminCode}\n`;
                message += `  Role: ${sessionData.role}\n`;
                message += `  Permissions: ${sessionData.permissions.join(', ')}\n`;
                if (sessionData.authenticatedAt) {
                  const authTime = new Date(sessionData.authenticatedAt);
                  message += `  Auth Time: ${authTime.toLocaleString()}\n`;
                }
                message += '\n';
              }
            } else {
              message += `📱 **Session Details:** No sessions found`;
            }
          } catch (error) {
            message += `❌ **Error reading file:** ${error.message}`;
          }
        } else {
          message += `❌ **File not found:** admin_sessions.json`;
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN SESSIONSFILE command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Reset admin system completely
    if (text.toUpperCase() === 'ADMIN RESET') {
      try {
        // Clear all admin sessions
        const sessionCount = adminSessions.size;
        adminSessions.clear();
        
        // Delete admin sessions file
        const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
        if (fs.existsSync(adminSessionsFile)) {
          fs.unlinkSync(adminSessionsFile);
        }
        
        // Reload admin manager
        adminManager.adminConfig = adminManager.loadAdminConfig();
        adminManager.codes = adminManager.loadCodes();
        adminManager.sessions = adminManager.loadSessions();
        
        await sock.sendMessage(jid, { 
          text: `🔄 **Admin System Reset**\n\n✅ Cleared ${sessionCount} admin sessions\n✅ Deleted admin sessions file\n✅ Reloaded admin manager\n✅ All admins will need to re-authenticate\n\n💡 Use ADMIN: <code> to authenticate again`
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error resetting admin system:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Error resetting admin system:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show admin system logs
    if (text.toUpperCase() === 'ADMIN LOG') {
      try {
        let message = `📋 **Admin System Logs**\n\n`;
        
        // Show recent admin actions
        message += `🔐 **Recent Admin Actions:**\n`;
        message += `• Admin sessions loaded: ${adminSessions.size}\n`;
        message += `• Admin manager initialized: ✅\n`;
        message += `• Admin config loaded: ${adminManager.adminConfig ? '✅' : '❌'}\n`;
        message += `• User codes loaded: ${Object.keys(adminManager.codes).length}\n`;
        message += `• User sessions loaded: ${Object.keys(adminManager.sessions).length}\n\n`;
        
        // Show admin session details
        if (adminSessions.size > 0) {
          message += `📱 **Active Admin Sessions:**\n`;
          for (const [sessionJid, sessionData] of adminSessions.entries()) {
            const phone = sessionJid.split('@')[0];
            const timeSinceAuth = Math.floor((Date.now() - sessionData.authenticatedAt) / 1000 / 60);
            message += `• ${phone} (${sessionData.adminCode}) - ${timeSinceAuth}m ago\n`;
          }
        } else {
          message += `📱 **Active Admin Sessions:** None\n`;
        }
        
        message += `\n💡 **System Status:** All systems operational`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN LOG command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Run admin system diagnostics
    if (text.toUpperCase() === 'ADMIN DEBUG') {
      try {
        let message = `🔍 **Admin System Diagnostics**\n\n`;
        
        // Test admin manager methods
        message += `🧪 **Method Tests:**\n`;
        
        try {
          const authTest = adminManager.authenticateAdmin('admin123');
          message += `✅ **Authentication Test:** ${authTest.success ? 'PASSED' : 'FAILED'}\n`;
          if (authTest.success) {
            message += `   Role: ${authTest.admin.role}\n`;
            message += `   Permissions: ${authTest.admin.permissions.join(', ')}\n`;
          }
        } catch (error) {
          message += `❌ **Authentication Test:** ERROR - ${error.message}\n`;
        }
        
        try {
          const usersTest = adminManager.listUsers('admin123');
          message += `✅ **List Users Test:** ${usersTest.success ? 'PASSED' : 'FAILED'}\n`;
          if (usersTest.success) {
            message += `   Users found: ${usersTest.users.length}\n`;
          }
        } catch (error) {
          message += `❌ **List Users Test:** ERROR - ${error.message}\n`;
        }
        
        try {
          const statusTest = adminManager.getSystemStatus('admin123');
          message += `✅ **System Status Test:** ${statusTest.success ? 'PASSED' : 'FAILED'}\n`;
          if (statusTest.success) {
            message += `   Total users: ${statusTest.status.totalUsers}\n`;
            message += `   Total codes: ${statusTest.status.totalCodes}\n`;
          }
        } catch (error) {
          message += `❌ **System Status Test:** ERROR - ${error.message}\n`;
        }
        
        message += `\n📊 **System Health:**\n`;
        message += `• Admin Manager: ✅ Loaded\n`;
        message += `• Admin Config: ${adminManager.adminConfig ? '✅' : '❌'}\n`;
        message += `• User Codes: ${adminManager.codes ? '✅' : '❌'}\n`;
        message += `• User Sessions: ${adminManager.sessions ? '✅' : '❌'}\n`;
        message += `• Admin Sessions Map: ${adminSessions ? '✅' : '❌'}\n`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN DEBUG command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Check admin system files
    if (text.toUpperCase() === 'ADMIN FILES') {
      try {
        let message = `📁 **Admin System Files**\n\n`;
        
        const files = [
          { name: 'admin_config.json', path: path.join(__dirname, 'admin_config.json') },
          { name: 'codes.json', path: path.join(__dirname, 'codes.json') },
          { name: 'sessions.json', path: path.join(__dirname, 'sessions.json') },
          { name: 'admin_sessions.json', path: path.join(__dirname, 'admin_sessions.json') }
        ];
        
        for (const file of files) {
          const exists = fs.existsSync(file.path);
          const status = exists ? '✅' : '❌';
          message += `${status} **${file.name}**\n`;
          
          if (exists) {
            try {
              const stats = fs.statSync(file.path);
              const size = (stats.size / 1024).toFixed(2);
              message += `   📏 Size: ${size} KB\n`;
              message += `   📅 Modified: ${stats.mtime.toLocaleString()}\n`;
              
              // Try to read and parse the file
              const content = fs.readFileSync(file.path, 'utf8');
              const data = JSON.parse(content);
              const keys = Object.keys(data);
              message += `   🔑 Keys: ${keys.join(', ')}\n`;
            } catch (error) {
              message += `   ⚠️ Error reading: ${error.message}\n`;
            }
          }
          message += '\n';
        }
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN FILES command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show all user sessions
    if (text.toUpperCase() === 'ADMIN USERSESSIONS') {
      try {
        let message = `📱 **User Sessions**\n\n`;
        
        const userSessions = Object.keys(adminManager.sessions);
        if (userSessions.length === 0) {
          message += `No user sessions found.`;
        } else {
          for (const [index, sessionJid] of userSessions.entries()) {
            const sessionData = adminManager.sessions[sessionJid];
            const phone = sessionJid.split('@')[0];
            message += `${index + 1}. **${phone}**\n`;
            message += `   📅 Created: ${new Date(sessionData.meta?.createdAt || Date.now()).toLocaleString()}\n`;
            message += `   🔐 Authenticated: ${sessionData.apiKeys ? '✅ Yes' : '❌ No'}\n`;
            message += `   📊 Status: ${sessionData.status || 'unknown'}\n`;
            message += `   🎯 Current Step: ${sessionData.currentStep || 'unknown'}\n`;
            message += `   🔒 Blocked: ${sessionData.security?.isBlocked ? '🚫 Yes' : '✅ No'}\n`;
            if (sessionData.security?.failedAuthAttempts > 0) {
              message += `   ⚠️ Failed attempts: ${sessionData.security.failedAuthAttempts}/5\n`;
            }
            if (sessionData.meta?.totalJobs > 0) {
              message += `   📈 Total jobs: ${sessionData.meta.totalJobs}\n`;
            }
            message += '\n';
          }
        }
        
        message += `**Total User Sessions:** ${userSessions.length}`;
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN USERSESSIONS command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show all user codes
    if (text.toUpperCase() === 'ADMIN CODES') {
      try {
        let message = `🔑 **User Codes**\n\n`;
        
        const userCodes = Object.keys(adminManager.codes);
        if (userCodes.length === 0) {
          message += `No user codes found.`;
        } else {
          for (const [index, userCode] of userCodes.entries()) {
            const userData = adminManager.codes[userCode];
            message += `${index + 1}. **${userCode}**\n`;
            message += `   📅 Created: ${new Date(userData.createdAt).toLocaleString()}\n`;
            message += `   🔑 Google Keys: ${userData.apiKeys.googleSearchKeys.length} keys\n`;
            message += `   🤖 Gemini Keys: ${userData.apiKeys.geminiKeys.length} keys\n`;
            if (userData.meta?.issuedBy) {
              message += `   👤 Issued by: ${userData.meta.issuedBy}\n`;
            }
            if (userData.meta?.useCount) {
              message += `   📊 Use count: ${userData.meta.useCount}\n`;
            }
            if (userData.meta?.lastUsed) {
              message += `   ⏰ Last used: ${new Date(userData.meta.lastUsed).toLocaleString()}\n`;
            }
            message += '\n';
          }
        }
        
        message += `**Total User Codes:** ${userCodes.length}`;
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN CODES command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show admin configuration details
    if (text.toUpperCase() === 'ADMIN CONFIG') {
      try {
        let message = `⚙️ **Admin Configuration**\n\n`;
        
        // Show admin codes
        message += `👑 **Admin Codes:**\n`;
        for (const [code, adminData] of Object.entries(adminManager.adminConfig.admin_codes)) {
          message += `• **${code}** - ${adminData.role}\n`;
          message += `  Permissions: ${adminData.permissions.join(', ')}\n`;
          message += `  Created: ${new Date(adminData.createdAt).toLocaleString()}\n`;
          message += `  Use count: ${adminData.useCount}\n\n`;
        }
        
        // Show roles
        message += `🎭 **Roles:**\n`;
        for (const [role, roleData] of Object.entries(adminManager.adminConfig.admin_roles)) {
          message += `• **${role}** - ${roleData.description}\n`;
          message += `  Permissions: ${roleData.permissions.join(', ')}\n\n`;
        }
        
        // Show system settings
        message += `⚙️ **System Settings:**\n`;
        const settings = adminManager.adminConfig.system_settings;
        message += `• Max failed attempts: ${settings.max_failed_auth_attempts}\n`;
        message += `• Auto-unblock hours: ${settings.auto_unblock_hours}\n`;
        message += `• Session timeout: ${settings.session_timeout_hours} hours\n`;
        message += `• Max users per admin: ${settings.max_users_per_admin}`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN CONFIG command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Reload admin manager completely
    if (text.toUpperCase() === 'ADMIN RELOAD') {
      try {
        // Create a new admin manager instance
        const newAdminManager = new AdminManager();
        
        // Replace the old one
        Object.assign(adminManager, newAdminManager);
        
        // Reload admin sessions from disk
        loadAdminSessions();
        
        await sock.sendMessage(jid, { 
          text: `🔄 **Admin Manager Reloaded**\n\n✅ Admin manager recreated\n✅ All data reloaded from disk\n✅ Admin sessions refreshed\n\n📊 Current admin sessions: ${adminSessions.size}`
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error reloading admin manager:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Error reloading admin manager:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Test admin permissions
    if (text.toUpperCase() === 'ADMIN TEST') {
      try {
        let message = `🧪 **Admin Permission Test**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Code:** ${adminSession.adminCode}\n\n`;
        
        message += `🔍 **Permission Tests:**\n`;
        
        // Test each permission
        const permissions = adminSession.permissions;
        const allPermissions = [
          'view_sessions', 'view_all_sessions', 'manage_users', 
          'manage_admins', 'view_logs', 'system_control'
        ];
        
        for (const permission of allPermissions) {
          const hasPermission = permissions.includes(permission);
          const status = hasPermission ? '✅' : '❌';
          message += `${status} **${permission}**\n`;
        }
        
        message += `\n📊 **Test Results:**\n`;
        message += `• Total Permissions: ${permissions.length}\n`;
        message += `• Can view users: ${permissions.includes('view_sessions') || permissions.includes('view_all_sessions') ? '✅' : '❌'}\n`;
        message += `• Can manage users: ${permissions.includes('manage_users') ? '✅' : '❌'}\n`;
        message += `• Can manage admins: ${permissions.includes('manage_admins') ? '✅' : '❌'}\n`;
        message += `• Can view system: ${permissions.includes('system_control') ? '✅' : '❌'}\n`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN TEST command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show system information
    if (text.toUpperCase() === 'ADMIN INFO') {
      try {
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        
        let message = `🤖 **System Information**\n\n`;
        message += `📱 **Bot Version:** WhatsApp Business Scraper v2.0\n`;
        message += `⏰ **Uptime:** ${hours}h ${minutes}m ${seconds}s\n`;
        message += `🔧 **Node.js:** ${process.version}\n`;
        message += `💾 **Platform:** ${process.platform}\n`;
        message += `📊 **Memory:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n\n`;
        
        message += `📁 **Files:**\n`;
        message += `• Admin Config: ${fs.existsSync(path.join(__dirname, 'admin_config.json')) ? '✅' : '❌'}\n`;
        message += `• User Codes: ${fs.existsSync(path.join(__dirname, 'codes.json')) ? '✅' : '❌'}\n`;
        message += `• User Sessions: ${fs.existsSync(path.join(__dirname, 'sessions.json')) ? '✅' : '❌'}\n`;
        message += `• Admin Sessions: ${fs.existsSync(path.join(__dirname, 'admin_sessions.json')) ? '✅' : '❌'}\n\n`;
        
        message += `👥 **Current Status:**\n`;
        message += `• Admin Sessions: ${adminSessions.size}\n`;
        message += `• User Codes: ${Object.keys(adminManager.codes).length}\n`;
        message += `• User Sessions: ${Object.keys(adminManager.sessions).length}`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN INFO command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show current admin session details
    if (text.toUpperCase() === 'ADMIN ME') {
      try {
        const timeSinceAuth = Math.floor((Date.now() - adminSession.authenticatedAt) / 1000 / 60);
        let message = `🔐 **Your Admin Session**\n\n`;
        message += `👑 **Role:** ${adminSession.role}\n`;
        message += `🔑 **Admin Code:** ${adminSession.adminCode}\n`;
        message += `📱 **Phone:** ${jid.split('@')[0]}\n`;
        message += `⏰ **Authenticated:** ${timeSinceAuth} minutes ago\n`;
        message += `🔑 **Permissions:** ${adminSession.permissions.join(', ')}\n\n`;
        
        // Show role description
        const roleInfo = adminManager.adminConfig.admin_roles[adminSession.role];
        if (roleInfo) {
          message += `📝 **Role Description:** ${roleInfo.description}\n\n`;
        }
        
        message += `💡 **Available Commands:**\n`;
        message += `• ADMIN USERS - List all users\n`;
        message += `• ADMIN STATUS - System status\n`;
        message += `• ADMIN HELP - Show all commands`;
        
        await sock.sendMessage(jid, { text: message });
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN ME command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Re-authenticate with admin code
    if (text.toUpperCase().startsWith('ADMIN AUTH ')) {
      try {
        const adminCode = text.replace(/^ADMIN AUTH\s+/i, '').trim();
        
        if (!adminCode) {
          await sock.sendMessage(jid, { 
            text: `❌ **Usage:** ADMIN AUTH <admin_code>\n\n💡 **Example:** ADMIN AUTH admin123`
          });
          return;
        }

        const authResult = adminManager.authenticateAdmin(adminCode);
        
        if (authResult.success) {
          // Update existing admin session
          adminSessions.set(jid, {
            adminCode: adminCode,
            role: authResult.admin.role,
            permissions: authResult.admin.permissions,
            authenticatedAt: new Date()
          });

          // Save admin sessions to disk
          saveAdminSessions();

          await sock.sendMessage(jid, { 
            text: `🔐 **Admin Re-authentication Successful!**\n\n👑 **Role:** ${authResult.admin.role}\n📝 **Description:** ${authResult.admin.roleDescription}\n🔑 **Permissions:** ${authResult.admin.permissions.join(', ')}\n\n✅ Your admin session has been refreshed.`
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ **Admin Re-authentication Failed**\n\n${authResult.error}\n\n💡 Please check your admin code and try again.`
          });
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN AUTH command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
              return;
      }

      // Admin command: Logout from admin session
      if (text.toUpperCase() === 'ADMIN LOGOUT') {
        try {
          const adminCode = adminSessions.get(jid)?.adminCode;
          adminSessions.delete(jid);
          saveAdminSessions();
          
          await sock.sendMessage(jid, { 
            text: `🔓 **Admin Logout Successful!**\n\n✅ You have been logged out of your admin session.\n\n💡 **To log back in:**\n• Send ADMIN: <admin_code> to authenticate again\n• Example: ADMIN: admin123\n\n💡 **To use as regular user:**\n• Send CODE: <user_code> to start a user session\n• Example: CODE: user1`
          });
          
          console.log(chalk.yellow(`🔓 Admin ${jid.split('@')[0]} logged out (was using code: ${adminCode})`));
        } catch (error) {
          console.error(chalk.red(`❌ Error in admin logout:`, error.message));
          await sock.sendMessage(jid, { 
            text: `❌ **Error during logout:** ${error.message}` 
          });
        }
        return;
      }

      // Admin command: Clear all admin sessions (debug)
    if (text.toUpperCase() === 'ADMIN CLEAR') {
      try {
        const sessionCount = adminSessions.size;
        adminSessions.clear();
        saveAdminSessions();
        
        await sock.sendMessage(jid, { 
          text: `🧹 **Admin Sessions Cleared**\n\n✅ Cleared ${sessionCount} admin sessions\n✅ All admins will need to re-authenticate\n\n💡 Use ADMIN REFRESH to reload data from disk`
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error clearing admin sessions:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Error clearing admin sessions:** ${error.message}` 
        });
      }
      return;
    }

    // If admin session exists but no command matched, show available commands
    if (!text.toUpperCase().startsWith('ADMIN ')) {
      await sock.sendMessage(jid, { 
        text: `🔐 **Admin Session Active**\n\n💡 Type **ADMIN HELP** to see available commands.\n\n💡 Type **ADMIN USERS** to list all users.\n\n💡 Type **ADMIN STATUS** to view system status.\n\n💡 Type **ADMIN LOGOUT** to switch to user mode.`
      });
      return;
    }

    // If admin session exists and text starts with ADMIN but no specific command matched, show error
    if (text.toUpperCase().startsWith('ADMIN ')) {
      const command = text.toUpperCase().trim();
      
      // Check if it's a valid admin command
      const validCommands = [
        'ADMIN USERS', 'ADMIN ADD USER', 'ADMIN REMOVE USER', 'ADMIN ADMINS', 
        'ADMIN ADD ADMIN', 'ADMIN REMOVE ADMIN', 'ADMIN STATUS', 'ADMIN HELP',
        'ADMIN SESSIONS', 'ADMIN REFRESH', 'ADMIN ADMINSESSIONSFILE', 
        'ADMIN USERSESSIONSFILE', 'ADMIN FILES', 'ADMIN DEBUG', 'ADMIN LOG',
        'ADMIN SESSIONSFILE', 'ADMIN RESET', 'ADMIN CONFIGFILE', 'ADMIN CODESFILE',
        'ADMIN CLEAR', 'ADMIN AUTH', 'ADMIN LOGOUT', 'ADMIN ME', 'ADMIN INFO', 'ADMIN TEST',
        'ADMIN RELOAD', 'ADMIN CONFIG', 'ADMIN CODES', 'ADMIN SESSIONS'
      ];

      let isValidCommand = false;
      for (const validCmd of validCommands) {
        if (command.startsWith(validCmd)) {
          isValidCommand = true;
          break;
        }
      }

      if (!isValidCommand) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid Admin Command!**\n\n⚠️ The command "${text}" is not recognized.\n\n💡 **Available Commands:**\n• ADMIN USERS - List all users\n• ADMIN ADD USER <code> <google_key1> <google_key2> <gemini_key1> <gemini_key2>\n• ADMIN REMOVE USER <code>\n• ADMIN ADMINS - List all admins\n• ADMIN STATUS - System status\n• ADMIN HELP - Show detailed help\n• ADMIN LOGOUT - Switch to user mode\n\n🔄 **Try again with a valid command!**`
        });
        return;
      }
    }
  } else {
     // Debug: Show why admin commands aren't working
     if (text.toUpperCase().startsWith('ADMIN ')) {
       console.log(chalk.yellow(`⚠️ Admin command "${text}" from ${jid.split('@')[0]} but no admin session found`));
       console.log(chalk.blue(`📊 Current admin sessions:`, Array.from(adminSessions.keys()).map(k => k.split('@')[0])));
     }
   }

   // STRICT AUTHENTICATION: No responses until CODE is provided (for regular users)
  if (!session.apiKeys && !/^CODE:?\s+/i.test(text)) {
    // SILENT IGNORE: Don't respond to any messages until authentication
    console.log(chalk.yellow(`🔒 Unauthorized message from ${jid.split('@')[0]}: "${shortText}" - Ignoring silently`));
    return; // Exit without any response
  }

  // Check if user is blocked due to too many failed attempts
  if (session.security && session.security.isBlocked) {
    // Check if 24 hours have passed since blocking (auto-unblock)
    if (session.security.blockedAt) {
      const blockedTime = new Date(session.security.blockedAt);
      const now = new Date();
      const hoursSinceBlocked = (now - blockedTime) / (1000 * 60 * 60);
      
      if (hoursSinceBlocked >= 24) {
        // Auto-unblock after 24 hours
        session.security.isBlocked = false;
        session.security.failedAuthAttempts = 0;
        session.security.lastFailedAttempt = null;
        session.security.blockedAt = null;
        
        console.log(chalk.green(`🔓 User ${jid.split('@')[0]} auto-unblocked after 24 hours`));
        
        // Save the updated session
        sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);
        
        // Send notification to user
        await sock.sendMessage(jid, { 
          text: `🔓 **Account Auto-Unblocked**\n\nYour account has been automatically unblocked after 24 hours. You can now authenticate again using your access code.`
        });
        
        // Continue with normal message processing
      } else {
        // Still blocked, ignore message
        console.log(chalk.red(`🚫 Blocked user ${jid.split('@')[0]} attempted to send message: "${shortText}" (${Math.floor(24 - hoursSinceBlocked)} hours until auto-unblock)`));
        return; // Exit without any response
      }
    } else {
      // No blocked timestamp, ignore message
      console.log(chalk.red(`🚫 Blocked user ${jid.split('@')[0]} attempted to send message: "${shortText}"`));
      return; // Exit without any response
    }
  }

  try {
    // Handle language selection first for new users (only if authenticated)
    if (session.currentStep === 'awaiting_language' && session.apiKeys) {
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

        // Log security attempt
        console.log(chalk.red(`🚨 Invalid access code attempt from ${jid.split('@')[0]}: "${code}"`));
        
        // Track failed attempts
        if (!session.security) {
          session.security = { failedAuthAttempts: 0, lastFailedAttempt: null, isBlocked: false };
        }
        
        session.security.failedAuthAttempts += 1;
        session.security.lastFailedAttempt = new Date().toISOString();
        
        // Block user after 5 failed attempts
        if (session.security.failedAuthAttempts >= 5) {
          session.security.isBlocked = true;
          session.security.blockedAt = new Date().toISOString();
          console.log(chalk.red(`🚫 User ${jid.split('@')[0]} blocked due to 5 failed authentication attempts`));
          
          await sock.sendMessage(jid, { 
            text: `🚫 **Account Blocked**\n\nYou have been blocked due to multiple failed authentication attempts. Please contact an administrator to regain access.`
          });
          
          saveJson(SESSIONS_FILE, sessions);
          return;
        }
        
        // Save updated security info
        saveJson(SESSIONS_FILE, sessions);
        
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'invalid_code')
        });
        return;
      }

      // Update usage statistics
      codesDb[code].meta.lastUsed = new Date().toISOString();
      codesDb[code].meta.useCount = (codesDb[code].meta.useCount || 0) + 1;
      saveJson(CODES_FILE, codesDb);


      // Log successful authentication
      console.log(chalk.green(`🔓 Access granted to ${jid.split('@')[0]} with code: ${code}`));

      // Reset security counters on successful authentication
      if (session.security) {
        session.security.failedAuthAttempts = 0;
        session.security.lastFailedAttempt = null;
        session.security.isBlocked = false;
        session.security.blockedAt = null;
      }

      // Assign API keys to session
      session.code = code;
      session.apiKeys = codesDb[code].apiKeys;
      sessions[jid] = session;
      saveJson(SESSIONS_FILE, sessions);


      // Send welcome message first (since this is their first interaction after authentication)
      await sock.sendMessage(jid, { 
        text: getMessage('en', 'welcome') // Always use English for welcome
      });
      
      // Then send access granted message
      await sock.sendMessage(jid, { 
        text: getMessage(session.language, 'access_granted', {
          source: session.prefs.source,
          format: session.prefs.format,
          limit: session.prefs.limit
        })
      });
      
      // Send logout information
      await sock.sendMessage(jid, { 
        text: `💡 **Tip:** You can logout anytime by sending **LOGOUT** to switch accounts or become admin.`
      });
      
      session.currentStep = 'awaiting_niche';
      session.previousMessage = null;
      saveJson(SESSIONS_FILE, sessions);
      return;
    }

    // User command: Logout from user session
    if (text.toUpperCase() === 'LOGOUT' && session.apiKeys) {
      try {
        const userCode = session.code;
        const phoneNumber = jid.split('@')[0];
        
        // Clear the user session
        delete sessions[jid];
        saveJson(SESSIONS_FILE, sessions);
        
        await sock.sendMessage(jid, { 
          text: `🔓 **User Logout Successful!**\n\n✅ You have been logged out of your user session.\n\n💡 **To log back in:**\n• Send CODE: <user_code> to start a new user session\n• Example: CODE: user1\n\n💡 **To become admin:**\n• Send ADMIN: <admin_code> to start an admin session\n• Example: ADMIN: admin123\n\n💡 **Available accounts:**\n• User codes: ${Object.keys(codesDb).join(', ')}\n• Admin codes: ${Object.keys(adminManager.admins).join(', ')}`
        });
        
        console.log(chalk.yellow(`🔓 User ${phoneNumber} logged out (was using code: ${userCode})`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in user logout:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Error during logout:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: UNBLOCK (only works for users with valid codes)
    if (text.toUpperCase().startsWith('ADMIN: UNBLOCK') && session.apiKeys) {
      const targetJid = text.replace(/^ADMIN:\s*UNBLOCK\s+/i, '').trim();
      
      if (!targetJid) {
        await sock.sendMessage(jid, { 
          text: `❌ **Admin Command Error**\n\nUsage: ADMIN: UNBLOCK <phone_number>\nExample: ADMIN: UNBLOCK 1234567890`
        });
        return;
      }

      // Find the target user's session
      const targetSession = sessions[targetJid + '@s.whatsapp.net'] || sessions[targetJid + '@c.us'];
      
      if (!targetSession) {
        await sock.sendMessage(jid, { 
          text: `❌ **User Not Found**\n\nNo session found for: ${targetJid}`
        });
        return;
      }

      if (!targetSession.security || !targetSession.security.isBlocked) {
        await sock.sendMessage(jid, { 
          text: `ℹ️ **User Status**\n\nUser ${targetJid} is not currently blocked.`
        });
        return;
      }

      // Unblock the user
      targetSession.security.isBlocked = false;
      targetSession.security.failedAuthAttempts = 0;
      targetSession.security.lastFailedAttempt = null;
      targetSession.security.blockedAt = null;
      
      sessions[targetJid + '@s.whatsapp.net'] = targetSession;
        saveJson(SESSIONS_FILE, sessions);

      
      console.log(chalk.green(`🔓 Admin ${jid.split('@')[0]} unblocked user ${targetJid}`));
        
        await sock.sendMessage(jid, { 

        text: `✅ **User Unblocked**\n\nUser ${targetJid} has been unblocked and can now authenticate again.`
      });
      
      // Notify the unblocked user
      try {
        await sock.sendMessage(targetJid + '@s.whatsapp.net', { 
          text: `🔓 **Account Unblocked**\n\nYour account has been unblocked by an administrator. You can now authenticate again using your access code.`
        });
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Could not notify unblocked user ${targetJid}: ${error.message}`));
      }
      
        return;
      }
      

    // Admin command: SECURITY STATUS (only works for users with valid codes)
    if (text.toUpperCase().startsWith('ADMIN: STATUS') && session.apiKeys) {
      const targetJid = text.replace(/^ADMIN:\s*STATUS\s+/i, '').trim();
      
      if (!targetJid) {
      await sock.sendMessage(jid, { 

          text: `❌ **Admin Command Error**\n\nUsage: ADMIN: STATUS <phone_number>\nExample: ADMIN: STATUS 1234567890`
        });
        return;
      }

      // Find the target user's session
      const targetSession = sessions[targetJid + '@s.whatsapp.net'] || sessions[targetJid + '@c.us'];
      
      if (!targetSession) {
        await sock.sendMessage(jid, { 
          text: `❌ **User Not Found**\n\nNo session found for: ${targetJid}`
        });
        return;
      }

      const security = targetSession.security || {};
      const status = security.isBlocked ? '🚫 BLOCKED' : '✅ ACTIVE';
      const failedAttempts = security.failedAuthAttempts || 0;
      const lastFailed = security.lastFailedAttempt ? new Date(security.lastFailedAttempt).toLocaleString() : 'Never';
      const blockedAt = security.blockedAt ? new Date(security.blockedAt).toLocaleString() : 'N/A';
      const isAuthenticated = !!targetSession.apiKeys;

      const statusMessage = `🔒 **Security Status for ${targetJid}**\n\n` +
        `Status: ${status}\n` +
        `Authenticated: ${isAuthenticated ? '✅ Yes' : '❌ No'}\n` +
        `Failed Auth Attempts: ${failedAttempts}/5\n` +
        `Last Failed Attempt: ${lastFailed}\n` +
        `Blocked At: ${blockedAt}\n` +
        `Session Created: ${new Date(targetSession.meta?.createdAt || Date.now()).toLocaleString()}`;

      await sock.sendMessage(jid, { text: statusMessage });
      return;
    }

    // Admin command: HELP (only works for users with valid codes)
    if (text.toUpperCase() === 'ADMIN: HELP' && session.apiKeys) {
      const helpMessage = `🔐 **Admin Commands**\n\n` +
        `**ADMIN: HELP** - Show this help message\n` +
        `**ADMIN: STATUS <phone>** - Check user security status\n` +
        `**ADMIN: UNBLOCK <phone>** - Unblock a blocked user\n` +
        `**ADMIN: LOG** - Show security log with all issues\n\n` +
        `**Examples:**\n` +
        `• ADMIN: STATUS 1234567890\n` +
        `• ADMIN: UNBLOCK 1234567890\n` +
        `• ADMIN: LOG\n\n` +
        `**Note:** These commands only work for authenticated users.`;

      await sock.sendMessage(jid, { text: helpMessage });
      return;
    }

         // Admin command: SECURITY LOG (only works for users with valid codes)
     if (text.toUpperCase() === 'ADMIN: LOG' && session.apiKeys) {
       // Get all sessions and find security issues
       const securityIssues = [];
       
       for (const [sessionJid, sessionData] of Object.entries(sessions)) {
         if (sessionData.security) {
           const security = sessionData.security;
           if (security.isBlocked || security.failedAuthAttempts > 0) {
             const phone = sessionJid.split('@')[0];
             const status = security.isBlocked ? '🚫 BLOCKED' : '⚠️ WARNING';
             const attempts = security.failedAuthAttempts;
             const lastFailed = security.lastFailedAttempt ? new Date(security.lastFailedAttempt).toLocaleString() : 'Never';
             const blockedAt = security.blockedAt ? new Date(security.blockedAt).toLocaleString() : 'N/A';
             
             securityIssues.push({
               phone,
               status,
               attempts,
               lastFailed,
               blockedAt,
               createdAt: sessionData.meta?.createdAt ? new Date(sessionData.meta.createdAt).toLocaleString() : 'Unknown'
             });
           }
         }
       }
       
       if (securityIssues.length === 0) {
         await sock.sendMessage(jid, { 
           text: `✅ **Security Status: All Clear**\n\nNo security issues detected. All users are secure.`
         });
         return;
       }
       
       // Sort by severity (blocked first, then by failed attempts)
       securityIssues.sort((a, b) => {
         if (a.status.includes('BLOCKED') && !b.status.includes('BLOCKED')) return -1;
         if (!a.status.includes('BLOCKED') && b.status.includes('BLOCKED')) return 1;
         return b.attempts - a.attempts;
       });
       
       let logMessage = `🔒 **Security Log**\n\n`;
       
       for (const issue of securityIssues) {
         logMessage += `${issue.status} **${issue.phone}**\n` +
           `Failed Attempts: ${issue.attempts}/5\n` +
           `Last Failed: ${issue.lastFailed}\n` +
           `Blocked At: ${issue.blockedAt}\n` +
           `Created: ${issue.createdAt}\n\n`;
       }
       
       logMessage += `**Total Issues:** ${securityIssues.length}`;
       
       await sock.sendMessage(jid, { text: logMessage });
       return;
     }



    // Handle incoming messages based on conversation step
    const inputNumber = parseInt(text);

    // Authentication is already checked at the beginning of the function
    // All messages reaching this point are from authenticated users

    // Handle language reset option (works for authenticated users)
    if (text === '0' && session.currentStep !== 'awaiting_language') {
      session.currentStep = 'awaiting_language';
      session.language = 'en'; // Reset to default
      saveJson(SESSIONS_FILE, sessions);
      
      await sock.sendMessage(jid, { 
        text: getMessage('en', 'welcome') // Always use English for welcome
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
                        },
                        
                        // ✅ CRITICAL FIX: Add onError callback to catch internal scraper errors
                        onError: async (error) => {
                            console.error(chalk.red(`🚨 Internal scraper error caught: ${error.message}`));
                            
                            // Stop the progress simulator immediately
                            const jobStatus = activeJobs.get(jid);
                            if (jobStatus && jobStatus.progressSimulator) {
                                console.log(chalk.yellow(`🛑 Stopping progress simulator due to internal error: ${jid}`));
                                jobStatus.progressSimulator.complete();
                            }
                            
                            // Send error message to user
                            let errorMessage = '';
                            
                            if (error.message.includes('Request failed with status code 400')) {
                                errorMessage = `🚨 **API Key Validation Failed!**\n\n` +
                                    `❌ **Your API keys are invalid or have expired.**\n\n` +
                                    `💡 **Solutions:**\n` +
                                    `• Contact admin to update your API keys\n` +
                                    `• Ensure your Google Search and Gemini AI keys are valid\n` +
                                    `• Check if your API keys have exceeded daily quotas\n\n` +
                                    `🛑 **Scraping stopped - invalid API configuration.**`;
                            } else if (error.message.includes('No main queries generated')) {
                                errorMessage = `🚨 **AI Query Generation Failed!**\n\n` +
                                    `❌ **The AI system could not generate search queries.**\n\n` +
                                    `💡 **Possible causes:**\n` +
                                    `• Invalid Gemini API key\n` +
                                    `• API quota exceeded\n` +
                                    `• Network connectivity issues\n\n` +
                                    `🛑 **Scraping stopped - AI system unavailable.**`;
                            } else {
                                errorMessage = `🚨 **Scraping Error!**\n\n` +
                                    `❌ **An error occurred during scraping:** ${error.message}\n\n` +
                                    `💡 **Solutions:**\n` +
                                    `• Try again with a different search term\n` +
                                    `• Contact support if the issue persists\n\n` +
                                    `🛑 **Scraping stopped due to error.**`;
                            }
                            
                            try {
                                await sock.sendMessage(jid, { text: errorMessage });
                            } catch (sendError) {
                                console.error('Failed to send error message to user:', sendError.message);
                            }
                            
                            // Clean up the job
                            activeJobs.delete(jid);
                            session.status = 'idle';
                            session.currentStep = 'awaiting_niche';
                            sessions[jid] = session;
                            saveJson(SESSIONS_FILE, sessions);
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
                
                // ✅ CRITICAL FIX: Stop progress simulator before cleanup
                const activeJob = activeJobs.get(jid);
                if (activeJob && activeJob.progressSimulator) {
                    console.log(chalk.yellow(`🛑 Stopping progress simulator for failed job: ${jid}`));
                    // Stop the progress simulator without sending completion message
                    activeJob.progressSimulator.stop();
                }
                
                // Clean up
                activeJobs.delete(jid);
                session.status = 'idle';
                session.currentStep = 'awaiting_niche'; // Reset step on error
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);

                // ✅ ENHANCED: Handle specific API key and quota errors
                let errorMessage = '';
                
                if (error.message.includes('aborted')) {
                    errorMessage = '🛑 **Job was cancelled.** You can send a new search query when ready.';
                } else if (error.message.includes('ALL_USER_API_KEYS_QUOTA_EXCEEDED')) {
                    errorMessage = `🚨 **Daily Quota Exceeded!**\n\n` +
                        `❌ **All your Google Search API keys have exceeded their daily quota.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Wait until tomorrow when quotas reset\n` +
                        `• Add more Google Search API keys\n` +
                        `• Contact admin to add more keys to your account\n\n` +
                        `🛑 **Scraping stopped - no more API access available.**`;
                        
                } else if (error.message.includes('GEMINI_API_QUOTA_EXCEEDED')) {
                    errorMessage = `🚨 **Gemini AI Quota Exceeded!**\n\n` +
                        `❌ **Your Gemini AI API key has exceeded its daily quota.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Wait until tomorrow when quota resets\n` +
                        `• Add more Gemini AI API keys\n` +
                        `• Contact admin to add more keys to your account\n\n` +
                        `🛑 **Scraping stopped - no AI query generation available.**`;
                        
                } else if (error.message.includes('GEMINI_API_RATE_LIMITED')) {
                    errorMessage = `🚨 **Gemini AI Rate Limited!**\n\n` +
                        `❌ **Your Gemini AI API key has hit rate limits.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Wait a few minutes before trying again\n` +
                        `• Add more Gemini AI API keys\n` +
                        `• Contact admin to add more keys to your account\n\n` +
                        `🛑 **Scraping stopped - rate limit exceeded.**`;
                        
                } else if (error.message.includes('GEMINI_API_INVALID_KEY')) {
                    errorMessage = `🚨 **Invalid Gemini AI API Key!**\n\n` +
                        `❌ **The Gemini AI API key in your account is invalid.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Contact admin to update your Gemini API key\n` +
                        `• Ensure your API key is valid and active\n\n` +
                        `🛑 **Scraping stopped - invalid API key.**`;
                        
                } else if (error.message.includes('ALL_USER_API_KEYS_EXHAUSTED')) {
                    errorMessage = `🚨 **All API Keys Exhausted!**\n\n` +
                        `❌ **All your API keys have been exhausted.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Wait until tomorrow when quotas reset\n` +
                        `• Add more API keys\n` +
                        `• Contact admin to add more keys to your account\n\n` +
                        `🛑 **Scraping stopped - no more API access available.**`;
                        
                } else if (error.message.includes('No Google Search API keys configured') || 
                           error.message.includes('No Gemini API key configured')) {
                    errorMessage = `🚨 **Missing API Keys!**\n\n` +
                        `❌ **Your account is missing required API keys.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Contact admin to add API keys to your account\n` +
                        `• Ensure you have both Google Search and Gemini AI keys\n\n` +
                        `🛑 **Scraping stopped - missing API configuration.**`;
                        
                } else if (error.message.includes('Request failed with status code 400')) {
                    errorMessage = `🚨 **API Key Validation Failed!**\n\n` +
                        `❌ **Your API keys are invalid or have expired.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Contact admin to update your API keys\n` +
                        `• Ensure your Google Search and Gemini AI keys are valid\n` +
                        `• Check if your API keys have exceeded daily quotas\n\n` +
                        `🛑 **Scraping stopped - invalid API configuration.**`;
                        
                } else if (error.message.includes('No main queries generated')) {
                    errorMessage = `🚨 **AI Query Generation Failed!**\n\n` +
                        `❌ **The AI system could not generate search queries.**\n\n` +
                        `💡 **Possible causes:**\n` +
                        `• Invalid Gemini API key\n` +
                        `• API quota exceeded\n` +
                        `• Network connectivity issues\n\n` +
                        `🛑 **Scraping stopped - AI system unavailable.**`;
                        
                } else if (error.message.includes('Maps scraper exited with code 1')) {
                    errorMessage = `🚨 **Daily Request Limit Reached!**\n\n` +
                        `❌ **Your API keys have exceeded their daily quota or are invalid.**\n\n` +
                        `💡 **What happened:**\n` +
                        `• The AI system could not generate search queries\n` +
                        `• This usually means your Gemini API key is invalid or quota exceeded\n` +
                        `• Or your Google Search API keys have reached daily limits\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Wait until tomorrow when quotas reset\n` +
                        `• Contact admin to update your API keys\n` +
                        `• Add more valid API keys to your account\n\n` +
                        `🛑 **Scraping stopped - no more API access available today.**`;
                        
                } else if (error.message.includes('exited with code 1') && 
                           (error.message.includes('Gemini API key not configured') || 
                            error.message.includes('GEMINI_API_ERROR'))) {
                    errorMessage = `🚨 **API Key Validation Failed!**\n\n` +
                        `❌ **Your API keys are invalid or have expired.**\n\n` +
                        `💡 **Solutions:**\n` +
                        `• Contact admin to update your API keys\n` +
                        `• Ensure your Google Search and Gemini AI keys are valid\n` +
                        `• Check if your API keys have exceeded daily quotas\n\n` +
                        `🛑 **Scraping stopped - invalid API configuration.**`;
                        
                } else {
                    // Generic error handling
                    errorMessage = `❌ **Error occurred:** ${error.message}\n\n` +
                        `💡 Please try again with a different niche or contact support if the issue persists.`;
                }

                // Send error message to user
                await sock.sendMessage(jid, { text: errorMessage });
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

        // Only allow STOP and STATUS commands during scraping
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

            // Only respond if user is authenticated
            if (session.apiKeys) {
            await sock.sendMessage(jid, { 
                text: '⏳ A scraping job is currently in progress. You can type STATUS to check its progress or STOP to cancel it.'
            });

            }
            return;
        }
    }

    // Existing general commands (STATUS, STOP, RESET, HELP, LIMIT) - re-evaluate their placement
    // These commands should ideally work regardless of step, but interact differently.
    // The step-specific handling above should take precedence.
    
    if (/^STATUS$/i.test(text)) {

      // Only allow STATUS command for authenticated users
      if (!session.apiKeys) {
        console.log(chalk.yellow(`🔒 Unauthorized STATUS command from ${jid.split('@')[0]} - Ignoring silently`));
        return;
      }
      
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

      // Only allow STOP command for authenticated users
      if (!session.apiKeys) {
        console.log(chalk.yellow(`🔒 Unauthorized STOP command from ${jid.split('@')[0]} - Ignoring silently`));
        return;
      }
      
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

      // Only allow RESET command for authenticated users
      if (!session.apiKeys) {
        console.log(chalk.yellow(`🔒 Unauthorized RESET command from ${jid.split('@')[0]} - Ignoring silently`));
        return;
      }
      
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

      // Only allow LIMIT command for authenticated users
      if (!session.apiKeys) {
        console.log(chalk.yellow(`🔒 Unauthorized LIMIT command from ${jid.split('@')[0]} - Ignoring silently`));
        return;
      }
      
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

      // Only allow HELP command for authenticated users
      if (!session.apiKeys) {
        console.log(chalk.yellow(`🔒 Unauthorized HELP command from ${jid.split('@')[0]} - Ignoring silently`));
        return;
      }
      
      await sendChunkedMessage(sock, jid, getMessage(session.language, 'help'));
      session.currentStep = 'awaiting_niche'; // Reset step after help
      session.previousMessage = null;
      saveJson(SESSIONS_FILE, sessions);
      return;
    }


        // Check if there are pending results for this user (only if authenticated)
    if (pendingResults.has(jid) && session.apiKeys) {
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

    
    // Load admin sessions from disk
    loadAdminSessions();
    
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

         console.log(chalk.cyan('📱 WhatsApp Admin Commands:'));
         console.log(chalk.gray('   ADMIN: admin123       - Authenticate as admin'));
         console.log(chalk.gray('   ADMIN USERS           - List all users'));
         console.log(chalk.gray('   ADMIN ADMINS          - List all admins'));
         console.log(chalk.gray('   ADMIN STATUS          - System status\n'));
        
        // Check for pending results to send when user comes back online
        await checkAndSendPendingResults();
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);


         // Keep connection alive with periodic status checks and refresh admin data
    const connectionCheckInterval = setInterval(() => {
      if (sock && sock.user) {
        // Just log connection status
        console.log(chalk.gray('📡 Connection status: Active'));

         
         // Refresh admin manager data every 5 minutes
         if (Date.now() % 300000 < 60000) { // Every 5 minutes
           adminManager.adminConfig = adminManager.loadAdminConfig();
           adminManager.codes = adminManager.loadCodes();
           adminManager.sessions = adminManager.loadSessions();
           console.log(chalk.blue('🔄 Admin manager data refreshed'));
         }
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
  startBot();

export { startBot };

