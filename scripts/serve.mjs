#!/usr/bin/env node
// Zero-dependency static server for local use and Shadw/DevHub (listens on PORT).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const HIDDEN = /(^|[\\/])(\.git|node_modules|scripts|tests|old)([\\/]|$)/;

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let rel = normalize(path === '/' ? 'index.html' : path.slice(1));
    if (rel.startsWith('..') || rel.includes('..' + sep) || HIDDEN.test(rel)) { res.writeHead(404).end('not found'); return; }
    let file = join(ROOT, rel);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff',
      'cache-control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(Number(process.env.PORT ?? 8000), '0.0.0.0', () => console.log(`PGMI Atlas Terrain on :${process.env.PORT ?? 8000}`));
