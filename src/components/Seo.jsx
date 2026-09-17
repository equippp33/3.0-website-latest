import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { JsonLd } from './JsonLd.jsx';

/**
 * Per-page document metadata: title, description, canonical, and social cards.
 *
 * React 19 hoists <title>, <meta> and <link> into <head> from anywhere in the
 * tree, so pages just render <Seo /> near the top of their fragment — no
 * helmet library needed.
 *
 * The canonical URL is the important part. Both threepointolabs.com and
 * www.threepointolabs.com resolve, so without an explicit canonical Google is
 * free to pick either as the indexed host. Every page points at the apex.
 */

// Must match the SITE_URL in scripts/generate-sitemap.js and the property
// verified in Search Console — protocol, subdomain and all.
const SITE_URL = 'https://threepointolabs.com';

// No purpose-built 1200x630 social card exists yet; the logo is the fallback.
const DEFAULT_IMAGE = `${SITE_URL}/Images/Logo.png`;

/** Absolute, trailing-slash-free URL for a route path ("/" stays "/"). */
function canonicalFor(pathname) {
  const clean = pathname.replace(/\/+$/, '');
  return clean ? `${SITE_URL}${clean}` : `${SITE_URL}/`;
}

/**
 * index.html ships a site-level title/description/canonical/og set so that link
 * scrapers — which never execute JS — have something to read. React appends its
 * per-page tags rather than replacing those, and a page with two
 * <link rel="canonical"> elements gets both ignored by Google, so the static set
 * is dropped as soon as the real one is in the document.
 */
function useDropStaticFallbacks() {
  useEffect(() => {
    for (const el of document.head.querySelectorAll('[data-seo-fallback]')) {
      el.remove();
    }
  }, []);
}

/**
 * BreadcrumbList for the current route.
 *
 * `labels` names each path segment below Home, so a page at
 * /portfolio/vdts passes ['Portfolio', 'VDTS'] and the URLs get derived from the
 * pathname. Returns null when the labels don't line up with the segments, so a
 * mismatched trail is left out rather than published wrong.
 */
function breadcrumbData(pathname, labels) {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (labels.length !== segments.length) return null;

  const crumbs = labels.map((name, i) => ({
    '@type': 'ListItem',
    position: i + 2, // Home occupies position 1.
    name,
    item: `${SITE_URL}/${segments.slice(0, i + 1).join('/')}`,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      ...crumbs,
    ],
  };
}

export function Seo({
  title,
  description,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  breadcrumb,
}) {
  const { pathname } = useLocation();
  const canonical = canonicalFor(pathname);
  const crumbs = breadcrumb ? breadcrumbData(pathname, breadcrumb) : null;
  useDropStaticFallbacks();

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="3.0 Labs" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {crumbs && <JsonLd data={crumbs} />}
    </>
  );
}
