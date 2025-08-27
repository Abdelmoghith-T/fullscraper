#!/usr/bin/env node

console.log('Starting WhatsApp Scraper on Railway...');
console.log('Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', process.env.PORT || 3000);

// Start the bot using ES module import
import('./bot.js').catch(err => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

