# ADMIN SHOW API DATA Command

## Overview

A new admin command `ADMIN SHOW API DATA` has been added to provide detailed information about all APIs in the API pool, including metadata like who added them, when they were added, and assignment details.

## Command Details

### **WhatsApp Bot Command**
```bash
ADMIN SHOW API DATA
```

### **CLI Command**
```bash
node manage_codes.js show-api-data
```

## What It Shows

### **For Each API Key:**

#### **Basic Information**
- **Key**: Masked API key (e.g., `AIza***2YSs`)
- **Status**: `available` or `used`
- **Added by**: Admin code who added the key
- **Added at**: Timestamp when the key was added

#### **Assignment Information** (if status is `used`)
- **Assigned to**: User code the key is assigned to
- **Assigned at**: Timestamp when the key was assigned

### **Summary Statistics**
- Google Keys: X available, Y used
- Gemini Keys: X available, Y used
- Can create trial users: X
- Can create paid users: Y

## Example Output

```
📊 **Detailed API Pool Data**

🔍 **Google Search Keys (2 total):**

   **1. Key:** AIza***2YSs
   **Status:** available
   **Added by:** admin123
   **Added at:** 9/27/2025, 10:50:39 PM

   **2. Key:** AIza***OlMQ
   **Status:** used
   **Added by:** admin123
   **Added at:** 9/27/2025, 10:51:15 PM
   **Assigned to:** user123
   **Assigned at:** 9/27/2025, 10:52:30 PM

🤖 **Gemini Keys (1 total):**

   **1. Key:** AIza***mrO8
   **Status:** available
   **Added by:** admin456
   **Added at:** 9/27/2025, 10:53:00 PM

📈 **Summary:**
   Google Keys: 1 available, 1 used
   Gemini Keys: 1 available, 0 used
   Can create trial users: 1
   Can create paid users: 0
```

## Permissions Required

- **WhatsApp Bot**: Requires `manage_users` or `view_logs` permission
- **CLI Tool**: No additional permissions required (admin-only tool)

## Comparison with ADMIN LIST KEYS

| Feature | ADMIN LIST KEYS | ADMIN SHOW API DATA |
|---------|----------------|-------------------|
| **Purpose** | Quick overview | Detailed analysis |
| **Key Info** | Masked key + status | Full metadata |
| **Assignment** | Basic (user only) | Detailed (user + timestamp) |
| **History** | No | Yes (who added, when) |
| **Use Case** | Daily monitoring | Audit trail, troubleshooting |

## Use Cases

### **1. Audit Trail**
- Track who added API keys and when
- Monitor key assignment history
- Identify unused or problematic keys

### **2. Troubleshooting**
- Find keys assigned to specific users
- Check key assignment timestamps
- Identify keys that haven't been used

### **3. Resource Management**
- Monitor key usage patterns
- Plan for key rotation
- Track admin activity

### **4. Security Analysis**
- Review key assignment patterns
- Identify unusual activity
- Audit admin actions

## Integration

### **WhatsApp Bot**
- Added to valid commands list
- Included in help messages
- Permission-based access control

### **CLI Tool**
- Added to command handler
- Included in help documentation
- Available for system administrators

### **Admin Manager**
- New method: `showDetailedApiData()`
- Integrates with API Pool Manager
- Returns structured data with metadata

## Benefits

1. **Complete Transparency**: See all API key metadata
2. **Audit Trail**: Track who did what and when
3. **Troubleshooting**: Identify assignment issues quickly
4. **Security**: Monitor key usage and admin activity
5. **Planning**: Make informed decisions about key management

## Technical Implementation

### **Files Modified**
- `bot.js`: Added command handler and help messages
- `lib/admin-manager.js`: Added `showDetailedApiData()` method
- `manage_codes.js`: Added CLI command and help documentation

### **Data Source**
- Reads directly from `api_pool.json`
- Accesses raw API pool data via `ApiPoolManager`
- Formats and masks sensitive information

### **Security**
- API keys are masked for display
- Requires appropriate admin permissions
- No sensitive data exposure

## Status

✅ **Complete**: The `ADMIN SHOW API DATA` command is fully implemented and functional in both WhatsApp bot and CLI interfaces.
