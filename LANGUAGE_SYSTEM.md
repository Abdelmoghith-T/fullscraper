# 🌍 Multi-Language WhatsApp Bot System

## 📋 Overview

The WhatsApp Business Scraper Bot now supports **three languages**: English, French, and Arabic. Users can select their preferred language when they first interact with the bot.

## 🚀 Features

### **Language Selection**
- **Welcome Message**: New users are greeted with a language selection menu
- **Persistent Language**: Selected language is saved in user session
- **Complete Localization**: All bot messages are translated to the selected language

### **Supported Languages**
1. **🇺🇸 English (en)** - Default language
2. **🇫🇷 Français (fr)** - French language
3. **🇸🇦 العربية (ar)** - Arabic language

## 🔧 Implementation

### **Language Configuration**
All messages are stored in `languages.js` with the following structure:

```javascript
export const languages = {
  en: {
    welcome: "🚀 **Welcome to the Business Scraper!**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice.",
    auth_required: "🔐 **Authentication required.** Please send your access code first...",
    // ... more messages
  },
  fr: {
    welcome: "🚀 **Bienvenue dans le Scraper Business!**\n\nVeuillez sélectionner votre langue préférée...",
    auth_required: "🔐 **Authentification requise.** Veuillez d'abord envoyer votre code d'accès...",
    // ... more messages
  },
  ar: {
    welcome: "🚀 **مرحباً بك في مستخرج البيانات التجارية!**\n\nيرجى اختيار لغتك المفضلة...",
    auth_required: "🔐 **مطلوب مصادقة.** يرجى إرسال رمز الوصول أولاً...",
    // ... more messages
  }
};
```

### **Message Retrieval**
Messages are retrieved using the `getMessage()` function:

```javascript
import { getMessage } from './languages.js';

// Simple message
const welcome = getMessage('en', 'welcome');

// Message with parameters
const accessGranted = getMessage('fr', 'access_granted', {
  source: 'ALL',
  format: 'XLSX',
  limit: 300
});
```

### **Session Management**
User language preference is stored in the session:

```javascript
sessions[jid] = {
  language: 'en', // User's selected language
  currentStep: 'awaiting_language', // New users start here
  // ... other session data
};
```

## 📱 User Experience

### **First-Time Users**
1. **Welcome Message**: User receives language selection menu
2. **Language Choice**: User selects 1, 2, or 3 for their preferred language
3. **Authentication**: User proceeds with authentication in their chosen language
4. **Full Experience**: All subsequent interactions are in the selected language

### **Returning Users**
- Language preference is automatically loaded from session
- All messages appear in their previously selected language
- No need to re-select language

## 🧪 Testing

### **Run Language Tests**
```bash
npm run test:languages
```

### **Test Output**
```
🌍 Testing Multi-Language WhatsApp Bot System...

📋 Available Languages:
   🇺🇸 English (en)
   🇫🇷 Français (fr)
   🇸🇦 العربية (ar)

🧪 Testing 🇺🇸 English (en):
   Welcome: 🚀 **Welcome to the Business Scraper!**...
   Auth: 🔐 **Authentication required.** Please send...
   Access: ✅ **Access granted!** Welcome to the Business...
   Source: 🎯 **Select Data Source for "dentist casablanca"**:...
   Data Type: 📋 **Select Data Type for Google Search:**...
   Format: 💾 **Select Output Format:**...
   Job Start: 🔍 **Starting scraping job...**...
   Job Complete: ✅ **Scraping Complete!**...
   Help: 📚 **Business Scraper Help**...
   ✅ English language test completed

🧪 Testing 🇫🇷 Français (fr):
   // ... French language tests

🧪 Testing 🇸🇦 العربية (ar):
   // ... Arabic language tests

🔧 Testing Parameter Replacement:
   English job complete with params: ✅ **Scraping Complete!**...
   French job complete with params: ✅ **Scraping Terminé!**...
   Arabic job complete with params: ✅ **اكتمل الاستخراج!**...

✅ Parameter replacement test completed

🔄 Testing Fallback to English:
   Invalid language fallback: 🚀 **Welcome to the Business Scraper!**...
   Invalid key fallback: invalid_key

🎉 All language system tests completed successfully!
```

## 📝 Message Categories

### **Core Messages**
- `welcome` - Language selection menu
- `auth_required` - Authentication prompt
- `invalid_code` - Invalid access code error
- `access_granted` - Successful authentication

### **Search Flow Messages**
- `enter_niche` - Search query input prompt
- `invalid_niche` - Invalid search query error
- `select_source` - Data source selection
- `select_type_*` - Data type selection (Google, LinkedIn, Maps, All)
- `select_format` - Output format selection
- `format_set` - Format selection confirmation

### **Job Management Messages**
- `job_starting` - Job initialization
- `job_complete` - Job completion summary
- `job_stopped` - Job stopped notification
- `job_status` - Current job status

### **Navigation Messages**
- `go_back` - Back navigation
- `restart` - Restart process
- `reset` - Reset preferences

### **Help & Error Messages**
- `help` - Complete help documentation
- `error_generic` - Generic error message
- `error_no_results` - No results found
- `progress_update` - Progress updates
- `progress_complete` - Progress completion

## 🔄 Adding New Languages

### **1. Add Language to Configuration**
```javascript
// In languages.js
export const languages = {
  // ... existing languages
  es: { // Spanish
    welcome: "🚀 **¡Bienvenido al Scraper de Negocios!**\n\nPor favor selecciona tu idioma preferido...",
    auth_required: "🔐 **Autenticación requerida.** Por favor envía tu código de acceso primero...",
    // ... add all message keys
  }
};
```

### **2. Update Available Languages**
```javascript
export function getAvailableLanguages() {
  return [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'es', name: 'Español', flag: '🇪🇸' } // New language
  ];
}
```

### **3. Update Welcome Message**
Add the new language option to all welcome messages:
```javascript
welcome: "🚀 **Welcome to the Business Scraper!**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n4️⃣ **Español**\n\n💬 **Reply with the number** corresponding to your choice."
```

### **4. Update Language Mapping**
```javascript
// In bot.js
const langMap = { 1: 'en', 2: 'fr', 3: 'ar', 4: 'es' };
```

## 🛡️ Error Handling

### **Fallback System**
- **Invalid Language**: Falls back to English
- **Missing Message**: Falls back to English version
- **Invalid Key**: Returns the key name as fallback

### **Parameter Validation**
- **Missing Parameters**: Uses empty strings
- **Invalid Parameters**: Gracefully handles type mismatches
- **Extra Parameters**: Ignores unused parameters

## 📊 Performance Considerations

### **Memory Usage**
- All language messages are loaded in memory
- Minimal impact on bot performance
- Efficient parameter replacement

### **Session Storage**
- Language preference stored in session file
- Automatic cleanup with session management
- No additional storage overhead

## 🎯 Best Practices

### **Message Consistency**
- Use consistent emoji across languages
- Maintain similar message structure
- Keep formatting consistent

### **Translation Quality**
- Use native speakers for translations
- Test with real users
- Maintain cultural sensitivity

### **Maintenance**
- Regular review of translations
- Update messages when features change
- Test all languages after updates

---

## 🚀 Quick Start

1. **Start the bot**: `npm run whatsapp`
2. **Scan QR code** with WhatsApp
3. **Select language** when prompted
4. **Authenticate** with your access code
5. **Start scraping** in your preferred language!

The multi-language system provides a seamless, localized experience for users worldwide while maintaining the full functionality of the Business Scraper Bot.
