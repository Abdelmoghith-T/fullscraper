# 🔐 WhatsApp Bot Admin System

The WhatsApp Bot now includes a comprehensive admin system that allows administrators to manage users, other admins, and system settings directly from WhatsApp or via CLI commands.

## 🚀 Quick Start

### 1. Default Admin Access
- **Default Admin Code:** `admin123`
- **Role:** `super_admin` (full access)
- **Permissions:** All system permissions

### 2. Authenticate as Admin
Send this message to the WhatsApp bot:
```
ADMIN: admin123
```

## 📱 WhatsApp Admin Commands

### Authentication
```
ADMIN: <admin_code>
```
Authenticate with your admin code to gain access to admin commands.

### User Management
```
ADMIN USERS                    # List all users and their status
ADMIN ADD TRIAL <code> <google_key> <gemini_key>     # Add trial user (1 key each)
ADMIN ADD PAID <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>  # Add paid user (3 keys each)
ADMIN REMOVE USER <code>      # Remove user code
```

### Admin Management
```
ADMIN ADMINS                  # List all admin codes
ADMIN ADD ADMIN <code> <role> # Add new admin
ADMIN REMOVE ADMIN <code>     # Remove admin code
```

### System Control
```
ADMIN STATUS                  # View system status and statistics
ADMIN HELP                    # Show admin help and available commands
```

## 🛠️ CLI Admin Management

### Manage Admin Codes
```bash
# List all admin codes
npm run admin:list-admins

# Add new admin
npm run admin:add-admin <code> <role>

# Generate random admin code
npm run admin:generate-admin <role>

# Remove admin
npm run admin:remove-admin <code>

# Show admin info
npm run admin:manage info <code>

# Show available roles
npm run admin:roles
```

### Manage User Codes

**Trial Users (1 API key each):**
```bash
# Add trial user
npm run admin:add-trial <code> <google_key> <gemini_key>

# Generate random trial code
npm run admin:generate-trial <google_key> <gemini_key>
```

**Paid Users (3 API keys each):**
```bash
# Add paid user
npm run admin:add-paid <code> <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>

# Generate random paid code
npm run admin:generate-paid <google_key1> <google_key2> <google_key3> <gemini_key1> <gemini_key2> <gemini_key3>
```

**Management:**
```bash
# List all user codes
npm run admin:list

# Remove user
npm run admin:remove <code>
```

## 👑 Admin Roles & Permissions

### Super Admin
- **Role:** `super_admin`
- **Description:** Full system access
- **Permissions:**
  - `manage_users` - Add/remove user codes
  - `manage_admins` - Add/remove admin codes
  - `view_logs` - View security logs
  - `system_control` - View/modify system settings
  - `view_all_sessions` - Access all user sessions

### Admin
- **Role:** `admin`
- **Description:** Standard admin access
- **Permissions:**
  - `manage_users` - Add/remove user codes
  - `view_logs` - View security logs
  - `view_sessions` - View user sessions

### Moderator
- **Role:** `moderator`
- **Description:** Limited admin access
- **Permissions:**
  - `view_logs` - View security logs
  - `view_sessions` - View user sessions

## 📋 Usage Examples

### Adding a New User

**Trial User:**
```
ADMIN ADD TRIAL trial123 AIzaSyA... AIzaSyB...
```

**Paid User:**
```
ADMIN ADD PAID paid123 AIzaSyA... AIzaSyB... AIzaSyC... AIzaSyD... AIzaSyE... AIzaSyF...
```

### Adding a New Admin
```
ADMIN ADD ADMIN mod123 moderator
```

### Checking System Status
```
ADMIN STATUS
```

## 🔒 Security Features

### Admin Session Management
- Admin sessions are stored in memory during bot runtime
- Sessions include role, permissions, and authentication timestamp
- Automatic data refresh every 5 minutes

### Permission-Based Access Control
- Each admin command checks permissions before execution
- Admins can only perform actions allowed by their role
- Failed permission checks return clear error messages

### Audit Trail
- All admin actions are logged with timestamps
- Usage statistics tracked for each admin code
- Creation and modification history maintained

## ⚙️ System Settings

### Configurable Parameters
- `max_failed_auth_attempts`: Maximum failed authentication attempts (default: 5)
- `auto_unblock_hours`: Hours until auto-unblock (default: 24)
- `session_timeout_hours`: Session timeout in hours (default: 168)
- `max_users_per_admin`: Maximum users per admin (default: 100)

### File Locations
- **Admin Config:** `admin_config.json`
- **User Codes:** `codes.json`
- **User Sessions:** `sessions.json`

## 🚨 Troubleshooting

### Common Issues

#### Admin Authentication Fails
- Verify admin code exists in `admin_config.json`
- Check if admin code has correct permissions
- Ensure bot has read access to admin config file

#### Permission Denied Errors
- Verify admin role has required permissions
- Check admin role configuration in `admin_config.json`
- Use `ADMIN HELP` to see available commands for your role

#### User Management Fails
- Ensure admin has `manage_users` permission
- Verify user code doesn't already exist
- Check API key format and validity

### Debug Commands
```bash
# Check admin configuration
npm run admin:roles

# List all admins
npm run admin:list-admins

# Verify file permissions
ls -la admin_config.json codes.json sessions.json
```

## 🔄 Data Synchronization

### Real-time Updates
- Admin manager refreshes data every 5 minutes
- Changes made via CLI are reflected in WhatsApp bot
- Session data is automatically synchronized

### File Monitoring
- Admin manager monitors configuration files for changes
- Automatic reload when files are modified
- Error handling for corrupted configuration files

## 📚 Advanced Usage

### Custom Admin Roles
You can create custom admin roles by modifying `admin_config.json`:

```json
{
  "admin_roles": {
    "custom_role": {
      "description": "Custom role description",
      "permissions": ["view_logs", "view_sessions"]
    }
  }
}
```

### Bulk Operations
For bulk operations, use the CLI tools:

```bash
# Add multiple trial users from a file
while IFS=',' read -r code g1 gem1; do
  npm run admin:add-trial "$code" "$g1" "$gem1"
done < trial_users.csv

# Add multiple paid users from a file  
while IFS=',' read -r code g1 g2 g3 gem1 gem2 gem3; do
  npm run admin:add-paid "$code" "$g1" "$g2" "$g3" "$gem1" "$gem2" "$gem3"
done < paid_users.csv

# Generate multiple admin codes
for role in admin moderator; do
  npm run admin:generate-admin "$role"
done
```

## 🆘 Support

### Getting Help
- Use `ADMIN HELP` in WhatsApp for command help
- Run `npm run admin:manage help` for CLI help
- Check logs for detailed error information

### Emergency Access
If you lose admin access:
1. Stop the bot
2. Edit `admin_config.json` directly
3. Add a new super_admin code
4. Restart the bot
5. Authenticate with the new code

### Backup Recommendations
- Regularly backup `admin_config.json`
- Keep copies of user codes in secure location
- Document admin role assignments
- Test admin access after configuration changes

---

**⚠️ Security Note:** Change the default admin code (`admin123`) in production environments and use strong, unique codes for each admin.
