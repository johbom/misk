#!/usr/bin/env node
// OSC-brygga för Hover Pads: tar emot OSC-paket från appen över WebSocket och skickar dem vidare
// som vanlig OSC över UDP (till t.ex. Max, Pure Data, TouchDesigner, QLab, Ableton via Max for Live).
// Webbläsare får inte skicka UDP själva, därför behövs bryggan. Inga beroenden – bara Node 18+.
//
// Bryggan serverar också själva appen på http://localhost:8765 – öppna den där i Safari, som inte
// tillåter ws:// från den publicerade https-sidan. (Chrome, Edge och Firefox går bra från båda.)
//
// Kör:   node tools/osc-bridge.mjs
// Val:   --ws 8765            WebSocket-port som appen ansluter till (ws://localhost:8765)
//        --host 127.0.0.1     dit OSC skickas
//        --port 9000          UDP-port dit OSC skickas
//        --verbose            skriv ut varje meddelande
//        --lan                ta emot även från andra enheter i nätverket (t.ex. en iPad);
//                             annars bara från den här datorn
//
// Exempel: node tools/osc-bridge.mjs --port 7000 --host 192.168.1.20

import http from 'node:http';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const WS_PORT = Number(arg('ws', 8765));
const OSC_HOST = arg('host', '127.0.0.1');
const OSC_PORT = Number(arg('port', 9000));
const VERBOSE = process.argv.includes('--verbose');
const LAN = process.argv.includes('--lan');

const udp = dgram.createSocket(OSC_HOST.includes(':') ? 'udp6' : 'udp4');

// Läser adress och argument ur ett OSC-paket (bara för --verbose)
function describe(buf) {
  const str = (o) => { const end = buf.indexOf(0, o); return [buf.toString('utf8', o, end), Math.ceil((end + 1) / 4) * 4]; };
  try {
    let [addr, o] = str(0);
    let types;
    [types, o] = str(o);
    const args = [];
    for (const t of types.slice(1)) {
      if (t === 'i') { args.push(buf.readInt32BE(o)); o += 4; }
      else if (t === 'f') { args.push(+buf.readFloatBE(o).toFixed(2)); o += 4; }
      else if (t === 's') { let s; [s, o] = str(o); args.push(JSON.stringify(s)); }
    }
    return `${addr} ${args.join(' ')}`;
  } catch { return `(${buf.length} byte)`; }
}

// Minimal WebSocket-server (RFC 6455): handskakning, maskerade ramar från webbläsaren, ping/stäng
// Vanliga sidförfrågningar: servera appen (bara filer inne i appens mapp)
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(APP_DIR, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
  // Aldrig utanför appens mapp, och aldrig dolda filer/mappar (.git m.m.)
  const hidden = path.relative(APP_DIR, file).split(path.sep).some((seg) => seg.startsWith('.'));
  if (!file.startsWith(APP_DIR + path.sep) || hidden) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Finns inte\n'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const from = req.headers.origin || req.socket.remoteAddress;
  console.log(`Ansluten: ${from}`);

  let pending = Buffer.alloc(0);
  let parts = []; // fragmenterade meddelanden
  const frame = (opcode, payload = Buffer.alloc(0)) => {
    const head = payload.length < 126 ? Buffer.from([0x80 | opcode, payload.length])
      : Buffer.from([0x80 | opcode, 126, payload.length >> 8, payload.length & 255]);
    socket.write(Buffer.concat([head, payload]));
  };

  socket.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      if (pending.length < 2) return;
      const fin = pending[0] & 0x80;
      const opcode = pending[0] & 0x0f;
      const masked = pending[1] & 0x80;
      let len = pending[1] & 0x7f;
      let o = 2;
      if (len === 126) { if (pending.length < 4) return; len = pending.readUInt16BE(2); o = 4; }
      else if (len === 127) { if (pending.length < 10) return; len = Number(pending.readBigUInt64BE(2)); o = 10; }
      const maskLen = masked ? 4 : 0;
      if (pending.length < o + maskLen + len) return;
      const mask = masked ? pending.subarray(o, o + 4) : null;
      const payload = Buffer.from(pending.subarray(o + maskLen, o + maskLen + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      pending = pending.subarray(o + maskLen + len);

      if (opcode === 0x8) { frame(0x8); socket.end(); return; } // stäng
      if (opcode === 0x9) { frame(0xA, payload); continue; } // ping -> pong
      if (opcode === 0xA) continue;
      parts.push(payload);
      if (!fin) continue;
      const msg = Buffer.concat(parts);
      parts = [];
      if (opcode === 0x1 && msg.toString() === 'ping') continue; // textmeddelanden ignoreras
      udp.send(msg, OSC_PORT, OSC_HOST);
      if (VERBOSE) console.log(describe(msg));
    }
  });
  socket.on('close', () => console.log(`Frånkopplad: ${from}`));
  socket.on('error', () => {});
});

server.listen(WS_PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Hover Pads OSC-brygga\n  appen ansluter till  ws://localhost:${WS_PORT}\n  OSC skickas till     udp ${OSC_HOST}:${OSC_PORT}`
    + `\n  appen finns även på  http://localhost:${WS_PORT}  (använd den i Safari)`
    + `\n  ${LAN ? 'tar emot från hela nätverket (--lan)' : 'tar bara emot från den här datorn (--lan för andra enheter)'}`
    + `${VERBOSE ? '' : '\n  (lägg till --verbose för att se varje meddelande)'}\nAvsluta med Ctrl+C.`);
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${WS_PORT} används redan – välj en annan med --ws` : e.message);
  process.exit(1);
});
