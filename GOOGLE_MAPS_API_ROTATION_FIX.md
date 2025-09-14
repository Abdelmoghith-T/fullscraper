# 🔄 Google Maps API Key Rotation Fix

## 📋 **Issue Description**

The Google Maps scraper was experiencing 429 (rate limit) errors when the first Gemini API key hit its quota limit, but unlike the Google Search scraper, it wasn't automatically rotating to the next available API key. This caused the scraping to fail completely instead of continuing with alternative keys.

### **Symptoms:**
- ✅ Google Search scraper: Properly rotated through API keys on 429 errors
- ❌ Google Maps scraper: Failed immediately on first 429 error
- ❌ Sub-queries generation: Also failed on 429 errors without rotation
- ❌ Address selection: No rotation logic implemented

## 🔧 **Root Cause Analysis**

The issue was in the `maps_scraper/run.js` file where the Gemini API functions were not implementing proper API key rotation logic:

1. **`generateMainQueriesWithGemini()`** - Had basic error handling but no rotation
2. **`generateSubQueriesWithGemini()`** - Used old single-key approach
3. **`batchSelectAddressesWithGemini()`** - No rotation logic
4. **Configuration** - Only supported single API key

## 🛠️ **Solution Implemented**

### **1. Updated Configuration (`maps_scraper/config.js`)**

**Before:**
```javascript
gemini: {
  apiKey: process.env.GEMINI_API_KEY,
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
}
```

**After:**
```javascript
gemini: {
  // Support multiple API keys for rotation
  apiKeys: [
    process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean), // Remove undefined keys
  currentKeyIndex: 0,
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
}
```

### **2. Added Helper Functions**

```javascript
// Get current API key with rotation support
function getCurrentGeminiApiKey() {
  if (!config.gemini.apiKeys || config.gemini.apiKeys.length === 0) {
    return process.env.GEMINI_API_KEY;
  }
  return config.gemini.apiKeys[config.gemini.currentKeyIndex];
}

// Rotate to next API key when quota is exceeded
function rotateGeminiApiKey() {
  if (!config.gemini.apiKeys || config.gemini.apiKeys.length <= 1) {
    return false; // No rotation possible
  }
  config.gemini.currentKeyIndex = (config.gemini.currentKeyIndex + 1) % config.gemini.apiKeys.length;
  console.log(`🔄 Rotating to Gemini API key ${config.gemini.currentKeyIndex + 1}/${config.gemini.apiKeys.length}`);
  return true;
}
```

### **3. Enhanced Main Query Generation**

**Before:**
```javascript
async function generateMainQueriesWithGemini(userQuery, locationContext) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || config.gemini.apiKey;
    // ... single API call
  } catch (e) {
    console.error('Error in generateMainQueriesWithGemini:', e.message);
    return [];
  }
}
```

**After:**
```javascript
async function generateMainQueriesWithGemini(userQuery, locationContext) {
  const maxRetries = Math.max(config.gemini.apiKeys.length, 1);
  const exhaustedKeys = new Set();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let apiKey = getCurrentGeminiApiKey();
    
    try {
      // Check if current key is exhausted
      if (exhaustedKeys.has(apiKey)) {
        if (attempt < maxRetries - 1) {
          if (!rotateGeminiApiKey()) break;
          apiKey = getCurrentGeminiApiKey();
          continue;
        }
        break;
      }
      
      // ... API call with proper headers
      
    } catch (error) {
      // Handle 429 errors with rotation
      if (error.response?.status === 429) {
        if (error.response.data?.error?.message?.includes('quota')) {
          console.log(`⚠️ Daily quota exceeded for Gemini API key ${config.gemini.currentKeyIndex + 1}`);
          exhaustedKeys.add(apiKey);
          
          if (exhaustedKeys.size >= config.gemini.apiKeys.length) {
            throw new Error(`ALL_GEMINI_API_KEYS_QUOTA_EXCEEDED`);
          }
          
          if (rotateGeminiApiKey()) {
            apiKey = getCurrentGeminiApiKey();
            continue;
          }
        }
      }
      // ... other error handling
    }
  }
}
```

### **4. Enhanced Sub-Query Generation**

Applied the same rotation logic to `generateSubQueriesWithGemini()` function with:
- Multiple API key support
- Exhausted key tracking
- Proper error handling for 429 and 401 errors
- Automatic rotation on quota exceeded

### **5. Updated Wrapper Environment Variables**

**Before:**
```javascript
env: { 
  ...process.env, 
  GEMINI_API_KEY: this.getGeminiApiKey() || process.env.GEMINI_API_KEY
}
```

