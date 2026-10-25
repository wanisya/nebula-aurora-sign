// Nebula Aurora Sign — server statis tanpa dependensi.
// Kamera browser hanya boleh diakses dari https:// atau http://localhost,
// jadi file di folder public/ disajikan lewat server lokal ini.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Port 0120 (= 120) supaya tidak bentrok dengan web karir di :3000.
const PORT = Number(process.env.PORT) || 120;
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.task': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': MIME['.json'] });
    res.end(JSON.stringify({ ok: true, app: 'nebula-aurora-sign' }));
    return;
  }

  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Tidak ditemukan');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Port ${PORT} sedang dipakai aplikasi lain. Coba: PORT=1200 npm start\n`);
  else if (err.code === 'EACCES') console.error(`\n  Tidak punya izin memakai port ${PORT}. Coba: PORT=1200 npm start\n`);
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  const shown = PORT === 120 ? '0120' : PORT;
  console.log(`\n  ✦ Nebula Aurora Sign by Wani Syafitri berjalan di  http://localhost:${shown}\n`);
});
