/**
 * The site's route list, parsed straight out of src/App.jsx so adding a <Route>
 * there is enough. Shared by generate-sitemap.js and prerender.js.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
export function readRoutes() {
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
