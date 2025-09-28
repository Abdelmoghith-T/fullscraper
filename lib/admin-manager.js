import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import ApiPoolManager from './api-pool-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_CONFIG_FILE = path.join(__dirname, '..', 'admin_config.json');
const CODES_FILE = path.join(__dirname, '..', 'codes.json');
const SESSIONS_FILE = path.join(__dirname, '..', 'sessions.json');

/**
 * Admin Manager - Handles admin authentication, permissions, and user management
 */
class AdminManager {
  constructor() {
    this.adminConfig = this.loadAdminConfig();
    this.codes = this.loadCodes();
    this.sessions = this.loadSessions();
  }

  // File loading utilities
  loadAdminConfig() {
    if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
      return this.createDefaultAdminConfig();
    }
    try {
      return JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading admin config:', error.message);
      return this.createDefaultAdminConfig();
    }
  }

  loadCodes() {
    if (!fs.existsSync(CODES_FILE)) return {};
    try {
      return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading codes:', error.message);
      return {};
    }
  }

  loadSessions() {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    try {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading sessions:', error.message);
      return {};
    }
  }

  createDefaultAdminConfig() {
    const defaultConfig = {
      admin_codes: {
        "admin123": {
          role: "super_admin",
          permissions: ["manage_users", "manage_admins", "view_logs", "system_control"],
          createdAt: new Date().toISOString(),
          createdBy: "system",
          lastUsed: null,
          useCount: 0
        }
      },
      admin_roles: {
        "super_admin": {
          description: "Full system access",
          permissions: ["manage_users", "manage_admins", "view_logs", "system_control", "view_all_sessions"]
        },
        "admin": {
          description: "Standard admin access",
          permissions: ["manage_users", "view_logs", "view_sessions"]
        },
        "moderator": {
          description: "Limited admin access",
          permissions: ["view_logs", "view_sessions"]
        }
      },
      system_settings: {
        max_failed_auth_attempts: 5,
        auto_unblock_hours: 24,
        session_timeout_hours: 168,
        max_users_per_admin: 100
      }
    };

    this.saveAdminConfig(defaultConfig);
    return defaultConfig;
  }

  saveAdminConfig(config) {
    try {
      fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving admin config:', error.message);
      return false;
    }
  }

  saveCodes(codes) {
    try {
      fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving codes:', error.message);
      return false;
    }
  }

  saveSessions(sessions) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving sessions:', error.message);
      return false;
    }
  }

  // Admin authentication
  authenticateAdmin(adminCode) {
    if (!this.adminConfig.admin_codes[adminCode]) {
      return { success: false, error: 'Invalid admin code' };
    }

    const adminData = this.adminConfig.admin_codes[adminCode];
    
    // Update usage statistics
    adminData.lastUsed = new Date().toISOString();
    adminData.useCount = (adminData.useCount || 0) + 1;
    
    this.saveAdminConfig(this.adminConfig);

    return {
      success: true,
      admin: {
        code: adminCode,
        role: adminData.role,
        permissions: adminData.permissions,
        roleDescription: this.adminConfig.admin_roles[adminData.role].description
      }
    };
  }

  // Permission checking
  hasPermission(adminCode, permission) {
    if (!this.adminConfig.admin_codes[adminCode]) return false;
    
    const adminData = this.adminConfig.admin_codes[adminCode];
    return adminData.permissions.includes(permission);
  }

  // User management
  listUsers(adminCode) {
    if (!this.hasPermission(adminCode, 'view_sessions') && !this.hasPermission(adminCode, 'view_all_sessions')) {
      return { success: false, error: 'Insufficient permissions. Need view_sessions or view_all_sessions permission.' };
    }

    const userCodes = [];
    for (const [userCode, userData] of Object.entries(this.codes)) {
      userCodes.push({
        code: userCode,
        googleSearchKeys: userData.apiKeys.googleSearchKeys,
        geminiKeys: userData.apiKeys.geminiKeys,
        createdAt: userData.createdAt,
        expiresAt: userData.expiresAt,
        issuedBy: userData.meta?.issuedBy || 'unknown',
        lastUsed: userData.meta?.lastUsed,
        useCount: userData.meta?.useCount || 0,
        dailyScraping: userData.dailyScraping || { count: 0, date: new Date().toDateString(), lastReset: new Date().toISOString() },
        language: userData.language || 'en'
      });
    }

    return { success: true, users: userCodes };
  }

  getUserDetails(userCode) {
    if (!this.codes[userCode]) {
      return null;
    }

    const userData = this.codes[userCode];
    return {
      code: userCode,
      apiKeys: userData.apiKeys,
      createdAt: userData.createdAt,
      expiresAt: userData.expiresAt,
      meta: userData.meta,
      dailyScraping: userData.dailyScraping || { count: 0, date: new Date().toDateString(), lastReset: new Date().toISOString() },
      language: userData.language || 'en',
      stage: userData.stage || 'free_trial',
      trial: userData.trial || { triesUsed: 0, maxTries: 3 },
      paid: userData.paid || { grantedAt: null, expiresAt: null }
    };
  }

  addTrialUser(adminCode, userCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (this.codes[userCode]) {
      return { success: false, error: 'User code already exists' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      
      // Get available API keys for trial user
      const keysResult = apiPoolManager.getTrialUserKeys();
      if (!keysResult.success) {
        return { 
          success: false, 
          error: keysResult.error + '. Add more API keys to the pool using admin commands.' 
        };
      }

      this.codes[userCode] = {
        apiKeys: {
          googleSearchKeys: keysResult.googleSearchKeys,
          geminiKeys: keysResult.geminiKeys
        },
        createdAt: new Date().toISOString(),
        expiresAt: null,
        meta: {
          issuedBy: adminCode,
          lastUsed: null,
          useCount: 0
        },
        dailyScraping: {
          date: new Date().toDateString(),
          count: 0,
          lastReset: new Date().toISOString()
        },
        language: 'en',
        stage: 'free_trial',
        trial: { triesUsed: 0, maxTries: 3 },
        paid: { grantedAt: null, expiresAt: null }
      };

      // Assign keys to user in API pool
      const assignmentResult = apiPoolManager.assignKeysToUser(userCode, keysResult, 'trial');
      if (!assignmentResult.success) {
        return { success: false, error: `Failed to assign API keys: ${assignmentResult.error}` };
      }

      if (this.saveCodes(this.codes)) {
        return { 
          success: true, 
          message: `Trial user code '${userCode}' added successfully with API keys assigned automatically` 
        };
      } else {
        return { success: false, error: 'Failed to save trial user code' };
      }
    } catch (error) {
      return { success: false, error: `Error adding trial user: ${error.message}` };
    }
  }

  addPaidUser(adminCode, userCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (this.codes[userCode]) {
      return { success: false, error: 'User code already exists' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      
      // Get available API keys for paid user
      const keysResult = apiPoolManager.getPaidUserKeys();
      if (!keysResult.success) {
        return { 
          success: false, 
          error: keysResult.error + '. Add more API keys to the pool using admin commands.' 
        };
      }

      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      this.codes[userCode] = {
        apiKeys: {
          googleSearchKeys: keysResult.googleSearchKeys,
          geminiKeys: keysResult.geminiKeys
        },
        createdAt: new Date().toISOString(),
        expiresAt: null,
        meta: {
          issuedBy: adminCode,
          lastUsed: null,
          useCount: 0
        },
        dailyScraping: {
          date: new Date().toDateString(),
          count: 0,
          lastReset: new Date().toISOString()
        },
        language: 'en',
        stage: 'paid',
        trial: { triesUsed: 0, maxTries: 3 },
        paid: { grantedAt: now.toISOString(), expiresAt: expires.toISOString() }
      };

      // Assign keys to user in API pool
      const assignmentResult = apiPoolManager.assignKeysToUser(userCode, keysResult, 'paid');
      if (!assignmentResult.success) {
        return { success: false, error: `Failed to assign API keys: ${assignmentResult.error}` };
      }

      if (this.saveCodes(this.codes)) {
        return { 
          success: true, 
          message: `Paid user code '${userCode}' added successfully with API keys assigned automatically (expires ${expires.toLocaleString()})` 
        };
      } else {
        return { success: false, error: 'Failed to save paid user code' };
      }
    } catch (error) {
      return { success: false, error: `Error adding paid user: ${error.message}` };
    }
  }

  removeUser(adminCode, userCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    // Release API keys from pool before removing user
    try {
      const apiPoolManager = new ApiPoolManager();
      const releaseResult = apiPoolManager.releaseKeysFromUser(userCode);
      
      if (!releaseResult.success) {
        console.warn(`Warning: Could not release API keys for user ${userCode}: ${releaseResult.error}`);
      }
    } catch (error) {
      console.warn(`Warning: Error releasing API keys for user ${userCode}: ${error.message}`);
    }

    delete this.codes[userCode];
    
    if (this.saveCodes(this.codes)) {
      return { success: true, message: `User code '${userCode}' removed successfully and API keys returned to pool` };
    } else {
      return { success: false, error: 'Failed to remove user code' };
    }
  }

  // Enhanced user management methods
  modifyUserCode(adminCode, oldUserCode, newUserCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[oldUserCode]) {
      return { success: false, error: 'Old user code not found' };
    }

    if (this.codes[newUserCode] && oldUserCode !== newUserCode) {
      return { success: false, error: 'New user code already exists' };
    }

    // Copy user data to new code
    this.codes[newUserCode] = { ...this.codes[oldUserCode] };
    
    // Update meta information
    this.codes[newUserCode].meta = {
      ...this.codes[newUserCode].meta,
      modifiedBy: adminCode,
      modifiedAt: new Date().toISOString(),
      previousCode: oldUserCode
    };

    // Remove old code
    delete this.codes[oldUserCode];
    
    if (this.saveCodes(this.codes)) {
      return { success: true, message: `User code changed from '${oldUserCode}' to '${newUserCode}' successfully` };
    } else {
      return { success: false, error: 'Failed to modify user code' };
    }
  }

  modifyUserApiKeys(adminCode, userCode, newApiKeys) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    // Validate API keys structure
    if (!newApiKeys.googleSearchKeys || !newApiKeys.geminiKeys) {
      return { success: false, error: 'Invalid API keys structure. Need googleSearchKeys and geminiKeys arrays.' };
    }

    // Validate keys based on user type
    const userStage = this.codes[userCode].stage;
    const requiredGoogleKeys = userStage === 'paid' ? 3 : 1;
    const requiredGeminiKeys = userStage === 'paid' ? 3 : 1;

    if (!Array.isArray(newApiKeys.googleSearchKeys) || newApiKeys.googleSearchKeys.length !== requiredGoogleKeys) {
      return { success: false, error: `${userStage} users must have exactly ${requiredGoogleKeys} Google Search API key${requiredGoogleKeys > 1 ? 's' : ''}.` };
    }

    if (!Array.isArray(newApiKeys.geminiKeys) || newApiKeys.geminiKeys.length !== requiredGeminiKeys) {
      return { success: false, error: `${userStage} users must have exactly ${requiredGeminiKeys} Gemini API key${requiredGeminiKeys > 1 ? 's' : ''}.` };
    }

    // Store old keys for audit
    const oldApiKeys = { ...this.codes[userCode].apiKeys };
    
    // Update API keys
    this.codes[userCode].apiKeys = newApiKeys;
    
    // Update meta information
    this.codes[userCode].meta = {
      ...this.codes[userCode].meta,
      modifiedBy: adminCode,
      modifiedAt: new Date().toISOString(),
      previousApiKeys: oldApiKeys
    };
    
    if (this.saveCodes(this.codes)) {
      return { success: true, message: `API keys updated for ${userStage} user '${userCode}' successfully` };
    } else {
      return { success: false, error: 'Failed to update API keys' };
    }
  }

  modifyUserLanguage(adminCode, userCode, newLanguage) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    // Validate language
    const validLanguages = ['en', 'fr', 'ar'];
    if (!validLanguages.includes(newLanguage)) {
      return { success: false, error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` };
    }

    // Store old language for audit
    const oldLanguage = this.codes[userCode].language || 'en';
    
    // Update language
    this.codes[userCode].language = newLanguage;
    
    // Update meta information
    this.codes[userCode].meta = {
      ...this.codes[userCode].meta,
      modifiedBy: adminCode,
      modifiedAt: new Date().toISOString(),
      previousLanguage: oldLanguage
    };
    
    if (this.saveCodes(this.codes)) {
      return { success: true, message: `Language changed from '${oldLanguage}' to '${newLanguage}' for user '${userCode}' successfully` };
    } else {
      return { success: false, error: 'Failed to update language' };
    }
  }


  addDailyScrapingLimit(adminCode, userCode, additionalLimit) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    // Validate additional limit
    if (!Number.isInteger(additionalLimit) || additionalLimit <= 0) {
      return { success: false, error: 'Additional limit must be a positive integer' };
    }

    // Initialize dailyScraping if it doesn't exist
    if (!this.codes[userCode].dailyScraping) {
      this.codes[userCode].dailyScraping = {
        date: new Date().toDateString(),
        count: 0,
        lastReset: new Date().toISOString()
      };
    }

    // Add additional limit
    const currentLimit = this.codes[userCode].dailyScraping.count || 0;
    const newLimit = Math.max(0, currentLimit - additionalLimit); // Reduce count (increase remaining)
    
    this.codes[userCode].dailyScraping.count = newLimit;
    
    // Update meta information
    this.codes[userCode].meta = {
      ...this.codes[userCode].meta,
      modifiedBy: adminCode,
      modifiedAt: new Date().toISOString(),
      dailyLimitModification: {
        previousCount: currentLimit,
        additionalLimit: additionalLimit,
        newCount: newLimit
      }
    };
    
    if (this.saveCodes(this.codes)) {
      return { 
        success: true, 
        message: `Daily scraping limit updated for user '${userCode}'. Previous: ${currentLimit}, Added: ${additionalLimit}, New: ${newLimit}`,
        details: {
          previousCount: currentLimit,
          additionalLimit: additionalLimit,
          newCount: newLimit
        }
      };
    } else {
      return { success: false, error: 'Failed to update daily scraping limit' };
    }
  }

  resetUserDailyLimit(adminCode, userCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    // Store old limit for audit
    const oldCount = this.codes[userCode].dailyScraping?.count || 0;
    
    // Reset daily limit
    this.codes[userCode].dailyScraping = {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };
    
    // Update meta information
    this.codes[userCode].meta = {
      ...this.codes[userCode].meta,
      modifiedBy: adminCode,
      modifiedAt: new Date().toISOString(),
      dailyLimitReset: {
        previousCount: oldCount,
        resetAt: new Date().toISOString()
      }
    };
    
    if (this.saveCodes(this.codes)) {
      return { 
        success: true, 
        message: `Daily scraping limit reset for user '${userCode}'. Previous count: ${oldCount}, now reset to 0`,
        details: {
          previousCount: oldCount,
          resetAt: new Date().toISOString()
        }
      };
    } else {
      return { success: false, error: 'Failed to reset daily scraping limit' };
    }
  }

  getUserDailyLimitStatus(adminCode, userCode) {
    if (!this.hasPermission(adminCode, 'view_sessions') && !this.hasPermission(adminCode, 'view_all_sessions')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (!this.codes[userCode]) {
      return { success: false, error: 'User code not found' };
    }

    const dailyScraping = this.codes[userCode].dailyScraping || {
      date: new Date().toDateString(),
      count: 0,
      lastReset: new Date().toISOString()
    };

    const DAILY_SCRAPING_LIMIT = 4; // Default limit
    const remainingLimit = Math.max(0, DAILY_SCRAPING_LIMIT - dailyScraping.count);
    const isLimitReached = dailyScraping.count >= DAILY_SCRAPING_LIMIT;

    return {
      success: true,
      status: {
        userCode,
        currentDate: dailyScraping.date,
        usedToday: dailyScraping.count,
        dailyLimit: DAILY_SCRAPING_LIMIT,
        remainingToday: remainingLimit,
        isLimitReached,
        lastReset: dailyScraping.lastReset,
        nextReset: new Date(new Date(dailyScraping.lastReset).getTime() + 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }

  // Admin management
  listAdmins(adminCode) {
    if (!this.hasPermission(adminCode, 'manage_admins')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const adminList = [];
    for (const [code, adminData] of Object.entries(this.adminConfig.admin_codes)) {
      adminList.push({
        code,
        role: adminData.role,
        permissions: adminData.permissions,
        roleDescription: this.adminConfig.admin_roles[adminData.role].description,
        createdAt: adminData.createdAt,
        createdBy: adminData.createdBy,
        lastUsed: adminData.lastUsed,
        useCount: adminData.useCount
      });
    }

    return { success: true, admins: adminList };
  }

  addAdmin(adminCode, newAdminCode, role, permissions) {
    if (!this.hasPermission(adminCode, 'manage_admins')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (this.adminConfig.admin_codes[newAdminCode]) {
      return { success: false, error: 'Admin code already exists' };
    }

    if (!this.adminConfig.admin_roles[role]) {
      return { success: false, error: 'Invalid role' };
    }

    this.adminConfig.admin_codes[newAdminCode] = {
      role,
      permissions: permissions || this.adminConfig.admin_roles[role].permissions,
      createdAt: new Date().toISOString(),
      createdBy: adminCode,
      lastUsed: null,
      useCount: 0
    };

    if (this.saveAdminConfig(this.adminConfig)) {
      return { success: true, message: `Admin '${newAdminCode}' added with role '${role}'` };
    } else {
      return { success: false, error: 'Failed to save admin' };
    }
  }

  removeAdmin(adminCode, targetAdminCode) {
    if (!this.hasPermission(adminCode, 'manage_admins')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    if (targetAdminCode === adminCode) {
      return { success: false, error: 'Cannot remove yourself' };
    }

    if (!this.adminConfig.admin_codes[targetAdminCode]) {
      return { success: false, error: 'Admin code not found' };
    }

    delete this.adminConfig.admin_codes[targetAdminCode];
    
    if (this.saveAdminConfig(this.adminConfig)) {
      return { success: true, message: `Admin '${targetAdminCode}' removed successfully` };
    } else {
      return { success: false, error: 'Failed to remove admin' };
    }
  }

  // System control
  getSystemStatus(adminCode) {
    if (!this.hasPermission(adminCode, 'system_control')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const totalUsers = Object.keys(this.sessions).length;
    const authenticatedUsers = Object.values(this.sessions).filter(s => s.apiKeys).length;
    const blockedUsers = Object.values(this.sessions).filter(s => s.security?.isBlocked).length;
    const totalCodes = Object.keys(this.codes).length;
    const totalAdmins = Object.keys(this.adminConfig.admin_codes).length;

    return {
      success: true,
      status: {
        totalUsers,
        authenticatedUsers,
        blockedUsers,
        totalCodes,
        totalAdmins,
        systemSettings: this.adminConfig.system_settings
      }
    };
  }

  updateSystemSettings(adminCode, settings) {
    if (!this.hasPermission(adminCode, 'system_control')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Validate settings
    const validSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      if (this.adminConfig.system_settings.hasOwnProperty(key)) {
        validSettings[key] = value;
      }
    }

    Object.assign(this.adminConfig.system_settings, validSettings);
    
    if (this.saveAdminConfig(this.adminConfig)) {
      return { success: true, message: 'System settings updated successfully' };
    } else {
      return { success: false, error: 'Failed to update system settings' };
    }
  }

  // Utility methods
  generateRandomCode() {
    return crypto.randomBytes(4).toString('hex');
  }

  maskApiKey(key) {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  getRolePermissions(role) {
    return this.adminConfig.admin_roles[role]?.permissions || [];
  }

  getAvailableRoles() {
    return Object.keys(this.adminConfig.admin_roles);
  }

  // API Pool Management Methods
  addGoogleKey(adminCode, apiKey) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return apiPoolManager.addGoogleSearchKey(apiKey, adminCode);
    } catch (error) {
      return { success: false, error: `Error adding Google Search API key: ${error.message}` };
    }
  }

  addGeminiKey(adminCode, apiKey) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return apiPoolManager.addGeminiKey(apiKey, adminCode);
    } catch (error) {
      return { success: false, error: `Error adding Gemini API key: ${error.message}` };
    }
  }

  removeGoogleKey(adminCode, apiKey) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return apiPoolManager.removeGoogleSearchKey(apiKey);
    } catch (error) {
      return { success: false, error: `Error removing Google Search API key: ${error.message}` };
    }
  }

  removeGeminiKey(adminCode, apiKey) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return apiPoolManager.removeGeminiKey(apiKey);
    } catch (error) {
      return { success: false, error: `Error removing Gemini API key: ${error.message}` };
    }
  }

  listApiKeys(adminCode) {
    if (!this.hasPermission(adminCode, 'view_logs') && !this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return apiPoolManager.listApiKeys();
    } catch (error) {
      return { success: false, error: `Error listing API keys: ${error.message}` };
    }
  }

  getApiPoolStatistics(adminCode) {
    if (!this.hasPermission(adminCode, 'view_logs') && !this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      return { success: true, statistics: apiPoolManager.getPoolStatistics() };
    } catch (error) {
      return { success: false, error: `Error getting API pool statistics: ${error.message}` };
    }
  }

  showDetailedApiData(adminCode) {
    if (!this.hasPermission(adminCode, 'view_logs') && !this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      const apiPoolManager = new ApiPoolManager();
      
      // Get the raw API pool data
      const apiPool = apiPoolManager.apiPool;
      
      // Create detailed data with masked keys and formatted dates
      const detailedData = {
        googleSearchKeys: apiPool.google_search_keys.map(key => ({
          key: key.key,
          maskedKey: apiPoolManager.maskApiKey(key.key),
          status: key.status,
          assignedTo: key.assignedTo,
          assignedAt: key.assignedAt,
          addedBy: key.addedBy,
          addedAt: key.addedAt
        })),
        geminiKeys: apiPool.gemini_keys.map(key => ({
          key: key.key,
          maskedKey: apiPoolManager.maskApiKey(key.key),
          status: key.status,
          assignedTo: key.assignedTo,
          assignedAt: key.assignedAt,
          addedBy: key.addedBy,
          addedAt: key.addedAt
        }))
      };

      return { success: true, ...detailedData };
    } catch (error) {
      return { success: false, error: `Error getting detailed API data: ${error.message}` };
    }
  }

  addTrialUserWithRandomCode(adminCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      let attempts = 0;
      let userCode;
      
      // Generate unique random code (max 10 attempts)
      do {
        userCode = this.generateRandomCode();
        attempts++;
        if (attempts > 10) {
          return { success: false, error: 'Unable to generate unique code after 10 attempts' };
        }
      } while (this.codes[userCode]);

      // Add trial user with the generated code
      const result = this.addTrialUser(adminCode, userCode);
      
      if (result.success) {
        return {
          success: true,
          message: 'Trial user created successfully with random code',
          userCode: userCode,
          userType: 'trial',
          generatedCode: true
        };
      }
      
      return result;
    } catch (error) {
      return { success: false, error: `Error creating trial user with random code: ${error.message}` };
    }
  }

  addPaidUserWithRandomCode(adminCode) {
    if (!this.hasPermission(adminCode, 'manage_users')) {
      return { success: false, error: 'Insufficient permissions' };
    }

    try {
      let attempts = 0;
      let userCode;
      
      // Generate unique random code (max 10 attempts)
      do {
        userCode = this.generateRandomCode();
        attempts++;
        if (attempts > 10) {
          return { success: false, error: 'Unable to generate unique code after 10 attempts' };
        }
      } while (this.codes[userCode]);

      // Add paid user with the generated code
      const result = this.addPaidUser(adminCode, userCode);
      
      if (result.success) {
        return {
          success: true,
          message: 'Paid user created successfully with random code',
          userCode: userCode,
          userType: 'paid',
          generatedCode: true
        };
      }
      
      return result;
    } catch (error) {
      return { success: false, error: `Error creating paid user with random code: ${error.message}` };
    }
  }
}

export default AdminManager;
