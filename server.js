const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS Headers for all local responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-n8n-webhook-url');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Proxy endpoint: /api/chat
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetWebhook = req.headers['x-n8n-webhook-url'] || 
                             payload.webhookUrl || 
                             'https://desarrollo-n8n.hostlapaz.com/webhook/chatbot';

        console.log(`[PROXY] Forwarding chat message to: ${targetWebhook}`);

        const n8nRes = await fetch(targetWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: payload.message || '',
            sessionId: payload.sessionId || 'session_default',
            context: payload.context || {}
          })
        });

        const n8nData = await n8nRes.json().catch(() => ({ reply: 'Respuesta sin formato de n8n.' }));
        
        res.writeHead(n8nRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(n8nData));
      } catch (err) {
        console.error('[PROXY ERROR]:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Error al comunicarse con el Webhook de n8n',
          details: err.message 
        }));
      }
    });
    return;
  }

  // Health check / Ping endpoint: /api/health
  if (req.url === '/api/health' && req.method === 'GET') {
    const targetUrl = 'https://desarrollo-n8n.hostlapaz.com/healthz';
    const start = Date.now();
    fetch(targetUrl)
      .then(r => r.json())
      .then(data => {
        const latency = Date.now() - start;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'online',
          n8nStatus: data.status || 'ok',
          latencyMs: latency,
          targetHost: 'https://desarrollo-n8n.hostlapaz.com'
        }));
      })
      .catch(err => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'warning',
          n8nStatus: 'unreachable',
          error: err.message
        }));
      });
    return;
  }

  // Static file serving
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Servidor ChatBot Web corriendo en: http://localhost:${PORT}`);
  console.log(`🔗 Conectado a n8n VPS: https://desarrollo-n8n.hostlapaz.com`);
  console.log(`======================================================\n`);
});
