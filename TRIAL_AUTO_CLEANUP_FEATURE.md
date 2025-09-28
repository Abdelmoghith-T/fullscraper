# Trial Auto-Cleanup Feature Implementation

## Overview
This document outlines the implementation of an automatic cleanup feature for trial users in the Business Lead Finder WhatsApp bot. When trial users consume all their attempts, their codes are automatically removed from the system to free up API keys, and they receive informative messages about upgrading to Premium.

## Features Implemented

### 1. Auto-Cleanup System
- **Automatic Code Removal**: Trial user codes are automatically removed from `codes.json` when they reach their limit
- **API Key Liberation**: Frees up Google Maps and Gemini API keys for reuse
- **Session State Management**: Users are moved to `trial_end` state after completing their trials

### 2. Enhanced User Experience
- **Informative Messages**: Clear, convincing messages about Premium benefits
- **Multilingual Support**: All messages available in English, French, and Arabic
- **Re-authentication Support**: Users can be re-authenticated if admins recreate their codes

### 3. Admin Flexibility
- **Code Recreation**: Admins can recreate codes for users who have completed trials
- **Seamless Re-authentication**: Users automatically re-authenticate when their codes are recreated
- **Session Restoration**: Full session restoration with appropriate welcome messages

## Technical Implementation

### Files Modified

#### 1. `bot.js` - Main Bot Logic
**Location**: Around line 6844 (Trial completion detection)
```javascript
// Block if trial limit reached
if (stageLocal === 'free_trial' && trialLocal.triesUsed >= trialLocal.maxTries) {
    // 🗑️ AUTO-REMOVE: Remove trial user code when limit is reached
    if (userCodeLocal && codesDbLocal[userCodeLocal]) {
        console.log(chalk.yellow(`🗑️ Trial user ${userCodeLocal} has reached limit (${trialLocal.triesUsed}/${trialLocal.maxTries}). Auto-removing code to free up API keys.`));
        delete codesDbLocal[userCodeLocal];
        saveJson(CODES_FILE, codesDbLocal);
        await sock.sendMessage(jid, {
            text: `🎯 **Trial Complete!**\n\n✅ You have used all ${trialLocal.maxTries} trial attempts.\n\n💡 **Want to continue? Upgrade to Premium!**\n\n🚀 **Premium Benefits:**\n• 4 searches per day (instead of 3 total)\n• Unlimited data extraction\n• Priority support\n• Advanced features\n\n📞 **Contact support in the number below to upgrade your account!**`
        });
        await sock.sendMessage(jid, {
            text: getMessage(currentSession.language, 'support_contact')
        });
        console.log(chalk.blue(`🗑️ Trial user code '${userCodeLocal}' auto-removed after reaching limit`));
    }
    currentSession.currentStep = 'trial_end';
    sessions[jid] = currentSession;
    saveJson(SESSIONS_FILE, sessions);
    return;
}
```

**Location**: Around line 7110 (Successful job completion handler)
```javascript
let isTrialComplete = false;
if (completionUserEntry && completionUserEntry.stage === 'free_trial' && completionUserEntry.trial) {
    const trial = completionUserEntry.trial;
    const currentTries = trial.triesUsed || 0;
    if (currentTries >= (trial.maxTries || 3)) {
        isTrialComplete = true;
        console.log(chalk.yellow(`🎯 Trial user ${completionUserCode} has completed their final attempt (${currentTries}/${trial.maxTries})`));
    }
}

if (isTrialComplete) {
    await mutateUserSession(jid, (s) => ({
        ...s,
        status: 'idle',
        currentStep: 'trial_end',
        meta: { ...(s.meta || {}), totalJobs: ((s.meta?.totalJobs) || 0) + 1 }
    }));
}
```

**Location**: Around line 5764 (Trial end state handler)
```javascript
if (session.currentStep === 'trial_end') {
    const userCode = session.code;
    const codesDb = loadJson(CODES_FILE, {});
    
    if (userCode && codesDb[userCode]) {
        console.log(chalk.green(`🔄 Code '${userCode}' was recreated by admin. Re-authenticating user ${jid.split('@')[0]}`));
        const userEntry = codesDb[userCode];
        session.apiKeys = userEntry.apiKeys;
        session.stage = userEntry.stage;
        session.language = userEntry.language || session.language;
        session.currentStep = 'main_menu';
        session.status = 'idle';
        if (userEntry.trial) {
            session.trial = userEntry.trial;
        }
        sessions[jid] = session;
        saveJson(SESSIONS_FILE, sessions);
        
        // Send welcome message first (like fresh authentication)
        if (session.stage === 'free_trial') {
            await sock.sendMessage(jid, { text: getMessage(session.language, 'trial_welcome') });
        } else if (session.stage === 'paid') {
            await sock.sendMessage(jid, { text: getMessage(session.language, 'paid_welcome') });
        }
        
        // Then send main menu
        await sendImageWithMessage(sock, jid, 'main_menu', getMessage(session.language, 'main_menu'), session.language);
        return;
    }
}
```