**After:**
```javascript
env: { 
  ...process.env, 
  GEMINI_API_KEY: this.getGeminiApiKey() || process.env.GEMINI_API_KEY,
  GEMINI_API_KEY_1: this.apiKeys?.geminiKeys?.[0] || process.env.GEMINI_API_KEY_1,
  GEMINI_API_KEY_2: this.apiKeys?.geminiKeys?.[1] || process.env.GEMINI_API_KEY_2,
  GEMINI_API_KEY_3: this.apiKeys?.geminiKeys?.[2] || process.env.GEMINI_API_KEY_3
}
```

## 🎯 **Key Features Implemented**

### **1. Intelligent Error Handling**
- **429 Quota Exceeded**: Automatically rotates to next key
- **429 Rate Limiting**: Waits and retries with same key
- **401 Unauthorized**: Rotates to next key (invalid key)
- **Other Errors**: Rotates to next key as fallback

### **2. Exhausted Key Tracking**
- Prevents reusing failed keys
- Tracks which keys have hit quota limits
- Provides clear error messages when all keys are exhausted

### **3. Comprehensive Logging**
```
🔍 DEBUG: Gemini API Error - Status: 429, Message: You exceeded your current quota...
⚠️  Daily quota exceeded (429) for Gemini API key 1, marking as exhausted...
🔄 Rotating to Gemini API key 2/3
✅ Successfully generated 5 queries with Gemini API key 2
```

### **4. Backward Compatibility**
- Maintains support for single `GEMINI_API_KEY` environment variable
- Falls back gracefully if multiple keys aren't provided
- No breaking changes to existing configurations

## 📊 **Testing Results**

### **Before Fix:**
```
🔍 DEBUG: Gemini API Error - Status: 429, Message: You exceeded your current quota...
❌ No main queries generated. Exiting.
❌ Gemini AI API issue
💡 Check your Gemini API key configuration for address selection
❌ Error in Google Maps Google Maps scraping: Maps scraper exited with code 1
```

### **After Fix:**
```
🔍 DEBUG: Gemini API Error - Status: 429, Message: You exceeded your current quota...
⚠️  Daily quota exceeded (429) for Gemini API key 1, marking as exhausted...
🔄 Rotating to Gemini API key 2/3
✅ Successfully generated 5 queries with Gemini API key 2
✅ Generated 5 main queries: [
  'chirurgien dentiste fes',
  'cabinet dentaire fes',
  'soins dentaires fes',
  'dentiste medina fes',
  'urgence dentaire fes'
]
```

## 🚀 **Usage Instructions**

### **1. Environment Variables Setup**

Add multiple Gemini API keys to your environment:

```bash
# Primary key (backward compatible)
GEMINI_API_KEY=your_primary_key

# Additional keys for rotation
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key  
GEMINI_API_KEY_3=your_third_key
```

### **2. Access Code Configuration**

When creating access codes, include multiple Gemini keys:

```bash
npm run admin add user123 GOOGLE_KEY_1 GOOGLE_KEY_2 GEMINI_KEY_1 GEMINI_KEY_2 GEMINI_KEY_3
```

### **3. Expected Behavior**

1. **First API key hits quota** → Automatically rotates to second key
2. **Second API key hits quota** → Automatically rotates to third key
3. **All keys exhausted** → Clear error message with guidance
4. **Rate limiting (429 without quota)** → Waits and retries with same key

## 🔍 **Files Modified**

1. **`maps_scraper/config.js`** - Added multi-key configuration
2. **`maps_scraper/run.js`** - Implemented rotation logic in all Gemini functions
3. **`wrappers/google-maps-wrapper.js`** - Enhanced environment variable passing

## 📈 **Performance Impact**

- **Positive**: Eliminates scraping failures due to API quota limits
- **Positive**: Maximizes utilization of available API keys
- **Neutral**: Minimal overhead for key rotation logic
- **Positive**: Better error reporting and debugging

## 🛡️ **Error Handling Improvements**

### **Before:**
- Single attempt per function
- Generic error messages
- No key exhaustion tracking
- Immediate failure on 429 errors

### **After:**
- Multiple attempts with different keys
- Detailed error logging with key identification
- Exhausted key tracking prevents reuse
- Graceful degradation with clear error messages

## 🎉 **Benefits**

1. **🔄 Automatic Recovery**: No manual intervention needed when keys hit limits
2. **📊 Better Utilization**: Uses all available API keys efficiently
3. **🛡️ Robust Error Handling**: Comprehensive error management and reporting
4. **🔧 Easy Configuration**: Simple environment variable setup
5. **📈 Higher Success Rate**: Significantly reduces scraping failures
6. **🔍 Better Debugging**: Detailed logging for troubleshooting

## 📝 **Notes**

- The fix maintains full backward compatibility with existing single-key configurations
- All Gemini API functions now use the same rotation logic for consistency
- The system gracefully handles cases where only one API key is available
- Error messages are clear and actionable for administrators

---

**Status**: ✅ **COMPLETED**  
**Date**: September 12, 2025  
**Impact**: High - Eliminates major source of scraping failures  
**Compatibility**: Full backward compatibility maintained
