import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_POOL_FILE = path.join(__dirname, '..', 'api_pool.json');

/**
 * API Pool Manager - Handles API key storage and assignment
 */
class ApiPoolManager {
  constructor() {
    this.apiPool = this.loadApiPool();
  }

  /**
   * Load API pool from file
   */
  loadApiPool() {
    if (!fs.existsSync(API_POOL_FILE)) {
      return this.createDefaultApiPool();
    }
    
    try {
      return JSON.parse(fs.readFileSync(API_POOL_FILE, 'utf8'));
    } catch (error) {
      console.error('❌ Error reading API pool:', error.message);
      return this.createDefaultApiPool();
    }
  }

  /**
   * Create default empty API pool
   */
  createDefaultApiPool() {
    const defaultPool = {
      google_search_keys: [],
      gemini_keys: []
    };
    
    this.saveApiPool(defaultPool);
    return defaultPool;
  }

  /**
   * Save API pool to file
   */
  saveApiPool(pool) {
    try {
      fs.writeFileSync(API_POOL_FILE, JSON.stringify(pool, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error saving API pool:', error.message);
      return false;
    }
  }

  /**
   * Add Google Search API key to pool
   */
  addGoogleSearchKey(apiKey, adminCode) {
    // Validate API key format
    if (!this.validateApiKey(apiKey, 'Google Search')) {
      return { success: false, error: 'Invalid Google Search API key format' };
    }

    // Check if key already exists
    const existingKey = this.apiPool.google_search_keys.find(k => k.key === apiKey);
    if (existingKey) {
      return { success: false, error: 'Google Search API key already exists in pool' };
    }

    // Add to pool
    this.apiPool.google_search_keys.push({
      key: apiKey,
      status: 'available',
      assignedTo: null,
      assignedAt: null,
      addedBy: adminCode,
      addedAt: new Date().toISOString()
    });

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `Google Search API key added successfully`,
        maskedKey: this.maskApiKey(apiKey)
      };
    } else {
      return { success: false, error: 'Failed to save API pool' };
    }
  }

