import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';
import { startUnifiedScraper } from './lib/startUnifiedScraper.js';
import concurrencyManager from './lib/concurrency-manager.js';
import { createRequire } from 'module';
import chalk from 'chalk';
import { getMessage } from './languages.js';
import http from 'http';

import AdminManager from './lib/admin-manager.js';
import { nicheValidator, setNicheValidatorErrorHandler } from './lib/niche-validator.js';
import { NicheSuggester } from './lib/niche-suggester.js';

const require = createRequire(import.meta.url);
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image helper function
// Helper function to send images with captions - optimized for mobile display
async function sendImageWithMessage(sock, jid, imageName, text, language = 'fr') {
  try {
    // Map language codes to directory names
    const languageMap = {
      'en': 'english_imgs',
      'fr': 'french_imgs', 
      'ar': 'arabic_imgs'
    };
    
    const imageDir = languageMap[language] || 'english_imgs';
    const imagePath = path.join(__dirname, 'imgs', imageDir, `${imageName}.png`);
    
    // Check if image exists
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Send image with caption - optimized for mobile display
      await sock.sendMessage(jid, {
        image: imageBuffer,
        caption: text,
        // Add metadata for better mobile display
        mimetype: 'image/png',
        jpegThumbnail: imageBuffer
      });
    } else {
      // Fallback to text only if image doesn't exist
      console.log(chalk.yellow(`⚠️ Image not found: ${imagePath}`));
      await sock.sendMessage(jid, { text });
    }
  } catch (error) {
    await handleError(error, 'image_send', { imageName, jid: jid.split('@')[0] });
    // Fallback to text only
    await sock.sendMessage(jid, { text });
  }
}

// --- Serialized session mutation utilities (avoid race conditions on sessions.json) ---
let __sessionsMutex = Promise.resolve();

function mutateUserSession(jid, update) {
  const task = async () => {
    // Always read fresh
    const all = loadJson(SESSIONS_FILE, {});
    const current = all[jid] || {};
    const next = typeof update === 'function' ? update(current) : { ...current, ...update };
    all[jid] = next;
    saveJson(SESSIONS_FILE, all);
    return next;
  };
  const run = __sessionsMutex.then(task, task);
  __sessionsMutex = run.catch(() => {});
  return run;
}

// Simple health check server for Railway
const PORT = process.env.PORT || 3000;
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'WhatsApp Scraper Bot',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp Scraper Bot</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            .status { padding: 15px; border-radius: 5px; margin: 20px 0; }
            .healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚂 WhatsApp Scraper Bot</h1>
            <div class="status healthy">
              <strong>✅ Service Status:</strong> Running on Railway
            </div>
            <div class="status info">
              <strong>📱 Bot Status:</strong> Active and monitoring WhatsApp
            </div>
            <h3>🔗 Available Endpoints:</h3>
            <p><strong>GET /health</strong> - Health check endpoint</p>
            <p><strong>GET /</strong> - This status page</p>
            <h3>📊 Service Information:</h3>
            <p><strong>Platform:</strong> Railway</p>
            <p><strong>Environment:</strong> Production</p>
            <p><strong>Port:</strong> ${PORT}</p>
            <p><strong>Uptime:</strong> ${Math.floor(process.uptime() / 60)} minutes</p>
            <p><strong>Memory Usage:</strong> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start health server
healthServer.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
  console.log(`🔗 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`📱 Status page: http://localhost:${PORT}/`);
});

/**
 * Progress Simulator - Creates realistic loading bar experience for WhatsApp
 */
