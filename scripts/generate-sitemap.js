/**
 * Generates public/sitemap.xml and public/robots.txt for Google Search Console.
 *
 * Routes are parsed straight out of src/App.jsx, so adding a <Route> there is
 * enough — no second list to keep in sync. `lastmod` comes from the last git
 * commit that touched each route's page component, falling back to the build
 * date when git history isn't available (e.g. a shallow CI checkout).
 *
 * Runs automatically via the `prebuild` npm script. Override the domain with:
 *   SITE_URL=https://www.example.com npm run build
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Must match the property you verified in Search Console exactly — protocol,
// subdomain and all. A mismatch makes Google reject every URL in the file.
const SITE_URL = (process.env.SITE_URL || 'https://threepointolabs.com').replace(/\/+$/, '');

/** Per-route crawl hints, keyed by path depth. */
function hintsFor(routePath) {
  if (routePath === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (routePath === '/contact') return { changefreq: 'yearly', priority: '0.6' };
  // Case-study detail pages sit a level down and change less often than hubs.
  if (routePath.split('/').length > 2) return { changefreq: 'monthly', priority: '0.7' };
  return { changefreq: 'monthly', priority: '0.9' };
}

/**
 * Turns an extensionless import specifier ("src/pages/TeamPage") into a real
 * repo path, matching how Vite resolves it. Returns null if nothing matches,
 * which just means that route falls back to the build date for `lastmod`.
 */
function resolveSourceFile(specifier) {
  const candidates = ['.jsx', '.js', '.tsx', '.ts'].flatMap((ext) => [
    `${specifier}${ext}`,
    `${specifier}/index${ext}`,
  ]);
  const isFile = (candidate) => {
    const full = path.join(rootDir, candidate);
    return existsSync(full) && statSync(full).isFile();
  };
  return [specifier, ...candidates].find(isFile) ?? null;
}

/**
 * Pulls `path` -> page-component-source pairs out of App.jsx by matching the
 * lazy() imports against the <Route> elements that render them.
 */
function readRoutes() {
  const appPath = path.join(rootDir, 'src/App.jsx');
  const source = readFileSync(appPath, 'utf8');

  const componentFiles = new Map();
  const importRe = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g;
  for (const [, name, specifier] of source.matchAll(importRe)) {
    componentFiles.set(name, resolveSourceFile(specifier.replace(/^@\//, 'src/')));
  }

  const routes = [];
  const routeRe = /<Route\s+path=["']([^"']+)["']\s+element=\{<(\w+)\s*\/>\}/g;
  for (const [, routePath, component] of source.matchAll(routeRe)) {
    // "*" is the catch-all redirect to "/", not a real indexable URL.
    if (routePath === '*') continue;
    routes.push({ path: routePath, sourceFile: componentFiles.get(component) ?? null });
  }

  if (routes.length === 0) {
    throw new Error(`No <Route path=...> entries found in ${appPath} — did the routing change shape?`);
  }
  return routes;
}

const buildDate = new Date().toISOString().slice(0, 10);

/** Date of the last commit touching `file`, as YYYY-MM-DD. */
function lastModified(file) {
  if (!file) return buildDate;
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return iso ? iso.slice(0, 10) : buildDate;
  } catch {
    return buildDate;
  }
}

const routes = readRoutes();

const urlEntries = routes
  .map(({ path: routePath, sourceFile }) => {
    const { changefreq, priority } = hintsFor(routePath);
    const loc = routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`;
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastModified(sourceFile)}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# The contact form endpoint has nothing to index.
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

writeFileSync(path.join(rootDir, 'public/sitemap.xml'), sitemap, 'utf8');
writeFileSync(path.join(rootDir, 'public/robots.txt'), robots, 'utf8');

console.log(`[sitemap] wrote public/sitemap.xml (${routes.length} URLs) and public/robots.txt for ${SITE_URL}`);
