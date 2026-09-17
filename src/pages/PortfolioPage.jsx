import { useReveal } from '@/hooks/useReveal';
import { Seo } from '@/components';
import { PageFooter } from '@/shell/PageFooter';
import { PageHero } from '@/shell/PageHero';
import { PageNavbar } from '@/shell/PageNavbar';
import {
  PortfolioIndex,
  PortfolioNextStep,
  PortfolioProcess,
  PortfolioShowcase,
} from '@/portfolio/PortfolioShowcase';

export default function PortfolioPage() {
  useReveal();

  return (
    <>
      <Seo
        title="Portfolio — 3.0 Labs"
        description="Selected 3.0 Labs portfolio builds across AI, SaaS, edtech, healthcare, agritech, and fintech."
        breadcrumb={['Portfolio']}
      />
      <PageNavbar active="portfolio" />
      <PageHero
        index="01"
        kicker="Portfolio / Selected work"
        title={{ before: 'Case ', after: '' }}
        italicWord="Studies"
        sub="Six production builds across government skilling, NGO field operations, AI learning, enterprise helpdesks, agritech marketplaces, and fintech workflows."
        meta={[
          ['Cases', '06'],
          ['Industries', '06'],
          ['Years', '2023-2025'],
          ['Focus', 'AI products'],
        ]}
      />
      <PortfolioIndex />
      <PortfolioShowcase />
      <PortfolioProcess />
      <PortfolioNextStep />
      <PageFooter />
    </>
  );
}