class ProgressSimulator {
  constructor(language = 'fr') {
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
    this.language = language;
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
    
    // Don't send completion message - let the bot handle it
    // if (this.onProgress) {
    //   this.onProgress({
    //     processed: 100,
    //     total: 100,
    //     phase: this.phase,
    //     message: 'Progress: 100% — Scraping complete!'
    //   });
    // }
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
      getMessage(this.language, 'progress_analyzing', { progress: progress.toFixed(1) }),
      getMessage(this.language, 'progress_processing', { progress: progress.toFixed(1) }),
      getMessage(this.language, 'progress_extracting', { progress: progress.toFixed(1) }),
      getMessage(this.language, 'progress_validating', { progress: progress.toFixed(1) }),
      getMessage(this.language, 'progress_compiling', { progress: progress.toFixed(1) }),
      getMessage(this.language, 'progress_finalizing', { progress: progress.toFixed(1) })
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
const ACCESS_CODES_FILE = path.join(__dirname, 'codes.json');
const AUTH_DIR = path.join(__dirname, 'auth_info');
const PENDING_RESULTS_FILE = path.join(__dirname, 'pending_results.json');

// Active jobs tracking with offline resilience
const activeJobs = new Map(); // jid -> { abort: AbortController, status: string, startTime: Date, results: any, progressSimulator: ProgressSimulator }
const pendingResults = new Map(); // jid -> { filePath: string, meta: any, timestamp: Date }

// Daily scraping limits
const DAILY_SCRAPING_LIMIT = 4; // Maximum scrapings per day per user

// Exact-time expiry timers (userCode -> Timeout)
const expiryTimers = new Map();

/**
 * Ensure user's paid subscription is still active; downgrade to 'unpaid' if expired
 * @param {Object} codesDb - In-memory codes database
 * @param {string} userCode - User code to check
 * @returns {boolean} true if a downgrade occurred
 */
function updateStageIfExpired(codesDb, userCode) {
  try {
    if (!userCode || !codesDb || !codesDb[userCode]) return false;
    const entry = codesDb[userCode];
    if (entry.stage !== 'paid') return false;
    const expiresAt = entry.paid && entry.paid.expiresAt;
    if (!expiresAt) return false;
    const now = Date.now();
    const exp = new Date(expiresAt).getTime();
    if (isNaN(exp)) return false;
    if (exp <= now) {
      entry.stage = 'unpaid';
      codesDb[userCode] = entry;
      saveJson(CODES_FILE, codesDb);
      console.log(chalk.yellow(`⏳ Subscription expired for '${userCode}'. Stage set to 'unpaid'.`));
      return true;
    }
    return false;
  } catch (e) {
    console.warn(chalk.gray(`⚠️ Unable to update stage for '${userCode}': ${e.message}`));
    return false;
  }
}

/**
 * Immediately downgrade an expired paid user to 'unpaid' and notify their active sessions.
 * Safe to call from a timer.
 */
async function handleExpiryNow(sock, userCode) {
  try {
    const codesDb = loadJson(CODES_FILE, {});
    const sessionsDb = loadJson(SESSIONS_FILE, {});
    const entry = codesDb[userCode];
    if (!entry) return;
    const expiresAt = entry?.paid?.expiresAt;
    const expMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    if (entry.stage !== 'paid' || isNaN(expMs) || expMs > Date.now()) return;

    // Downgrade
    entry.stage = 'unpaid';
    codesDb[userCode] = entry;
    saveJson(CODES_FILE, codesDb);

    // Notify all sessions using this code
    for (const [jid, sess] of Object.entries(sessionsDb)) {
      if (sess?.code === userCode) {
        const lang = sess.language || 'en';
        sess.currentStep = 'main_menu';
        sess.status = 'idle';
        sessionsDb[jid] = sess;
        try {
          await sock.sendMessage(jid, { text: getMessage(lang, 'subscription_expired') });
          await sendImageWithMessage(sock, jid, 'main_menu', getMessage(lang, 'main_menu'), lang);
        } catch (e) {
          console.log(chalk.yellow(`⚠️ Failed to send expiry notice to ${jid}: ${e.message}`));
        }
      }
    }
    saveJson(SESSIONS_FILE, sessionsDb);
    console.log(chalk.blue(`⏳ Expired subscription processed for '${userCode}' → 'unpaid'`));
  } catch (e) {
    console.log(chalk.yellow(`⚠️ handleExpiryNow error for '${userCode}': ${e.message}`));
  }
}

/**
 * Sweep all users for expired subscriptions, downgrade, and notify active sessions.
 * Runs independently of inbound messages.
 * @param {any} sock - WhatsApp socket instance
 */
async function runExpirySweep(sock) {
  try {
    const codesDb = loadJson(CODES_FILE, {});
    const sessionsDb = loadJson(SESSIONS_FILE, {});
    const now = Date.now();
    let anyChange = false;
    for (const [userCode, entry] of Object.entries(codesDb)) {
      if (!entry || entry.stage !== 'paid') continue;
      const expiresAt = entry?.paid?.expiresAt;
      if (!expiresAt) continue;
      const exp = new Date(expiresAt).getTime();
      if (isNaN(exp)) continue;
      // Schedule exact-time expiry timer for paid users
      if (exp > now) {
        // Ensure a timer exists for this user
        if (!expiryTimers.has(userCode)) {
          const delay = Math.min(exp - now, 2147483647);
          const t = setTimeout(async () => {
            expiryTimers.delete(userCode);
            await handleExpiryNow(sock, userCode);
          }, delay);
          expiryTimers.set(userCode, t);
        }
      }
      if (exp <= now) {
        entry.stage = 'unpaid';
        codesDb[userCode] = entry;
        anyChange = true;
        // Notify all sessions currently authenticated with this code
        for (const [jid, sess] of Object.entries(sessionsDb)) {
          if (sess?.code === userCode) {
            const lang = sess.language || 'en';
            sess.currentStep = 'main_menu';
            sess.status = 'idle';
            sessionsDb[jid] = sess;
            try {
              await sock.sendMessage(jid, { text: getMessage(lang, 'subscription_expired') });
              await sendImageWithMessage(sock, jid, 'main_menu', getMessage(lang, 'main_menu'), lang);
            } catch (e) {
              console.log(chalk.yellow(`⚠️ Failed to send expiry notice to ${jid}: ${e.message}`));
            }
          }
        }
      }
    }
    if (anyChange) {
      saveJson(CODES_FILE, codesDb);
      saveJson(SESSIONS_FILE, sessionsDb);
      console.log(chalk.blue('⏳ Expiry sweep: downgraded expired paid users to unpaid and notified sessions'));
    }
  } catch (e) {
    console.log(chalk.yellow(`⚠️ Expiry sweep error: ${e.message}`));
  }
}

/**
 * Helper function to safely reset session state when clearing active jobs
 * @param {string} jid - User's JID
 * @param {Object} sessions - Current sessions data
 */
function resetSessionState(jid, sessions) {
  // Use serialized mutation to avoid overwriting concurrent updates
  mutateUserSession(jid, (s) => {
    const updated = { ...s };
    updated.currentStep = 'awaiting_business_service';
    updated.status = 'idle';
    updated.currentLoadingPercentage = 0;
    updated.lastLoadingUpdateTimestamp = 0;
    return updated;
  })
    .then(() => {
    console.log(chalk.yellow(`🔧 Session state reset for ${jid}: currentStep -> 'awaiting_business_service'`));
    })
    .catch((e) => {
      console.log(chalk.yellow(`⚠️ Failed to reset session state for ${jid}: ${e.message}`));
    });
}

// Admin management
const adminManager = new AdminManager();
const adminSessions = new Map(); // jid -> { adminCode: string, role: string, permissions: string[], authenticatedAt: Date }

/**
 * Check if user has reached daily scraping limit
 * @param {string} jid - User's JID
 * @param {Object} sessions - Current sessions data
 * @returns {Object} - { canScrape: boolean, remaining: number, resetTime: string }
 */
function checkDailyScrapingLimit(jid, sessions) {
  const session = sessions[jid];
  if (!session || !session.code) {
    return { canScrape: false, remaining: 0, resetTime: null };
  }

  // Load access codes to get daily limits
  const accessCodes = loadJson(ACCESS_CODES_FILE, {});
  const userCode = session.code;
  const userAccess = accessCodes[userCode];
  
  if (!userAccess) {
    console.log(chalk.red(`❌ Access code not found for user ${jid.split('@')[0]}: ${userCode}`));
    return { canScrape: false, remaining: 0, resetTime: null };
  }

  // Initialize daily tracking if not exists
  if (!userAccess.dailyScraping) {
    userAccess.dailyScraping = {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };
  }

  const today = new Date().toDateString();
  const lastReset = new Date(userAccess.dailyScraping.lastReset);
  const lastResetDate = lastReset.toDateString();

  // Check if it's a new day
  if (today !== lastResetDate) {
    // Reset daily count for new day
    userAccess.dailyScraping.date = today;
    userAccess.dailyScraping.count = 0;
    userAccess.dailyScraping.lastReset = new Date().toISOString();
    
    // Save updated access codes
    accessCodes[userCode] = userAccess;
    saveJson(ACCESS_CODES_FILE, accessCodes);
    console.log(chalk.blue(`🔄 Daily limit reset for access code ${userCode}: new day detected`));
  }

  const remaining = Math.max(0, DAILY_SCRAPING_LIMIT - userAccess.dailyScraping.count);
  const canScrape = remaining > 0;

  // Calculate next reset time (tomorrow at midnight)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetTime = tomorrow.toLocaleString();

  console.log(chalk.blue(`🔍 Daily limit calculation for ${jid.split('@')[0]} (${userCode}): count=${userAccess.dailyScraping.count}, limit=${DAILY_SCRAPING_LIMIT}, remaining=${remaining}, canScrape=${canScrape}`));

  return { canScrape, remaining, resetTime };
}

/**
 * Increment daily scraping count for user
 * @param {string} jid - User's JID
 * @param {Object} sessions - Current sessions data
 * @returns {boolean} - Success status
 */
async function incrementDailyScrapingCount(jid, sessions) {
  try {
    const session = sessions[jid];
    if (!session || !session.code) {
      return false;
    }

    // Load access codes to update daily limits
    const accessCodes = loadJson(ACCESS_CODES_FILE, {});
    const userCode = session.code;
    const userAccess = accessCodes[userCode];
    
    if (!userAccess) {
      console.log(chalk.red(`❌ Access code not found for user ${jid.split('@')[0]}: ${userCode}`));
      return false;
    }

    // Initialize daily tracking if not exists
    if (!userAccess.dailyScraping) {
      userAccess.dailyScraping = {
        date: new Date().toDateString(),
        count: 0,
        lastReset: new Date().toISOString()
      };
    }

    const today = new Date().toDateString();
    const lastReset = new Date(userAccess.dailyScraping.lastReset);
    const lastResetDate = lastReset.toDateString();

    // Check if it's a new day
    if (today !== lastResetDate) {
      // Reset daily count for new day
      userAccess.dailyScraping.date = today;
      userAccess.dailyScraping.count = 0;
      userAccess.dailyScraping.lastReset = new Date().toISOString();
    }

    // Increment count
    userAccess.dailyScraping.count += 1;
    
    // Save updated access codes
    accessCodes[userCode] = userAccess;
    saveJson(ACCESS_CODES_FILE, accessCodes);
    
    console.log(chalk.blue(`📊 Daily scraping count updated for ${jid.split('@')[0]} (${userCode}): ${userAccess.dailyScraping.count}/${DAILY_SCRAPING_LIMIT}`));
    console.log(chalk.blue(`💾 Access codes saved for ${userCode} with daily count: ${userAccess.dailyScraping.count}`));
    return true;
  } catch (error) {
    await handleError(error, 'daily_limit_update', { jid: jid.split('@')[0] });
    return false;
  }
}

/**
 * Get daily scraping status message
 * @param {Object} limitInfo - Limit check result
 * @param {string} language - User's language
 * @returns {string} - Formatted status message
 */
function getDailyScrapingStatusMessage(limitInfo, language = 'fr') {
  if (limitInfo.canScrape) {
    return getMessage(language, 'daily_status_ok', {
      remaining: limitInfo.remaining,
      limit: DAILY_SCRAPING_LIMIT
    });
  } else {
    return getMessage(language, 'daily_status_reached', {
      limit: DAILY_SCRAPING_LIMIT,
      resetTime: limitInfo.resetTime || ''
    });
  }
}

// Load admin sessions from disk
async function loadAdminSessions() {
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
    await handleError(error, 'admin_sessions_load', {});
    console.log(chalk.blue(`📱 Starting with empty admin sessions`));
  }
}

// Save admin sessions to disk
async function saveAdminSessions() {
  try {
    const adminSessionsFile = path.join(__dirname, 'admin_sessions.json');
    const data = {};
    for (const [jid, session] of adminSessions.entries()) {
      data[jid] = session;
    }
    fs.writeFileSync(adminSessionsFile, JSON.stringify(data, null, 2));
    console.log(chalk.blue(`💾 Admin sessions saved to disk`));
  } catch (error) {
    await handleError(error, 'admin_sessions_save', {});
  }
}

// Connection management
let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Offline job completion tracking
const completedJobs = new Map(); // jid -> { filePath: string, meta: any, completedAt: Date }

// Error logging and notification system
const errorLog = [];
const MAX_ERROR_LOG_SIZE = 100; // Keep last 100 errors

/**
 * Centralized error handler that logs errors and notifies admins
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} additionalData - Additional data to include in the error report
 */
async function handleError(error, context = 'Unknown', additionalData = {}) {
  try {
    const timestamp = new Date().toISOString();
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create error entry
    const errorEntry = {
      id: errorId,
      timestamp,
      context,
      message: error.message,
      stack: error.stack,
      additionalData,
      severity: determineErrorSeverity(error, context)
    };
    
    // Add to error log
    errorLog.push(errorEntry);
    
    // Keep only the last MAX_ERROR_LOG_SIZE errors
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
      errorLog.shift();
    }
    
    // Log to console
    console.error(chalk.red(`🚨 [${errorId}] Error in ${context}:`), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    
    // Notify admins if the error is severe enough
    if (errorEntry.severity >= 2) { // Only notify for medium and high severity errors
      await notifyAdminsOfError(errorEntry);
    }
    
    return errorId;
  } catch (notificationError) {
    console.error(chalk.red('❌ Failed to handle error notification:'), notificationError.message);
  }
}

/**
 * Determine error severity level
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @returns {number} Severity level (1=low, 2=medium, 3=high, 4=critical)
 */
function determineErrorSeverity(error, context) {
  const message = error.message.toLowerCase();
  const stack = error.stack ? error.stack.toLowerCase() : '';
  
  // Critical errors
  if (message.includes('uncaught') || 
      message.includes('fatal') || 
      message.includes('memory') ||
      message.includes('connection lost') ||
      context.includes('startup') ||
      context.includes('authentication')) {
    return 4;
  }
  
  // High severity errors
  if (message.includes('failed to send') ||
      message.includes('scraping failed') ||
      message.includes('api key') ||
      message.includes('quota exceeded') ||
      context.includes('scraping') ||
      context.includes('file_send')) {
    return 3;
  }
  
  // Medium severity errors
  if (message.includes('timeout') ||
      message.includes('network') ||
      message.includes('retry') ||
      context.includes('connection') ||
      context.includes('session')) {
    return 2;
  }
  
  // Low severity errors (default)
  return 1;
}

/**
 * Notify all active admins about an error
 * @param {Object} errorEntry - The error entry object
 */
async function notifyAdminsOfError(errorEntry) {
  if (!sock || adminSessions.size === 0) {
    return;
  }
  
  try {
    const severityEmoji = {
      1: '🟡', // Low
      2: '🟠', // Medium  
      3: '🔴', // High
      4: '🚨'  // Critical
    };
    
    const severityText = {
      1: 'LOW',
      2: 'MEDIUM',
      3: 'HIGH', 
      4: 'CRITICAL'
    };
    
    const emoji = severityEmoji[errorEntry.severity] || '🟡';
    const severity = severityText[errorEntry.severity] || 'LOW';
    
    const errorMessage = `${emoji} **Bot Error Alert**\n\n` +
      `🆔 **Error ID:** \`${errorEntry.id}\`\n` +
      `⏰ **Time:** ${new Date(errorEntry.timestamp).toLocaleString()}\n` +
      `📍 **Context:** ${errorEntry.context}\n` +
      `⚠️ **Severity:** ${severity}\n` +
      `💬 **Message:** ${errorEntry.message}\n\n` +
      `🔧 **Additional Data:**\n${JSON.stringify(errorEntry.additionalData, null, 2)}\n\n` +
      `📊 **Total Errors Today:** ${errorLog.length}\n` +
      `🛠️ **Use ADMIN ERROR LOG to see all errors**`;
    
    // Send to all active admins
    for (const [adminJid, adminSession] of adminSessions.entries()) {
      try {
        await sock.sendMessage(adminJid, { text: errorMessage });
        console.log(chalk.blue(`📤 Error notification sent to admin ${adminJid.split('@')[0]}`));
      } catch (sendError) {
        console.error(chalk.red(`❌ Failed to send error notification to admin ${adminJid.split('@')[0]}:`), sendError.message);
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to notify admins of error:'), error.message);
  }
}

// Set error handler for niche validator after handleError is defined
setNicheValidatorErrorHandler(handleError);

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

/**
 * 🗑️ Helper function to extract base business/service from filename for cleanup
 * @param {string} fileName - The filename to extract business/service from
 * @returns {string} - The base business/service (e.g., "dentist_casablanca" or "dentisterabat")
 */
function extractBaseNicheFromFileName(fileName) {
  const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
  
  // Remove source-specific suffixes and timestamps
  let baseNiche = fileNameWithoutExt
    .replace(/_google_maps.*$/, '') // Remove everything from _google_maps onwards
    .replace(/_complete_.*$/, '')   // Remove _complete_ and timestamp
    .replace(/_autosave.*$/, '')    // Remove _autosave and session info
    .replace(/_SESSION_.*$/, '')    // Remove _SESSION_ and session ID
    .replace(/_linkedin.*$/, '')    // Remove _linkedin and related info
    .replace(/_google_search.*$/, '') // Remove _google_search and related info
    .replace(/_all_sources.*$/, '') // Remove _all_sources and related info
    .replace(/_results.*$/, ''); // Remove _results and everything after it (for Google Search files in lead-scraper)
  
  // Handle different filename patterns:
  // 1. "dentiste_rabat_google_maps_complete_..." -> "dentiste_rabat"
  // 2. "dentisterabat_google_maps_complete_..." -> "dentisterabat"
  // 3. "dentiste rabat_google_maps_complete_..." -> "dentiste rabat"
  
  return baseNiche;
}

/**
 * 🎯 Generate clean user-facing file name by removing source information
 * @param {string} originalFileName - The original filename with source info
 * @returns {string} - Clean filename without source information for user display
 */
function generateCleanUserFileName(originalFileName) {
  const fileExt = path.extname(originalFileName);
  const fileNameWithoutExt = path.basename(originalFileName, fileExt);
  
  // Remove source-specific information while preserving business/service and timestamp
  let cleanName = fileNameWithoutExt
    .replace(/_google_maps/g, '')           // Remove _google_maps
    .replace(/_linkedin/g, '')              // Remove _linkedin  
    .replace(/_google_search/g, '')         // Remove _google_search
    .replace(/_all_sources/g, '')           // Remove _all_sources
    .replace(/_results/g, '')               // Remove _results
    .replace(/_complete/g, '')              // Remove _complete
    .replace(/_autosave.*$/, '')            // Remove _autosave and session info
    .replace(/_SESSION_.*$/, '')            // Remove _SESSION_ and session ID
    .replace(/_{2,}/g, '_')                 // Replace multiple underscores with single
    .replace(/^_|_$/g, '');                 // Remove leading/trailing underscores
  
  // Handle edge case where filename only contains source information
  if (cleanName === 'google_maps' || cleanName === 'linkedin' || cleanName === 'google_search' || cleanName === 'all_sources' || 
      cleanName.startsWith('google_maps_') || cleanName.startsWith('linkedin_') || cleanName.startsWith('google_search_') || cleanName.startsWith('all_sources_')) {
    cleanName = '';
  }
  
  // If the name becomes empty or too short, use a generic name
  if (!cleanName || cleanName.length < 3) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    cleanName = `leads_${timestamp}`;
  }
  
  return cleanName + fileExt;
}

/**
 * 🗑️ Helper function to cleanup related files for a specific source and business/service
 * @param {string} resultsDir - Directory to search in
 * @param {string} baseNiche - Base business/service to match
 * @param {string} source - Source type (google_maps, linkedin, etc.)
 * @param {string} excludeFile - File to exclude from deletion (already being deleted)
 * @returns {number} - Number of files deleted
 */
function cleanupRelatedFiles(resultsDir, baseNiche, source, excludeFile = null) {
  if (!fs.existsSync(resultsDir)) {
    console.log(chalk.red(`❌ Directory does not exist: ${resultsDir}`));
    return 0;
  }
  
  try {
    const files = fs.readdirSync(resultsDir);
    
    // Find ALL files that match this business/service and source
    // Use more flexible matching to handle different filename patterns
    const relatedFiles = files.filter(f => {
      // Must contain the source type (with special handling for Google Search)
      if (source === 'google_search') {
        // Google Search files have pattern: business_service_results.txt or business_service_results_autosave_session_TIMESTAMP.txt
        if (!f.includes('_results') && !f.includes('results_')) return false;
      } else {
        if (!f.includes(source)) return false;
      }
      
      // Must be a result file
      if (!(f.endsWith('.json') || f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.txt'))) return false;
      
      // Extract the business/service part from the filename for comparison
      const fileNiche = extractBaseNicheFromFileName(f);
      
      // Check if this file belongs to the same business/service (handle different patterns)
      // Examples:
      // - baseNiche: "dentiste_rabat", fileNiche: "dentisterabat" -> should match
      // - baseNiche: "dentisterabat", fileNiche: "dentiste_rabat" -> should match
      // - baseNiche: "dentiste rabat", fileNiche: "dentisterabat" -> should match
      
      // Normalize both business/services for comparison (remove spaces, underscores, convert to lowercase)
      const normalizeNiche = (niche) => niche.toLowerCase().replace(/[\s_]/g, '');
      const normalizedBaseNiche = normalizeNiche(baseNiche);
      const normalizedFileNiche = normalizeNiche(fileNiche);
      
      return normalizedBaseNiche === normalizedFileNiche;
    });
    
    console.log(chalk.blue(`🔍 Found ${relatedFiles.length} related ${source} files with base business/service: "${baseNiche}"`));
    console.log(chalk.blue(`🔍 Files: ${relatedFiles.join(', ')}`));
    
    let deletedCount = 0;
    // Delete all related files
    for (const relatedFile of relatedFiles) {
      const relatedPath = path.join(resultsDir, relatedFile);
      if (fs.existsSync(relatedPath) && relatedPath !== excludeFile) {
        fs.unlinkSync(relatedPath);
        console.log(chalk.green(`🗑️ Storage optimization: Deleted related ${source} file: ${relatedFile}`));
        console.log(chalk.gray(`   File path: ${relatedPath}`));
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not cleanup related ${source} files: ${error.message}`));
    return 0;
  }
}

/**
 * 🗑️ STORAGE OPTIMIZATION: Clean up result files from multiple locations
 * This function removes files from both the main results folder and lead-scraper folder
 */
function cleanupResultFile(filePath) {
  try {
    if (!filePath) {
      console.log(chalk.yellow(`⚠️ No file path provided for cleanup`));
      return false;
    }

    // Check if file exists in the main results folder
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(chalk.green(`🗑️ Storage optimization: Deleted result file: ${path.basename(filePath)}`));
      console.log(chalk.gray(`   File path: ${filePath}`));
      
      // 🗑️ SPECIAL CASE: For any source files, delete ALL related files (Excel, JSON autosave, JSON complete, etc.)
      const fileName = path.basename(filePath);
      
      // Determine source type and cleanup related files
      let sourceType = null;
      if (fileName.includes('google_maps')) {
        sourceType = 'google_maps';
      } else if (fileName.includes('linkedin')) {
        sourceType = 'linkedin';
      } else if (fileName.includes('google_search')) {
        sourceType = 'google_search';
      } else if (fileName.includes('all_sources')) {
        sourceType = 'all_sources';
      }
      
      if (sourceType) {
        // For Google Search files, look in the lead-scraper directory, not the results directory
        let resultsDir;
        if (sourceType === 'google_search') {
          resultsDir = path.join(__dirname, 'google search + linkdin scraper', 'lead-scraper');
        } else {
          resultsDir = path.dirname(filePath);
        }
        
        const baseNiche = extractBaseNicheFromFileName(fileName);
        console.log(chalk.blue(`🔍 Looking for ${sourceType} files with base business/service: "${baseNiche}"`));
        
        const deletedCount = cleanupRelatedFiles(resultsDir, baseNiche, sourceType, filePath);
        console.log(chalk.blue(`🗑️ Cleaned up ${deletedCount} related ${sourceType} files`));
      }
      
      return true;
    }

    
    // Check if file exists in the lead-scraper folder (for other sources)
    const leadScraperPath = path.join(__dirname, 'google search + linkdin scraper', 'lead-scraper', path.basename(filePath));
    if (fs.existsSync(leadScraperPath)) {
      fs.unlinkSync(leadScraperPath);
      console.log(chalk.green(`🗑️ Storage optimization: Deleted result file from lead-scraper: ${path.basename(filePath)}`));
      console.log(chalk.gray(`   File path: ${leadScraperPath}`));
      
      // 🗑️ SPECIAL CASE: For any source files in lead-scraper, also delete related files
      if (sourceType && sourceType !== 'google_search') {
        const leadScraperDir = path.join(__dirname, 'google search + linkdin scraper', 'lead-scraper');
        const baseNiche = extractBaseNicheFromFileName(fileName);
        console.log(chalk.blue(`🔍 Looking for ${sourceType} files in lead-scraper with base business/service: "${baseNiche}"`));
        
        const deletedCount = cleanupRelatedFiles(leadScraperDir, baseNiche, sourceType, leadScraperPath);
        console.log(chalk.blue(`🗑️ Cleaned up ${deletedCount} related ${sourceType} files from lead-scraper`));
      }
      
      return true;
    }

    // Check if file exists in the maps_scraper folder
    const mapsScraperPath = path.join(__dirname, 'maps_scraper', 'results', path.basename(filePath));
    if (fs.existsSync(mapsScraperPath)) {
      fs.unlinkSync(mapsScraperPath);
      console.log(chalk.green(`🗑️ Storage optimization: Deleted result file from maps_scraper: ${path.basename(filePath)}`));
      console.log(chalk.gray(`   File path: ${mapsScraperPath}`));
      
      // 🗑️ SPECIAL CASE: For any source files in maps_scraper, also delete related files
      const fileName = path.basename(filePath);
      
      // Determine source type and cleanup related files
      let sourceType = null;
      if (fileName.includes('google_maps')) {
        sourceType = 'google_maps';
      } else if (fileName.includes('linkedin')) {
        sourceType = 'linkedin';
      } else if (fileName.includes('google_search')) {
        sourceType = 'google_search';
      } else if (fileName.includes('all_sources')) {
        sourceType = 'all_sources';
      }
      
      if (sourceType) {
        const mapsScraperDir = path.join(__dirname, 'maps_scraper', 'results');
        const baseNiche = extractBaseNicheFromFileName(fileName);
        console.log(chalk.blue(`🔍 Looking for ${sourceType} files in maps_scraper with base business/service: "${baseNiche}"`));
        
        const deletedCount = cleanupRelatedFiles(mapsScraperDir, baseNiche, sourceType, mapsScraperPath);
        console.log(chalk.blue(`🗑️ Cleaned up ${deletedCount} related ${sourceType} files from maps_scraper`));
      }
      
      return true;
    }

    console.log(chalk.yellow(`⚠️ File not found in any expected location: ${path.basename(filePath)}`));
    return false;

  } catch (error) {
    console.log(chalk.red(`❌ Failed to cleanup result file: ${error.message}`));
    console.log(chalk.gray(`   File path: ${filePath}`));
    return false;
  }
}

/**
 * 🗑️ STORAGE OPTIMIZATION: Clean up old result files from all locations
 * This function removes files older than the specified number of hours
 */
function cleanupOldResultFiles(maxAgeHours = 24) {
  try {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    const cutoffTime = Date.now() - maxAgeMs;
    let totalCleaned = 0;

    console.log(chalk.blue(`🗑️ Starting cleanup of result files older than ${maxAgeHours} hours...`));

    // Clean up main results folder
    const resultsDir = path.join(__dirname, 'results');
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      for (const file of files) {
        const filePath = path.join(resultsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
            console.log(chalk.green(`🗑️ Deleted old file: ${file}`));
            totalCleaned++;
          } catch (error) {
            console.log(chalk.red(`❌ Failed to delete old file: ${file} - ${error.message}`));
          }
        }
      }
    }

    // Clean up lead-scraper folder (Google Search files are created directly in lead-scraper, not in results subfolder)
    const leadScraperDir = path.join(__dirname, 'google search + linkdin scraper', 'lead-scraper');
    if (fs.existsSync(leadScraperDir)) {
      const files = fs.readdirSync(leadScraperDir);
      for (const file of files) {
        const filePath = path.join(leadScraperDir, file);
        const stats = fs.statSync(filePath);
        
        // Only delete actual result files, not project files
        const isResultFile = (file.includes('_results') && 
                             (file.endsWith('.txt') || file.endsWith('.json') || file.endsWith('.xlsx'))) ||
                             file.includes('_autosave_session_');
        
        if (stats.isFile() && isResultFile && stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
            console.log(chalk.green(`🗑️ Deleted old file from lead-scraper: ${file}`));
            totalCleaned++;
          } catch (error) {
            console.log(chalk.red(`❌ Failed to delete old file from lead-scraper: ${file} - ${error.message}`));
          }
        }
      }
    }

    // Clean up maps_scraper results folder
    const mapsScraperDir = path.join(__dirname, 'maps_scraper', 'results');
    if (fs.existsSync(mapsScraperDir)) {
      const files = fs.readdirSync(mapsScraperDir);
      for (const file of files) {
        const filePath = path.join(mapsScraperDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          try {
            fs.unlinkSync(filePath);
            console.log(chalk.green(`🗑️ Deleted old file from maps_scraper: ${file}`));
            totalCleaned++;
          } catch (error) {
            console.log(chalk.red(`❌ Failed to delete old file from maps_scraper: ${file} - ${error.message}`));
          }
        }
      }
    }

    console.log(chalk.green(`✅ Cleanup completed: ${totalCleaned} old files removed`));
    return totalCleaned;

  } catch (error) {
    console.log(chalk.red(`❌ Failed to cleanup old result files: ${error.message}`));
    return 0;
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

// Handle user guide PDF sending
async function handleUserGuide(sock, jid, session) {
  try {
    const userLanguage = session.language || 'fr';
    
    // Map language codes to PDF filenames
    const guideFiles = {
      'en': 'Lead Finder - Complete User Guide english.pdf',
      'fr': 'Lead Finder - Guide Complet d\'Utilisation.pdf',
      'ar': 'Lead Finder - دليل المستخدم الكامل.pdf'
    };
    
    const guideFileName = guideFiles[userLanguage] || guideFiles['en'];
    const guideFilePath = path.join(__dirname, 'user_guides', guideFileName);
    
    // Check if file exists
    if (!fs.existsSync(guideFilePath)) {
      console.log(chalk.red(`❌ Guide file not found: ${guideFilePath}`));
      await sock.sendMessage(jid, { 
        text: getMessage(userLanguage, 'guide_error')
      });
      return;
    }
    
    // Set session state to guide_processing so we can handle user messages during processing
    session.currentStep = 'guide_processing';
    const sessions = loadJson(SESSIONS_FILE, {});
    sessions[jid] = session;
    saveJson(SESSIONS_FILE, sessions);
    
    // Send "sending" message
    const languageNames = {
      'en': 'English',
      'fr': 'Français',
      'ar': 'العربية'
    };
    
    await sock.sendMessage(jid, { 
      text: getMessage(userLanguage, 'guide_sending', { 
        language: languageNames[userLanguage] || 'English' 
      })
    });
    
    // Send the PDF file
    const fileSent = await sendFile(sock, jid, guideFilePath, '', guideFileName);
    
    if (fileSent) {
      console.log(chalk.green(`✅ User guide sent successfully to ${jid.split('@')[0]} in ${userLanguage}`));
      
      // Go directly back to main menu (no "guide sent" message)
      session.currentStep = 'main_menu';
      sessions[jid] = session;
      saveJson(SESSIONS_FILE, sessions);
      
      await sendImageWithMessage(sock, jid, 'main_menu', getMessage(userLanguage, 'main_menu'), userLanguage);
    } else {
      console.log(chalk.red(`❌ Failed to send user guide to ${jid.split('@')[0]}`));
      await sock.sendMessage(jid, { 
        text: getMessage(userLanguage, 'guide_error')
      });
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Error in handleUserGuide:`, error.message));
    await sock.sendMessage(jid, { 
      text: getMessage(session.language || 'en', 'guide_error')
    });
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
        
        // Send the results (this will automatically delete the file after successful delivery)
        const fileSent = await sendResultsToUser(sock, jid, pendingResult.filePath, pendingResult.meta, session.language);
        
        // Remove from pending regardless of send success (file cleanup is handled in sendResultsToUser)
        pendingResults.delete(jid);
        savePendingResults(); // Save updated pending results
        
        if (fileSent) {
          console.log(chalk.green(`✅ Pending results sent successfully to ${jid}`));
        } else {
          console.log(chalk.yellow(`⚠️ Pending results send failed for ${jid}, but removed from pending queue`));
        }
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

async function sendFile(sock, jid, filePath, caption = '', customFileName = null) {
  try {
    console.log(chalk.blue(`🔍 sendFile: Starting file send process...`));
    console.log(chalk.blue(`🔍 sendFile: File path: ${filePath}`));
    console.log(chalk.blue(`🔍 sendFile: JID: ${jid}`));
    console.log(chalk.blue(`🔍 sendFile: Caption: ${caption}`));
    console.log(chalk.blue(`🔍 sendFile: Custom filename: ${customFileName || 'none'}`));
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    // Generate clean user-facing filename by removing source information
    const originalFileName = path.basename(filePath);
    const cleanFileName = generateCleanUserFileName(originalFileName);
    const fileName = customFileName || cleanFileName;
    const fileData = fs.readFileSync(filePath);
    const fileExt = path.extname(fileName).toLowerCase();
    
    console.log(chalk.blue(`🔍 sendFile: Original file name: ${originalFileName}`));
    console.log(chalk.blue(`🔍 sendFile: Clean user file name: ${fileName}`));
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
async function sendResultsToUser(sock, jid, filePath, meta, userLanguage = 'en') {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Results file not found: ${filePath}`);
    }
    
    const fileName = meta.customFilename || path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Create appropriate caption based on source and format in user's language
    let caption = `📄 **${getMessage(userLanguage, 'file_ready')}**\n\n`;
    
    // Handle totalResults - if it's already formatted (contains the word "results"), use as is
    // Otherwise, append the localized "results" word
    const totalResultsText = meta.totalResults || 'Unknown';
    const summaryText = totalResultsText.toString().includes(getMessage(userLanguage, 'results')) 
      ? totalResultsText 
      : `${totalResultsText} ${getMessage(userLanguage, 'results')}`;
    
    caption += `📊 **${getMessage(userLanguage, 'summary')}:** ${summaryText}\n`;
    caption += `📋 **${getMessage(userLanguage, 'format')}:** ${meta.format || fileExtension.toUpperCase()}\n`;
    
    console.log(chalk.blue(`📤 Sending results to ${jid}: ${fileName}`));
    console.log(chalk.blue(`📤 Custom filename from meta: ${meta.customFilename || 'none'}`));
    console.log(chalk.blue(`📤 Original file path: ${filePath}`));
    
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
        
        // Try to send file as document attachment with custom filename
        fileSent = await sendFile(sock, jid, filePath, caption, meta.customFilename);
        
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
    
    // 🗑️ STORAGE OPTIMIZATION: Delete file after successful delivery
    if (fileSent) {
      try {
        // Add a small delay to ensure the file was fully sent
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Use the comprehensive cleanup function that checks multiple locations
        const cleanupSuccess = cleanupResultFile(filePath);
        
        if (cleanupSuccess) {
          console.log(chalk.green(`🗑️ Storage optimization: Successfully cleaned up result file after delivery: ${fileName}`));
        } else {
          console.log(chalk.yellow(`⚠️ File cleanup completed but file may have been already deleted: ${fileName}`));
        }
      } catch (deleteError) {
        console.log(chalk.red(`❌ Failed to cleanup result file after delivery: ${deleteError.message}`));
        console.log(chalk.gray(`   File path: ${filePath}`));
        // Don't throw error - file was sent successfully, deletion is just optimization
      }
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
  summary += `• Business/Service: "${meta.niche}"\n`;
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
          `🎯 **Business or Service**\n` +
          `   Send any text as a business or service\n` +
          `   Example: "dentist casablanca"\n\n` +
          `📏 **LIMIT: <number>**\n` +
          `   Set max results (1-500). Default: 300\n\n` +
          `📊 **STATUS**\n` +
          `   Check current job status and daily limits\n\n` +
          `🛑 **STOP**\n` +
          `   Cancel current scraping job\n\n` +
          `♻️ **RESET**\n` +
          `   Reset all preferences\n\n` +
          `🔄 **RESTART** (00)\n` +
          `   Restart the entire process from business/service selection\n\n` +
          `❓ **HELP**\n` +
          `   Show this help message\n\n` +
          `📅 **Daily Limits:**\n` +
          `• Each user can perform ${DAILY_SCRAPING_LIMIT} scraping jobs per day\n` +
          `• Limits reset at midnight local time\n` +
          `• Use STATUS command to check your remaining scrapings\n\n` +
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
  // Auto-downgrade to unpaid if subscription expired
  try {
    const currentCode = sessions[jid]?.code;
    if (currentCode) {
      const downgraded = updateStageIfExpired(codesDb, currentCode);
      // Ensure an exact-time timer exists for paid users
      try {
        const entry = codesDb[currentCode];
        if (entry?.stage === 'paid' && entry?.paid?.expiresAt) {
          const expMs = new Date(entry.paid.expiresAt).getTime();
          if (!isNaN(expMs) && expMs > Date.now() && !expiryTimers.has(currentCode)) {
            const delay = Math.min(expMs - Date.now(), 2147483647);
            const t = setTimeout(async () => {
              expiryTimers.delete(currentCode);
              await handleExpiryNow(sock, currentCode);
            }, delay);
            expiryTimers.set(currentCode, t);
          }
        }
      } catch (e) {}
      if (downgraded) {
        // Notify user immediately and stop further processing
        const lang = sessions[jid]?.language || 'en';
        // Reset to main menu
        sessions[jid].currentStep = 'main_menu';
        sessions[jid].status = 'idle';
        saveJson(SESSIONS_FILE, sessions);
        await sock.sendMessage(jid, { text: getMessage(lang, 'subscription_expired') });
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(lang, 'main_menu'), lang);
        return;
      }
    }
  } catch (e) {}
  
  // Debug: Log session loading
  console.log(chalk.gray(`📱 Session data loaded for ${jid.split('@')[0]}: ${Object.keys(sessions).length} total sessions`));


  // Initialize session if not exists and send language selection message
  if (!sessions[jid]) {
    sessions[jid] = {
      prefs: {
        source: 'GOOGLE',
        format: 'XLSX'
      },
      status: 'idle',
      currentStep: 'awaiting_language', // Start with language selection
      previousMessage: null, // Stores the previous message content for "go back" functionality
      language: 'fr', // Default language
      meta: {
        createdAt: new Date().toISOString(),
        totalJobs: 0,
        lastBusinessService: null
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
    saveJson(SESSIONS_FILE, sessions);
    
    // Send language selection message for new users
    console.log(chalk.yellow(`🌐 New user ${jid.split('@')[0]} - sending language selection`));
    await sendImageWithMessage(sock, jid, 'welcome', getMessage('fr', 'welcome'), 'fr');
    return;
  }

  const session = sessions[jid];

  // Debug: Log current session state
  if (session && session.dailyScraping) {
    console.log(chalk.gray(`📊 Current daily count for ${jid.split('@')[0]}: ${session.dailyScraping.count}/${DAILY_SCRAPING_LIMIT}`));
  }

  // FIX: Safety check to automatically fix stuck session states
  if (session.currentStep === 'scraping_in_progress' && !activeJobs.has(jid)) {
        console.log(chalk.yellow(`🔧 Auto-fixing stuck session state for ${jid}: resetting from 'scraping_in_progress' to 'awaiting_business_service'`));
    resetSessionState(jid, sessions);
  }

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
        authenticatedAt: new Date(),
        currentMenu: 'main_admin_menu',
        menuOptions: 10
      });

      // Save admin sessions to disk
      await saveAdminSessions();

      console.log(chalk.green(`🔓 Admin access granted to ${jid.split('@')[0]} with role: ${authResult.admin.role}`));
      console.log(chalk.blue(`📊 Admin sessions Map now contains ${adminSessions.size} sessions:`, Array.from(adminSessions.keys()).map(k => k.split('@')[0])));

      await sock.sendMessage(jid, { 
        text: `🔐 **Admin Access Granted!**\n\n👑 **Role:** ${authResult.admin.role}\n📝 **Description:** ${authResult.admin.roleDescription}\n🔑 **Permissions:** ${authResult.admin.permissions.join(', ')}\n\n💡 **Quick Start:**\n1️⃣ Type **ADMIN MENU** for simple numbered menu\n2️⃣ Type **ADMIN HELP** for detailed command list\n3️⃣ Type **ADMIN USERS** to see all users\n4️⃣ Type **ADMIN STATUS** to check system status\n\n💡 **Tip:** You can also directly send **1, 2, 3, or 4** for quick access!\n💡 **Tip:** Use **ADMIN MENU** for the easiest way to navigate!`
      });

      // Save admin sessions to disk
      await saveAdminSessions();
      
      console.log(chalk.blue(`🔍 Admin session initialized for ${jid.split('@')[0]}: currentMenu=main_admin_menu, menuOptions=10`));
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
    
    // Ensure admin session has required properties
    if (!adminSession.currentMenu) {
      adminSession.currentMenu = 'main_admin_menu';
      adminSession.menuOptions = 10;
      adminSessions.set(jid, adminSession);
      await saveAdminSessions();
      console.log(chalk.blue(`🔍 Fixed admin session: set currentMenu = "${adminSession.currentMenu}"`));
    }
    
    // Handle ADMIN LIMIT <number>
    if (/^ADMIN\s+LIMIT\s+\d+$/i.test(text)) {
      const num = parseInt(text.trim().split(/\s+/).pop(), 10);
      try {
        concurrencyManager.setLimit(num);
        await sock.sendMessage(jid, { text: `✅ Concurrency limit set to ${num}` });
      } catch (e) {
        await sock.sendMessage(jid, { text: `❌ ${e.message}` });
      }
      return;
    }
    
    // FULL ADMIN MENU: Handle numbers 1-9 when IN main menu (PRIORITY 1)
    if (adminSession.currentMenu === 'main_admin_menu' && !isNaN(parseInt(text)) && parseInt(text) >= 1 && parseInt(text) <= 9) {
      console.log(chalk.blue(`🔍 Full admin menu choice ${parseInt(text)} detected for admin ${adminSession.adminCode}`));
      // Let the existing full menu system handle this
      // (The logic below will process it)
    } else if (!isNaN(parseInt(text)) && parseInt(text) >= 1 && parseInt(text) <= 4 && 
               adminSession.currentMenu === 'main_admin_menu') {
      // QUICK ACCESS: Handle numbers 1-4 only when in main menu (PRIORITY 3)
      console.log(chalk.blue(`🔍 Quick access number ${parseInt(text)} detected for admin ${adminSession.adminCode}`));
      
      let quickAction = '';
      
      switch (parseInt(text)) {
        case 1:
          quickAction = 'ADMIN MENU';
          break;
        case 2:
          quickAction = 'ADMIN HELP';
          break;
        case 3:
          quickAction = 'ADMIN USERS';
          break;
        case 4:
          quickAction = 'ADMIN STATUS';
          break;
      }
      
      console.log(chalk.blue(`🔍 Executing quick action: ${quickAction}`));
      
      // Execute the quick action
      if (quickAction === 'ADMIN MENU') {
        // Show the admin menu
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Menu**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Choose an option by number:**\n\n`;
        
        let optionNumber = 1;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `${optionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
          optionNumber++;
        }
        
        if (permissions.includes('manage_users')) {
          message += `2️⃣ **➕ ADD USER** - Create new user account\n`;
          message += `3️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
          message += `4️⃣ **✏️ MODIFY USER** - Change user details\n`;
          message += `5️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `6️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
        }
        
        if (permissions.includes('system_control')) {
          message += `7️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
        }
        
        message += `8️⃣ **❓ HELP** - Show detailed admin help\n`;
        message += `9️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
        
        message += `💬 **Reply with the number** corresponding to your choice.\n`;
        message += `💡 **Example:** Send "1" to list users`;
        
        // Store admin menu state
        adminSession.currentMenu = 'main_admin_menu';
        adminSession.menuOptions = optionNumber - 1;
        adminSessions.set(jid, adminSession);
        
        await sock.sendMessage(jid, { text: message });
        return;
      } else if (quickAction === 'ADMIN USERS') {
        // Execute ADMIN USERS command
        try {
          console.log(chalk.blue(`🔍 Executing ADMIN USERS for ${adminSession.adminCode}`));
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
            message += `**Total User Codes:** ${result.users.length}\n\n`;
            message += `💡 **Use ADMIN MENU** to return to the main menu.`;
            await sock.sendMessage(jid, { text: message });
          } else {
            await sock.sendMessage(jid, { text: `❌ **Error:** ${result.error}` });
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error in ADMIN USERS command:`, error.message));
          await sock.sendMessage(jid, { text: `❌ **Internal Error:** ${error.message}` });
        }
        return;
      } else if (quickAction === 'ADMIN STATUS') {
        // Execute ADMIN STATUS command
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
            message += `• Max failed auth attempts: ${status.systemSettings.max_failed_auth_attempts}\n`;
            message += `• Auto unblock hours: ${status.systemSettings.auto_unblock_hours}\n`;
            message += `• Session timeout hours: ${status.systemSettings.session_timeout_hours}\n`;
            message += `• Max users per admin: ${status.systemSettings.max_users_per_admin}\n\n`;
            message += `💡 **Use ADMIN MENU** to return to the main menu.`;
            
            await sock.sendMessage(jid, { text: message });
          } else {
            await sock.sendMessage(jid, { text: `❌ **Error:** ${result.error}` });
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error in ADMIN STATUS command:`, error.message));
          await sock.sendMessage(jid, { text: `❌ **Internal Error:** ${error.message}` });
        }
        return;
      } else if (quickAction === 'ADMIN HELP') {
        // Execute ADMIN HELP command
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Commands Help**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Available Commands:**\n\n`;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `• **ADMIN USERS** - List all users and their status\n`;
        }
        
        if (permissions.includes('manage_users')) {
          message += `• **ADMIN ADD USER <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>** - Add new user with 3 API keys for each service\n`;
          message += `• **ADMIN REMOVE USER <code>** - Remove user code\n`;
          message += `• **ADMIN MODIFY CODE <old_code> <new_code>** - Change user's access code\n`;
          message += `• **ADMIN MODIFY KEYS <code> <google_key1> <google_key2> <gemini_key1> <gemini_key2>** - Update user's API keys\n`;
          message += `• **ADMIN MODIFY LANGUAGE <code> <language>** - Change user's language preference\n`;
          message += `• **ADMIN ADD LIMIT <code> <amount>** - Add more daily scraping attempts\n`;
          message += `• **ADMIN RESET LIMIT <code>** - Reset user's daily scraping count\n`;
          message += `• **ADMIN LIMIT STATUS <code>** - Check user's daily limit status\n`;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `• **ADMIN ADD ADMIN <code> <role>** - Add new admin\n`;
          message += `• **ADMIN REMOVE ADMIN <code>** - Remove admin code\n`;
        }
        
        if (permissions.includes('system_control')) {
          message += `• **ADMIN STATUS** - View system status and statistics\n`;
        }
        
        message += `• **ADMIN HELP** - Show this help message\n`;
        message += `• **ADMIN MENU** - Show numbered admin menu\n`;
        message += `• **ADMIN LOGOUT** - Logout from admin session (switch to user mode)\n\n`;
        
        message += `📅 **Daily Scraping Limits:** Each user can perform ${DAILY_SCRAPING_LIMIT} scraping jobs per day. Limits reset at midnight.\n\n`;
        message += `💡 **Tip:** Use **ADMIN MENU** for a simpler numbered interface!`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
    }
    
    // INTERACTIVE MODIFY USER FLOW (PRIORITY 1 - Check this BEFORE main menu)
    if (adminSession.currentMenu === 'modify_user_select') {
      if (text === '0') {
        // Go back to main menu
        adminSession.currentMenu = 'main_admin_menu';
        adminSession.modifyUserData = null;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        // Show main menu again
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Menu**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Choose an option by number:**\n\n`;
        
        let menuOptionNumber = 1;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_users')) {
          message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('system_control')) {
          message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
          menuOptionNumber++;
        }
        
        message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
        
        message += `💬 **Reply with the number** corresponding to your choice.\n`;
        message += `💡 **Example:** Send "2" to list users`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      // Handle user selection
      const userChoice = parseInt(text);
      if (!isNaN(userChoice) && userChoice >= 1 && userChoice <= adminSession.modifyUserData.users.length) {
        const selectedUser = adminSession.modifyUserData.users[userChoice - 1];
        
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n`;
        message += `📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        // Set admin session to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSession.modifyUserData.selectedUser = selectedUser;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        await sock.sendMessage(jid, { text: message });
        return;
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid choice!** Please select a number between 1 and ${adminSession.modifyUserData.users.length}, or send "0" to go back.`
        });
        return;
      }
    }
    
    // Handle modification type selection (PRIORITY 2)
    if (adminSession.currentMenu === 'modify_user_type') {
      if (text === '0') {
        // Go back to user selection
        adminSession.currentMenu = 'modify_user_select';
        adminSession.modifyUserData.selectedUser = null;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        // Show user list again
        let message = `✏️ **Modify User - Select User**\n\n📋 **Available users to modify:**\n\n`;
        
        adminSession.modifyUserData.users.forEach((user, index) => {
          message += `${index + 1}. **${user.code}**\n`;
          message += `   📅 Created: ${new Date(user.createdAt).toLocaleString()}\n`;
          message += `   👤 Issued by: ${user.issuedBy}\n`;
          message += `   📊 Use count: ${user.useCount}\n`;
          if (user.language) {
            message += `   🌐 Language: ${user.language}\n`;
          }
          message += `\n`;
        });
        
        message += `💬 **Reply with the number** of the user you want to modify.\n`;
        message += `💡 **Example:** Send "1" to modify user1\n\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      const modificationChoice = parseInt(text);
      const selectedUser = adminSession.modifyUserData.selectedUser;
      
      switch (modificationChoice) {
        case 1: // Change User Code
          await sock.sendMessage(jid, { 
            text: `✏️ **Change User Code**\n\n📝 **Current code:** ${selectedUser.code}\n\n💬 **Send the new code** for this user.\n\n💡 **Example:** newuser123\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_code';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 2: // Update API Keys
          await sock.sendMessage(jid, { 
            text: `✏️ **Update API Keys**\n\n📝 **Current keys:**\n• Google 1: ${formatApiKey(selectedUser.googleSearchKeys[0])}\n• Google 2: ${formatApiKey(selectedUser.googleSearchKeys[1])}\n• Gemini 1: ${formatApiKey(selectedUser.geminiKeys[0])}\n• Gemini 2: ${formatApiKey(selectedUser.geminiKeys[1])}\n\n💬 **Send the new keys** in this format:\n<google_key1> <google_key2> <gemini_key1> <gemini_key2>\n\n💡 **Example:** newkey1 newkey2 gemkey1 gemkey2\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_keys';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 3: // Change Language
          await sock.sendMessage(jid, { 
            text: `✏️ **Change Language**\n\n📝 **Current language:** ${selectedUser.language || 'fr'}\n\n💬 **Available languages:**\n1️⃣ **en** - English\n2️⃣ **fr** - French\n3️⃣ **ar** - Arabic\n\n💬 **Send the language code** (en, fr, or ar)\n\n💡 **Example:** fr\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_language';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 4: // Reset Daily Scraping Count
          await sock.sendMessage(jid, { 
            text: `✏️ **Reset Daily Scraping Count**\n\n📝 **Current daily count:** ${selectedUser.dailyScraping?.count || 0}/4\n\n⚠️ **This will reset the daily scraping count to 0.**\n\n💬 **Type 'CONFIRM'** to reset the daily count.\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_reset_count';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 5: // Add Daily Limit
          await sock.sendMessage(jid, { 
            text: `✏️ **Add Daily Limit**\n\n📝 **Current daily limit:** ${selectedUser.dailyScrapingLimit || 4}\n\n💬 **Send the number** of additional daily scraping attempts to add.\n\n💡 **Example:** 2 (adds 2 more attempts)\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_add_limit';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        default:
          await sock.sendMessage(jid, { 
            text: `❌ **Invalid choice!** Please select a number between 1-5, or send "0" to go back.`
          });
          return;
      }
    }
    
    // Handle specific modification types (PRIORITY 3)
    if (adminSession.currentMenu === 'modify_user_code') {
      if (text === '0') {
        // Go back to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        const selectedUser = adminSession.modifyUserData.selectedUser;
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      // Handle code change
      const newCode = text.trim();
      if (newCode.length < 3) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid code!** Code must be at least 3 characters long.\n\n💬 **Try again** or send "0" to go back.`
        });
        return;
      }
      
      try {
        const result = adminManager.modifyUserCode(adminSession.adminCode, adminSession.modifyUserData.selectedUser.code, newCode);
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ **User Code Modified Successfully!**\n\n📝 **Old code:** ${adminSession.modifyUserData.selectedUser.code}\n📝 **New code:** ${newCode}\n\n💡 **The user can now use the new code to access the system.**`
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ **Error:** ${result.error}`
          });
        }
      } catch (error) {
        await sock.sendMessage(jid, { 
          text: `❌ **Error:** Failed to modify user code`
        });
      }
      
      // Return to main menu
      adminSession.currentMenu = 'main_admin_menu';
      adminSession.modifyUserData = null;
      adminSessions.set(jid, adminSession);
      await saveAdminSessions();
      
      // Show main menu
      const permissions = adminSession.permissions;
      let message = `🔐 **Admin Menu**\n\n`;
      message += `👑 **Your Role:** ${adminSession.role}\n`;
      message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
      
      message += `📋 **Choose an option by number:**\n\n`;
      
      let menuOptionNumber = 1;
      
      if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
        message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_users')) {
        message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_admins')) {
        message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('system_control')) {
        message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
        menuOptionNumber++;
      }
      
      message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
      menuOptionNumber++;
      message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
      
      message += `💬 **Reply with the number** corresponding to your choice.\n`;
      message += `💡 **Example:** Send "2" to list users`;
      
      await sock.sendMessage(jid, { text: message });
      return;
    }
    
    // Handle reset daily scraping count (PRIORITY 3)
    if (adminSession.currentMenu === 'modify_user_reset_count') {
      if (text === '0') {
        // Go back to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        const selectedUser = adminSession.modifyUserData.selectedUser;
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      if (text === 'CONFIRM') {
        try {
          const selectedUser = adminSession.modifyUserData.selectedUser;
          const result = adminManager.resetUserDailyLimit(adminSession.adminCode, selectedUser.code);
          
          if (result.success) {
            await sock.sendMessage(jid, { 
              text: `✅ **Daily Scraping Count Reset Successfully!**\n\n📝 **User:** ${selectedUser.code}\n📝 **Previous daily count:** ${selectedUser.dailyScraping?.count || 0}/4\n📝 **New daily count:** 0/4\n\n💡 **The user can now perform 4 more scraping jobs today.**`
            });
          } else {
            await sock.sendMessage(jid, { 
              text: `❌ **Error:** ${result.error}`
            });
          }
        } catch (error) {
          await sock.sendMessage(jid, { 
            text: `❌ **Error:** Failed to reset daily scraping count`
          });
        }
        
        // Return to main menu
        adminSession.currentMenu = 'main_admin_menu';
        adminSession.modifyUserData = null;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        // Show main menu
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Menu**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Choose an option by number:**\n\n`;
        
        let menuOptionNumber = 1;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_users')) {
          message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('system_control')) {
          message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
          menuOptionNumber++;
        }
        
        message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
        
        message += `💬 **Reply with the number** corresponding to your choice.\n`;
        message += `💡 **Example:** Send "2" to list users`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      await sock.sendMessage(jid, { 
        text: `❌ **Invalid input!** Please type 'CONFIRM' to reset the daily scraping count, or send "0" to go back.`
      });
      return;
    }
    
    // Handle add daily limit (PRIORITY 3)
    if (adminSession.currentMenu === 'modify_user_add_limit') {
      if (text === '0') {
        // Go back to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        const selectedUser = adminSession.modifyUserData.selectedUser;
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      const amount = parseInt(text);
      if (isNaN(amount) || amount < 1) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid amount!** Please send a number greater than 0, or send "0" to go back.`
        });
        return;
      }
      
      try {
        const selectedUser = adminSession.modifyUserData.selectedUser;
        const result = adminManager.addDailyScrapingLimit(adminSession.adminCode, selectedUser.code, amount);
        
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ **Daily Limit Added Successfully!**\n\n📝 **User:** ${selectedUser.code}\n📝 **Previous daily count:** ${selectedUser.dailyScraping?.count || 0}/4\n📝 **Amount added:** +${amount}\n📝 **New daily count:** ${Math.min(4, (selectedUser.dailyScraping?.count || 0) + amount)}/4\n\n💡 **The user can now perform more scraping jobs today.**`
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ **Error:** ${result.error}`
          });
        }
      } catch (error) {
        await sock.sendMessage(jid, { 
          text: `❌ **Error:** Failed to add daily limit`
        });
      }
      
      // Return to main menu
      adminSession.currentMenu = 'main_admin_menu';
      adminSession.modifyUserData = null;
      adminSessions.set(jid, adminSession);
      await saveAdminSessions();
      
      // Show main menu
      const permissions = adminSession.permissions;
      let message = `🔐 **Admin Menu**\n\n`;
      message += `👑 **Your Role:** ${adminSession.role}\n`;
      message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
      
      message += `📋 **Choose an option by number:**\n\n`;
      
      let menuOptionNumber = 1;
      
      if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
        message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_users')) {
        message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_admins')) {
        message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('system_control')) {
        message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
        menuOptionNumber++;
      }
      
      message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
      menuOptionNumber++;
      message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
      
      message += `💬 **Reply with the number** corresponding to your choice.\n`;
      message += `💡 **Example:** Send "2" to list users`;
      
      await sock.sendMessage(jid, { text: message });
      return;
    }
    
    // Handle numbered admin menu choices (for the full menu system) - PRIORITY 4
    if (adminSession.currentMenu === 'main_admin_menu' && !isNaN(parseInt(text))) {
      const choice = parseInt(text);
      const permissions = adminSession.permissions;
      
      if (choice < 1 || choice > adminSession.menuOptions) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid choice!** Please select a number between 1 and ${adminSession.menuOptions}.\n\n💡 **Use ADMIN MENU** to see the options again.`
        });
        return;
      }

      let optionNumber = 1;
      
      // SHOW ADMIN MENU (Option 1)
      if (choice === optionNumber) {
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Menu**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Choose an option by number:**\n\n`;
        
        let menuOptionNumber = 1;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_users')) {
          message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('system_control')) {
          message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
          menuOptionNumber++;
        }
        
        message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
        
        message += `💬 **Reply with the number** corresponding to your choice.\n`;
        message += `💡 **Example:** Send "2" to list users`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      optionNumber++;
      
      // LIST USERS (Option 2)
      if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
        if (choice === 2) {
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
              message += `**Total User Codes:** ${result.users.length}\n\n`;
              message += `💡 **Use ADMIN MENU** to return to the main menu.`;
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
        optionNumber++;
      }
      
      // ADD USER (Option 3)
      if (permissions.includes('manage_users')) {
        if (choice === 3) {
          await sock.sendMessage(jid, { 
            text: `➕ **Add New User**\n\n📝 **Usage:** ADMIN ADD USER <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>\n\n💡 **Example:** ADMIN ADD USER abc123 google_key1 google_key2 google_key3 gemini_key1 gemini_key2 gemini_key3\n\n⚠️ **Please provide:**\n• User code\n• 3 Google Search API keys\n• 3 Gemini API keys\n\n🔄 **Send the command above to add a user.**`
          });
          return;
        }
        optionNumber++;
        
        // MODIFY USER (Option 4)
        if (choice === 4) {
          try {
            // Get list of users
            const result = adminManager.listUsers(adminSession.adminCode);
            if (result.success && result.users.length > 0) {
              let message = `✏️ **Modify User - Select User**\n\n📋 **Available users to modify:**\n\n`;
              
              result.users.forEach((user, index) => {
                message += `${index + 1}. **${user.code}**\n`;
                message += `   📅 Created: ${new Date(user.createdAt).toLocaleString()}\n`;
                message += `   👤 Issued by: ${user.issuedBy}\n`;
                message += `   📊 Use count: ${user.useCount}\n`;
                if (user.language) {
                  message += `   🌐 Language: ${user.language}\n`;
                }
                message += `\n`;
              });
              
              message += `💬 **Reply with the number** of the user you want to modify.\n`;
              message += `💡 **Example:** Send "1" to modify user1\n\n`;
              message += `🔙 **To go back:** Send "0"`;
              
              // Set admin session to modification mode
              adminSession.currentMenu = 'modify_user_select';
              adminSession.modifyUserData = { users: result.users };
              adminSessions.set(jid, adminSession);
              await saveAdminSessions();
              
              await sock.sendMessage(jid, { text: message });
            } else {
              await sock.sendMessage(jid, { 
                text: `❌ **No users found**\n\n💡 Use **ADMIN ADD USER** to create users first.`
              });
            }
          } catch (error) {
            console.error(chalk.red(`❌ Error in MODIFY USER:`, error.message));
            await sock.sendMessage(jid, { text: `❌ **Error:** Failed to load users` });
          }
          return;
        }
        optionNumber++;
        
        // REMOVE USER (Option 5)
        if (choice === 5) {
          await sock.sendMessage(jid, { 
            text: `🗑️ **Remove User**\n\n📝 **Usage:** ADMIN REMOVE USER <code>\n\n💡 **Example:** ADMIN REMOVE USER abc123\n\n⚠️ **This will permanently delete the user account!**\n\n🔄 **Send the command above to remove a user.**`
          });
          return;
        }
        optionNumber++;
        
        // MANAGE LIMITS (Option 6)
        if (choice === 6) {
          let message = `📊 **Manage Daily Limits**\n\n📋 **Available limit management options:**\n\n`;
          message += `• **ADMIN ADD LIMIT <code> <amount>** - Add more daily scraping attempts\n`;
          message += `• **ADMIN RESET LIMIT <code>** - Reset user's daily scraping count to 0\n`;
          message += `• **ADMIN LIMIT STATUS <code>** - Check user's current daily limit status\n\n`;
          message += `💡 **Examples:**\n`;
          message += `• ADMIN ADD LIMIT abc123 2 (adds 2 more attempts)\n`;
          message += `• ADMIN RESET LIMIT abc123 (resets to 0)\n`;
          message += `• ADMIN LIMIT STATUS abc123 (shows current status)\n\n`;
          message += `🔄 **Send any of the commands above to manage limits.**`;
          
          await sock.sendMessage(jid, { text: message });
          return;
        }
        optionNumber++;
      }
      
      // MANAGE ADMINS (Option 7)
      if (permissions.includes('manage_admins')) {
        if (choice === 7) {
          let message = `👑 **Manage Admins**\n\n📋 **Available admin management options:**\n\n`;
          message += `• **ADMIN ADMINS** - List all admin codes\n`;
          message += `• **ADMIN ADD ADMIN <code> <role>** - Add new admin\n`;
          message += `• **ADMIN REMOVE ADMIN <code>** - Remove admin code\n\n`;
          message += `💡 **Available roles:** super_admin, admin, moderator\n`;
          message += `💡 **Examples:**\n`;
          message += `• ADMIN ADMINS (list all)\n`;
          message += `• ADMIN ADD ADMIN mod123 moderator\n`;
          message += `• ADMIN REMOVE ADMIN mod123\n\n`;
          message += `🔄 **Send any of the commands above to manage admins.**`;
          
          await sock.sendMessage(jid, { text: message });
          return;
        }
        optionNumber++;
      }
      
      // SYSTEM STATUS (Option 8)
      if (permissions.includes('system_control')) {
        if (choice === 8) {
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
              message += `• Max failed auth attempts: ${status.systemSettings.max_failed_auth_attempts}\n`;
              message += `• Auto unblock hours: ${status.systemSettings.auto_unblock_hours}\n`;
              message += `• Session timeout hours: ${status.systemSettings.session_timeout_hours}\n`;
              message += `• Max users per admin: ${status.systemSettings.max_users_per_admin}\n\n`;
              message += `💡 **Use ADMIN MENU** to return to the main menu.`;
              
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
        optionNumber++;
      }
      
      // HELP (Option 9)
      if (choice === 9) {
        await sock.sendMessage(jid, { 
          text: `❓ **Admin Help**\n\n💡 **Use ADMIN HELP** to see all available commands.\n\n💡 **Use ADMIN MENU** to return to the numbered menu.\n\n💡 **Use ADMIN LOGOUT** to exit admin session.`
        });
        return;
      }
      optionNumber++;
      
      // LOGOUT (Option 10)
      if (choice === 10) {
        try {
          const adminCode = adminSession.adminCode;
          const phoneNumber = jid.split('@')[0];
          
          // Clear the admin session
          adminSessions.delete(jid);
          await saveAdminSessions();
          
          await sock.sendMessage(jid, { 
            text: `🔓 **Admin Logout Successful!**\n\n✅ You have been logged out of your admin session.\n\n💡 **To log back in:**\n• Send ADMIN: <admin_code> to start a new admin session\n• Example: ADMIN: admin123\n\n💡 **To become user:**\n• Send CODE: <user_code> to start a user session\n• Example: CODE: user1`
          });
          
          console.log(chalk.yellow(`🔓 Admin ${phoneNumber} logged out (was using code: ${adminCode})`));
        } catch (error) {
          console.error(chalk.red(`❌ Error in admin logout:`, error.message));
          await sock.sendMessage(jid, { 
            text: `❌ **Error during logout:** ${error.message}` 
          });
        }
        return;
      }
    }
    
    // INTERACTIVE MODIFY USER FLOW
    if (adminSession.currentMenu === 'modify_user_select') {
      if (text === '0') {
        // Go back to main menu
        adminSession.currentMenu = 'main_admin_menu';
        adminSession.modifyUserData = null;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        // Show main menu again
        const permissions = adminSession.permissions;
        let message = `🔐 **Admin Menu**\n\n`;
        message += `👑 **Your Role:** ${adminSession.role}\n`;
        message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
        
        message += `📋 **Choose an option by number:**\n\n`;
        
        let menuOptionNumber = 1;
        
        if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
          message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_users')) {
          message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
          menuOptionNumber++;
          message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('manage_admins')) {
          message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
          menuOptionNumber++;
        }
        
        if (permissions.includes('system_control')) {
          message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
          menuOptionNumber++;
        }
        
        message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
        
        message += `💬 **Reply with the number** corresponding to your choice.\n`;
        message += `💡 **Example:** Send "2" to list users`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      // Handle user selection
      const userChoice = parseInt(text);
      if (!isNaN(userChoice) && userChoice >= 1 && userChoice <= adminSession.modifyUserData.users.length) {
        const selectedUser = adminSession.modifyUserData.users[userChoice - 1];
        
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n`;
        message += `📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        // Set admin session to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSession.modifyUserData.selectedUser = selectedUser;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        await sock.sendMessage(jid, { text: message });
        return;
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid choice!** Please select a number between 1 and ${adminSession.modifyUserData.users.length}, or send "0" to go back.`
        });
        return;
      }
    }
    
    // Handle modification type selection
    if (adminSession.currentMenu === 'modify_user_type') {
      if (text === '0') {
        // Go back to user selection
        adminSession.currentMenu = 'modify_user_select';
        adminSession.modifyUserData.selectedUser = null;
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        // Show user list again
        let message = `✏️ **Modify User - Select User**\n\n📋 **Available users to modify:**\n\n`;
        
        adminSession.modifyUserData.users.forEach((user, index) => {
          message += `${index + 1}. **${user.code}**\n`;
          message += `   📅 Created: ${new Date(user.createdAt).toLocaleString()}\n`;
          message += `   👤 Issued by: ${user.issuedBy}\n`;
          message += `   📊 Use count: ${user.useCount}\n`;
          if (user.language) {
            message += `   🌐 Language: ${user.language}\n`;
          }
          message += `\n`;
        });
        
        message += `💬 **Reply with the number** of the user you want to modify.\n`;
        message += `💡 **Example:** Send "1" to modify user1\n\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      const modificationChoice = parseInt(text);
      const selectedUser = adminSession.modifyUserData.selectedUser;
      
      switch (modificationChoice) {
        case 1: // Change User Code
          await sock.sendMessage(jid, { 
            text: `✏️ **Change User Code**\n\n📝 **Current code:** ${selectedUser.code}\n\n💬 **Send the new code** for this user.\n\n💡 **Example:** newuser123\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_code';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 2: // Update API Keys
          await sock.sendMessage(jid, { 
            text: `✏️ **Update API Keys**\n\n📝 **Current keys:**\n• Google 1: ${formatApiKey(selectedUser.googleSearchKeys[0])}\n• Google 2: ${formatApiKey(selectedUser.googleSearchKeys[1])}\n• Gemini 1: ${formatApiKey(selectedUser.geminiKeys[0])}\n• Gemini 2: ${formatApiKey(selectedUser.geminiKeys[1])}\n\n💬 **Send the new keys** in this format:\n<google_key1> <google_key2> <gemini_key1> <gemini_key2>\n\n💡 **Example:** newkey1 newkey2 gemkey1 gemkey2\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_keys';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 3: // Change Language
          await sock.sendMessage(jid, { 
            text: `✏️ **Change Language**\n\n📝 **Current language:** ${selectedUser.language || 'fr'}\n\n💬 **Available languages:**\n1️⃣ **en** - English\n2️⃣ **fr** - French\n3️⃣ **ar** - Arabic\n\n💬 **Send the language code** (en, fr, or ar)\n\n💡 **Example:** fr\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_language';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 4: // Reset Daily Scraping Count
          await sock.sendMessage(jid, { 
            text: `✏️ **Reset Daily Scraping Count**\n\n📝 **Current daily count:** ${selectedUser.dailyScraping?.count || 0}/4\n\n⚠️ **This will reset the daily scraping count to 0.**\n\n💬 **Type 'CONFIRM'** to reset the daily count.\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_reset_count';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        case 5: // Add Daily Limit
          await sock.sendMessage(jid, { 
            text: `✏️ **Add Daily Limit**\n\n📝 **Current daily limit:** ${selectedUser.dailyScrapingLimit || 4}\n\n💬 **Send the number** of additional daily scraping attempts to add.\n\n💡 **Example:** 2 (adds 2 more attempts)\n\n🔙 **To go back:** Send "0"`
          });
          
          adminSession.currentMenu = 'modify_user_add_limit';
          adminSessions.set(jid, adminSession);
          await saveAdminSessions();
          return;
          
        default:
          await sock.sendMessage(jid, { 
            text: `❌ **Invalid choice!** Please select a number between 1-5, or send "0" to go back.`
          });
          return;
      }
    }
    
    // Handle specific modification types
    if (adminSession.currentMenu === 'modify_user_code') {
      if (text === '0') {
        // Go back to modification type selection
        adminSession.currentMenu = 'modify_user_type';
        adminSessions.set(jid, adminSession);
        await saveAdminSessions();
        
        const selectedUser = adminSession.modifyUserData.selectedUser;
        let message = `✏️ **Modify User: ${selectedUser.code}**\n\n📋 **Current user information:**\n`;
        message += `• **Code:** ${selectedUser.code}\n`;
        message += `• **Created:** ${new Date(selectedUser.createdAt).toLocaleString()}\n`;
        message += `• **Issued by:** ${selectedUser.issuedBy}\n`;
        message += `• **Use count:** ${selectedUser.useCount}\n`;
        if (selectedUser.language) {
          message += `• **Language:** ${selectedUser.language}\n`;
        }
        message += `• **Google Keys:** ${formatApiKey(selectedUser.googleSearchKeys[0])}, ${formatApiKey(selectedUser.googleSearchKeys[1])}\n`;
        message += `• **Gemini Keys:** ${formatApiKey(selectedUser.geminiKeys[0])}, ${formatApiKey(selectedUser.geminiKeys[1])}\n\n`;
        
        message += `📝 **What would you like to modify?**\n\n`;
        message += `1️⃣ **Change User Code** - Modify the access code\n`;
        message += `2️⃣ **Update API Keys** - Change Google/Gemini keys\n`;
        message += `3️⃣ **Change Language** - Update language preference\n`;
        message += `4️⃣ **Reset Use Count** - Reset daily usage count\n`;
        message += `5️⃣ **Add Daily Limit** - Increase daily scraping limit\n\n`;
        
        message += `💬 **Reply with the number** of what you want to modify.\n`;
        message += `🔙 **To go back:** Send "0"`;
        
        await sock.sendMessage(jid, { text: message });
        return;
      }
      
      // Handle code change
      const newCode = text.trim();
      if (newCode.length < 3) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid code!** Code must be at least 3 characters long.\n\n💬 **Try again** or send "0" to go back.`
        });
        return;
      }
      
      try {
        const result = adminManager.modifyUserCode(adminSession.adminCode, adminSession.modifyUserData.selectedUser.code, newCode);
        if (result.success) {
          await sock.sendMessage(jid, { 
            text: `✅ **User Code Modified Successfully!**\n\n📝 **Old code:** ${adminSession.modifyUserData.selectedUser.code}\n📝 **New code:** ${newCode}\n\n💡 **The user can now use the new code to access the system.**`
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `❌ **Error:** ${result.error}`
          });
        }
      } catch (error) {
        await sock.sendMessage(jid, { 
          text: `❌ **Error:** Failed to modify user code`
        });
      }
      
      // Return to main menu
      adminSession.currentMenu = 'main_admin_menu';
      adminSession.modifyUserData = null;
      adminSessions.set(jid, adminSession);
      await saveAdminSessions();
      
      // Show main menu
      const permissions = adminSession.permissions;
      let message = `🔐 **Admin Menu**\n\n`;
      message += `👑 **Your Role:** ${adminSession.role}\n`;
      message += `🔑 **Your Permissions:** ${permissions.join(', ')}\n\n`;
      
      message += `📋 **Choose an option by number:**\n\n`;
      
      let menuOptionNumber = 1;
      
      if (permissions.includes('view_sessions') || permissions.includes('view_all_sessions')) {
        message += `${menuOptionNumber}️⃣ **👥 LIST USERS** - View all users and their status\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_users')) {
        message += `${menuOptionNumber}️⃣ **➕ ADD USER** - Create new user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **🗑️ REMOVE USER** - Delete user account\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **✏️ MODIFY USER** - Change user details\n`;
        menuOptionNumber++;
        message += `${menuOptionNumber}️⃣ **📊 MANAGE LIMITS** - Handle daily scraping limits\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('manage_admins')) {
        message += `${menuOptionNumber}️⃣ **👑 MANAGE ADMINS** - Admin user management\n`;
        menuOptionNumber++;
      }
      
      if (permissions.includes('system_control')) {
        message += `${menuOptionNumber}️⃣ **📈 SYSTEM STATUS** - View system statistics\n`;
        menuOptionNumber++;
      }
      
      message += `${menuOptionNumber}️⃣ **❓ HELP** - Show detailed admin help\n`;
      menuOptionNumber++;
      message += `${menuOptionNumber}️⃣ **🔓 LOGOUT** - Exit admin session\n\n`;
      
      message += `💬 **Reply with the number** corresponding to your choice.\n`;
      message += `💡 **Example:** Send "2" to list users`;
      
      await sock.sendMessage(jid, { text: message });
      return;
    }
    
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
      if (parts.length < 9) {
        await sock.sendMessage(jid, { 
          text: `❌ **Invalid Format!**\n\n📝 **Correct Usage:** ADMIN ADD USER <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>\n\n💡 **Example:** ADMIN ADD USER abc123 google_key1 google_key2 google_key3 gemini_key1 gemini_key2 gemini_key3\n\n⚠️ **Please provide:**\n• User code\n• 3 Google Search API keys\n• 3 Gemini API keys\n\n🔄 **Try again with the correct format!**`
        });
        return;
      }

      const userCode = parts[3];
      const googleKey1 = parts[4];
      const googleKey2 = parts[5];
      const googleKey3 = parts[6];
      const geminiKey1 = parts[7];
      const geminiKey2 = parts[8];
      const geminiKey3 = parts[9];

      // Validate that all keys are provided and not empty
      if (!userCode || !googleKey1 || !googleKey2 || !googleKey3 || !geminiKey1 || !geminiKey2 || !geminiKey3) {
        await sock.sendMessage(jid, { 
          text: `❌ **Missing Required Information!**\n\n📝 **You provided:**\n• Code: ${userCode || '❌ MISSING'}\n• Google Key 1: ${formatApiKey(googleKey1)}\n• Google Key 2: ${formatApiKey(googleKey2)}\n• Google Key 3: ${formatApiKey(googleKey3)}\n• Gemini Key 1: ${formatApiKey(geminiKey1)}\n• Gemini Key 2: ${formatApiKey(geminiKey2)}\n• Gemini Key 3: ${formatApiKey(geminiKey3)}\n\n💡 **Please provide all 7 required fields and try again!**`
        });
        return;
      }

      // Validate key formats (basic validation) - check for duplicates
      const googleKeys = [googleKey1, googleKey2, googleKey3];
      const geminiKeys = [geminiKey1, geminiKey2, geminiKey3];
      
      if (new Set(googleKeys).size !== 3) {
        await sock.sendMessage(jid, { 
          text: `❌ **Duplicate Google Keys!**\n\n⚠️ All 3 Google Search API keys must be different.\n\n🔄 **Please provide 3 unique Google API keys and try again!**`
        });
        return;
      }

      if (new Set(geminiKeys).size !== 3) {
        await sock.sendMessage(jid, { 
          text: `❌ **Duplicate Gemini Keys!**\n\n⚠️ All 3 Gemini API keys must be different.\n\n🔄 **Please provide 3 unique Gemini API keys and try again!**`
        });
        return;
      }

      // Basic validation: ensure keys are not empty strings
      if (googleKey1.trim() === '' || googleKey2.trim() === '' || googleKey3.trim() === '' || geminiKey1.trim() === '' || geminiKey2.trim() === '' || geminiKey3.trim() === '') {
        await sock.sendMessage(jid, { 
          text: `❌ **Empty Keys Not Allowed!**\n\n⚠️ All API keys must contain actual values.\n\n🔍 **Your keys:**\n• Google Key 1: ${formatApiKey(googleKey1)}\n• Google Key 2: ${formatApiKey(googleKey2)}\n• Google Key 3: ${formatApiKey(googleKey3)}\n• Gemini Key 1: ${formatApiKey(geminiKey1)}\n• Gemini Key 2: ${formatApiKey(geminiKey2)}\n• Gemini Key 3: ${formatApiKey(geminiKey3)}\n\n🔄 **Please provide non-empty keys and try again!**`
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
        googleSearchKeys: [googleKey1, googleKey2, googleKey3],
        geminiKeys: [geminiKey1, geminiKey2, geminiKey3]
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
          successMessage += `   • Key 2: ${formatApiKey(userDetails.apiKeys.googleSearchKeys[1])}\n`;
          successMessage += `   • Key 3: ${formatApiKey(userDetails.apiKeys.googleSearchKeys[2])}\n\n`;
          successMessage += `🤖 **Gemini API Keys:**\n`;
          successMessage += `   • Key 1: ${formatApiKey(userDetails.apiKeys.geminiKeys[0])}\n`;
          successMessage += `   • Key 2: ${formatApiKey(userDetails.apiKeys.geminiKeys[1])}\n`;
          successMessage += `   • Key 3: ${formatApiKey(userDetails.apiKeys.geminiKeys[2])}\n\n`;
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

    // Admin command: Cleanup
    if (text.toUpperCase() === 'ADMIN CLEANUP') {
      console.log(chalk.blue(`🔍 Processing ADMIN CLEANUP command for ${adminSession.adminCode}`));
      try {
        await sock.sendMessage(jid, { 
          text: `🗑️ **Storage Cleanup Started**\n\nCleaning up old result files...`
        });

        const cleanedFiles = cleanupOldResultFiles(24); // Clean files older than 24 hours
        
        await sock.sendMessage(jid, { 
          text: `✅ **Storage Cleanup Complete**\n\n🗑️ **Files Removed:** ${cleanedFiles}\n⏰ **Age Threshold:** 24 hours\n📁 **Locations Cleaned:**\n• Main results folder\n• Lead-scraper results folder\n• Maps-scraper results folder`
        });

        console.log(chalk.blue(`🗑️ Manual cleanup requested by admin ${adminSession.adminCode}: ${cleanedFiles} files removed`));
      } catch (error) {
        console.log(chalk.red(`❌ Manual cleanup failed: ${error.message}`));
        await sock.sendMessage(jid, { 
          text: `❌ **Cleanup Failed**\n\nError: ${error.message}`
        });
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
        message += `• **ADMIN ADD USER <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>** - Add new user with 3 API keys for each service\n`;
        message += `• **ADMIN REMOVE USER <code>** - Remove user code\n`;
      }
      
      if (permissions.includes('manage_admins')) {
        message += `• **ADMIN ADMINS** - List all admin codes\n`;
        message += `• **ADMIN ADD ADMIN <code> <role>** - Add new admin\n`;
        message += `• **ADMIN REMOVE ADMIN <code>** - Remove admin code\n`;
      }
      
      if (permissions.includes('system_control')) {
        message += `• **ADMIN STATUS** - View system status and statistics\n`;
        message += `• **ADMIN CLEANUP** - Clean up old result files (storage optimization)\n`;
      }
      
      message += `• **ADMIN HELP** - Show this help message\n`;
      message += `• **ADMIN SESSIONS** - Show current admin sessions (debug)\n`;
              message += `• **ADMIN USERSESSIONS** - Show all user sessions (includes daily scraping limits)\n`;
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
        message += `• **ADMIN SESSIONS** - Show all user sessions\n`;
        message += `• **ADMIN SEND FILES** - Send sessions.json and codes.json files as attachments\n`;
        message += `• **ADMIN ERROR LOG** - Show recent error log\n`;
        message += `• **ADMIN ERROR DETAILS <error_id>** - Show detailed error information\n`;
        message += `• **ADMIN TEST ERROR** - Test the error logging system\n`;
        message += `• **ADMIN TEST SCRAPER ERROR** - Test scraper error logging\n`;
        message += `• **ADMIN CLEAR ERROR LOG** - Clear all errors from the error log\n\n`;
        
        message += `📅 **Daily Scraping Limits:** Each user can perform ${DAILY_SCRAPING_LIMIT} scraping jobs per day. Limits reset at midnight.\n\n`;
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
        await loadAdminSessions();
        
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
            
            // Add daily scraping information
            if (sessionData.dailyScraping) {
              const today = new Date().toDateString();
              const lastReset = new Date(sessionData.dailyScraping.lastReset);
              const lastResetDate = lastReset.toDateString();
              
              if (today === lastResetDate) {
                message += `   📅 Daily scraping: ${sessionData.dailyScraping.count}/${DAILY_SCRAPING_LIMIT}\n`;
              } else {
                message += `   📅 Daily scraping: 0/${DAILY_SCRAPING_LIMIT} (new day)\n`;
              }
            } else {
              message += `   📅 Daily scraping: 0/${DAILY_SCRAPING_LIMIT} (not initialized)\n`;
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

    // Admin command: GRANT paid stage to a user code (supports two syntaxes)
    // Syntax A: ADMIN GRANT <user_code>
    // Syntax B: ADMIN <user_code> GRANT
    {
      const grantMatchA = text.match(/^ADMIN\s+GRANT\s+(\S+)$/i);
      const grantMatchB = text.match(/^ADMIN\s+(\S+)\s+GRANT$/i);
      const targetUserCode = grantMatchA ? grantMatchA[1] : (grantMatchB ? grantMatchB[1] : null);
      if (targetUserCode) {
        try {
          const result = adminManager.grantPaidStage(adminSession.adminCode, targetUserCode);
          if (result.success) {
            await sock.sendMessage(jid, { 
              text: `✅ ${result.message}`
            });
          } else {
            await sock.sendMessage(jid, { 
              text: `❌ **Grant Failed**\n\n${result.error}` 
            });
          }
        } catch (error) {
          await sock.sendMessage(jid, { 
            text: `❌ **Grant Error:** ${error.message}` 
          });
        }
        return;
      }
    }

    // Admin command: Reload admin manager completely
    if (text.toUpperCase() === 'ADMIN RELOAD') {
      try {
        // Create a new admin manager instance
        const newAdminManager = new AdminManager();
        
        // Replace the old one
        Object.assign(adminManager, newAdminManager);
        
        // Reload admin sessions from disk
        await loadAdminSessions();
        
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
          await saveAdminSessions();

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
          await saveAdminSessions();
          
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
        await saveAdminSessions();
        
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

    // Admin command: Show error log
    if (text.toUpperCase() === 'ADMIN ERROR LOG') {
      try {
        console.log(chalk.blue(`📋 Admin ${jid.split('@')[0]} requested error log`));
        
        if (errorLog.length === 0) {
          await sock.sendMessage(jid, { 
            text: `📋 **Error Log**\n\n✅ No errors recorded yet!\n\n🎉 The bot is running smoothly with no issues.`
          });
          return;
        }
        
        let message = `📋 **Error Log** (Last ${Math.min(errorLog.length, 20)} errors)\n\n`;
        
        // Show recent errors (last 20)
        const recentErrors = errorLog.slice(-20).reverse();
        
        for (const error of recentErrors) {
          const severityEmoji = {
            1: '🟡', // Low
            2: '🟠', // Medium  
            3: '🔴', // High
            4: '🚨'  // Critical
          };
          
          const severityText = {
            1: 'LOW',
            2: 'MEDIUM',
            3: 'HIGH', 
            4: 'CRITICAL'
          };
          
          const emoji = severityEmoji[error.severity] || '🟡';
          const severity = severityText[error.severity] || 'LOW';
          const time = new Date(error.timestamp).toLocaleString();
          
          message += `${emoji} **${error.id}**\n`;
          message += `⏰ ${time}\n`;
          message += `📍 ${error.context}\n`;
          message += `⚠️ ${severity} - ${error.message}\n\n`;
        }
        
        message += `📊 **Total Errors:** ${errorLog.length}\n`;
        message += `🕒 **Log Period:** ${errorLog.length > 0 ? new Date(errorLog[0].timestamp).toLocaleString() + ' to ' + new Date(errorLog[errorLog.length - 1].timestamp).toLocaleString() : 'N/A'}\n\n`;
        message += `💡 **Use ADMIN ERROR DETAILS <error_id> to see full error details**`;
        
        await sock.sendMessage(jid, { text: message });
        
        console.log(chalk.green(`📋 Error log sent to admin ${jid.split('@')[0]} (${errorLog.length} errors)`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN ERROR LOG command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Show detailed error information
    if (text.toUpperCase().startsWith('ADMIN ERROR DETAILS ')) {
      try {
        const errorId = text.substring('ADMIN ERROR DETAILS '.length).trim();
        console.log(chalk.blue(`🔍 Admin ${jid.split('@')[0]} requested error details for: ${errorId}`));
        
        const error = errorLog.find(e => e.id === errorId);
        
        if (!error) {
          await sock.sendMessage(jid, { 
            text: `❌ **Error Not Found**\n\nError ID \`${errorId}\` not found in the error log.\n\n💡 Use **ADMIN ERROR LOG** to see available error IDs.`
          });
          return;
        }
        
        const severityEmoji = {
          1: '🟡', // Low
          2: '🟠', // Medium  
          3: '🔴', // High
          4: '🚨'  // Critical
        };
        
        const severityText = {
          1: 'LOW',
          2: 'MEDIUM',
          3: 'HIGH', 
          4: 'CRITICAL'
        };
        
        const emoji = severityEmoji[error.severity] || '🟡';
        const severity = severityText[error.severity] || 'LOW';
        const time = new Date(error.timestamp).toLocaleString();
        
        let message = `${emoji} **Error Details**\n\n`;
        message += `🆔 **Error ID:** \`${error.id}\`\n`;
        message += `⏰ **Time:** ${time}\n`;
        message += `📍 **Context:** ${error.context}\n`;
        message += `⚠️ **Severity:** ${severity}\n`;
        message += `💬 **Message:** ${error.message}\n\n`;
        
        if (error.stack) {
          message += `📚 **Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n\n`;
        }
        
        if (error.additionalData && Object.keys(error.additionalData).length > 0) {
          message += `🔧 **Additional Data:**\n\`\`\`json\n${JSON.stringify(error.additionalData, null, 2)}\n\`\`\`\n\n`;
        }
        
        message += `📊 **Error #${errorLog.indexOf(error) + 1} of ${errorLog.length}**`;
        
        await sock.sendMessage(jid, { text: message });
        
        console.log(chalk.green(`🔍 Error details sent to admin ${jid.split('@')[0]} for error ${errorId}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN ERROR DETAILS command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Test error logging system
    if (text.toUpperCase() === 'ADMIN TEST ERROR') {
      try {
        console.log(chalk.blue(`🧪 Admin ${jid.split('@')[0]} requested error test`));
        
        // Create a test error
        const testError = new Error('This is a test error to verify the error logging system');
        testError.stack = 'TestError: This is a test error to verify the error logging system\n    at testFunction (test.js:1:1)\n    at adminCommand (bot.js:1234:5)';
        
        await handleError(testError, 'admin_test', { 
          requestedBy: jid.split('@')[0],
          testType: 'manual_test',
          timestamp: new Date().toISOString()
        });
        
        await sock.sendMessage(jid, { 
          text: `🧪 **Error Test Completed**\n\n✅ Test error has been generated and logged\n📤 Error notification should be sent to all admins\n\n💡 Use **ADMIN ERROR LOG** to see the test error\n💡 Use **ADMIN ERROR DETAILS <error_id>** to see full details`
        });
        
        console.log(chalk.green(`🧪 Error test completed for admin ${jid.split('@')[0]}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN TEST ERROR command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Test scraper error logging
    if (text.toUpperCase() === 'ADMIN TEST SCRAPER ERROR') {
      try {
        console.log(chalk.blue(`🧪 Admin ${jid.split('@')[0]} requested scraper error test`));
        
        // Create a test scraper error that simulates the Gemini API error
        const testError = new Error('GEMINI_API_SERVICE_UNAVAILABLE: Gemini API service is temporarily unavailable (503). Please wait a few minutes and try again.');
        testError.stack = 'Error: GEMINI_API_SERVICE_UNAVAILABLE: Gemini API service is temporarily unavailable (503). Please wait a few minutes and try again.\n    at main (file:///C:/Users/Hp/Downloads/fullscraper-1/google%20search%20+%20linkdin%20scraper/lead-scraper/scraper.js:1097:13)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)';
        
        await handleError(testError, 'google_search_scraping', { 
          requestedBy: jid.split('@')[0],
          testType: 'scraper_error_test',
          niche: 'test niche',
          dataType: 'contacts',
          format: 'xlsx',
          source: 'google_search',
          timestamp: new Date().toISOString()
        });
        
        await sock.sendMessage(jid, { 
          text: `🧪 **Scraper Error Test Completed**\n\n✅ Test scraper error has been generated and logged\n📤 Error notification should be sent to all admins\n\n💡 This simulates the Gemini API error you saw earlier\n💡 Use **ADMIN ERROR LOG** to see the test error\n💡 Use **ADMIN ERROR DETAILS <error_id>** to see full details`
        });
        
        console.log(chalk.green(`🧪 Scraper error test completed for admin ${jid.split('@')[0]}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN TEST SCRAPER ERROR command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Clear error log
    if (text.toUpperCase() === 'ADMIN CLEAR ERROR LOG') {
      try {
        console.log(chalk.blue(`🗑️ Admin ${jid.split('@')[0]} requested to clear error log`));
        
        const errorCount = errorLog.length;
        
        if (errorCount === 0) {
          await sock.sendMessage(jid, { 
            text: `📋 **Error Log Clear**\n\n✅ Error log is already empty.\n\n📊 **Status:** No errors to clear`
          });
          return;
        }
        
        // Clear the error log
        errorLog.length = 0;
        
        await sock.sendMessage(jid, { 
          text: `🗑️ **Error Log Cleared**\n\n✅ Successfully cleared all errors from the log.\n\n📊 **Cleared:** ${errorCount} error(s)\n📋 **Status:** Error log is now empty\n\n🔄 **Note:** New errors will continue to be logged as they occur.`
        });
        
        console.log(chalk.green(`🗑️ Admin ${jid.split('@')[0]} cleared ${errorCount} errors from the log`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN CLEAR ERROR LOG command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Clear Error Log Failed:** ${error.message}` 
        });
      }
      return;
    }

    // Admin command: Send session.json and codes.json files
    if (text.toUpperCase() === 'ADMIN SEND FILES') {
      try {
        console.log(chalk.blue(`📤 Admin ${jid.split('@')[0]} requested to send system files`));
        
        const sessionsFile = path.join(__dirname, 'sessions.json');
        const codesFile = path.join(__dirname, 'codes.json');
        
        let filesSent = 0;
        let message = `📁 **System Files Sent**\n\n`;
        
        // Send sessions.json file
        if (fs.existsSync(sessionsFile)) {
          try {
            const sessionsData = fs.readFileSync(sessionsFile);
            const sessionsSize = (sessionsData.length / 1024).toFixed(2);
            
            await sock.sendMessage(jid, {
              document: sessionsData,
              fileName: 'sessions.json',
              mimetype: 'application/json',
              caption: `📄 **Sessions File**\n\n📁 File: sessions.json\n📏 Size: ${sessionsSize} KB\n📱 Sessions: ${Object.keys(JSON.parse(sessionsData.toString())).length}\n\n🔐 Contains user session data and daily limits`
            });
            
            filesSent++;
            message += `✅ **sessions.json** sent (${sessionsSize} KB)\n`;
            console.log(chalk.green(`✅ Sessions file sent to admin ${jid.split('@')[0]}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to send sessions file: ${error.message}`));
            message += `❌ **sessions.json** failed to send: ${error.message}\n`;
          }
        } else {
          message += `❌ **sessions.json** not found\n`;
        }
        
        // Send codes.json file
        if (fs.existsSync(codesFile)) {
          try {
            const codesData = fs.readFileSync(codesFile);
            const codesSize = (codesData.length / 1024).toFixed(2);
            
            await sock.sendMessage(jid, {
              document: codesData,
              fileName: 'codes.json',
              mimetype: 'application/json',
              caption: `📄 **Codes File**\n\n📁 File: codes.json\n📏 Size: ${codesSize} KB\n🔑 Codes: ${Object.keys(JSON.parse(codesData.toString())).length}\n\n🔐 Contains user access codes and API keys`
            });
            
            filesSent++;
            message += `✅ **codes.json** sent (${codesSize} KB)\n`;
            console.log(chalk.green(`✅ Codes file sent to admin ${jid.split('@')[0]}`));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to send codes file: ${error.message}`));
            message += `❌ **codes.json** failed to send: ${error.message}\n`;
          }
        } else {
          message += `❌ **codes.json** not found\n`;
        }
        
        message += `\n📊 **Summary:** ${filesSent}/2 files sent successfully`;
        
        await sock.sendMessage(jid, { text: message });
        
        console.log(chalk.green(`📤 Admin ${jid.split('@')[0]} received ${filesSent}/2 system files`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in ADMIN SEND FILES command:`, error.message));
        await sock.sendMessage(jid, { 
          text: `❌ **Internal Error:** ${error.message}` 
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
        'ADMIN ADD ADMIN', 'ADMIN REMOVE ADMIN', 'ADMIN STATUS', 'ADMIN CLEANUP', 'ADMIN HELP',
        'ADMIN SESSIONS', 'ADMIN REFRESH', 'ADMIN ADMINSESSIONSFILE', 
        'ADMIN USERSESSIONSFILE', 'ADMIN FILES', 'ADMIN DEBUG', 'ADMIN LOG',
        'ADMIN SESSIONSFILE', 'ADMIN RESET', 'ADMIN CONFIGFILE', 'ADMIN CODESFILE',
        'ADMIN CLEAR', 'ADMIN AUTH', 'ADMIN LOGOUT', 'ADMIN ME', 'ADMIN INFO', 'ADMIN TEST',
        'ADMIN RELOAD', 'ADMIN CONFIG', 'ADMIN CODES', 'ADMIN SESSIONS', 'ADMIN GRANT',
        'ADMIN SEND FILES', 'ADMIN ERROR LOG', 'ADMIN ERROR DETAILS', 'ADMIN TEST ERROR', 'ADMIN TEST SCRAPER ERROR', 'ADMIN CLEAR ERROR LOG'
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
          text: `❌ **Invalid Admin Command!**\n\n⚠️ The command "${text}" is not recognized.\n\n💡 **Available Commands:**\n• ADMIN USERS - List all users\n• ADMIN ADD USER <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>\n• ADMIN REMOVE USER <code>\n• ADMIN ADMINS - List all admins\n• ADMIN STATUS - System status\n• ADMIN HELP - Show detailed help\n• ADMIN LOGOUT - Switch to user mode\n\n🔄 **Try again with a valid command!**`
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

   // Handle language selection for unauthenticated users
   if (session.currentStep === 'awaiting_language' && !session.apiKeys) {
     const langNumber = parseInt(text);
     const langMap = { 1: 'en', 2: 'fr', 3: 'ar' };
     
     if (langNumber >= 1 && langNumber <= 3) {
       session.language = langMap[langNumber];
       session.currentStep = 'awaiting_authentication';
       saveJson(SESSIONS_FILE, sessions);
       
       console.log(chalk.green(`🌐 User ${jid.split('@')[0]} selected language: ${session.language}`));
       console.log(chalk.green(`🌐 Session saved with language: ${session.language}, currentStep: ${session.currentStep}`));
       console.log(chalk.green(`🌐 Session object after save:`, JSON.stringify(session, null, 2)));
       
      await sendImageWithMessage(sock, jid, 'authentication', getMessage(session.language, 'auth_required'), session.language);
       return;
     } else if (text.trim() === '0') {
       // For unauthenticated users, "0" should resend the welcome message (no main menu to go back to)
       console.log(chalk.yellow(`⚠️ User ${jid.split('@')[0]} pressed 0 during language selection - resending welcome message`));
       await sendImageWithMessage(sock, jid, 'welcome', getMessage('fr', 'welcome'), 'fr');
       return;
     } else {
       // Invalid selection - resend language selection message
       console.log(chalk.yellow(`⚠️ Invalid language selection from ${jid.split('@')[0]}: "${text}" - resending language selection`));
       await sendImageWithMessage(sock, jid, 'welcome', getMessage('fr', 'welcome'), 'fr');
       return;
     }
   }
   
   // Handle authentication for users who have selected language
    if (session.currentStep === 'awaiting_authentication' && !session.apiKeys) {
      if (text.trim() === '0') {
        // User wants to go back to language selection
        session.currentStep = 'awaiting_language';
        saveJson(SESSIONS_FILE, sessions);
        console.log(chalk.yellow(`🔄 User ${jid.split('@')[0]} going back to language selection from authentication`));
        await sendImageWithMessage(sock, jid, 'welcome', getMessage('fr', 'welcome'), 'fr');
        return;
      } else if (!/^CODE:?\s+/i.test(text)) {
        // Invalid input - resend authentication message
        console.log(chalk.yellow(`⚠️ Invalid authentication attempt from ${jid.split('@')[0]}: "${text}" - resending auth message`));
        await sendImageWithMessage(sock, jid, 'authentication', getMessage(session.language, 'auth_required'), session.language);
       return;
     }
     // If it's a CODE command, let it continue to the authentication logic below
   }
   
   // STRICT AUTHENTICATION: No responses until CODE is provided (for regular users who haven't selected language)
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
    // Handle language selection for authenticated users
    if (session.currentStep === 'awaiting_language' && session.apiKeys) {
      const langNumber = parseInt(text);
      const langMap = { 1: 'en', 2: 'fr', 3: 'ar' };
      
      if (langNumber >= 1 && langNumber <= 3) {
        session.language = langMap[langNumber];
        
        // Save language to user's profile in codes.json
        if (session.code && codesDb[session.code]) {
          codesDb[session.code].language = session.language;
          saveJson(CODES_FILE, codesDb);
        }
        
        session.currentStep = 'main_menu';
        saveJson(SESSIONS_FILE, sessions);
        
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        return;
      } else if (text.trim() === '0') {
        // User wants to go back to main menu
        session.currentStep = 'main_menu';
        saveJson(SESSIONS_FILE, sessions);
        
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        return;
      } else {
        // Invalid selection - send invalid selection error message and resend language selection
        console.log(chalk.yellow(`⚠️ Invalid language selection from ${jid.split('@')[0]}: "${text}" - sending invalid selection message`));
        
        // Send invalid selection error message
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'invalid_selection', { max: 3 })
        });
        
        // Then resend language selection message
        await sendImageWithMessage(sock, jid, 'language', getMessage(session.language, 'language_selection'), session.language);
        return;
      }
    }

    // Handle main menu selections
    if (session.currentStep === 'main_menu' && session.apiKeys) {
      const menuChoice = parseInt(text);
      
      if (menuChoice >= 1 && menuChoice <= 5) {
        switch (menuChoice) {
          case 1: // START SCRAPER
            // Early trial check: block immediately if trial finished
            try {
              const codesNow = loadJson(CODES_FILE, {});
              const userCodeNow = session.code;
              const entry = userCodeNow ? (codesNow[userCodeNow] || {}) : {};
              const stageNow = entry.stage || 'free_trial';
              // Block unpaid users immediately with expiry message
              if (stageNow === 'unpaid') {
                await sock.sendMessage(jid, { text: getMessage(session.language, 'subscription_expired') });
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
                return;
              }
              const trialNow = entry.trial || { triesUsed: 0, maxTries: 3 };
              if (stageNow === 'free_trial' && (trialNow.triesUsed || 0) >= (trialNow.maxTries || 3)) {
                await sock.sendMessage(jid, { text: getMessage(session.language, 'trial_finished') });
                // Stay in main menu
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
                return;
              }
            } catch (e) {
              // If any issue reading codes, fall back to normal flow
            }
            
            // Check daily scraping limit before allowing user to enter business/service
            const limitInfo = checkDailyScrapingLimit(jid, sessions);
            console.log(chalk.yellow(`🔍 Daily limit check for ${jid.split('@')[0]} (main menu): ${JSON.stringify(limitInfo)}`));
            
            if (!limitInfo.canScrape) {
              console.log(chalk.red(`🚫 User ${jid.split('@')[0]} attempted to start scraper but daily limit reached: ${limitInfo.remaining}/${DAILY_SCRAPING_LIMIT}`));
              const limitMessage = getDailyScrapingStatusMessage(limitInfo, session.language);
              await sock.sendMessage(jid, { text: limitMessage });
              
              // Stay in main menu
              await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
              return;
            }
            
            console.log(chalk.green(`✅ User ${jid.split('@')[0]} can start scraper: ${limitInfo.remaining}/${DAILY_SCRAPING_LIMIT} remaining`));
            
            session.currentStep = 'awaiting_business_service';
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
              text: getMessage(session.language, 'enter_niche')
            });
            return;
            
          case 2: // STATUS
            try {
              // Trial-first status
              const codesNow = loadJson(CODES_FILE, {});
              const codeNow = session.code;
              const entry = codeNow ? (codesNow[codeNow] || {}) : {};
              const stage = entry.stage || 'free_trial';
              if (stage === 'free_trial') {
                const trial = entry.trial || { triesUsed: 0, maxTries: 3 };
                const triesUsed = Math.min(trial.triesUsed || 0, trial.maxTries || 3);
                const maxTries = trial.maxTries || 3;
                const remaining = Math.max(0, maxTries - triesUsed);
                if (triesUsed >= maxTries) {
                  await sock.sendMessage(jid, { text: getMessage(session.language, 'trial_finished') });
                } else {
                  let msg = getMessage(session.language, 'trial_status_title');
                  msg += getMessage(session.language, 'trial_status_body', { triesUsed, maxTries, remaining });
                  await sendImageWithMessage(sock, jid, 'status', msg, session.language);
                }
              } else if (stage === 'unpaid') {
                await sock.sendMessage(jid, { text: getMessage(session.language, 'subscription_expired') });
              } else {
                const limitInfo = checkDailyScrapingLimit(jid, sessions);
                const statusMessage = getDailyScrapingStatusMessage(limitInfo, session.language);
                let message = getMessage(session.language, 'status_title');
                message += statusMessage;
                // If paid, append subscription expiry info
                if (stage === 'paid' && entry.paid && entry.paid.expiresAt) {
                  const expiresDate = new Date(entry.paid.expiresAt);
                  const now = new Date();
                  let remainingStr = '';
                  const ms = expiresDate - now;
                  if (ms <= 0) {
                    remainingStr = '0d';
                  } else {
                    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    remainingStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  }
                  const expiresStr = expiresDate.toLocaleString();
                  message += getMessage(session.language, 'paid_status', { expires: expiresStr, remaining: remainingStr });
                }
                await sendImageWithMessage(sock, jid, 'status', message, session.language);
              }
            } catch (error) {
              console.error(chalk.red(`❌ Error in STATUS command:`, error.message));
              await sock.sendMessage(jid, { 
                text: `❌ **Error checking status:** ${error.message}` 
              });
            }
            // Show main menu again
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
            
          case 3: // USER GUIDE
            await handleUserGuide(sock, jid, session);
            return;
            
          case 4: // CHANGE LANGUAGE
            session.currentStep = 'awaiting_language';
            saveJson(SESSIONS_FILE, sessions);
            await sendImageWithMessage(sock, jid, 'language', getMessage(session.language, 'language_selection'), session.language);
            return;
            
          case 5: // LOGOUT
            // Ask for logout confirmation
            session.currentStep = 'logout_confirmation';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'logout', getMessage(session.language, 'logout_confirmation'), session.language);
            return;
        }
      } else {
        // Invalid selection - show main menu again
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        return;
      }
    }
    
    // Handle stop confirmation state
    if (session.currentStep === 'stop_confirmation') {
      if (text.trim() === '1') {
        // User confirmed stopping the job
        try {
          const activeJob = activeJobs.get(jid);
          if (activeJob && activeJob.abort) {
            // Stop the progress simulator first
            if (activeJob.progressSimulator) {
              activeJob.progressSimulator.stop();
              console.log(chalk.yellow(`🛑 Stopped progress simulator for ${jid.split('@')[0]}`));
            }
            
            // Stop the job
            activeJob.abort.abort();
            console.log(chalk.yellow(`🛑 User ${jid.split('@')[0]} confirmed stopping the job`));
            
            // Clear the active job from the Map
            activeJobs.delete(jid);
            console.log(chalk.yellow(`🛑 Cleared active job for ${jid.split('@')[0]}`));
            
            // Check if there are any results to send
            let resultsFound = false;
            
            // First check pendingResults
            if (pendingResults.has(jid)) {
              const pendingResult = pendingResults.get(jid);
              try {
                // Send the results that were found
                await sendResultsToUser(sock, jid, pendingResult.filePath, pendingResult.meta, session.language);
                pendingResults.delete(jid);
                savePendingResults();
                
                // Send success message with results
                await sock.sendMessage(jid, { 
                  text: getMessage(session.language, 'stop_success', { results: 'Results found and sent above' })
                });
                resultsFound = true;
              } catch (error) {
                console.log(chalk.red(`❌ Failed to send results after stop: ${error.message}`));
                await sock.sendMessage(jid, { 
                  text: getMessage(session.language, 'stop_success', { results: 'Results found but failed to send' })
                });
                resultsFound = true;
              }
            }
            
            // If no pending results, check for autosaved files
            if (!resultsFound) {
              try {
                const resultsDir = path.join(__dirname, 'results');
                if (fs.existsSync(resultsDir)) {
                  const files = fs.readdirSync(resultsDir);
                  
                  // Look for autosaved files for this session ONLY
                  const currentNiche = session.meta?.lastNiche || session.meta?.lastBusinessService || session.niche || 'unknown';
                  const currentSource = session.meta?.lastSource || 'unknown';
                  const sessionStartTime = session.meta?.jobStartTime || Date.now();
                  const maxFileAge = 10 * 60 * 1000; // 10 minutes - files older than this are not from current session
                  
                  // If no job start time is recorded, use a very recent time to ensure we only get current session files
                  const effectiveStartTime = sessionStartTime === Date.now() ? Date.now() - (5 * 60 * 1000) : sessionStartTime;
                  
                  console.log(chalk.blue(`🔍 Looking for autosaved files for business/service: "${currentNiche}" and source: "${currentSource}"`));
                  console.log(chalk.blue(`⏰ Session started at: ${new Date(sessionStartTime).toLocaleString()}`));
                  console.log(chalk.blue(`⏰ Effective start time: ${new Date(effectiveStartTime).toLocaleString()}`));
                  console.log(chalk.blue(`⏰ Max file age: ${Math.round(maxFileAge / 1000 / 60)} minutes`));
                  
                  // Determine what file types to look for based on the source
                  let fileExtensions = ['.xlsx'];
                  let filePatterns = [];
                  let searchDirectory = resultsDir; // Default to results directory
                  
                  if (currentSource === 'MAPS' || currentSource === 'google_maps') {
                    // Google Maps creates .json files with pattern: business_service_google_maps_autosave_SESSION_ID.json
                    fileExtensions = ['.json'];
                    filePatterns.push('google_maps_autosave');
                    searchDirectory = resultsDir; // Look in results directory
                    console.log(chalk.blue(`🗺️ Looking for Google Maps autosave files (.json) in: ${searchDirectory}`));
                  } else if (currentSource === 'LINKEDIN' || currentSource === 'linkedin') {
                    // LinkedIn creates .xlsx files with autosave pattern
                    filePatterns.push('autosave', 'SESSION_');
                    searchDirectory = resultsDir; // Look in results directory
                    console.log(chalk.blue(`💼 Looking for LinkedIn autosave files in: ${searchDirectory}`));
                  } else if (currentSource === 'GOOGLE' || currentSource === 'google_search') {
                    // Google Search creates .txt files in lead-scraper directory
                    fileExtensions = ['.txt'];
                    filePatterns.push('results');
                    searchDirectory = path.join(__dirname, 'google search + linkdin scraper', 'lead-scraper'); // Look in lead-scraper directory
                    console.log(chalk.blue(`🌐 Looking for Google Search results files in: ${searchDirectory}`));
                  }
                  
                  // Get files from the appropriate directory
                  let searchDirectoryFiles = [];
                  if (fs.existsSync(searchDirectory)) {
                    searchDirectoryFiles = fs.readdirSync(searchDirectory);
                    console.log(chalk.blue(`📁 Found ${searchDirectoryFiles.length} files in search directory: ${searchDirectory}`));
                  } else {
                    console.log(chalk.yellow(`⚠️ Search directory does not exist: ${searchDirectory}`));
                  }
                  
                  // STRICT filtering: Only look for files that are:
                  // 1. From the current session (created after session start)
                  // 2. Match the current business/service exactly
                  // 3. Match the current source type
                  // 4. Are actually autosaved (not completed files)
                  let autosaveFiles = searchDirectoryFiles.filter(file => {
                    try {
                      const filePath = path.join(searchDirectory, file);
                      const fileStat = fs.statSync(filePath);
                      const fileCreationTime = fileStat.mtime.getTime();
                      
                                                                   // Check if file is from current session (created AFTER session started, within 10 minutes)
                      const isFromCurrentSession = fileCreationTime >= effectiveStartTime && (fileCreationTime - effectiveStartTime) <= maxFileAge;
                      
                      // Check if file matches current business/service exactly
                      // Handle multiple naming formats: with underscores, without spaces, with spaces
                      const nicheWithUnderscores = currentNiche.toLowerCase().replace(/\s+/g, '_');
                      const nicheWithoutSpaces = currentNiche.toLowerCase().replace(/\s+/g, '');
                      const hasCorrectNiche = file.toLowerCase().includes(nicheWithUnderscores) || 
                                            file.toLowerCase().includes(nicheWithoutSpaces) ||
                                            file.toLowerCase().includes(currentNiche.toLowerCase());
                      
                      // Debug logging for business/service matching
                      if (currentSource === 'MAPS' || currentSource === 'google_maps') {
                        console.log(chalk.gray(`   🔍 Business/service matching for "${file}":`));
                        console.log(chalk.gray(`      - Current business/service: "${currentNiche}"`));
                        console.log(chalk.gray(`      - With underscores: "${nicheWithUnderscores}"`));
                        console.log(chalk.gray(`      - Without spaces: "${nicheWithoutSpaces}"`));
                        console.log(chalk.gray(`      - Matches: ${hasCorrectNiche}`));
                      }
                      
                      // Check if file has correct extension and patterns
                      const hasCorrectExtension = fileExtensions.some(ext => file.endsWith(ext));
                      const hasCorrectPatterns = filePatterns.every(pattern => file.includes(pattern));
                      
                      // Check if file is actually autosaved (not completed)
                      const isAutosaved = file.includes('autosave') || file.includes('SESSION');
                      
                      // Check if file matches current source type
                      const matchesSource = (currentSource === 'MAPS' || currentSource === 'google_maps') ? 
                        file.includes('google_maps') : 
                        (currentSource === 'LINKEDIN' || currentSource === 'linkedin') ? 
                        file.includes('linkedin') : 
                        (currentSource === 'GOOGLE' || currentSource === 'google_search') ? 
                        file.includes('results') : true;
                      
                      // Log detailed filtering for debugging
                      if (hasCorrectExtension && hasCorrectNiche && isAutosaved && matchesSource) {
                        console.log(chalk.blue(`🔍 File "${file}" filtering details:`));
                        console.log(chalk.blue(`   - Extension: ${hasCorrectExtension} (${fileExtensions.join(', ')})`));
                        console.log(chalk.blue(`   - Niche: ${hasCorrectNiche} (looking for: ${currentNiche})`));
                        console.log(chalk.blue(`   - Patterns: ${hasCorrectPatterns} (${filePatterns.join(', ')})`));
                        console.log(chalk.blue(`   - Autosaved: ${isAutosaved}`));
                        console.log(chalk.blue(`   - Source: ${matchesSource} (${currentSource})`));
                        console.log(chalk.blue(`   - Session: ${isFromCurrentSession} (created: ${new Date(fileCreationTime).toLocaleString()}, effective session: ${new Date(effectiveStartTime).toLocaleString()})`));
                      }
                      
                      // ALL conditions must be met
                      return hasCorrectExtension && 
                             hasCorrectNiche && 
                             hasCorrectPatterns && 
                             isAutosaved && 
                             matchesSource && 
                             isFromCurrentSession;
                    } catch (error) {
                      console.log(chalk.yellow(`⚠️ Error checking file "${file}": ${error.message}`));
                      return false;
                    }
                  });
                  
                  console.log(chalk.blue(`📁 Found ${autosaveFiles.length} autosaved files from current session:`));
                  autosaveFiles.forEach(file => console.log(chalk.blue(`   - ${file}`)));
                  
                  // If no files found, this means the job was stopped before autosave
                  if (autosaveFiles.length === 0) {
                    console.log(chalk.yellow(`⚠️ No autosaved files found from current session`));
                    console.log(chalk.yellow(`⚠️ This means the job was stopped before any results could be saved`));
                    console.log(chalk.yellow(`⚠️ Will send "no results found" message instead of old files`));
                  }
                  
                  if (autosaveFiles.length > 0) {
                    // Sort by modification time to get the most recent
                    const sortedFiles = autosaveFiles.sort((a, b) => {
                      const statA = fs.statSync(path.join(searchDirectory, a));
                      const statB = fs.statSync(path.join(searchDirectory, b));
                      return statB.mtime.getTime() - statA.mtime.getTime();
                    });
                    
                    const mostRecentFile = sortedFiles[0];
                    const filePath = path.join(searchDirectory, mostRecentFile);
                    
                    console.log(chalk.green(`📁 Found matching autosaved file: ${mostRecentFile}`));
                    console.log(chalk.blue(`📝 Original filename analysis:`));
                    console.log(chalk.blue(`   - Full filename: ${mostRecentFile}`));
                    console.log(chalk.blue(`   - Contains autosave: ${mostRecentFile.includes('autosave')}`));
                    console.log(chalk.blue(`   - Contains SESSION: ${mostRecentFile.includes('SESSION')}`));
                    console.log(chalk.blue(`   - File extension: ${path.extname(mostRecentFile)}`));
                    
                    // Create a clean filename for the user
                    // Handle different file types and patterns
                    let cleanFilename = mostRecentFile;
                    
                    console.log(chalk.blue(`🔍 Filename cleaning process:`));
                    console.log(chalk.blue(`   - Original: ${mostRecentFile}`));
                    console.log(chalk.blue(`   - Source type: ${currentSource}`));
                    
                    let cleaned = false;
                    
                    if (currentSource === 'MAPS' || currentSource === 'google_maps') {
                      // Google Maps files: niche_google_maps_autosave_SESSION_ID.json
                      if (cleanFilename.includes('_google_maps_autosave')) {
                        // Use our clean filename generator to remove source information
                        cleanFilename = generateCleanUserFileName(cleanFilename);
                        console.log(chalk.blue(`🗺️ Google Maps Pattern: ${mostRecentFile} → ${cleanFilename}`));
                        cleaned = true;
                      }
                    } else if (currentSource === 'LINKEDIN' || currentSource === 'linkedin') {
                      // LinkedIn files: handle autosave patterns
                      if (cleanFilename.includes('_autosave') || cleanFilename.includes('_linkedin')) {
                        // Use our clean filename generator to remove source information
                        cleanFilename = generateCleanUserFileName(cleanFilename);
                        console.log(chalk.blue(`📝 LinkedIn Pattern: ${mostRecentFile} → ${cleanFilename}`));
                        cleaned = true;
                      }
                    } else if (currentSource === 'GOOGLE' || currentSource === 'google_search') {
                      // Google Search files: remove session part and source information
                      if (cleanFilename.includes('_autosave') || cleanFilename.includes('_google_search') || cleanFilename.includes('_results')) {
                        // Use our clean filename generator to remove source information
                        cleanFilename = generateCleanUserFileName(cleanFilename);
                        console.log(chalk.blue(`🌐 Google Search Pattern: ${mostRecentFile} → ${cleanFilename}`));
                        cleaned = true;
                      }
                    }
                    
                    // If no patterns matched, keep original but log warning
                    if (!cleaned) {
                      console.log(chalk.yellow(`⚠️ No cleaning pattern found for source "${currentSource}", keeping original filename: ${cleanFilename}`));
                    }
                    
                    console.log(chalk.green(`✅ Final cleaned filename: ${cleanFilename}`));
                    
                    // Verify that the niche name is preserved
                    if (cleanFilename.includes('linkedin_results.xlsx') && !cleanFilename.includes('_')) {
                      console.log(chalk.red(`⚠️ WARNING: Niche name appears to be lost! Filename: ${cleanFilename}`));
                      console.log(chalk.red(`⚠️ This suggests the autosaved file doesn't contain the niche name`));
                    }
                    
                    // Read the file to get actual result count
                    let resultCount = 0;
                    try {
                      console.log(chalk.blue(`📁 Attempting to read file: ${filePath}`));
                      console.log(chalk.blue(`📁 File exists: ${fs.existsSync(filePath)}`));
                      console.log(chalk.blue(`📁 File size: ${fs.statSync(filePath).size} bytes`));
                      
                      // Check file type and read accordingly
                      if (filePath.endsWith('.json')) {
                        // Google Maps JSON file
                        console.log(chalk.blue(`📦 Reading Google Maps JSON file`));
                        const fs = require('fs');
                        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        
                        // Google Maps JSON has structure: { metadata: {...}, results: [...] }
                        if (jsonData.results && Array.isArray(jsonData.results)) {
                          resultCount = jsonData.results.length;
                          console.log(chalk.green(`📊 Successfully read ${resultCount} results from Google Maps JSON file`));
                        } else if (Array.isArray(jsonData)) {
                          // Fallback: direct array structure
                          resultCount = jsonData.length;
                          console.log(chalk.green(`📊 Successfully read ${resultCount} results from JSON array file`));
                        } else {
                          resultCount = 0;
                          console.log(chalk.yellow(`⚠️ JSON file doesn't have expected structure: ${JSON.stringify(Object.keys(jsonData))}`));
                        }
                      } else if (filePath.endsWith('.xlsx')) {
                        // LinkedIn/Excel file
                        console.log(chalk.blue(`📦 Reading Excel file with XLSX library`));
                        const XLSX = require('xlsx');
                        const workbook = XLSX.readFile(filePath);
                        console.log(chalk.blue(`📖 Workbook read successfully, sheets: ${workbook.SheetNames.join(', ')}`));
                        
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        console.log(chalk.blue(`📋 Worksheet "${sheetName}" loaded, dimensions: ${worksheet['!ref']}`));
                        
                        const data = XLSX.utils.sheet_to_json(worksheet);
                        resultCount = data.length;
                        console.log(chalk.green(`📊 Successfully read ${resultCount} results from Excel file`));
                      } else {
                        // Text file (Google Search)
                        console.log(chalk.blue(`📦 Reading Google Search text file`));
                        const fs = require('fs');
                        const content = fs.readFileSync(filePath, 'utf8');
                        const lines = content.split('\n').filter(line => line.trim());
                        
                        // Try to parse the header to get the correct count
                        let headerCount = 0;
                        let foundHeader = false;
                        
                        for (const line of lines) {
                          // Look for the "Total Emails: X | Total Phone Numbers: Y" line which contains both counts
                          if (line.includes('Total Emails:') && line.includes('Total Phone Numbers:')) {
                            console.log(chalk.blue(`📊 Found Total Emails/Phones line: ${line}`));
                            foundHeader = true;
                            
                            // Parse: "Total Emails: 45 | Total Phone Numbers: 38"
                            const emailMatch = line.match(/Total Emails:\s*(\d+)/);
                            const phoneMatch = line.match(/Total Phone Numbers:\s*(\d+)/);
                            
                            if (emailMatch && phoneMatch) {
                              const emailCount = parseInt(emailMatch[1]);
                              const phoneCount = parseInt(phoneMatch[1]);
                              headerCount = emailCount + phoneCount; // Sum both counts for total contacts
                              console.log(chalk.green(`📊 Parsed email count: ${emailCount}, phone count: ${phoneCount}, total contacts: ${headerCount}`));
                            }
                            break;
                          }
                          // Handle case where only emails are present
                          else if (line.includes('Total Emails:') && !line.includes('Total Phone Numbers:')) {
                            console.log(chalk.blue(`📊 Found Total Emails only line: ${line}`));
                            foundHeader = true;
                            
                            // Parse: "Total Emails: 45"
                            const emailMatch = line.match(/Total Emails:\s*(\d+)/);
                            
                            if (emailMatch) {
                              headerCount = parseInt(emailMatch[1]);
                              console.log(chalk.green(`📊 Parsed email count only: ${headerCount} total`));
                            }
                            break;
                          }
                          // Handle case where only phones are present
                          else if (line.includes('Total Phone Numbers:') && !line.includes('Total Emails:')) {
                            console.log(chalk.blue(`📊 Found Total Phone Numbers only line: ${line}`));
                            foundHeader = true;
                            
                            // Parse: "Total Phone Numbers: 38"
                            const phoneMatch = line.match(/Total Phone Numbers:\s*(\d+)/);
                            
                            if (phoneMatch) {
                              headerCount = parseInt(phoneMatch[1]);
                              console.log(chalk.green(`📊 Parsed phone count only: ${headerCount} total`));
                            }
                            break;
                          }
                          // Fallback: Look for the old "Total Contacts:" line format (for backward compatibility)
                          else if (line.includes('Total Contacts:')) {
                            console.log(chalk.blue(`📊 Found Total Contacts line (legacy): ${line}`));
                            foundHeader = true;
                            
                            // Parse: "Total Contacts: 208"
                            const totalMatch = line.match(/Total Contacts:\s*(\d+)/);
                            
                            if (totalMatch) {
                              headerCount = parseInt(totalMatch[1]);
                              console.log(chalk.green(`📊 Parsed total contacts (legacy): ${headerCount} total`));
                            }
                            break;
                          }
                        }
                        
                        if (foundHeader && headerCount > 0) {
                          // Use the header count if available
                          resultCount = headerCount;
                          console.log(chalk.green(`📊 Using header count: ${resultCount} results`));
                        } else {
                          // Fallback: count data lines (skip headers and formatting)
                          const dataLines = lines.filter(line => {
                            // Skip header lines and empty lines
                            const isHeader = line.includes('Email and Phone Numbers Data for:') ||
                                           line.includes('Results for:') ||
                                           line.includes('Session:') ||
                                           line.includes('Timestamp:') ||
                                           line.includes('Generated on:') ||
                                           line.includes('Total Emails:') ||
                                           line.includes('Total Phones:') ||
                                           line.includes('Total Contacts:') ||
                                           line.includes('─') ||
                                           line.includes('=') ||
                                           line.includes('📧') ||
                                           line.includes('📞') ||
                                           line.includes('🌐') ||
                                           line.includes('📍') ||
                                           line.includes('📊') ||
                                           line.includes('Total:') ||
                                           line.includes('Found:');
                            
                            // Skip lines that are just separators or formatting
                            const isSeparator = line.trim().length === 0 || 
                                              line.trim() === '─' || 
                                              line.trim() === '=' ||
                                              line.trim() === '|';
                            
                            return !isHeader && !isSeparator && line.trim().length > 0;
                          });
                          
                          resultCount = dataLines.length;
                          console.log(chalk.yellow(`⚠️ Header parsing failed, using line count: ${resultCount} results`));
                        }
                        
                        console.log(chalk.green(`📊 Final result count: ${resultCount} results from Google Search text file`));
                        console.log(chalk.gray(`   - Total lines in file: ${lines.length}`));
                        console.log(chalk.gray(`   - Header parsing: ${foundHeader ? 'success' : 'failed'}`));
                        console.log(chalk.gray(`   - Count method: ${foundHeader ? 'header' : 'line counting'}`));
                      }
                    } catch (error) {
                      console.log(chalk.red(`❌ Error reading file: ${error.message}`));
                      console.log(chalk.red(`❌ Error stack: ${error.stack}`));
                      // Use localized fallback text instead of hardcoded English
                      resultCount = getMessage(session.language, 'autosaved_results');
                    }
                    
                    // Apply Google Search data type adjustment: subtract 2 for emails-only or phones-only
                    if (typeof resultCount === 'number' && resultCount > 0) {
                      const currentSource = session.meta?.lastSource || 'unknown';
                      const currentDataType = session.meta?.lastDataType || 'unknown';
                      
                      // Check if conditions are met: Google Search + (emails-only OR phones-only)
                      if (currentSource === 'GOOGLE' && (currentDataType === 'emails' || currentDataType === 'phones')) {
                        const originalCount = resultCount;
                        resultCount = Math.max(0, resultCount - 2); // Ensure it doesn't go below 0
                        console.log(chalk.blue(`📊 Google Search data type adjustment:`));
                        console.log(chalk.blue(`   - Source: ${currentSource}`));
                        console.log(chalk.blue(`   - Data Type: ${currentDataType}`));
                        console.log(chalk.blue(`   - Original count: ${originalCount}`));
                        console.log(chalk.blue(`   - Adjusted count: ${resultCount} (subtracted 2)`));
                      }
                    }
                    
                    // Format the result count properly
                    const formattedResults = typeof resultCount === 'number' 
                      ? `${resultCount} ${getMessage(session.language, 'results')}`
                      : resultCount;
                    
                    console.log(chalk.blue(`📊 Result count formatting:`));
                    console.log(chalk.blue(`   - Original resultCount: ${resultCount} (type: ${typeof resultCount})`));
                    console.log(chalk.blue(`   - Formatted results: ${formattedResults}`));
                    console.log(chalk.blue(`   - Language: ${session.language}`));
                    
                    // Check if the file actually has results
                    if (resultCount === 0) {
                      console.log(chalk.yellow(`⚠️ File contains 0 results - this is likely a completed file, not an autosaved file`));
                      console.log(chalk.yellow(`⚠️ Will not send this file to user - should send "no results found" message instead`));
                      // Don't set resultsFound = true, let it fall through to "no results found" message
                    } else {
                      // First send success message ONLY if we have results to send
                      await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'stop_success')
                      });
                      
                      // For Google Maps JSON files, convert to Excel before sending
                      let finalFilePath = filePath;
                      let finalFormat = filePath.endsWith('.json') ? 'JSON' : filePath.endsWith('.xlsx') ? 'XLSX' : 'TXT';
                      let finalCustomFilename = cleanFilename;
                      
                      if (filePath.endsWith('.json') && (currentSource === 'MAPS' || currentSource === 'google_maps')) {
                        try {
                          console.log(chalk.blue(`🔄 Converting Google Maps JSON to Excel format...`));
                          
                          // Read the JSON data
                          const fs = require('fs');
                          const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                          
                          if (jsonData.results && Array.isArray(jsonData.results)) {
                            // Create Excel file from JSON data
                            const XLSX = require('xlsx');
                            const workbook = XLSX.utils.book_new();
                            
                            // Process the results to handle arrays properly
                            const processedResults = jsonData.results.map(result => {
                              const processedResult = { ...result };
                              
                              // Handle emails array - join with "/" if it's an array
                              if (Array.isArray(processedResult.emails)) {
                                if (processedResult.emails.length > 0) {
                                  console.log(chalk.blue(`📧 Processing emails array for "${processedResult.name}": ${processedResult.emails.join(', ')}`));
                                  processedResult.emails = processedResult.emails.join(' / ');
                                } else {
                                  processedResult.emails = '';
                                }
                              }
                              
                              // Handle other potential arrays (phones, websites, etc.)
                              if (Array.isArray(processedResult.phone)) {
                                if (processedResult.phone.length > 0) {
                                  console.log(chalk.blue(`📞 Processing phone array for "${processedResult.name}": ${processedResult.phone.join(', ')}`));
                                  processedResult.phone = processedResult.phone.join(' / ');
                                } else {
                                  processedResult.phone = '';
                                }
                              }
                              
                              if (Array.isArray(processedResult.website)) {
                                if (processedResult.website.length > 0) {
                                  console.log(chalk.blue(`🌐 Processing website array for "${processedResult.name}": ${processedResult.website.join(', ')}`));
                                  processedResult.website = processedResult.website.join(' / ');
                                } else {
                                  processedResult.website = '';
                                }
                              }
                              
                              return processedResult;
                            });
                            
                            // Create custom worksheet with specific column order and no Source column
                            const customResults = processedResults.map(result => {
                              // Create new object with desired column order and no Source column
                              const customResult = {};
                              
                              // Column order: Business Name -> Phone -> Address -> Website -> Emails
                              if (result.name) customResult['Business Name'] = result.name;
                              if (result.phone) customResult['Phone'] = result.phone;
                              if (result.address) customResult['Address'] = result.address;
                              if (result.website) customResult['Website'] = result.website;
                              if (result.emails) customResult['Emails'] = result.emails;
                              
                              return customResult;
                            });
                            
                            const worksheet = XLSX.utils.json_to_sheet(customResults);
                            
                            // Auto-size columns for better readability
                            const cols = [];
                            if (customResults.length > 0) {
                              Object.keys(customResults[0]).forEach(key => {
                                const maxLength = Math.max(
                                  key.length,
                                  ...customResults.map(row => String(row[key] || '').length)
                                );
                                cols.push({ width: Math.min(maxLength + 2, 50) });
                              });
                            }
                            worksheet['!cols'] = cols;
                            
                            XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
                            
                            // Create Excel filename with session ID to prevent overwriting
                            // Use original filename (with session ID) for actual file, clean filename for display
                            const excelFilename = mostRecentFile.replace('.json', '.xlsx');
                            const excelFilePath = path.join(__dirname, 'results', excelFilename);
                            
                            // Save Excel file
                            XLSX.writeFile(workbook, excelFilePath);
                            console.log(chalk.green(`✅ Successfully converted JSON to Excel: ${excelFilename}`));
                            
                            // Update variables for sending
                            finalFilePath = excelFilePath;
                            finalFormat = 'XLSX';
                            finalCustomFilename = cleanFilename.replace('.json', '.xlsx'); // Use clean filename for display
                          } else {
                            console.log(chalk.yellow(`⚠️ JSON file doesn't have results array, keeping original JSON`));
                          }
                        } catch (conversionError) {
                          console.log(chalk.red(`❌ Error converting JSON to Excel: ${conversionError.message}`));
                          console.log(chalk.yellow(`⚠️ Will send original JSON file instead`));
                        }
                      }
                      
                      // Send the file to the user (now Excel for Google Maps, original for others)
                      await sendResultsToUser(sock, jid, finalFilePath, { 
                        totalResults: formattedResults,
                        source: currentSource === 'MAPS' ? 'Google Maps' : currentSource === 'LINKEDIN' ? 'LinkedIn' : 'Google Search',
                        format: finalFormat,
                        customFilename: finalCustomFilename
                      }, session.language);
                      resultsFound = true;
                    }
                  } else {
                    console.log(chalk.yellow(`⚠️ No matching autosaved files found for niche "${currentNiche}"`));
                  }
                  
                  // Additional debugging: show why files were filtered out
                  if (autosaveFiles.length === 0) {
                    console.log(chalk.yellow(`🔍 Debug: Analyzing why no files were found:`));
                    console.log(chalk.yellow(`   - Current niche: "${currentNiche}"`));
                    console.log(chalk.yellow(`   - Current source: "${currentSource}"`));
                    console.log(chalk.yellow(`   - File extensions looking for: ${fileExtensions.join(', ')}`));
                    console.log(chalk.yellow(`   - File patterns looking for: ${filePatterns.join(', ')}`));
                    
                    // Show some example files that were filtered out
                    const exampleFiles = files.slice(0, 5);
                    console.log(chalk.yellow(`   - Example files in directory: ${exampleFiles.join(', ')}`));
                  }
                }
              } catch (error) {
                console.log(chalk.red(`❌ Error checking for autosaved files: ${error.message}`));
              }
            }
            
            // If still no results found, send no results message
            if (!resultsFound) {
              await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'stop_no_results')
              });
            }
            
            // Reset session state and show main menu
            session.currentStep = 'main_menu';
            session.status = 'idle';
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
          } else {
                         // No active job found
             await sock.sendMessage(jid, { 
               text: getMessage(session.language, 'error_generic')
             });
             session.currentStep = 'main_menu';
             session.status = 'idle';
             saveJson(SESSIONS_FILE, sessions);
             await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error stopping job:`, error.message));
          await sock.sendMessage(jid, { 
            text: getMessage(session.language, 'error_generic')
          });
          session.currentStep = 'main_menu';
          session.status = 'idle';
          saveJson(SESSIONS_FILE, sessions);
          await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        }
        return;
      } else if (text.trim() === '0') {
        // User cancelled stopping - return to scraping
        session.currentStep = 'scraping_in_progress';
        saveJson(SESSIONS_FILE, sessions);
        console.log(chalk.green(`✅ User ${jid.split('@')[0]} cancelled stopping the job`));
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'job_running')
        });
        return;
      } else {
        // Invalid input - show stop confirmation again
        await sock.sendMessage(jid, { 
          text: getMessage(session.language, 'stop_confirmation')
        });
        return;
      }
    }
    
    // Handle guide processing state - user sent message while guide is being processed
    if (session.currentStep === 'guide_processing') {
      // User sent a message while guide is being processed - tell them to wait
      await sock.sendMessage(jid, { 
        text: getMessage(session.language, 'guide_processing')
      });
      return;
    }
    
    // Handle logout confirmation state
    if (session.currentStep === 'logout_confirmation') {
      if (text.trim() === '5') {
        // User confirmed logout
        try {
          const userCode = session.code || 'unknown';
          const phoneNumber = jid.split('@')[0];
          
          // Clear the user session
          delete sessions[jid];
          saveJson(SESSIONS_FILE, sessions);
          
          // Send logout success message
          await sock.sendMessage(jid, { 
            text: getMessage(session.language, 'logout_successful')
          });
          
          console.log(chalk.yellow(`🔓 User ${phoneNumber} logged out (was using code: ${userCode})`));
        } catch (error) {
          console.error(chalk.red(`❌ Error in user logout:`, error.message));
          await sock.sendMessage(jid, { 
            text: getMessage(session.language, 'logout_error')
          });
        }
        return;
      } else if (text.trim() === '0') {
        // User cancelled logout - return to main menu
        session.currentStep = 'main_menu';
        sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);
        
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        return;
      } else {
        // Invalid input - show logout confirmation again
        await sendImageWithMessage(sock, jid, 'logout', getMessage(session.language, 'logout_confirmation'), session.language);
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
      
      // CRITICAL FIX: Always preserve user's selected language during onboarding
      console.log(chalk.blue(`🔍 Language debug - Session language: ${session.language || 'not set'}, currentStep: ${session.currentStep}`));
      console.log(chalk.blue(`🔍 Language debug - Codes database language: ${codesDb[code].language || 'not set'}`));
      
      // If user just completed onboarding (selected language then authenticated), preserve their choice
      if (session.currentStep === 'awaiting_authentication' && session.language) {
        // User just selected language during onboarding - this ALWAYS takes precedence
        codesDb[code].language = session.language;
        saveJson(CODES_FILE, codesDb);
        console.log(chalk.blue(`💾 CRITICAL: Preserved user language preference: ${session.language}`));
      } else if (!session.language && codesDb[code].language) {
        // Only load from codes database if user hasn't selected language during this session
        session.language = codesDb[code].language;
        console.log(chalk.blue(`📖 Loaded user language preference from codes database: ${session.language}`));
      }
      
      console.log(chalk.blue(`🔍 Language debug - Final session language: ${session.language || 'not set'}`));
      
      // Set appropriate next step based on current state
      if (session.currentStep === 'awaiting_authentication') {
        // User just authenticated after language selection - go to main menu
        session.currentStep = 'main_menu';
      } else if (session.currentStep === 'awaiting_language') {
        // User authenticated without language selection - go to language selection
        session.currentStep = 'awaiting_language';
      }
      
      sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);
        
              // Send appropriate welcome message based on current state
        if (session.currentStep === 'awaiting_language') {
          // User authenticated but needs to select language - show language selection
        await sendImageWithMessage(sock, jid, 'welcome', getMessage('fr', 'welcome'), 'fr');
        return;
      } else {
          // User is ready for main menu - show welcome and main menu
        session.currentStep = 'main_menu';
        saveJson(SESSIONS_FILE, sessions);
        
                // Debug: Log the language being used
      console.log(chalk.blue(`🌐 Authentication success - User language: ${session.language || 'en'}`));
      console.log(chalk.blue(`🌐 Session currentStep: ${session.currentStep}`));
      console.log(chalk.blue(`🌐 Codes database language: ${codesDb[code].language || 'not set'}`));
          
          // Send appropriate welcome message based on user stage
        try {
          const codesNow = loadJson(CODES_FILE, {});
          const entry = codesNow[code] || {};
          const stage = entry.stage || 'free_trial';
            
                  // Use the session language (which should be set from the user's selection)
      const userLanguage = session.language || 'fr';
      console.log(chalk.blue(`🎯 Using language for welcome message: ${userLanguage}`));
            
            console.log(chalk.blue(`🎯 Sending welcome message in language: ${userLanguage}, stage: ${stage}`));
            
          if (stage === 'free_trial') {
              await sendImageWithMessage(sock, jid, 'welcome', getMessage(userLanguage, 'trial_welcome'), userLanguage);
          } else if (stage === 'paid') {
              await sendImageWithMessage(sock, jid, 'welcome', getMessage(userLanguage, 'paid_welcome'), userLanguage);
          } else if (stage === 'unpaid') {
              await sock.sendMessage(jid, { text: getMessage(userLanguage, 'subscription_expired') });
          } else {
            // Fallback welcome
              await sendImageWithMessage(sock, jid, 'welcome', getMessage(userLanguage, 'paid_welcome'), userLanguage);
            }
          } catch (e) {
            // If any issue reading codes, fall back to normal welcome
            const userLanguage = session.language || 'fr';
            console.log(chalk.yellow(`⚠️ Error reading codes, using fallback language: ${userLanguage}`));
            await sendImageWithMessage(sock, jid, 'welcome', getMessage(userLanguage, 'paid_welcome'), userLanguage);
          }
          
          // Ensure main menu is also sent in the correct language
          const menuLanguage = session.language || 'en';
          console.log(chalk.blue(`🎯 Sending main menu in language: ${menuLanguage}`));
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(menuLanguage, 'main_menu'), menuLanguage);
        return;
      }
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



    // Handle messages based on current conversation step
    if (session.currentStep === 'validating_niche') {
        // User sent a message while validation is in progress - resend validation message
        if (session.validatingNiche) {
            await sock.sendMessage(jid, {
                text: getMessage(session.language, 'niche_validating', { niche: session.validatingNiche })
            });
        }
        return;
    } else if (session.currentStep === 'awaiting_business_service') {
        if (text === '0') {
            // User wants to go back to main menu
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            sessions[jid] = session; // Update the sessions object
            saveJson(SESSIONS_FILE, sessions);

            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (text === '1') {
            // User wants AI niche suggestions
            session.currentStep = 'niche_suggestion_intro';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_intro')
            });
            return;
        } else if (isNaN(inputNumber)) { // Treat non-numeric input as business/service
            // Set validation state and store the niche being validated
            session.currentStep = 'validating_niche';
            session.validatingNiche = text;
            saveJson(SESSIONS_FILE, sessions);
            
            // Send validation message to inform user
            await sock.sendMessage(jid, {
                text: getMessage(session.language, 'niche_validating', { niche: text })
            });
            
            // Initialize business/service validator with user's Gemini API key
            if (session.apiKeys && session.apiKeys.geminiKeys && session.apiKeys.geminiKeys.length > 0) {
                nicheValidator.initialize(session.apiKeys.geminiKeys[0]);
            }
            
            // Validate the business/service using Gemini AI
            const validation = await nicheValidator.validateNiche(text, session.language);
            
            if (!validation.isValid) {
                // Clear validation state
                session.currentStep = 'awaiting_business_service';
                session.validatingNiche = null;
                saveJson(SESSIONS_FILE, sessions);
                
                // Send validation error message using language-specific template
                let suggestionsText = '';
                if (validation.suggestions && validation.suggestions.length > 0) {
                    validation.suggestions.forEach((suggestion, index) => {
                        suggestionsText += `${index + 1}. ${suggestion}\n`;
                    });
                }
                
                const errorMessage = getMessage(session.language, 'niche_validation_error', {
                    reason: validation.reason,
                    suggestions: suggestionsText
                });
                
                await sock.sendMessage(jid, { text: errorMessage });
            return;
            }
            
            // Business/service is valid, proceed with normal flow
            session.pendingNiche = text;
            session.currentStep = 'awaiting_source';
            session.validatingNiche = null; // Clear validation state
            session.previousMessage = getMessage(session.language, 'select_source', {
              niche: session.pendingNiche
            });
            await sendImageWithMessage(sock, jid, 'results_type', session.previousMessage, session.language);
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            // User sent a number - guide them back to search flow
            await sock.sendMessage(jid, { 
                text: '⚠️ **Invalid input.** Please enter your business or service (e.g., "dentist casablanca") or send 0 to go back to main menu.'
            });
            // Resend the enter_niche message to guide them
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'enter_niche')
            });
            return;
        }
    } else if (session.currentStep === 'niche_suggestion_intro') {
        // Handle niche suggestion intro
        if (text === '0') {
            // Go back to niche input
            session.currentStep = 'awaiting_business_service';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'enter_niche')
            });
            return;
        } else if (text === '00') {
            // Go back to main menu
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (inputNumber === 1) {
            // Start niche suggestion questions
            session.currentStep = 'niche_suggestion_questions';
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            const nicheSuggester = new NicheSuggester(handleError);
            const questionData = nicheSuggester.getNextQuestion(session.language, 0);
            
            if (questionData) {
                await sock.sendMessage(jid, { 
                    text: questionData.question.question
                });
            }
            return;
        } else {
            // Invalid input
            await sock.sendMessage(jid, { 
                text: '⚠️ **Invalid input.** Please choose 1 to start, 0 to go back, or 00 to return to main menu.'
            });
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_intro')
            });
            return;
        }
    } else if (session.currentStep === 'niche_suggestion_questions') {
        // Handle niche suggestion questions
        if (text === '0') {
            // Go back to niche input
            session.currentStep = 'awaiting_business_service';
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'enter_niche')
            });
            return;
        } else if (text === '00') {
            // Go back to main menu
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        }
        
        const nicheSuggester = new NicheSuggester(handleError);
        const currentQuestion = nicheSuggester.getNextQuestion(session.language, session.nicheSuggestionStep);
        
        if (!currentQuestion) {
            // All questions completed, generate suggestions
            session.currentStep = 'niche_suggestion_processing';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_processing')
            });
            
            try {
                // Generate niche suggestions
                const suggestions = await nicheSuggester.generateNicheSuggestions(
                    session.nicheSuggestionAnswers, 
                    session.apiKeys?.geminiKeys?.[0], 
                    session.language
                );
                
                // Store suggestions and show them
                session.nicheSuggestions = suggestions;
                session.currentStep = 'niche_suggestion_results';
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                
                const formattedSuggestions = nicheSuggester.formatSuggestions(suggestions, session.language);
                await sock.sendMessage(jid, { 
                    text: formattedSuggestions
                });
                
            } catch (error) {
                console.error('Error generating niche suggestions:', error);
                session.currentStep = 'awaiting_business_service';
                session.nicheSuggestionAnswers = {};
                session.nicheSuggestionStep = 0;
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'niche_suggestion_error')
                });
            }
            return;
        }
        
        // Store answer and move to next question
        const question = currentQuestion.question;
        let answer = text;
        let isValidInput = true;
        
        // Handle single choice questions
        if (question.type === 'single_choice') {
            if (isNaN(inputNumber)) {
                // Invalid input - not a number
                isValidInput = false;
            } else {
                // Get the number of choices from the question text by counting emoji numbers
                const choiceCount = (question.question.match(/[1-9]️⃣/g) || []).length;
                const choiceIndex = inputNumber - 1;
                if (choiceIndex < 0 || choiceIndex >= choiceCount) {
                    // Invalid input - number out of range
                    isValidInput = false;
                } else {
                    // Map the choice index to the corresponding choice value
                    const choiceMapping = {
                        'business_goal': ['lead_generation', 'market_research', 'partnership_building', 'recruitment', 'sales_prospecting'],
                        'target_audience': ['b2b_professionals', 'b2c_consumers', 'local_businesses', 'enterprise_companies', 'mixed'],
                        'industry_interest': ['technology', 'healthcare', 'finance', 'real_estate', 'retail_ecommerce', 'professional_services', 'other'],
                        'geographic_focus': ['local', 'national', 'international', 'global'],
                        'budget_range': ['low', 'medium', 'high', 'enterprise', 'mixed']
                    };
                    
                    const choices = choiceMapping[question.id] || [];
                    if (choiceIndex < choices.length) {
                        answer = choices[choiceIndex];
                    } else {
                        isValidInput = false;
                    }
                }
            }
        } else if (question.type === 'text_input') {
            // Validate text input
            if (!text || text.trim().length < 2) {
                isValidInput = false;
            } else {
                answer = text.trim();
            }
        }
        
        if (!isValidInput) {
            // Show error message and resend current question
            let errorMessage = '';
            if (question.type === 'single_choice') {
                // Get the number of choices from the question text
                const choiceCount = (question.question.match(/[1-9]️⃣/g) || []).length;
                errorMessage = getMessage(session.language, 'niche_suggestion_invalid_choice', { max_choices: choiceCount });
            } else if (question.type === 'text_input') {
                errorMessage = getMessage(session.language, 'niche_suggestion_invalid_text');
            } else {
                errorMessage = `⚠️ **Invalid input.** Please try again.`;
            }
            
            await sock.sendMessage(jid, { 
                text: `${errorMessage}\n\n${question.question}`
            });
            return;
        }
        
        session.nicheSuggestionAnswers[question.id] = answer;
        session.nicheSuggestionStep = currentQuestion.stepIndex + 1;
        sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);
        
        // Get next question
        const nextQuestion = nicheSuggester.getNextQuestion(session.language, session.nicheSuggestionStep);
        if (nextQuestion) {
            await sock.sendMessage(jid, { 
                text: nextQuestion.question.question
            });
        } else {
            // All questions completed, generate suggestions
            session.currentStep = 'niche_suggestion_processing';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_processing')
            });
            
            try {
                const suggestions = await nicheSuggester.generateNicheSuggestions(
                    session.nicheSuggestionAnswers, 
                    session.apiKeys?.geminiKeys?.[0], 
                    session.language
                );
                
                session.nicheSuggestions = suggestions;
                session.currentStep = 'niche_suggestion_results';
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                
                const formattedSuggestions = nicheSuggester.formatSuggestions(suggestions, session.language);
                await sock.sendMessage(jid, { 
                    text: formattedSuggestions
                });
                
            } catch (error) {
                console.error('Error generating niche suggestions:', error);
                session.currentStep = 'awaiting_business_service';
                session.nicheSuggestionAnswers = {};
                session.nicheSuggestionStep = 0;
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'niche_suggestion_error')
                });
            }
        }
        return;
    } else if (session.currentStep === 'niche_suggestion_results') {
        // Handle niche suggestion results
        if (text === '0') {
            // Start over with new questions
            session.currentStep = 'niche_suggestion_intro';
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            session.nicheSuggestions = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_intro')
            });
            return;
        } else if (text === '00') {
            // Go back to main menu
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            session.nicheSuggestions = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (!isNaN(inputNumber) && inputNumber >= 1 && inputNumber <= (session.nicheSuggestions?.suggestions?.length || 0)) {
            // User selected a suggested niche
            const selectedNiche = session.nicheSuggestions.suggestions[inputNumber - 1].niche;
            session.pendingNiche = selectedNiche;
            session.currentStep = 'awaiting_source';
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            session.nicheSuggestions = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_suggestion_selected', { niche: selectedNiche })
            });
            
            // Proceed to source selection
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'select_source', { niche: selectedNiche })
            });
            return;
        } else if (isNaN(inputNumber)) {
            // User entered a custom niche - validate it first
            session.pendingNiche = text;
            session.currentStep = 'validating_niche';
            session.validatingNiche = text; // Set the validating niche property
            // Store the suggestions before clearing them
            const currentSuggestions = session.nicheSuggestions;
            session.nicheSuggestionAnswers = {};
            session.nicheSuggestionStep = 0;
            session.nicheSuggestions = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            // Start niche validation
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'niche_validating', { niche: text })
            });
            
            try {
                console.log(chalk.blue(`🤖 Starting niche validation for custom input: "${text}"`));
                console.log(chalk.blue(`🔑 API Key available: ${session.apiKeys?.geminiKeys?.[0] ? 'Yes' : 'No'}`));
                console.log(chalk.blue(`🌐 Language: ${session.language}`));
                
                // Initialize business/service validator with user's Gemini API key
                if (session.apiKeys && session.apiKeys.geminiKeys && session.apiKeys.geminiKeys.length > 0) {
                    nicheValidator.initialize(session.apiKeys.geminiKeys[0]);
                }
                
                const validationResult = await nicheValidator.validateNiche(text, session.language);
                
                console.log(chalk.blue(`✅ Validation result:`, validationResult));
                
                if (validationResult.isValid) {
                    // Niche is valid, proceed to source selection
                    session.currentStep = 'awaiting_source';
                    session.validatingNiche = null;
                    sessions[jid] = session;
                    saveJson(SESSIONS_FILE, sessions);
                    
                    await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'niche_suggestion_custom', { niche: text })
                    });
                    
                    // Proceed to source selection
                    await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'select_source', { niche: text })
                    });
                } else {
                    // Niche is invalid, show error and go back to niche suggestion results
                    session.currentStep = 'niche_suggestion_results';
                    session.validatingNiche = null;
                    session.nicheSuggestions = currentSuggestions; // Restore suggestions
                    sessions[jid] = session;
                    saveJson(SESSIONS_FILE, sessions);
                    
                    await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'niche_validation_error', { 
                            reason: validationResult.reason,
                            suggestions: validationResult.suggestions 
                        })
                    });
                }
            } catch (error) {
                console.error('❌ Error validating custom niche:', error);
                console.log(chalk.red(`🚨 Validation failed, proceeding anyway to avoid blocking user`));
                // On validation error, proceed anyway to avoid blocking the user
                session.currentStep = 'awaiting_source';
                session.validatingNiche = null;
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);
                
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'niche_suggestion_custom', { niche: text })
                });
                
                // Proceed to source selection
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'select_source', { niche: text })
                });
            }
            return;
        } else {
            // Invalid input
            await sock.sendMessage(jid, { 
                text: '⚠️ **Invalid input.** Please choose a number from the suggestions, enter your own niche, or use 0/00 to navigate.'
            });
            return;
        }
    } else if (session.currentStep === 'awaiting_source') {
        const sourceOptions = ['GOOGLE', 'LINKEDIN', 'MAPS', 'AI_DECIDE'];
        if (text === '00') {
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid);
            }
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (inputNumber === 0) {
            // Go back to business/service input
            session.currentStep = 'awaiting_business_service';
            session.previousMessage = null;
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'enter_niche')
            });
            return;
        } else if (inputNumber >= 1 && inputNumber <= sourceOptions.length) {
            // Handle AI decision option
            if (inputNumber === 4) { // AI_DECIDE option
                // Show AI analyzing message
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'ai_analyzing', { niche: session.pendingNiche })
                });
                
                try {
                    // Import AI source decider
                    const { decideBestSource, getSourceDisplayName } = await import('./lib/ai-source-decider.js');
                    
                    // Get user's API keys from codes
                    const codes = loadJson(ACCESS_CODES_FILE, {});
                    const userCode = session.code;
                    const userData = codes[userCode];
                    
                    if (!userData || !userData.apiKeys || !userData.apiKeys.geminiKeys || userData.apiKeys.geminiKeys.length === 0) {
                        throw new Error('No Gemini API keys available for AI decision');
                    }
                    
                    // Use the first available Gemini key
                    const geminiKey = userData.apiKeys.geminiKeys[0];
                    
                    // Get AI recommendation
                    const recommendation = await decideBestSource(session.pendingNiche, geminiKey, session.language);
                    
                    // Set the recommended source
                    session.prefs.source = recommendation.source;
                    
                    // Track the selected source in session metadata for STOP functionality
                    if (!session.meta) session.meta = {};
                    session.meta.lastSource = session.prefs.source;
                    session.meta.aiRecommended = true;
                    session.meta.aiReason = recommendation.reason;
                    
                    // Show AI recommendation
                    const sourceDisplayName = getSourceDisplayName(recommendation.source, session.language);
                    await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'ai_recommendation', { 
                            niche: session.pendingNiche,
                            recommended_source: sourceDisplayName,
                            reason: recommendation.reason
                        })
                    });
                    
                    // For LinkedIn and Google Maps, automatically set dataType to 'COMPLETE' and format to 'XLSX', skip to ready_to_start
                    if (session.prefs.source === 'LINKEDIN' || session.prefs.source === 'MAPS') {
                        session.prefs.dataType = 'COMPLETE';
                        session.prefs.format = 'XLSX';
                        session.currentStep = 'ready_to_start';
                        session.previousMessage = getMessage(session.language, 'format_set');
                        await sock.sendMessage(jid, { text: session.previousMessage });
                        saveJson(SESSIONS_FILE, sessions);
                        return;
                    }
                    
                    // For Google, show data type options as before
                    session.currentStep = 'awaiting_type';
                    let dataTypeChoices = getMessage(session.language, 'select_type_google');
                    session.previousMessage = dataTypeChoices;
                    await sock.sendMessage(jid, { text: dataTypeChoices });
                    saveJson(SESSIONS_FILE, sessions);
                    return;
                    
                } catch (error) {
                    console.error('AI Decision Error:', error.message);
                    // Fallback to Google Search if AI fails
                    session.prefs.source = 'GOOGLE';
                    session.prefs.dataType = 'CONTACTS';
                    session.prefs.format = 'TXT';
                    session.currentStep = 'ready_to_start';
                    session.previousMessage = getMessage(session.language, 'format_set');
                    
                    await sock.sendMessage(jid, { 
                        text: `⚠️ **AI analysis failed. Using Google Search as fallback.**\n\n${getMessage(session.language, 'format_set')}`
                    });
                    saveJson(SESSIONS_FILE, sessions);
                    return;
                }
            }
            
            // Handle regular source selection (1-3)
            session.prefs.source = sourceOptions[inputNumber - 1];
            
            // Track the selected source in session metadata for STOP functionality
            if (!session.meta) session.meta = {};
            session.meta.lastSource = session.prefs.source;
            
            // For LinkedIn and Google Maps, automatically set dataType to 'COMPLETE' and format to 'XLSX', skip to ready_to_start
            if (session.prefs.source === 'LINKEDIN' || session.prefs.source === 'MAPS') {
                session.prefs.dataType = 'COMPLETE';
                session.prefs.format = 'XLSX';
                session.currentStep = 'ready_to_start';
                session.previousMessage = getMessage(session.language, 'format_set');
                await sock.sendMessage(jid, { text: session.previousMessage });
                saveJson(SESSIONS_FILE, sessions);
                return;
            }
            
            // For Google, show data type options as before
            session.currentStep = 'awaiting_type';
            let dataTypeChoices = getMessage(session.language, 'select_type_google');
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
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (inputNumber === 0) {
            // Go back to source selection
            session.currentStep = 'awaiting_source';
            session.previousMessage = getMessage(session.language, 'select_source', { niche: session.pendingNiche || '' });
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
            await sendImageWithMessage(sock, jid, 'results_type', session.previousMessage, session.language);
            return;
        } else if (inputNumber >= 1 && inputNumber <= validTypes.length) {
            session.prefs.dataType = validTypes[inputNumber - 1];
            
            // Automatically set format based on source and skip to ready_to_start
            if (session.prefs.source === 'GOOGLE') {
                session.prefs.format = 'TXT';
            } else if (session.prefs.source === 'ALL') {
                session.prefs.format = 'XLSX';
            }
            
            session.currentStep = 'ready_to_start';
            session.previousMessage = getMessage(session.language, 'format_set');
            await sock.sendMessage(jid, { text: session.previousMessage });
            saveJson(SESSIONS_FILE, sessions);
            return;
        } else {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'invalid_selection', { max: validTypes.length })
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
            session.currentStep = 'main_menu';
            session.pendingNiche = null;
            session.previousMessage = null;
            session.status = 'idle';
            sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'restart')
            });
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            return;
        } else if (text === '0') {
            // Go back to previous step based on source
            if (session.prefs.source === 'GOOGLE' || session.prefs.source === 'ALL') {
                // Back to data type selection
                session.currentStep = 'awaiting_type';
                const backChoices = session.prefs.source === 'GOOGLE'
                  ? getMessage(session.language, 'select_type_google')
                  : getMessage(session.language, 'select_type_all');
                session.previousMessage = backChoices;
                sessions[jid] = session;
            saveJson(SESSIONS_FILE, sessions);
            
                await sock.sendMessage(jid, { text: backChoices });
            } else {
                // For LINKEDIN or MAPS, back to source selection
                session.currentStep = 'awaiting_source';
                session.previousMessage = getMessage(session.language, 'select_source', { niche: session.pendingNiche || '' });
                sessions[jid] = session;
                saveJson(SESSIONS_FILE, sessions);

                await sendImageWithMessage(sock, jid, 'results_type', session.previousMessage, session.language);
            }
            return;
        } else if (text.toUpperCase() === 'START') {
            if (!session.pendingNiche || !session.prefs.source || !session.prefs.dataType || !session.prefs.format) {
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'error_generic')
                });
                return;
            }

            // CRITICAL FIX: Reload sessions from disk to get the most up-to-date daily counts
            sessions = loadJson(SESSIONS_FILE, {});
            const currentSession = sessions[jid];

            // Load codes DB to check trial status
            const codesDbLocal = loadJson(CODES_FILE, {});
            const userCodeLocal = currentSession.code;
            const userEntryLocal = userCodeLocal ? (codesDbLocal[userCodeLocal] || {}) : {};
            const stageLocal = userEntryLocal.stage || 'free_trial';
            const trialLocal = userEntryLocal.trial || { triesUsed: 0, maxTries: 3 };
            // Clamp triesUsed to never exceed maxTries
            if (trialLocal.triesUsed > trialLocal.maxTries) {
                trialLocal.triesUsed = trialLocal.maxTries;
                if (userCodeLocal) {
                    codesDbLocal[userCodeLocal].trial = trialLocal;
                    saveJson(CODES_FILE, codesDbLocal);
                }
            }
            // Block if trial limit reached
            if (stageLocal === 'free_trial' && trialLocal.triesUsed >= trialLocal.maxTries) {
                await sock.sendMessage(jid, { text: getMessage(currentSession.language, 'trial_finished') });
                currentSession.currentStep = 'main_menu';
                sessions[jid] = currentSession;
                saveJson(SESSIONS_FILE, sessions);
                // Show main menu
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(currentSession.language, 'main_menu'), currentSession.language);
                return;
            }
            
            // Daily limit already checked at main menu level - proceed with job

            // Now start the actual scraping job
            const niche = currentSession.pendingNiche;
            const { source, dataType, format, limit } = currentSession.prefs;
            
            // Helper to update sessions safely (serialized)
            const updateSessionState = (userId, partial) => mutateUserSession(userId, partial);

            // Function to actually run the scraper when capacity is available
            const runScraper = async () => {
                // Clear pending niche when we really start
                await mutateUserSession(jid, (s) => {
                    const next = { ...s };
                    delete next.pendingNiche;
                    next.currentStep = 'scraping_in_progress';
                    return next;
                });
            
            // Start the scraping job
            console.log(chalk.cyan(`🔍 Job started: "${niche}" (${source}/${dataType}/${format}/${limit})`));

            await sendImageWithMessage(sock, jid, 'starting', getMessage(currentSession.language, 'job_starting', {
                  niche: niche
                }), currentSession.language);
            
            console.log(chalk.cyan(`🚀 Progress tracking initialized for ${jid}: 0%`));
            
            // Continue with the existing scraping logic...
            // Create abort controller
            const abortController = new AbortController();

            currentSession.status = 'running';
            currentSession.meta.lastNiche = niche;
            
            // Initialize progress simulator for this job
            const progressSimulator = new ProgressSimulator(currentSession.language);
            activeJobs.set(jid, {
                abort: abortController,
                status: 'initializing',
                startTime: new Date(),
                results: null,
                progressSimulator: progressSimulator,
                didIncrementDailyCount: false
            });

            await mutateUserSession(jid, (s) => ({
                ...s,
                status: 'running',
                meta: { ...(s.meta || {}), lastNiche: niche, lastSource: source, lastDataType: dataType.toLowerCase() }
            }));

            let resultCount = 0;
            
            try {
                // Determine trial mode from codes database
                const userCode = currentSession.code;
                const userEntry = (typeof codesDb !== 'undefined' && userCode) ? (codesDb[userCode] || {}) : {};
                const isTrialMode = (userEntry.stage === 'free_trial');

                const result = await startUnifiedScraper({
                    niche,
                    source: source, // Use original uppercase values
                    dataType: dataType.toLowerCase(), // Convert to lowercase for internal use
                    format,
                    apiKeys: session.apiKeys,
                    errorHandler: handleError,
                    options: {
                        abortSignal: abortController.signal,
                        debug: false,
                        trialMode: isTrialMode,
                        trialLimit: 20,
                        
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
                                                const progressMessage = `**${progressData.message}**`;
                                                
                                                await sock.sendMessage(jid, { text: progressMessage });
                                                
                                                // Increment usage ONLY once, on the first progress message
                                                const currentJob = activeJobs.get(jid);
                                                if (currentJob && !currentJob.didIncrementDailyCount) {
                                                    try {
                                                        if (isTrialMode && userCode && typeof saveJson === 'function') {
                                                            // Increment free-trial triesUsed in codes.json
                                                            const codesNow = loadJson(CODES_FILE, {});
                                                            if (codesNow[userCode]) {
                                                                const trial = codesNow[userCode].trial || { triesUsed: 0, maxTries: 3 };
                                                                // Only increment if below maxTries, and clamp
                                                                const currentTries = Math.min(trial.triesUsed || 0, trial.maxTries || 3);
                                                                if (currentTries < (trial.maxTries || 3)) {
                                                                    trial.triesUsed = currentTries + 1;
                                                                } else {
                                                                    trial.triesUsed = currentTries; // clamp
                                                                }
                                                                codesNow[userCode].trial = trial;
                                                                saveJson(CODES_FILE, codesNow);
                                                                console.log(chalk.green(`✅ Trial try incremented for ${jid.split('@')[0]} → ${trial.triesUsed}/${trial.maxTries}`));
                                                            }
                                                        } else {
                                                            // Paid mode: increment daily count
                                                            incrementDailyScrapingCount(jid, sessions);
                                                        }
                                                    } catch (incErr) {
                                                        console.error('Failed to increment usage counters:', incErr.message);
                                                    }
                                                    currentJob.didIncrementDailyCount = true;
                                                    activeJobs.set(jid, currentJob);
                                                    console.log(chalk.green(`✅ Usage incremented on first progress update for ${jid.split('@')[0]}`));
                                                }
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
                                    
                                    // Don't send completion message here - let the main completion handler do it
                                    // try {
                                    //     await sock.sendMessage(jid, { text: getMessage(session.language, 'progress_complete') });
                                    // } catch (error) {
                                    //     console.error('Failed to send completion message:', error.message);
                                    // }
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
                            session.currentStep = 'awaiting_business_service';
                            sessions[jid] = session;
                            saveJson(SESSIONS_FILE, sessions);
                        }
                    }
                });
                


                                // Stop progress simulator to prevent duplicate completion messages
                const activeJob = activeJobs.get(jid);
                if (activeJob && activeJob.progressSimulator) {
                    activeJob.progressSimulator.stop();
                }

                // Job completed successfully - perform cleanup and reset session state
                activeJobs.delete(jid);
                await mutateUserSession(jid, (s) => ({
                    ...s,
                    status: 'idle',
                    currentStep: 'main_menu',
                    meta: { ...(s.meta || {}), totalJobs: ((s.meta?.totalJobs) || 0) + 1 }
                }));

                // Notify concurrency manager that this user finished
                await concurrencyManager.finishScraping(jid);

                console.log(chalk.blue(`[DEBUG] Scraper result: ${JSON.stringify(result)}`));
                console.log(chalk.blue(`[DEBUG] Result filePath exists: ${!!result.filePath}`));
                console.log(chalk.blue(`[DEBUG] Result structure:`, {
                    hasFilePath: !!result.filePath,
                    hasMeta: !!result.meta,
                    hasResults: !!result.results,
                    filePath: result.filePath,
                    metaKeys: result.meta ? Object.keys(result.meta) : 'NO_META'
                }));

                // Send the file first using the dedicated function
                let fileSent = false;
                if (result.filePath) {
                    try {
                        // Convert to absolute path if it's relative
                        const absoluteFilePath = path.isAbsolute(result.filePath) 
                            ? result.filePath 
                            : path.resolve(result.filePath);
                        
                        console.log(chalk.blue(`📎 Sending results file: ${absoluteFilePath}`));
                        
                        // Use the dedicated function for reliable file sending
                        fileSent = await sendResultsToUser(sock, jid, absoluteFilePath, result.meta, session.language);
                        
                        if (fileSent) {
                            console.log(chalk.green(`✅ Results file sent successfully to ${jid}`));
                        } else {
                            console.log(chalk.red(`❌ Results file not sent to ${jid} (sendFile returned false).`));
                        }
                        
                    } catch (error) {
                        console.log(chalk.red(`❌ Failed to send results file: ${error.message}`));
                        
                        // Store as pending if immediate sending failed and not due to size
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
                    }
                } else {
                    console.log(chalk.red(`❌ No file path provided in result`));
                    
                    // Try to find the file in the results directory as fallback
                    if (result.meta && result.meta.niche && result.meta.source) {
                        const resultsDir = path.join(process.cwd(), 'results');
                        // Preserve Arabic and other Unicode characters, only replace problematic path characters
                        const searchPattern = `${result.meta.niche.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')}_${result.meta.source.toLowerCase()}`;
                        
                        try {
                            const files = fs.readdirSync(resultsDir);
                            const matchingFile = files.find(file => 
                                file.includes(searchPattern) && 
                                (file.endsWith('.xlsx') || file.endsWith('.csv') || file.endsWith('.json') || file.endsWith('.txt'))
                            );
                            
                            if (matchingFile) {
                                const fallbackFilePath = path.join(resultsDir, matchingFile);
                                console.log(chalk.yellow(`🔄 Found fallback file: ${fallbackFilePath}`));
                                
                                // Try to send the fallback file
                                try {
                                    fileSent = await sendResultsToUser(sock, jid, fallbackFilePath, result.meta, session.language);
                                    if (fileSent) {
                                        console.log(chalk.green(`✅ Fallback file sent successfully: ${matchingFile}`));
                                    }
                                } catch (fallbackError) {
                                    console.log(chalk.red(`❌ Failed to send fallback file: ${fallbackError.message}`));
                                }
                            } else {
                                console.log(chalk.red(`❌ No matching file found in results directory for pattern: ${searchPattern}`));
                            }
                        } catch (dirError) {
                            console.log(chalk.red(`❌ Error reading results directory: ${dirError.message}`));
                        }
                    }
                }

                // File caption already contains all the information, no need for duplicate completion message
                
                // Show main menu after job completion
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);

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
                await mutateUserSession(jid, { status: 'idle', currentStep: 'main_menu' });

                // Notify concurrency manager that this user finished (even on error)
                await concurrencyManager.finishScraping(jid);

                // ✅ ENHANCED: Handle specific errors with localization
                let errorMessage = '';

                if (error.message.includes('aborted')) {
                    // Don't send message for user-initiated aborts - our STOP logic already handles this
                    console.log(chalk.yellow(`🛑 Job aborted by user - skipping error message (already handled by STOP logic)`));
                    return; // Exit early to avoid duplicate messages
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
                        
                } else if (/invalid niche format/i.test(error.message) && /maps/i.test(error.message)) {
                    // Friendly localized message for invalid niche for Google Maps
                    errorMessage = getMessage(session.language, 'error_invalid_niche_maps');
                } else {
                    // Localized friendly generic error
                    errorMessage = getMessage(session.language, 'error_generic_friendly');
                }

                // Send error message to user
                await sock.sendMessage(jid, { text: errorMessage });
                
                // Show main menu after error
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
            }
            };

            // Start via concurrency manager
            const resultState = await concurrencyManager.startScraping(jid, runScraper, {
                updateSession: (userId, partial) => updateSessionState(userId, partial),
                notifyQueued: async () => {
                    await sock.sendMessage(jid, { 
                        text: getMessage(session.language, 'queued_waiting')
                    });
                }
            });

            if (resultState === 'already_queued') {
                // If user pings again while queued, resend the same waiting message
                await sock.sendMessage(jid, { 
                    text: getMessage(session.language, 'queued_waiting')
                });
                return;
            }
            
            return;
        } else if (text.toUpperCase() === 'STOP') { // Allow STOP during ready_to_start
            const activeJob = activeJobs.get(jid);
            if (activeJob && activeJob.abort) {
                activeJob.abort.abort();
                activeJobs.delete(jid); // Ensure job is cleared
                await mutateUserSession(jid, { status: 'idle', currentStep: 'main_menu' });
                await sock.sendMessage(jid, { text: '🛑 **Job cancelled successfully.** You can send a new search query when ready.' });
                
                // Show main menu after job cancellation
                await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
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
    } else if (session.currentStep === 'queued_for_scraping') {
        // User is queued: resend waiting message and don't re-enqueue
        await sock.sendMessage(jid, { 
            text: getMessage(session.language, 'queued_waiting')
        });
        return;
    } else if (session.currentStep === 'scraping_in_progress') {

        // Only allow STOP command during scraping (STATUS removed)
        if (text.toUpperCase() === 'STOP' || text.toLowerCase() === 'stop') {
            // Ask for confirmation before stopping
            session.currentStep = 'stop_confirmation';
            saveJson(SESSIONS_FILE, sessions);
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'stop_confirmation')
            });
            return;
        } else {

            // Only respond if user is authenticated
            if (session.apiKeys) {
            await sock.sendMessage(jid, { 
                text: getMessage(session.language, 'job_running')
            });

            }
            return;
        }
    } else if (session.currentStep === 'scraping_in_progress' && !activeJobs.has(jid)) {
        // FIX: If session step is 'scraping_in_progress' but no active job exists,
        // reset the session state to prevent stuck state
        console.log(chalk.yellow(`🔧 Fixing stuck session state for ${jid}: resetting from 'scraping_in_progress' to 'awaiting_business_service'`));
        resetSessionState(jid, sessions);
        
        // Send message to user about the reset
        if (session.apiKeys) {
            await sock.sendMessage(jid, { 
                text: '🔄 **Session state reset.** You can now send a new search query to begin scraping.'
            });
            
            // Show main menu after reset
            await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        }
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
          await sendResultsToUser(sock, jid, pendingResult.filePath, pendingResult.meta, session.language);
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
        if (!['awaiting_niche', 'awaiting_source', 'awaiting_type', 'validating_niche', 'ready_to_start', 'scraping_in_progress', 'niche_suggestion_intro', 'niche_suggestion_questions', 'niche_suggestion_processing', 'niche_suggestion_results'].includes(session.currentStep) &&
            !['START'].some(cmd => text.toUpperCase().startsWith(cmd))) {
            await sock.sendMessage(jid, { 
                text: `📎 **You have pending results.** Reply \`SEND\` to receive them, or \`SKIP\` to discard. Continuing with your new message...`
            });
        }
      }
    }

    // Fallback for unhandled messages when not in a specific conversational step
    if (!activeJobs.has(jid) && session.currentStep !== 'awaiting_business_service' && isNaN(inputNumber) && text.toUpperCase() !== 'START') {
        // If not in awaiting_business_service and no job running, re-send the previous prompt for numerical input
        if (session.previousMessage) {
            await sock.sendMessage(jid, { text: '⚠️ Invalid input. Please choose a number from the list, or 0 to go back.' });
            await sock.sendMessage(jid, { text: session.previousMessage });
        } else {
            // This case should ideally not be reached if previousMessage is correctly managed
            await sock.sendMessage(jid, { text: getMessage(session.language, 'error_generic') });
        }
    } else if (!activeJobs.has(jid) && session.currentStep === 'awaiting_business_service' && !isNaN(inputNumber)) {
        // User sent a number in awaiting_business_service state - guide them back to search flow
        await sock.sendMessage(jid, { 
            text: '⚠️ **Invalid input.** Please enter your business or service (e.g., "dentist casablanca") or send 0 to go back to main menu.'
        });
        // Resend the enter_niche message to guide them
        await sock.sendMessage(jid, { 
            text: getMessage(session.language, 'enter_niche')
        });
    } else if (!activeJobs.has(jid) && isNaN(inputNumber) && text.toUpperCase() !== 'START') {
        // Generic invalid input if not caught by specific steps or other commands
        await sock.sendMessage(jid, { text: getMessage(session.language, 'error_generic') });
    }

  } catch (error) {
    console.error('❌ Error handling message:', error.message);
    
    // Check if it's a connection error
    if (error.message.includes('Connection Closed') || error.message.includes('Connection closed')) {
      console.log(chalk.red('🔌 WhatsApp connection lost during message handling'));
      console.log(chalk.yellow('💡 Connection will be restored automatically'));
      
      // Don't try to send message if connection is down
      return;
    }
    
    // Try to send error message, but don't crash if it fails
    try {
      await sock.sendMessage(jid, { 
        text: '❌ Internal error occurred. Please try again or contact support.'
      });
    } catch (sendError) {
      console.error('❌ Failed to send error message to user:', sendError.message);
    }
  }
}

