#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_CONFIG_FILE = path.join(__dirname, 'admin_config.json');

/**
 * Admin Management CLI for WhatsApp scraper
 * Usage:
 *   node manage_admins.js add <code> <role>
 *   node manage_admins.js list
 *   node manage_admins.js remove <code>
 *   node manage_admins.js info <code>
 *   node manage_admins.js generate <role>
 */

// Helper functions
function loadAdminConfig() {
  if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
    return createDefaultAdminConfig();
  }
  try {
    return JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Error reading admin config:', error.message);
    return createDefaultAdminConfig();
  }
}

function createDefaultAdminConfig() {
  const defaultConfig = {
    admin_codes: {
      "admin123": {
        role: "super_admin",
        permissions: ["manage_users", "manage_admins", "view_logs", "system_control"],
        createdAt: new Date().toISOString(),
        createdBy: "system",
        lastUsed: null,
        useCount: 0
      }
    },
    admin_roles: {
      "super_admin": {
        description: "Full system access",
        permissions: ["manage_users", "manage_admins", "view_logs", "system_control", "view_all_sessions"]
      },
      "admin": {
        description: "Standard admin access",
        permissions: ["manage_users", "view_logs", "view_sessions"]
      },
      "moderator": {
        description: "Limited admin access",
        permissions: ["view_logs", "view_sessions"]
      }
    },
    system_settings: {
      max_failed_auth_attempts: 5,
      auto_unblock_hours: 24,
      session_timeout_hours: 168,
      max_users_per_admin: 100
    }
  };

  saveAdminConfig(defaultConfig);
  return defaultConfig;
}

function saveAdminConfig(config) {
  try {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving admin config:', error.message);
    return false;
  }
}

function generateRandomCode() {
  return crypto.randomBytes(4).toString('hex');
}

// Command handlers
function addAdmin(args) {
  const [code, role] = args;
  
  if (!code || !role) {
    console.error('❌ Code and role are required');
    console.log('Usage: node manage_admins.js add <code> <role>');
    console.log('Available roles: super_admin, admin, moderator');
    process.exit(1);
  }

  const adminConfig = loadAdminConfig();
  
  if (adminConfig.admin_codes[code]) {
    console.log(`⚠️  Admin code '${code}' already exists. Overwriting...`);
  }

  if (!adminConfig.admin_roles[role]) {
    console.error(`❌ Invalid role: ${role}`);
    console.log('Available roles:', Object.keys(adminConfig.admin_roles).join(', '));
    process.exit(1);
  }

  adminConfig.admin_codes[code] = {
    role,
    permissions: adminConfig.admin_roles[role].permissions,
    createdAt: new Date().toISOString(),
    createdBy: 'cli',
    lastUsed: null,
    useCount: 0
  };

  if (saveAdminConfig(adminConfig)) {
    console.log('✅ Admin added successfully!');
    console.log(`📋 Code: ${code}`);
    console.log(`👑 Role: ${role}`);
    console.log(`🔑 Permissions: ${adminConfig.admin_roles[role].permissions.join(', ')}`);
    console.log(`📅 Created: ${new Date().toLocaleString()}`);
  }
}

function listAdmins() {
  const adminConfig = loadAdminConfig();
  const adminList = Object.keys(adminConfig.admin_codes);
  
  if (adminList.length === 0) {
    console.log('📋 No admin codes found.');
    return;
  }

  console.log(`📋 Total Admins: ${adminList.length}\n`);
  
  adminList.forEach((code, index) => {
    const adminData = adminConfig.admin_codes[code];
    const roleData = adminConfig.admin_roles[adminData.role];
    
    console.log(`${index + 1}. Code: ${code}`);
    console.log(`   👑 Role: ${adminData.role}`);
    console.log(`   📝 Description: ${roleData.description}`);
    console.log(`   🔑 Permissions: ${roleData.permissions.join(', ')}`);
    console.log(`   📅 Created: ${new Date(adminData.createdAt).toLocaleString()}`);
    console.log(`   📊 Usage: ${adminData.useCount} times`);
    if (adminData.lastUsed) {
      console.log(`   ⏰ Last Used: ${new Date(adminData.lastUsed).toLocaleString()}`);
    }
    console.log('');
  });
}

function removeAdmin(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Admin code is required');
    console.log('Usage: node manage_admins.js remove <code>');
    process.exit(1);
  }

  const adminConfig = loadAdminConfig();
  
  if (!adminConfig.admin_codes[code]) {
    console.error(`❌ Admin code '${code}' not found`);
    process.exit(1);
  }

  delete adminConfig.admin_codes[code];
  
  if (saveAdminConfig(adminConfig)) {
    console.log(`✅ Admin '${code}' removed successfully!`);
  }
}

