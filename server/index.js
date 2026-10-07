// HTTP-Server: Express + Static + WebSocket-Upgrade auf einem Port
const path = require('path');
const http = require('http');
const express = require('express');
const { router } = require('./api');
const ws = require('./ws');
const { UPLOADS_DIR } = require('./db');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '8mb' }));

app.use('/api', router);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Client-Build ausliefern (im Dev-Modus läuft Vite separat auf :5173)
const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api|uploads|ws).*/, (req, res) => {
  res.sendFile(path.join(dist, 'index.html'), e => { if (e) res.status(404).json({ error: 'Client nicht gebaut — npm run build' }); });
});

const server = http.createServer(app);
ws.attach(server);

server.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  }
  console.log('┌──────────────────────────────────────────────┐');
  console.log('│  BlurChat läuft! 🎉                          │');
  console.log(`│  Lokal:      http://localhost:${PORT}            `);
  ips.forEach(ip => console.log(`│  Im Netzwerk: http://${ip}:${PORT}`.padEnd(46) + '│'));
  console.log('└──────────────────────────────────────────────┘');
});
