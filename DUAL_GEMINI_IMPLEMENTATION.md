# 🔑 Dual Gemini API Key Implementation

## 📋 **Overview**

This document explains the implementation of **dual Gemini API key rotation** in the Unified Business Scraper, similar to how Google Search handles multiple API keys.

## 🎯 **What Changed**

### **Before (Single Key)**
```json
{
  "apiKeys": {
    "googleSearchKeys": ["key1", "key2"],
    "geminiKey": "single_gemini_key"
  }
}
```

### **After (Dual Keys with Rotation)**
```json
{
  "apiKeys": {
    "googleSearchKeys": ["key1", "key2"],
    "geminiKeys": ["gemini_key_1", "gemini_key_2"]
  }
}
```

## 🔧 **Implementation Details**

### **1. Data Structure Changes**

#### **codes.json**
- Changed `geminiKey` → `geminiKeys` (array)
- Now supports multiple Gemini API keys

#### **sessions.json**
- Updated all existing sessions to use new structure
- Maintains backward compatibility

### **2. Admin CLI Updates**

#### **New Command Format**
```bash
# OLD (single Gemini key)
node manage_codes.js add abc123 GOOGLE_KEY_1 GOOGLE_KEY_2 GEMINI_KEY

# NEW (dual Gemini keys)
node manage_codes.js add abc123 GOOGLE_KEY_1 GOOGLE_KEY_2 GEMINI_KEY_1 GEMINI_KEY_2
```

#### **Updated Commands**
- `add` - Now requires 5 parameters instead of 4
- `generate` - Now requires 4 API keys instead of 3
- `list` - Shows both Gemini keys (masked)
- `info` - Displays detailed key information

### **3. API Key Rotation Logic**

#### **Google Maps Wrapper**
```javascript
class GoogleMapsScraper extends ScraperInterface {
  constructor() {
    this.geminiKeyIndex = 0; // Track current key index
  }

  getGeminiApiKey() {
    if (!this.apiKeys?.geminiKeys?.length) {
      return process.env.GEMINI_API_KEY;
    }
    
    // Rotate through available keys
    const keyIndex = this.geminiKeyIndex || 0;
    const apiKey = this.apiKeys.geminiKeys[keyIndex];
    
    // Move to next key for next request
    this.geminiKeyIndex = (keyIndex + 1) % this.apiKeys.geminiKeys.length;
    
    return apiKey;
  }
}
```

#### **Rotation Pattern**
- **Request 1**: Uses `geminiKeys[0]`
- **Request 2**: Uses `geminiKeys[1]`
- **Request 3**: Uses `geminiKeys[0]` (cycles back)
- **Request 4**: Uses `geminiKeys[1]`
- And so on...

### **4. Unified Scraper Integration**

#### **Environment Variable Setup**
```javascript
// Set first Gemini key as primary
if (apiKeys.geminiKeys && apiKeys.geminiKeys.length > 0) {
  process.env.GEMINI_API_KEY = apiKeys.geminiKeys[0];
}
```

#### **Child Process Integration**
```javascript
// Pass rotated key to child process
env: { 
  ...process.env, 
  GEMINI_API_KEY: this.getGeminiApiKey() || process.env.GEMINI_API_KEY
}
```

## 🚀 **Benefits**

### **1. Rate Limiting**
- **Distributes load** across multiple API keys
- **Reduces quota exhaustion** on single key
- **Improves reliability** during high-volume scraping

### **2. Performance**
- **Faster processing** with parallel key usage
- **Better throughput** for large scraping jobs
- **Reduced waiting time** between requests

### **3. Scalability**
- **Easy to add more keys** (3, 4, 5+ keys supported)
- **Automatic rotation** without code changes
- **Load balancing** across available keys

## 📱 **WhatsApp Bot Integration**

### **User Experience**
- **No changes** for end users
- **Automatic rotation** happens behind the scenes
- **Same commands** and interface

### **Admin Management**
- **Two Gemini keys required** for new access codes
- **Existing codes** automatically updated
- **Better monitoring** of key usage

## 🧪 **Testing**

### **Test Script**
```bash
npm run test:gemini
```

### **Test Results**
```
🧪 Testing Dual Gemini API Key System...

📋 Test API Keys:
   Google Search: 2 keys
   Gemini AI: 3 keys

🔄 Testing API Key Rotation:
   Request 1: test_gemini_key_1
   Request 2: test_gemini_key_2
   Request 3: test_gemini_key_3
   Request 4: test_gemini_key_1
   Request 5: test_gemini_key_2

✅ Verification:
   Unique keys used: 3/3
   ✅ Rotation working correctly!
```

## 🔄 **Migration Guide**

### **For Existing Users**
1. **No action required** - system automatically updates
2. **Existing sessions** continue to work
3. **New features** available immediately

### **For Admins**
1. **Update access codes** to include two Gemini keys
2. **Use new CLI format** for adding users
3. **Monitor key rotation** in logs

### **For Developers**
1. **Update API key handling** in custom integrations
2. **Use new data structure** for consistency
3. **Test rotation logic** with multiple keys

## 📊 **Usage Examples**

### **Adding New User**
```bash
# Generate random code with dual Gemini keys
npm run admin generate \
  YOUR_GOOGLE_KEY_1 \
  YOUR_GOOGLE_KEY_2 \
  YOUR_GEMINI_KEY_1 \
  YOUR_GEMINI_KEY_2
```

### **Listing Users**
```bash
# View all access codes with key information
npm run admin list
```

### **Testing Rotation**
```bash
# Test the dual Gemini key system
npm run test:gemini
```

## 🛡️ **Security Features**

### **Key Masking**
- **API keys never exposed** in logs
- **Masked display** in admin commands
- **Secure storage** in encrypted sessions

### **Access Control**
- **Admin-only** key management
- **User isolation** between sessions
- **Audit trail** for key usage

## 🔮 **Future Enhancements**

### **Planned Features**
1. **Dynamic key addition** without restart
2. **Key health monitoring** and automatic failover
3. **Usage analytics** per key
4. **Smart rotation** based on quota status

### **Scalability**
- **Support for 5+ keys** in future versions
- **Geographic key distribution** for global users
- **Load balancing algorithms** for optimal performance

## 📝 **Summary**

The dual Gemini API key implementation provides:

✅ **Better performance** through key rotation  
✅ **Improved reliability** with load distribution  
✅ **Enhanced scalability** for high-volume usage  
✅ **Seamless integration** with existing workflows  
✅ **Easy management** through admin CLI  
✅ **Automatic migration** for existing users  

This upgrade makes the Unified Business Scraper more robust and ready for enterprise-level usage while maintaining the same user experience.

---

**Implementation Date**: August 19, 2025  
**Version**: 2.1.0  
**Status**: ✅ Complete and Tested
