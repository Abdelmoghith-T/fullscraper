const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Simple health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Check if bot is running by looking for session files
    const sessionPath = path.join(__dirname, 'sessions.json');
    const codesPath = path.join(__dirname, 'codes.json');
    
    try {
      const hasSessions = fs.existsSync(sessionPath);
      const hasCodes = fs.existsSync(codesPath);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'WhatsApp Scraper Bot',
        sessions: hasSessions,
        codes: hasCodes,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp Scraper Bot</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            .status { padding: 15px; border-radius: 5px; margin: 20px 0; }
            .healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
            .endpoint { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚂 WhatsApp Scraper Bot</h1>
            <div class="status healthy">
              <strong>✅ Service Status:</strong> Running on Railway
            </div>
            <div class="status info">
              <strong>📱 Bot Status:</strong> Active and monitoring WhatsApp
            </div>
            <h3>🔗 Available Endpoints:</h3>
            <div class="endpoint">GET /health - Health check endpoint</div>
            <div class="endpoint">GET / - This status page</div>
            <h3>📊 Service Information:</h3>
            <p><strong>Platform:</strong> Railway</p>
            <p><strong>Environment:</strong> Production</p>
            <p><strong>Port:</strong> ${PORT}</p>
            <p><strong>Uptime:</strong> <span id="uptime">Loading...</span></p>
            <p><strong>Memory Usage:</strong> <span id="memory">Loading...</span></p>
          </div>
          <script>
            // Update uptime and memory info
            setInterval(() => {
              fetch('/health')
                .then(response => response.json())
                .then(data => {
                  document.getElementById('uptime').textContent = Math.floor(data.uptime / 60) + ' minutes';
                  document.getElementById('memory').textContent = Math.round(data.memory.heapUsed / 1024 / 1024) + ' MB';
                })
                .catch(error => {
                  console.error('Error fetching health data:', error);
                });
            }, 5000);
          </script>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
  console.log(`🔗 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`📱 Status page: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Health server shutting down...');
  server.close(() => {
    console.log('✅ Health server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Health server shutting down...');
  server.close(() => {
    console.log('✅ Health server closed');
    process.exit(0);
  });
});
