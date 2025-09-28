# API Pool Management System

## Overview

The API Pool Management System simplifies user creation by automatically managing API key assignment. Instead of manually providing API keys when creating users, admins can now manage a pool of API keys separately and have them automatically assigned to users.

## Key Features

- **Centralized API Key Management**: All Google Search and Gemini API keys are stored in `api_pool.json`
- **Automatic Assignment**: API keys are automatically assigned to users based on their type (trial/paid)
- **Key Reuse**: When users are removed, their API keys are returned to the available pool
- **Simplified Commands**: Admin commands no longer require manual API key input

## File Structure

```
api_pool.json          # API key storage
lib/api-pool-manager.js # API pool management logic
manage_codes.js         # Updated admin CLI
```

## API Pool Commands

### Adding API Keys
```bash
# Add Google Search API key
node manage_codes.js add-google-key <key>

# Add Gemini API key  
node manage_codes.js add-gemini-key <key>
```

### Removing API Keys
```bash
# Remove Google Search API key (only if not assigned)
node manage_codes.js remove-google-key <key>

# Remove Gemini API key (only if not assigned)
node manage_codes.js remove-gemini-key <key>
```

### Viewing Pool Status
```bash
# List all API keys with their status
node manage_codes.js list-keys
```

## Simplified User Creation

### Before (Old System)
```bash
# Trial user - required manual API key input
node manage_codes.js add-trial abc123 YOUR_GOOGLE_KEY YOUR_GEMINI_KEY

# Paid user - required 6 API keys
node manage_codes.js add-paid xyz789 GOOGLE_KEY_1 GOOGLE_KEY_2 GOOGLE_KEY_3 GEMINI_KEY_1 GEMINI_KEY_2 GEMINI_KEY_3
```

### After (New System)
```bash
# Trial user - API keys assigned automatically
node manage_codes.js add-trial abc123

# Paid user - API keys assigned automatically
node manage_codes.js add-paid xyz789

# Generate random codes
node manage_codes.js generate-trial
node manage_codes.js generate-paid
```

## API Key Requirements

### Trial Users
- **1 Google Search API key**
- **1 Gemini API key**
- **3 attempts maximum**

### Paid Users  
- **3 Google Search API keys**
- **3 Gemini API keys**
- **30 days access**

## Pool Statistics

The system tracks:
- Total API keys in pool
- Available keys (not assigned)
- Used keys (assigned to users)
- Maximum users that can be created

## Error Handling

- **Insufficient Keys**: Clear error messages when not enough API keys are available
- **Key Validation**: API keys are validated before being added to the pool
- **Assignment Protection**: Cannot remove keys that are currently assigned to users
- **Duplicate Prevention**: Cannot add duplicate API keys to the pool

## Migration

The system automatically migrated existing users from `codes.json` to the new API pool system. All existing API keys are properly tracked and marked as "used" in the pool.

## Benefits

1. **Simplified Admin Workflow**: No need to manually provide API keys
2. **Better Resource Management**: Centralized view of all API keys
3. **Automatic Key Reuse**: Keys are returned to pool when users are removed
4. **Error Prevention**: Built-in validation and duplicate checking
5. **Scalability**: Easy to add more API keys as needed

## Example Workflow

```bash
# 1. Add API keys to pool
node manage_codes.js add-google-key AIzaSyYourGoogleKey123
node manage_codes.js add-gemini-key AIzaSyYourGeminiKey456

# 2. Check pool status
node manage_codes.js list-keys

# 3. Create users (API keys assigned automatically)
node manage_codes.js add-trial user123
node manage_codes.js add-paid premium456

# 4. Remove user (API keys returned to pool)
node manage_codes.js remove user123
```

This system makes user management much more efficient and reduces the chance of errors when creating users.
