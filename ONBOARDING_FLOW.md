# 🌐 New Onboarding Flow Implementation

## 🎯 **Overview**

The WhatsApp bot now implements a proper onboarding flow for new users that ensures they select a language and authenticate before accessing the system. This provides a better user experience and prevents confusion.

## 🔄 **Flow Overview**

### **Step 1: First Message**
- **User sends any message** to the bot
- **Bot creates session** with `currentStep: 'awaiting_language'`
- **Bot sends language selection message** (always in English)

### **Step 2: Language Selection**
- **User must select 1, 2, or 3** for language choice
- **Invalid inputs** trigger resend of language selection message
- **Valid selection** sets language and moves to authentication step

### **Step 3: Authentication**
- **User must send CODE: <access_code>**
- **Invalid inputs** trigger resend of authentication message
- **Valid code** completes authentication and shows main menu

## 📱 **Detailed Flow**

### **1. New User First Message**
```
👤 User: "hello"
🤖 Bot: [Language Selection Message]
```

**Language Selection Message:**
```
🚀 **Welcome to the Business Lead Finder!**

Please select your preferred language:

1️⃣ **English**
2️⃣ **Français** 
3️⃣ **العربية**

💬 **Reply with the number** corresponding to your choice.
```

### **2. Invalid Language Selection**
```
👤 User: "hi there"
🤖 Bot: [Resends Language Selection Message]
```

### **3. Valid Language Selection**
```
👤 User: "2"
🤖 Bot: [Authentication Message in French]
```

**Authentication Message (French):**
```
🔐 **Authentification requise.** Veuillez d'abord envoyer votre code d'accès.

💬 **Format:** CODE: votre_code_ici
💬 **Exemple:** CODE: user1

💡 Contactez l'administrateur si vous n'avez pas de code d'accès.

0️⃣ **CHANGER DE LANGUE** - Sélectionner une langue différente
```

### **4. Invalid Authentication Attempt**
```
👤 User: "hello again"
🤖 Bot: [Resends Authentication Message]
```

### **5. Valid Authentication**
```
👤 User: "CODE: user123"
🤖 Bot: [Welcome Message + Main Menu in Selected Language]
```

## 🛠️ **Technical Implementation**

### **Session States**
```javascript
// New user session creation
sessions[jid] = {
  currentStep: 'awaiting_language',  // Start with language selection
  language: 'en',                    // Default language
  // ... other session properties
};
```

### **State Transitions**
1. **`awaiting_language`** → User must select language (1, 2, or 3)
2. **`awaiting_authentication`** → User must send CODE: <access_code> or "0" to go back to language selection
3. **`main_menu`** → User is authenticated and can use the system

### **Validation Logic**
```javascript
// Language selection validation
if (session.currentStep === 'awaiting_language' && !session.apiKeys) {
  const langNumber = parseInt(text);
  const langMap = { 1: 'en', 2: 'fr', 3: 'ar' };
  
  if (langNumber >= 1 && langNumber <= 3) {
    // Valid selection - proceed to authentication
    session.language = langMap[langNumber];
    session.currentStep = 'awaiting_authentication';
  } else {
    // Invalid selection - resend language message
    await sock.sendMessage(jid, { text: getMessage('en', 'welcome') });
  }
}

// Authentication validation
if (session.currentStep === 'awaiting_authentication' && !session.apiKeys) {
  if (!/^CODE:?\s+/i.test(text)) {
    // Invalid input - resend authentication message
    await sock.sendMessage(jid, { text: getMessage(session.language, 'auth_required') });
  }
  // If valid CODE format, continue to authentication logic
}
```

## 🌍 **Language Support**

### **Supported Languages**
- **1️⃣ English (en)** - Default language
- **2️⃣ French (fr)** - Français
- **3️⃣ Arabic (ar)** - العربية

### **Language Persistence**
- **Selected language** is saved to user's profile in `codes.json` after authentication
- **Language preference** is loaded on subsequent logins
- **All messages** are displayed in the selected language
- **Language is preserved** throughout the entire onboarding and authentication flow
- **Critical fix**: User's language selection during onboarding always takes precedence over codes database language

## 🔒 **Security Features**

### **Input Validation**
- **Language selection**: Only accepts 1, 2, or 3
- **Authentication**: Accepts CODE: format or "0" to go back to language selection
- **Invalid inputs**: Trigger appropriate error messages

### **Session Management**
- **New sessions** start with language selection
- **Language selection** is required before authentication
- **Authentication** is required before system access

### **Error Handling**
- **Invalid language selection**: Sends invalid selection error message + resends language message
- **Invalid authentication**: Resends authentication message
- **Failed authentication**: Tracks failed attempts and blocks after 5 failures

### **Navigation Options**
- **"0" during language selection**: For unauthenticated users, resends welcome message; for authenticated users, returns to main menu
- **"0" during authentication**: Goes back to language selection, allowing users to change language before providing access code
- **"0" during stop confirmation**: Cancels the stop request and returns to scraping state

