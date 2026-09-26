import { createReadStream, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import contactHandler from './api/contact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || '0.0.0.0';

// The one host search engines should index. Requests arriving on any other
// hostname (notably www.) get a 301 here so Google never has to guess which
// duplicate is canonical.
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'threepointolabs.com';

/** Retired URLs that once ranked, kept as 301s so their link equity survives. */
const REDIRECTS = new Map([['/portfolio/revision-prep', '/portfolio']]);

/**
 * Paths the SPA actually renders, read out of the generated sitemap so there's
 * no second route list to keep in sync — scripts/generate-sitemap.js derives it
 * from App.jsx at build time. Anything outside this set is a real 404.
 */
const knownRoutes = readKnownRoutes();

function readKnownRoutes() {
  try {
    const xml = readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8');
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname);
    if (paths.length === 0) throw new Error('sitemap contained no <loc> entries');
    return new Set(paths);
  } catch (err) {
    // Without the sitemap we can't tell a real route from a typo, so fall back
    // to the old behaviour: every unmatched path renders the app with a 200.
    console.warn(`[server] no route manifest (${err.message}); serving SPA fallback for all paths`);
    return null;
  }
}

/** True when `pathname` is a route the client router will render. */
function isKnownRoute(pathname) {
  if (knownRoutes === null) return true;
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  return knownRoutes.has(normalized) || knownRoutes.has(`${normalized}/`);
}

/**
 * The SPA shell, read once. Its fallback canonical and og:url point at the
 * homepage, and Google reads the canonical from the raw HTML before any JS
 * runs — serve that unchanged on /services and Google files the page as a
 * duplicate of /. So each known route gets the shell with those two URLs
 * rewritten to its own (same trailing-slash-free form as canonicalFor in
 * src/components/Seo.jsx).
 */
const shellHtml = readShell();

function readShell() {
  try {
    return readFileSync(path.join(distDir, 'index.html'), 'utf8');
  } catch {
    return null;
  }
}

function shellFor(pathname) {
  const clean = pathname.replace(/\/+$/, '');
  const canonical = clean ? `https://${CANONICAL_HOST}${clean}` : `https://${CANONICAL_HOST}/`;
  return shellHtml
    .replace(/(rel="canonical"\s+href=")[^"]*"/, `$1${canonical}"`)
    .replace(/(property="og:url"\s+content=")[^"]*"/, `$1${canonical}"`);
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

/**
 * Where a request should be 301'd, or null if it's already canonical.
 *
 * Host redirects only fire for subdomains of the canonical host, so health
 * checks and container-IP requests (localhost, 10.x, the Coolify internal
 * name) are left alone.
 */
function redirectFor(req, url) {
  const target = REDIRECTS.get(url.pathname.replace(/\/+$/, '') || '/');
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const wrongHost = host.endsWith(`.${CANONICAL_HOST}`);

  if (!target && !wrongHost) return null;

  const pathname = target || url.pathname;
  return wrongHost
    ? `https://${CANONICAL_HOST}${pathname}${url.search}`
    : `${pathname}${url.search}`;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function withVercelResponseHelpers(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

async function serveFile(res, requestedPath) {
  const pathname = decodeURIComponent(requestedPath);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(distDir, relativePath);

  if (!filePath.startsWith(distDir + path.sep)) {
    sendJson(res, 403, { ok: false, error: 'Forbidden' });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
    };

    if (pathname.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  } catch {
    // No file at that path — hand over to the client router. A path it doesn't
    // route gets the same shell with a 404 status, so crawlers drop it instead
    // of indexing it as a near-duplicate of the pages it can reach.
    const known = isKnownRoute(pathname);
    res.writeHead(known ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    if (shellHtml === null) {
      createReadStream(path.join(distDir, 'index.html')).pipe(res);
      return;
    }
    // Only rewrite for real routes: the path is then one we generated, never
    // arbitrary request input echoed into the page.
    res.end(known && knownRoutes !== null ? shellFor(pathname) : shellHtml);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  try {
    // Canonicalisation runs first, but never on /api/ — a 301 would turn the
    // contact form's POST into a GET.
    if (!url.pathname.startsWith('/api/')) {
      const location = redirectFor(req, url);
      if (location) {
        res.writeHead(301, { Location: location });
        res.end();
        return;
      }
    }

    if (url.pathname === '/api/contact') {
      await contactHandler(req, withVercelResponseHelpers(res));
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return;
    }

    await serveFile(res, url.pathname);
  } catch (err) {
    console.error('[server] request failed', err);
    if (!res.headersSent) {
      sendJson(res, 500, { ok: false, error: 'Internal server error' });
    } else {
      res.end();
    }
  }
});

server.listen(port, hostname, () => {
  console.log(`3.0 Labs server listening on http://${hostname}:${port}`);
});
