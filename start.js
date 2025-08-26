#!/usr/bin/env node

console.log('🚂 Starting WhatsApp Scraper on Railway...');
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`🔌 Port: ${process.env.PORT || 3000}`);

// Start the bot
require('./bot.js');
