# User Creation System Update

## Overview

The admin user creation system has been completely redesigned to separate trial and paid user creation with different API key requirements.

## Changes Made

### 1. New Admin Commands

#### Trial User Creation
- **Command**: `node manage_codes.js add-trial <code> <google_key> <gemini_key>`
- **API Keys**: Only 1 Google Search key and 1 Gemini key required
- **User Type**: Trial (3 attempts max)
- **Access**: Limited trial access

#### Paid User Creation  
- **Command**: `node manage_codes.js add-paid <code> <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>`
- **API Keys**: 3 Google Search keys and 3 Gemini keys required
- **User Type**: Paid (30 days access)
- **Access**: Full paid access with API key rotation

#### Random Code Generation
- **Trial**: `node manage_codes.js generate-trial <google_key> <gemini_key>`
- **Paid**: `node manage_codes.js generate-paid <google_key_1> <google_key_2> <google_key_3> <gemini_key_1> <gemini_key_2> <gemini_key_3>`

### 2. Removed Features

- ❌ **Old `add` command** - No longer available
- ❌ **Old `generate` command** - No longer available  
- ❌ **`grantPaidStage` method** - Removed from admin-manager.js
- ❌ **Grant method** - Users are now created as trial or paid directly

### 3. Updated User Data Structure

#### Trial Users
```json
{
  "userCode": {
    "apiKeys": {
      "googleSearchKeys": ["single_key"],
      "geminiKeys": ["single_key"]
    },
    "stage": "free_trial",
    "trial": {
      "triesUsed": 0,
      "maxTries": 3
    },
    "paid": {
      "grantedAt": null,
      "expiresAt": null
    }
  }
}
```

#### Paid Users
```json
{
  "userCode": {
    "apiKeys": {
      "googleSearchKeys": ["key1", "key2", "key3"],
      "geminiKeys": ["key1", "key2", "key3"]
    },
    "stage": "paid",
    "trial": {
      "triesUsed": 0,
      "maxTries": 3
    },
    "paid": {
      "grantedAt": "2024-01-20T10:00:00Z",
      "expiresAt": "2024-02-19T10:00:00Z"
    }
  }
}
```

### 4. Updated Admin Manager

#### New Methods
- `addTrialUser(adminCode, userCode, apiKeys)` - Creates trial users
- `addPaidUser(adminCode, userCode, apiKeys)` - Creates paid users

#### Updated Methods
- `modifyUserApiKeys()` - Now validates keys based on user type
- `listUsers()` - Shows user type and key count
- `getUserDetails()` - Includes trial/paid status

### 5. Updated Scraper Validation

The `lib/startUnifiedScraper.js` now validates API keys based on user type:
- **Trial users**: Must have exactly 1 key for each service
- **Paid users**: Must have exactly 3 keys for each service

### 6. Updated Package.json Scripts

```json
{
  "admin:add-trial": "node manage_codes.js add-trial",
  "admin:add-paid": "node manage_codes.js add-paid", 
  "admin:generate-trial": "node manage_codes.js generate-trial",
  "admin:generate-paid": "node manage_codes.js generate-paid"
}
```

## Usage Examples

### Create Trial User
```bash
# Manual code
node manage_codes.js add-trial trial123 AIzaSy... AIzaSy...

# Random code
node manage_codes.js generate-trial AIzaSy... AIzaSy...
```

### Create Paid User
```bash
# Manual code
node manage_codes.js add-paid paid123 AIzaSy... AIzaSy... AIzaSy... AIzaSy... AIzaSy... AIzaSy...

# Random code  
node manage_codes.js generate-paid AIzaSy... AIzaSy... AIzaSy... AIzaSy... AIzaSy... AIzaSy...
```

### List Users
```bash
node manage_codes.js list
```

### Check User Info
```bash
node manage_codes.js info trial123
```

## Benefits

1. **Clear Separation**: Trial and paid users are created with different commands
2. **Appropriate API Requirements**: Trial users need fewer keys, paid users get full rotation
3. **Direct Creation**: No need for grant/upgrade process - users are created as intended type
4. **Better Validation**: System validates API keys based on user type
5. **Improved UX**: Clear commands and better error messages
6. **Cost Efficiency**: Trial users use fewer API keys, reducing costs
7. **🗑️ Auto-Cleanup**: Trial user codes are automatically removed when they consume all 3 attempts, freeing up API keys for reuse

## Migration Notes

- Existing users will continue to work with their current configuration
- New users should be created using the new commands
- The old `add` and `generate` commands are no longer available
- Admin scripts in package.json have been updated

## File Changes

### Modified Files
- `manage_codes.js` - Complete rewrite of user creation commands
- `lib/admin-manager.js` - Added new user creation methods, removed grant method
- `lib/startUnifiedScraper.js` - Updated API key validation logic
- `package.json` - Updated admin scripts

### New Features
- Trial user creation with 1 API key each
- Paid user creation with 3 API keys each  
- User type validation in scraper
- Enhanced user listing with type information
- Automatic paid user expiration (30 days)
- **🗑️ Auto-cleanup of trial users**: Codes are automatically removed when all 3 attempts are consumed

## 🗑️ Auto-Cleanup Feature

### Overview
Trial user codes are automatically removed when they consume all 3 attempts, freeing up API keys for reuse by other trial users.

### How It Works
1. **During Scraping**: When a trial user completes their 3rd scraping job, the system automatically:
   - Increments the `triesUsed` counter to 3
   - Detects that the limit has been reached
   - Removes the user code from `codes.json`
   - Notifies the user that their trial has ended

2. **Before Scraping**: If a trial user tries to start a new job after consuming all attempts:
   - System detects they've reached the limit
   - Removes the code immediately
   - Notifies the user and shows main menu

### User Experience
When a trial user completes all 3 attempts, they receive:
```
🎯 Trial Complete!

✅ You have used all 3 trial attempts.
🗑️ Your access code has been automatically removed to free up API keys.

💡 To continue using the service:
• Contact an admin for a new trial code
• Or upgrade to a paid account for unlimited access

📞 Contact support for assistance.
```

### Benefits
- **Resource Optimization**: API keys are freed up immediately
- **Cost Efficiency**: No wasted API keys on inactive trial users
- **Clean Database**: No accumulation of expired trial codes
- **User Clarity**: Clear notification about trial completion

This update provides a much cleaner and more intuitive admin experience while reducing API costs for trial users.