  /**
   * Add Gemini API key to pool
   */
  addGeminiKey(apiKey, adminCode) {
    // Validate API key format
    if (!this.validateApiKey(apiKey, 'Gemini')) {
      return { success: false, error: 'Invalid Gemini API key format' };
    }

    // Check if key already exists
    const existingKey = this.apiPool.gemini_keys.find(k => k.key === apiKey);
    if (existingKey) {
      return { success: false, error: 'Gemini API key already exists in pool' };
    }

    // Add to pool
    this.apiPool.gemini_keys.push({
      key: apiKey,
      status: 'available',
      assignedTo: null,
      assignedAt: null,
      addedBy: adminCode,
      addedAt: new Date().toISOString()
    });

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `Gemini API key added successfully`,
        maskedKey: this.maskApiKey(apiKey)
      };
    } else {
      return { success: false, error: 'Failed to save API pool' };
    }
  }

  /**
   * Remove Google Search API key from pool
   */
  removeGoogleSearchKey(apiKey) {
    const keyIndex = this.apiPool.google_search_keys.findIndex(k => k.key === apiKey);
    
    if (keyIndex === -1) {
      return { success: false, error: 'Google Search API key not found in pool' };
    }

    const key = this.apiPool.google_search_keys[keyIndex];
    
    // Check if key is currently assigned
    if (key.status === 'used' && key.assignedTo) {
      return { 
        success: false, 
        error: `Cannot remove key currently assigned to user: ${key.assignedTo}` 
      };
    }

    // Remove from pool
    this.apiPool.google_search_keys.splice(keyIndex, 1);

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `Google Search API key removed successfully`,
        maskedKey: this.maskApiKey(apiKey)
      };
    } else {
      return { success: false, error: 'Failed to save API pool' };
    }
  }

  /**
   * Remove Gemini API key from pool
   */
  removeGeminiKey(apiKey) {
    const keyIndex = this.apiPool.gemini_keys.findIndex(k => k.key === apiKey);
    
    if (keyIndex === -1) {
      return { success: false, error: 'Gemini API key not found in pool' };
    }

    const key = this.apiPool.gemini_keys[keyIndex];
    
    // Check if key is currently assigned
    if (key.status === 'used' && key.assignedTo) {
      return { 
        success: false, 
        error: `Cannot remove key currently assigned to user: ${key.assignedTo}` 
      };
    }

    // Remove from pool
    this.apiPool.gemini_keys.splice(keyIndex, 1);

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `Gemini API key removed successfully`,
        maskedKey: this.maskApiKey(apiKey)
      };
    } else {
      return { success: false, error: 'Failed to save API pool' };
    }
  }

  /**
   * Get available API keys for trial user (1 of each)
   */
  getTrialUserKeys() {
    const availableGoogleKeys = this.apiPool.google_search_keys.filter(k => k.status === 'available');
    const availableGeminiKeys = this.apiPool.gemini_keys.filter(k => k.status === 'available');

    if (availableGoogleKeys.length === 0) {
      return { success: false, error: 'No available Google Search API keys for trial user' };
    }

    if (availableGeminiKeys.length === 0) {
      return { success: false, error: 'No available Gemini API keys for trial user' };
    }

    return {
      success: true,
      googleSearchKeys: [availableGoogleKeys[0].key],
      geminiKeys: [availableGeminiKeys[0].key],
      assignedKeys: {
        google: availableGoogleKeys[0],
        gemini: availableGeminiKeys[0]
      }
    };
  }

  /**
   * Get available API keys for paid user (3 of each)
   */
  getPaidUserKeys() {
    const availableGoogleKeys = this.apiPool.google_search_keys.filter(k => k.status === 'available');
    const availableGeminiKeys = this.apiPool.gemini_keys.filter(k => k.status === 'available');

    if (availableGoogleKeys.length < 3) {
      return { 
        success: false, 
        error: `Insufficient Google Search API keys. Need 3, available: ${availableGoogleKeys.length}` 
      };
    }

    if (availableGeminiKeys.length < 3) {
      return { 
        success: false, 
        error: `Insufficient Gemini API keys. Need 3, available: ${availableGeminiKeys.length}` 
      };
    }

    return {
      success: true,
      googleSearchKeys: availableGoogleKeys.slice(0, 3).map(k => k.key),
      geminiKeys: availableGeminiKeys.slice(0, 3).map(k => k.key),
      assignedKeys: {
        google: availableGoogleKeys.slice(0, 3),
        gemini: availableGeminiKeys.slice(0, 3)
      }
    };
  }

  /**
   * Assign API keys to user
   */
  assignKeysToUser(userCode, keys, userType) {
    const assignedKeys = keys.assignedKeys;
    const now = new Date().toISOString();

    // Mark Google Search keys as used
    if (Array.isArray(assignedKeys.google)) {
      assignedKeys.google.forEach(key => {
        key.status = 'used';
        key.assignedTo = userCode;
        key.assignedAt = now;
      });
    } else {
      // Single key case
      assignedKeys.google.status = 'used';
      assignedKeys.google.assignedTo = userCode;
      assignedKeys.google.assignedAt = now;
    }

    // Mark Gemini keys as used
    if (Array.isArray(assignedKeys.gemini)) {
      assignedKeys.gemini.forEach(key => {
        key.status = 'used';
        key.assignedTo = userCode;
        key.assignedAt = now;
      });
    } else {
      // Single key case
      assignedKeys.gemini.status = 'used';
      assignedKeys.gemini.assignedTo = userCode;
      assignedKeys.gemini.assignedAt = now;
    }

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `API keys assigned to ${userType} user: ${userCode}`,
        assignedCount: {
          google: Array.isArray(assignedKeys.google) ? assignedKeys.google.length : 1,
          gemini: Array.isArray(assignedKeys.gemini) ? assignedKeys.gemini.length : 1
        }
      };
    } else {
      return { success: false, error: 'Failed to save API pool after assignment' };
    }
  }

  /**
   * Release API keys from user
   */
  releaseKeysFromUser(userCode) {
    let releasedCount = { google: 0, gemini: 0 };

    // Release Google Search keys
    this.apiPool.google_search_keys.forEach(key => {
      if (key.assignedTo === userCode) {
        key.status = 'available';
        key.assignedTo = null;
        key.assignedAt = null;
        releasedCount.google++;
      }
    });

    // Release Gemini keys
    this.apiPool.gemini_keys.forEach(key => {
      if (key.assignedTo === userCode) {
        key.status = 'available';
        key.assignedTo = null;
        key.assignedAt = null;
        releasedCount.gemini++;
      }
    });

    if (this.saveApiPool(this.apiPool)) {
      return { 
        success: true, 
        message: `Released API keys from user: ${userCode}`,
        releasedCount
      };
    } else {
      return { success: false, error: 'Failed to save API pool after release' };
    }
  }

  /**
   * List all API keys with status
   */
  listApiKeys() {
    return {
      success: true,
      googleSearchKeys: {
        total: this.apiPool.google_search_keys.length,
        available: this.apiPool.google_search_keys.filter(k => k.status === 'available').length,
        used: this.apiPool.google_search_keys.filter(k => k.status === 'used').length,
        keys: this.apiPool.google_search_keys.map(k => ({
          maskedKey: this.maskApiKey(k.key),
          status: k.status,
          assignedTo: k.assignedTo,
          assignedAt: k.assignedAt
        }))
      },
      geminiKeys: {
        total: this.apiPool.gemini_keys.length,
        available: this.apiPool.gemini_keys.filter(k => k.status === 'available').length,
        used: this.apiPool.gemini_keys.filter(k => k.status === 'used').length,
        keys: this.apiPool.gemini_keys.map(k => ({
          maskedKey: this.maskApiKey(k.key),
          status: k.status,
          assignedTo: k.assignedTo,
          assignedAt: k.assignedAt
        }))
      }
    };
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey, type) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return false;
    }

    if (apiKey.length < 10) {
      return false;
    }

    // Basic Google API key validation (starts with AIzaSy)
    if (type === 'Google Search' && !apiKey.startsWith('AIzaSy')) {
      return false;
    }

    // Basic Gemini API key validation (starts with AIzaSy)
    if (type === 'Gemini' && !apiKey.startsWith('AIzaSy')) {
      return false;
    }

    return true;
  }

  /**
   * Mask API key for display
   */
  maskApiKey(key) {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics() {
    const googleAvailable = this.apiPool.google_search_keys.filter(k => k.status === 'available').length;
    const googleUsed = this.apiPool.google_search_keys.filter(k => k.status === 'used').length;
    const geminiAvailable = this.apiPool.gemini_keys.filter(k => k.status === 'available').length;
    const geminiUsed = this.apiPool.gemini_keys.filter(k => k.status === 'used').length;

    return {
      googleSearchKeys: {
        total: this.apiPool.google_search_keys.length,
        available: googleAvailable,
        used: googleUsed
      },
      geminiKeys: {
        total: this.apiPool.gemini_keys.length,
        available: geminiAvailable,
        used: geminiUsed
      },
      canCreateTrialUsers: Math.min(googleAvailable, geminiAvailable),
      canCreatePaidUsers: Math.min(Math.floor(googleAvailable / 3), Math.floor(geminiAvailable / 3))
    };
  }
}

export default ApiPoolManager;