### **Job Management**
- **Job running message**: Now uses user's selected language and only shows STOP option (STATUS removed)
- **STOP command**: Requires confirmation before execution
- **Stop confirmation**: User must send "1" to confirm, "0" to cancel
- **Stop results**: If results exist, they are sent to user; if no results, appropriate message is shown
- **State management**: Proper session state transitions during stop process
- **Progress simulator**: Properly stopped when job is cancelled to prevent continued progress messages
- **Job cleanup**: Active jobs are completely cleared from memory when stopped
- **Process termination**: Child processes (LinkedIn scraper, etc.) are properly killed on abort
- **Abort signal propagation**: Abort signals are passed through the entire scraping chain

## 🧪 **Testing**

### **Test Script**
```bash
npm run test:onboarding
```

### **Test Scenarios**
1. **New user first message** → Language selection
2. **Invalid language input** → Resend language message
3. **Valid language selection** → Authentication message
4. **Invalid authentication** → Resend auth message
5. **Valid authentication** → Main menu

### **Edge Cases**
- **Empty messages**: Ignored silently
- **Non-numeric language input**: Shows invalid selection error message + resends language message
- **Partial CODE format**: Resends authentication message
- **Invalid access codes**: Shows error message

## 📋 **Message Templates**

### **Language Selection Messages**

#### **Welcome Message (for new users)**
```javascript
// English
"🤖 **Welcome to the Business Lead Finder!**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice."

// French
"🤖 **Bienvenue dans le Localisateur de Prospects!**\n\nVeuillez sélectionner votre langue préférée:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Répondez avec le numéro** correspondant à votre choix."

// Arabic
"🤖 **مرحباً بك في محدد العملاء المحتملين!**\n\nيرجى اختيار لغتك المفضلة:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **أرسل الرقم** المقابل لاختيارك."
```

#### **Language Selection Message (for existing users)**
```javascript
// English
"🌐 **Language Selection**\n\nPlease select your preferred language:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Reply with the number** corresponding to your choice.\n\n0️⃣ **BACK TO MENU** - Return to main menu"

// French
"🌐 **Sélection de Langue**\n\nVeuillez sélectionner votre langue préférée:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **Répondez avec le numéro** correspondant à votre choix.\n\n0️⃣ **RETOUR AU MENU** - Retourner au menu principal"

// Arabic
"🌐 **اختيار اللغة**\n\nيرجى اختيار لغتك المفضلة:\n\n1️⃣ **English**\n2️⃣ **Français**\n3️⃣ **العربية**\n\n💬 **أرسل الرقم** المقابل لاختيارك.\n\n0️⃣ **العودة إلى القائمة** - العودة إلى القائمة الرئيسية"
```

### **Authentication Required (auth_required)**
```javascript
// English
"🔐 **Authentication required.** Please send your access code first.\n\n💬 **Format:** CODE: your_code_here\n💬 **Example:** CODE: user1\n\n💡 Contact admin if you don't have an access code.\n\n0️⃣ **CHANGE LANGUAGE** - Select a different language"

// French
"🔐 **Authentification requise.** Veuillez d'abord envoyer votre code d'accès.\n\n💬 **Format:** CODE: votre_code_ici\n💬 **Exemple:** CODE: user1\n\n💡 Contactez l'administrateur si vous n'avez pas de code d'accès.\n\n0️⃣ **CHANGER DE LANGUE** - Sélectionner une langue différente"

// Arabic
"🔐 **مطلوب مصادقة.** يرجى إرسال رمز الوصول أولاً.\n\n💬 **التنسيق:** CODE: رمزك_هنا\n💬 **مثال:** CODE: user1\n\n💡 اتصل بالمدير إذا لم يكن لديك رمز وصول.\n\n0️⃣ **تغيير اللغة** - اختر لغة مختلفة"
```

## 🚀 **Benefits**

### **User Experience**
- **Clear onboarding** process for new users
- **Language preference** selection upfront
- **Guided authentication** with clear instructions
- **Error handling** with helpful messages
- **Consistent language** throughout the entire user journey
- **Fixed language persistence** - users now receive messages in their selected language after authentication
- **Separate language selection messages** - different messages for new users vs existing users changing language

### **System Security**
- **Structured authentication** flow
- **Input validation** at each step
- **Session state management** prevents bypassing
- **Consistent error handling**

### **Maintainability**
- **Modular code** with clear state transitions
- **Reusable message templates** in multiple languages
- **Comprehensive testing** with dedicated test script
- **Clear documentation** for future development

## 🔄 **Migration Notes**

### **Existing Users**
- **Returning users** with existing sessions continue to work normally
- **Language preferences** are preserved from previous sessions
- **Authentication flow** remains the same for authenticated users

### **New Users**
- **All new users** go through the complete onboarding flow
- **Language selection** is required before authentication
- **Session states** are properly managed throughout the process

---

**The new onboarding flow ensures a smooth and secure user experience while maintaining backward compatibility with existing users.** 🎯

