#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Set environment variables for Railway
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3000;

console.log('🚂 Starting WhatsApp Scraper on Railway...');
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔌 Port: ${process.env.PORT}`);

// Start the bot with PM2 if available, otherwise direct
const startBot = () => {
  // Check if PM2 is available
  const pm2Path = path.join(__dirname, 'node_modules', '.bin', 'pm2');
  
  if (fs.existsSync(pm2Path)) {
    console.log('📦 Using PM2 for process management...');
    const pm2 = spawn(pm2Path, ['start', 'ecosystem.config.js', '--env', 'production'], {
      stdio: 'inherit',
      shell: true
    });
    
    pm2.on('error', (err) => {
      console.error('❌ PM2 error:', err);
      startDirect();
    });
  } else {
    console.log('📦 PM2 not found, starting directly...');
    startDirect();
  }
};

const startDirect = () => {
  console.log('🚀 Starting bot directly...');
  const bot = spawn('node', ['bot.js'], {
    stdio: 'inherit',
    shell: true
  });
  
  bot.on('error', (err) => {
    console.error('❌ Bot error:', err);
    process.exit(1);
  });
  
  bot.on('exit', (code) => {
    console.log(`📱 Bot exited with code ${code}`);
    if (code !== 0) {
      console.log('🔄 Restarting in 5 seconds...');
      setTimeout(startDirect, 5000);
    }
  });
  
  // Handle Railway shutdown signals
  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    bot.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    bot.kill('SIGINT');
  });
};

// Start the bot
startBot();
