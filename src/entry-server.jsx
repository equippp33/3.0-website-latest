import { StrictMode } from 'react';
import { prerender } from 'react-dom/static';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';

/**
 * Renders one route to HTML for scripts/prerender.js. `prerender` (unlike
 * renderToString) waits for the lazy page chunks to resolve, so the output
 * holds the full page rather than the Suspense fallback.
 */
export async function render(url) {
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
  return new Response(prelude).text();
}
