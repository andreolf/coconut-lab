// Minimal static server used by the tests. Serves `dir` under `prefix` (e.g. "/coconut-lab")
// to mimic GitHub Pages project sites; anything outside the prefix is a 404.
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join, normalize } from 'node:path';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.json': 'application/json' };
export function serve(dir = 'dist', prefix = '') {
  prefix = prefix.replace(/\/$/, '');
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (prefix) { if (p === prefix) { res.writeHead(301, { location: prefix + '/' }); return res.end(); } if (!p.startsWith(prefix + '/')) { res.writeHead(404); return res.end('not found'); } p = p.slice(prefix.length); }
    p = normalize(p).replace(/^(\.\.[/\\])+/, ''); if (p.endsWith('/')) p += 'index.html';
    try { const b = await readFile(join(dir, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}${prefix}`, close: () => srv.close() })));
}
