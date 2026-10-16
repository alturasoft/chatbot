const http = require('http');

const REMOTE_OPENWA = 'http://129.121.63.105:2785';
const LOCAL_PORT = 2785;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
]);

const server = http.createServer(async (req, res) => {
  try {
    const targetUrl = `${REMOTE_OPENWA}${req.url}`;

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      headers[k] = v;
    }

    let body = undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      body = await new Promise(resolve => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual'
    });

    for (const [key, val] of proxyRes.headers.entries()) {
      const lower = key.toLowerCase();
      // Drop HSTS and upgrade-insecure-requests so Chrome won't fail with ERR_SSL_PROTOCOL_ERROR
      if (lower === 'strict-transport-security') continue;
      if (lower === 'content-security-policy') {
        const cleaned = val.replace(/upgrade-insecure-requests;?/gi, '');
        res.setHeader(key, cleaned);
        continue;
      }
      res.setHeader(key, val);
    }

    res.writeHead(proxyRes.status);
    const buf = await proxyRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error(`[Tunnel Error on ${req.method} ${req.url}]:`, err.message, err.cause || '');
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OpenWA Tunnel Error: ' + err.message + ' (' + (err.cause?.message || err.cause?.code || '') + ')');
  }
});

server.listen(LOCAL_PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 OpenWA Tunnel Activo en: http://localhost:${LOCAL_PORT}`);
  console.log(`🔗 Redirigiendo a VPS: ${REMOTE_OPENWA}`);
  console.log(`🛡️ Cabeceras limpias y listas`);
  console.log(`====================================================`);
});
