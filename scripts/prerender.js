/**
 * Prerenders every route in src/App.jsx to static HTML after `vite build`.
 *
 * Without this, every URL served the same empty <div id="root"></div> shell:
 * no body text, no <a href> links and the homepage's title, so Google had
 * nothing to index on first crawl and no links to discover the inner pages
 * from. Each route now ships its full markup plus its own <title>, description,
 * canonical and og tags. The client hydrates that markup in place (main.jsx).
 *
 * Output: dist/index.html for "/", dist/<route>/index.html for the rest, and
 * dist/404.html, which server.js serves for paths it doesn't know.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readRoutes } from './routes.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const ssrDir = path.join(rootDir, 'dist-ssr');
const manifestPath = path.join(distDir, '.vite/manifest.json');

const { render } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// The shell's site-level fallback tags. Every page's <Seo> emits its own full
// set, and two canonicals on one page get both ignored, so they're dropped.
const template = readFileSync(path.join(distDir, 'index.html'), 'utf8')
  .replace(/<title data-seo-fallback>[^<]*<\/title>\s*/, '')
  .replace(/<(meta|link)\s+data-seo-fallback\b[^>]*>\s*/g, '');

if (!template.includes('<div id="root"></div>')) {
  throw new Error('[prerender] dist/index.html has no empty <div id="root"></div> to fill');
}

/**
 * CSS and JS for a page's lazy chunk, so the prerendered markup is styled on
 * first paint instead of waiting for the chunk to load and inject its CSS.
 */
function assetTagsFor(sourceFile) {
  const css = new Set();
  const js = new Set();
  const visit = (key, isRoot) => {
    const chunk = manifest[key];
    if (!chunk || chunk.isEntry) return;
    if (isRoot || chunk.isDynamicEntry !== true) js.add(chunk.file);
    for (const file of chunk.css ?? []) css.add(file);
    for (const imported of chunk.imports ?? []) visit(imported, false);
  };
  if (sourceFile) visit(sourceFile, true);

  const tags = [
    ...[...css].map((file) => `<link rel="stylesheet" crossorigin href="/${file}">`),
    ...[...js].map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`),
  ];
  return tags.filter((tag) => !template.includes(tag.match(/href="([^"]+)"/)[1])).join('');
}

/**
 * React emits the hoisted <title>/<meta>/<link> tags ahead of the app markup,
 * which starts at the page's Suspense boundary (<!--$-->). Split them so the
 * head tags land in <head>.
 */
function splitHead(html, url) {
  const start = html.indexOf('<!--$');
  if (start === -1) throw new Error(`[prerender] ${url}: no Suspense boundary in output`);
  const head = html.slice(0, start);
  const leftover = head.replace(/<(title)\b[^>]*>[^<]*<\/title>|<(meta|link)\b[^>]*\/?>/g, '');
  if (leftover.trim()) {
    throw new Error(`[prerender] ${url}: unexpected markup before the app root: ${leftover.slice(0, 200)}`);
  }
  return { head, body: html.slice(start) };
}

async function renderPage(url, sourceFile) {
  const { head, body } = splitHead(await render(url), url);
  return template
    .replace('</head>', `${head}${assetTagsFor(sourceFile)}</head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
}

function outputPathFor(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  return path.join(distDir, routePath.replace(/^\/+/, ''), 'index.html');
}

const routes = readRoutes();
for (const { path: routePath, sourceFile } of routes) {
  const file = outputPathFor(routePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, await renderPage(routePath, sourceFile), 'utf8');
}

// Any path App.jsx doesn't route falls through to the NotFoundPage catch-all.
const notFoundSource = readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8').match(
  /const\s+NotFoundPage\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]@\/([^'"]+)['"]/,
);
const notFoundFile = notFoundSource
  ? ['.jsx', '.js'].map((ext) => `src/${notFoundSource[1]}${ext}`).find((f) => manifest[f])
  : null;
// It's served at whatever path was mistyped, so it can't name a canonical URL.
const notFoundHtml = (await renderPage('/__prerender-not-found__', notFoundFile))
  .replace(/<link rel="canonical"[^>]*>/, '')
  .replace(/<meta property="og:url"[^>]*>/, '');
writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');

// The manifest is a build input, not something to publish.
rmSync(path.join(distDir, '.vite'), { recursive: true, force: true });
if (existsSync(ssrDir)) rmSync(ssrDir, { recursive: true, force: true });

console.log(`[prerender] wrote ${routes.length} routes + 404.html`);