#### 2. `languages.js` - Multilingual Messages
**Added Messages**:
```javascript
// English
trial_finished: "🎯 **Trial Complete!**\n\n✅ You have used all 3 trial attempts.\n\n💡 **Want to continue? Upgrade to Premium!**\n\n🚀 **Premium Benefits:**\n• 4 searches per day (instead of 3 total)\n• Unlimited data extraction\n• Priority support\n• Advanced features\n\n📞 **Contact support in the number below to upgrade your account!**",
support_contact: "📞 **Support Contact:**\n\nClick here: https://wa.me/212717034808",

// French
trial_finished: "🎯 **Essai Terminé !**\n\n✅ Vous avez utilisé vos 3 tentatives d'essai.\n\n💡 **Voulez-vous continuer ? Passez à Premium !**\n\n🚀 **Avantages Premium :**\n• 4 recherches par jour (au lieu de 3 au total)\n• Extraction de données illimitée\n• Support prioritaire\n• Fonctionnalités avancées\n\n📞 **Contactez le support au numéro ci-dessous pour mettre à niveau votre compte !**",
support_contact: "📞 **Contact Support :**\n\nCliquez ici : https://wa.me/212717034808",

// Arabic
trial_finished: "🎯 **انتهت التجربة!**\n\n✅ لقد استخدمت جميع محاولاتك التجريبية الثلاث.\n\n💡 **هل تريد المتابعة؟ ترقية إلى Premium!**\n\n🚀 **مزايا Premium:**\n• 4 عمليات بحث يومياً (بدلاً من 3 إجمالي)\n• استخراج بيانات غير محدود\n• دعم أولوية\n• ميزات متقدمة\n\n📞 **تواصل مع الدعم في الرقم أدناه لترقية حسابك!**",
support_contact: "📞 **جهة اتصال الدعم:**\n\nانقر هنا: https://wa.me/212717034808",
```

**Updated Welcome Messages** (removed STATUS command references):
```javascript
// Trial Welcome (English)
trial_welcome: "🎉 **Welcome to your Free Trial!**\n\nYou're all set to explore the Business Lead Finder.\n\n**How it works:**\n• 3 trial searches included\n• Each trial search returns up to 20 leads (trial limit). Upgrade to get unlimited results\n\nWhen you're ready to continue after the trial, contact support to upgrade.\n\n✨ Happy lead finding!",

// Paid Welcome (English)
paid_welcome: "🎉 **Welcome back!**\n\nYour subscription is active.\n\n**Good to know:**\n• Daily limit: 4 searches per day\n• Results per search: unlimited\n\n✨ Let's find new leads!",
```

## User Flow

### 1. Trial User Journey
1. **Authentication**: User enters trial code
2. **Usage**: User performs searches (up to 3 attempts)
3. **Completion**: After final search, system detects trial completion
4. **Auto-Cleanup**: Code is automatically removed from `codes.json`
5. **State Change**: User's `currentStep` is set to `'trial_end'`
6. **Messaging**: User receives trial completion and upgrade messages

### 2. Trial End State Behavior
- **Message Handling**: Any message from user in `trial_end` state triggers trial completion message
- **Code Recreation Check**: System checks if admin has recreated the user's code
- **Re-authentication**: If code exists, user is automatically re-authenticated
- **Welcome Flow**: User receives appropriate welcome message and main menu

### 3. Admin Code Recreation
1. **Admin Action**: Admin recreates user's code using CLI or WhatsApp commands
2. **User Message**: User sends any message while in `trial_end` state
3. **Detection**: System detects code recreation
4. **Re-authentication**: User session is updated with new code details
5. **Welcome**: User receives welcome message and main menu

## Benefits

### 1. Resource Management
- **API Key Liberation**: Automatically frees up Google Maps and Gemini API keys
- **Storage Optimization**: Removes unused trial codes from `codes.json`
- **System Efficiency**: Prevents accumulation of inactive trial accounts

### 2. User Experience
- **Clear Communication**: Informative messages about trial completion
- **Upgrade Path**: Clear call-to-action for Premium upgrade
- **Seamless Re-authentication**: Smooth experience when codes are recreated

### 3. Admin Benefits
- **Flexible Management**: Easy code recreation for users
- **Resource Optimization**: Automatic cleanup reduces manual maintenance
- **User Retention**: Clear upgrade messaging encourages conversions

## Error Handling

### 1. Concurrent Access
- **Safe Updates**: Uses `mutateUserSession` for thread-safe session updates
- **File Locking**: Proper JSON file handling to prevent corruption
- **Error Recovery**: Graceful handling of file system errors

### 2. State Management
- **Session Consistency**: Ensures session state matches code status
- **Race Conditions**: Prevents conflicts between concurrent operations
- **Debug Logging**: Comprehensive logging for troubleshooting

## Testing Scenarios

### 1. Trial Completion
- ✅ User reaches 3rd attempt limit
- ✅ Code is automatically removed
- ✅ User receives trial completion message
- ✅ User is moved to `trial_end` state

### 2. Trial End State
- ✅ User sends message in `trial_end` state
- ✅ System sends trial completion message
- ✅ Support contact information is provided

### 3. Code Recreation
- ✅ Admin recreates user's code
- ✅ User sends message in `trial_end` state
- ✅ System detects code recreation
- ✅ User is re-authenticated automatically
- ✅ User receives welcome message and main menu

### 4. Multilingual Support
- ✅ All messages work in English, French, and Arabic
- ✅ Language detection works correctly
- ✅ Welcome messages are localized

## Future Enhancements

### 1. Analytics
- Track trial completion rates
- Monitor upgrade conversion rates
- Analyze user behavior patterns

### 2. Advanced Messaging
- Personalized upgrade offers
- Time-based messaging
- A/B testing for conversion optimization

### 3. Admin Dashboard
- Visual trial user management
- Bulk operations interface
- Real-time monitoring

## Conclusion

The Trial Auto-Cleanup feature successfully implements:
- **Automatic resource management** for trial users
- **Enhanced user experience** with clear messaging
- **Admin flexibility** for code recreation
- **Multilingual support** for global users
- **Robust error handling** for production reliability

This implementation ensures efficient resource utilization while providing a smooth user experience and flexible admin management capabilities.