function showAdminInfo(args) {
  const [code] = args;
  
  if (!code) {
    console.error('❌ Admin code is required');
    console.log('Usage: node manage_admins.js info <code>');
    process.exit(1);
  }

  const adminConfig = loadAdminConfig();
  
  if (!adminConfig.admin_codes[code]) {
    console.error(`❌ Admin code '${code}' not found`);
    process.exit(1);
  }

  const adminData = adminConfig.admin_codes[code];
  const roleData = adminConfig.admin_roles[adminData.role];

  console.log(`📋 Admin Information: ${code}`);
  console.log('─'.repeat(50));
  console.log(`👑 Role: ${adminData.role}`);
  console.log(`📝 Description: ${roleData.description}`);
  console.log(`🔑 Permissions: ${roleData.permissions.join(', ')}`);
  console.log(`📅 Created: ${new Date(adminData.createdAt).toLocaleString()}`);
  console.log(`👤 Created By: ${adminData.createdBy}`);
  console.log(`📊 Usage Count: ${adminData.useCount}`);
  
  if (adminData.lastUsed) {
    console.log(`⏰ Last Used: ${new Date(adminData.lastUsed).toLocaleString()}`);
  } else {
    console.log(`⏰ Last Used: Never`);
  }
}

function generateAdmin(args) {
  const [role] = args;
  
  if (!role) {
    console.error('❌ Role is required');
    console.log('Usage: node manage_admins.js generate <role>');
    console.log('Available roles: super_admin, admin, moderator');
    process.exit(1);
  }

  const adminConfig = loadAdminConfig();
  
  if (!adminConfig.admin_roles[role]) {
    console.error(`❌ Invalid role: ${role}`);
    console.log('Available roles:', Object.keys(adminConfig.admin_roles).join(', '));
    process.exit(1);
  }

  const randomCode = generateRandomCode();
  console.log(`🎲 Generated random admin code: ${randomCode}`);
  console.log('Adding with generated code...\n');
  
  addAdmin([randomCode, role]);
}

function showRoles() {
  const adminConfig = loadAdminConfig();
  const roles = Object.keys(adminConfig.admin_roles);
  
  console.log(`👑 Available Admin Roles: ${roles.length}\n`);
  
  roles.forEach((role, index) => {
    const roleData = adminConfig.admin_roles[role];
    console.log(`${index + 1}. **${role}**`);
    console.log(`   📝 Description: ${roleData.description}`);
    console.log(`   🔑 Permissions: ${roleData.permissions.join(', ')}`);
    console.log('');
  });
}

function showHelp() {
  console.log('🛠️  WhatsApp Scraper - Admin Management');
  console.log('═'.repeat(50));
  console.log('');
  console.log('📋 Available Commands:');
  console.log('');
  console.log('  add <code> <role>');
  console.log('    Add a new admin with specified code and role');
  console.log('');
  console.log('  generate <role>');
  console.log('    Generate a random code and add admin with specified role');
  console.log('');
  console.log('  list');
  console.log('    List all existing admin codes');
  console.log('');
  console.log('  info <code>');
  console.log('    Show detailed information about a specific admin');
  console.log('');
  console.log('  remove <code>');
  console.log('    Remove an existing admin');
  console.log('');
  console.log('  roles');
  console.log('    Show available admin roles and permissions');
  console.log('');
  console.log('  help');
  console.log('    Show this help message');
  console.log('');
  console.log('📝 Examples:');
  console.log('  node manage_admins.js add mod123 moderator');
  console.log('  node manage_admins.js generate admin');
  console.log('  node manage_admins.js list');
  console.log('  node manage_admins.js info admin123');
  console.log('  node manage_admins.js remove mod123');
  console.log('  node manage_admins.js roles');
}

// Main CLI handler
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command) {
    showHelp();
    return;
  }

  switch (command.toLowerCase()) {
    case 'add':
      addAdmin(commandArgs);
      break;
    case 'generate':
      generateAdmin(commandArgs);
      break;
    case 'list':
      listAdmins();
      break;
    case 'remove':
    case 'delete':
      removeAdmin(commandArgs);
      break;
    case 'info':
    case 'show':
      showAdminInfo(commandArgs);
      break;
    case 'roles':
      showRoles();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "node manage_admins.js help" for available commands');
      process.exit(1);
  }
}

// Run if called directly
main();

export {
  loadAdminConfig,
  saveAdminConfig,
  generateRandomCode
};