async function startBot() {
  console.log(chalk.cyan.bold('\n🤖 Starting WhatsApp Business Scraper Bot...\n'));

  try {
    // Initialize authentication
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Load pending results from disk
    loadPendingResults();

    // 🗑️ STORAGE OPTIMIZATION: Clean up old result files on startup
    console.log(chalk.blue('🗑️ Running storage optimization cleanup...'));
    const cleanedFiles = cleanupOldResultFiles(24); // Clean files older than 24 hours
    if (cleanedFiles > 0) {
      console.log(chalk.green(`✅ Storage optimization: Cleaned up ${cleanedFiles} old result files`));
    } else {
      console.log(chalk.gray('✅ Storage optimization: No old files to clean up'));
    }
    
    // Load admin sessions from disk
    await await loadAdminSessions();
    
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

        // Kick off an immediate expiry sweep and schedule exact-time timers (no polling)
        await runExpirySweep(sock);
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);


         // Keep connection alive with periodic status checks and refresh admin data
    const connectionCheckInterval = setInterval(async () => {
      try {
        if (sock && sock.user) {
          // Test connection by checking if user object exists (safer than ping)
          if (sock.user && sock.user.id) {
            console.log(chalk.gray('📡 Connection status: Active'));
          } else {
            console.log(chalk.yellow('⚠️  Connection check: User object not ready'));
          }
        } else {
          console.log(chalk.yellow('⚠️  Connection check: Socket not ready'));
        }
      } catch (error) {
        console.log(chalk.red('❌ Connection check failed:', error.message));
        
        // If connection check fails, try to reconnect
        if (error.message.includes('Connection Closed') || error.message.includes('Connection closed')) {
          console.log(chalk.yellow('🔄 Attempting to reconnect...'));
          clearInterval(connectionCheckInterval);
          setTimeout(startBot, 5000);
        }
      }
         // Refresh admin manager data every 5 minutes
         if (Date.now() % 300000 < 60000) { // Every 5 minutes
           adminManager.adminConfig = adminManager.loadAdminConfig();
           adminManager.codes = adminManager.loadCodes();
           adminManager.sessions = adminManager.loadSessions();
           console.log(chalk.blue('🔄 Admin manager data refreshed'));
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

    // Additional safety: Handle unexpected exits
    process.on('exit', () => {
      console.log(chalk.yellow('\n🛑 Bot process exiting...'));
      // activeJobs.clear() is not needed here as the process is terminating
    });

    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('\n❌ Uncaught Exception:'), error);
      console.log(chalk.yellow('🛑 Bot shutting down due to uncaught exception...'));
      
      // Log the critical error
      await handleError(error, 'uncaught_exception', { 
        activeJobs: activeJobs.size,
        adminSessions: adminSessions.size 
      });
      
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
      
      process.exit(1);
    });

  } catch (error) {
    console.error(chalk.red('❌ Failed to start bot:'), error.message);
    await handleError(error, 'bot_startup', {});
    process.exit(1);
  }
}

// Start the bot
  startBot();

export { startBot };

