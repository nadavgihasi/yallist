// A static server for the Expo web export: serves files from the folder given as the first
// argument on port 8180 (or PORT), falling back to index.html for the app's routes.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const PORT = Number(process.env.PORT ?? 8180);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(DIST, '.' + path);
  // Never serve anything outside the build folder.
  const inside = file === DIST || file.startsWith(DIST + sep);
  const body = inside ? await readFile(file).catch(() => undefined) : undefined;
  res.writeHead(200, { 'content-type': (body && types[extname(file)]) || 'text/html' });
  res.end(body ?? (await readFile(resolve(DIST, 'index.html'))));
}).listen(PORT);
