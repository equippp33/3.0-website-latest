import { useReveal } from '@/hooks/useReveal';
import { Seo } from '@/components';
import { PageNavbar } from '@/shell/PageNavbar';
import { PageHero } from '@/shell/PageHero';
import { PageCTA } from '@/shell/PageCTA';
import { PageFooter } from '@/shell/PageFooter';

/**
 * Catch-all for unknown paths.
 *
 * This used to redirect to "/", which made Google treat every bad URL as a
 * duplicate of the homepage. server.js now answers unrouteable paths with a
 * real 404 status; the noindex here is the backstop for the case where it
 * can't read its route manifest and falls back to serving a 200.
 *
 * URLs that were retired rather than mistyped belong in the REDIRECTS map in
 * server.js, so they 301 and keep their link equity.
 */
export default function NotFoundPage() {
  useReveal();
  return (
    <>
      <Seo
        noindex
        title="Page not found — 3.0 Labs"
        description="That page doesn't exist. Browse our work, services, or get in touch."
      />
      <PageNavbar />
      <PageHero
        index="01"
        kicker="404 / Not found"
        title={{ before: 'That page ', after: '.' }}
        italicWord="moved on"
        sub="The link is broken or the page has been retired. Everything we're working on is one hop away — start with our recent work."
      />
      <PageCTA
        kicker="02 / Keep going"
        title="Looking for something?"
        italic="We'll point you there."
        sub="Browse the case studies, read what we build, or send a note and we'll reply within one working day."
        primary={{ href: '/portfolio', label: 'See recent work' }}
        secondary={{ href: '/contact', label: 'Connect to team' }}
      />
      <PageFooter />
    </>
  );
}
