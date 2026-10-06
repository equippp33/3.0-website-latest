import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ScrollToTop } from '@/utils/ScrollToTop';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ServicesPage = lazy(() => import('@/pages/ServicesPage'));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'));
const BFSISkillPortalPage = lazy(() => import('@/pages/BFSISkillPortalPage'));
const BlueCrossPage = lazy(() => import('@/pages/BlueCrossPage'));
const VDTSPage = lazy(() => import('@/pages/VDTSPage'));
const SailyourPage = lazy(() => import('@/pages/SailyourPage'));
const BhoomiBoxPage = lazy(() => import('@/pages/BhoomiBoxPage'));
const FundPitchPage = lazy(() => import('@/pages/FundPitchPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageFallback() {
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} aria-hidden="true" />;
}

/**
 * The route table. The router is supplied by the entry point: BrowserRouter in
 * main.jsx, StaticRouter in entry-server.jsx when routes are prerendered.
 */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/portfolio/bfsi-skill-portal" element={<BFSISkillPortalPage />} />
          <Route path="/portfolio/blue-cross-hyderabad" element={<BlueCrossPage />} />
          <Route path="/portfolio/vdts" element={<VDTSPage />} />
          <Route path="/portfolio/sailyour-ai" element={<SailyourPage />} />
          <Route path="/portfolio/bhoomibox" element={<BhoomiBoxPage />} />
          <Route path="/portfolio/fundpitch" element={<FundPitchPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
