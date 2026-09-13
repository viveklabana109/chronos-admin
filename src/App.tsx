import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth, useCan } from './lib/auth';
import { PERM } from './lib/permissions';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Approvals from './pages/Approvals';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Categories from './pages/Categories';
import Tiers from './pages/Tiers';
import DocumentTypes from './pages/DocumentTypes';
import CategoryDocuments from './pages/CategoryDocuments';
import Banners from './pages/Banners';
import Markets from './pages/Markets';
import Currencies from './pages/Currencies';
import Reports from './pages/Reports';
import Payouts from './pages/Payouts';
import Administrators from './pages/Administrators';

/**
 * Routes are gated as well as the nav, because hiding a link is not the same
 * as closing a door: a bookmark, a pasted URL or a browser's back button all
 * reach a page the sidebar never offered. Without this a scoped admin lands on
 * a screen whose every request 403s — which reads as "the panel is broken"
 * rather than "this is not yours".
 *
 * Still only presentation. The server refuses the data either way; this just
 * makes the refusal legible.
 */
export default function App() {
  const { me, loading } = useAuth();
  const can = useCan();

  if (loading) return <div className="loading">Loading…</div>;
  if (!me) return <Login />;
  // Before anything else, and without a route: the server refuses every admin
  // call while this is set, so a panel behind it would only render 403s.
  if (me.mustChangePassword) return <ChangePassword />;

  const gated: [string, ReactElement, boolean][] = [
    ['/approvals', <Approvals />, can(PERM.identityReview, PERM.listingsReview)],
    ['/users', <Users />, can(PERM.usersView)],
    ['/categories', <Categories />, can(PERM.catalogManage)],
    ['/tiers', <Tiers />, can(PERM.catalogManage)],
    ['/document-types', <DocumentTypes />, can(PERM.catalogManage)],
    ['/category-documents', <CategoryDocuments />, can(PERM.catalogManage)],
    ['/settings', <Settings />, can(PERM.settingsManage)],
    ['/markets', <Markets />, can(PERM.marketsManage)],
    ['/currencies', <Currencies />, can(PERM.marketsManage)],
    ['/banners', <Banners />, can(PERM.bannersManage)],
    ['/reports', <Reports />, can(PERM.reportsManage)],
    ['/payouts', <Payouts />, can(PERM.payoutsManage)],
    ['/administrators', <Administrators />, Boolean(me.isSuperAdmin)],
  ];

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {gated
          .filter(([, , allowed]) => allowed)
          .map(([path, element]) => (
            <Route key={path} path={path} element={element} />
          ))}
        {/* Anything left over — a route this account may not have, or no route
            at all — goes home rather than rendering an empty shell. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
