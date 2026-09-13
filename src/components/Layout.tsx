import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, useCan } from '../lib/auth';
import { PERM } from '../lib/permissions';
import { apiBaseUrl } from '../lib/api';
import { applyTheme, readTheme } from '../lib/theme';
import type { Theme } from '../lib/theme';
import { useResource } from '../lib/useResource';
import type { AdminUser } from '../lib/types';

/**
 * The queue counts in the sidebar are the panel's whole reason for existing —
 * an admin should not have to open a page to learn there is nothing waiting.
 * They come from the same `/admin/users` payload the approvals page uses, which
 * is the only endpoint that carries both the KYC submissions and the listings.
 */
function useQueueCounts(enabled: boolean) {
  // A scoped admin with neither review permission cannot read /admin/users at
  // all, and asking anyway would put a 403 in their console on every page.
  const { data, reload } = useResource<AdminUser[]>(enabled ? '/admin/users' : '', (d) => d.users ?? [], [enabled]);
  const location = useLocation();

  // The counts have their own copy of the data, so an approval made on the
  // approvals page leaves this one behind — the badge would go on claiming work
  // that is already done. Refetch on every navigation, and slowly on a timer so
  // a tab left open on one page still catches up.
  useEffect(() => {
    if (enabled) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload, enabled]);

  const users = data ?? [];
  const kyc = users.filter(
    (u) => u.identitySubmission && !['active', 'approved'].includes((u.identitySubmission.status ?? '').toLowerCase()),
  ).length;
  const listings = users.filter(
    (u) => u.providerListing && ['under_review', 'pending'].includes((u.providerListing.status ?? '').toLowerCase()),
  ).length;
  return { kyc, listings };
}

/**
 * Light / Dark / System, as three segments rather than a two-way switch.
 *
 * A switch has to pick a side for "system", and whichever it picks is wrong for
 * the person who wanted the other. Three labelled choices also say what the
 * current state *is*, which a half-lit switch icon never does.
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {(['light', 'dark', 'system'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={option === theme ? 'active' : undefined}
          aria-pressed={option === theme}
          onClick={() => choose(option)}
        >
          {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'Auto'}
        </button>
      ))}
    </div>
  );
}

function Item({ to, label, count }: { to: string; label: string; count?: number }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
      <span>{label}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const can = useCan();
  const { kyc, listings } = useQueueCounts(can(PERM.identityReview, PERM.listingsReview, PERM.usersView));
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Below the drawer breakpoint the sidebar sits on top of the page, so a tap
  // that navigates has to close it — otherwise the destination is behind the
  // thing you just used to reach it.
  useEffect(() => setNavOpen(false), [location.pathname]);

  // Escape closes it too, same as the modals.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const waiting = kyc + listings;

  return (
    <div className="shell">
      {/* Only rendered at drawer widths; CSS hides it on a wide screen. */}
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
        >
          ☰
        </button>
        <span className="brand-dot">C</span>
        <strong>Chronos Admin</strong>
        {waiting ? <span className="nav-count">{waiting}</span> : null}
      </header>

      {navOpen ? <div className="nav-scrim" onClick={() => setNavOpen(false)} /> : null}

      <aside className={navOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="brand-dot">C</span> Chronos Admin
          <button className="icon-btn nav-close" onClick={() => setNavOpen(false)} aria-label="Close navigation">
            ✕
          </button>
        </div>

        <Item to="/" label="Dashboard" />
        {can(PERM.identityReview, PERM.listingsReview) ? (
          <Item to="/approvals" label="Approvals" count={waiting} />
        ) : null}
        {can(PERM.usersView) ? <Item to="/users" label="Users" /> : null}

        {can(PERM.catalogManage) ? (
          <>
            <div className="nav-group">Catalog</div>
            <Item to="/categories" label="Categories" />
            <Item to="/tiers" label="Experience tiers" />
            <Item to="/document-types" label="Document types" />
            <Item to="/category-documents" label="Category documents" />
          </>
        ) : null}

        {can(PERM.settingsManage, PERM.marketsManage, PERM.bannersManage) ? (
          <div className="nav-group">Platform</div>
        ) : null}
        {can(PERM.settingsManage) ? <Item to="/settings" label="Settings" /> : null}
        {can(PERM.marketsManage) ? <Item to="/markets" label="Markets" /> : null}
        {can(PERM.marketsManage) ? <Item to="/currencies" label="Currencies" /> : null}
        {can(PERM.bannersManage) ? <Item to="/banners" label="Banners" /> : null}

        {can(PERM.reportsManage, PERM.payoutsManage) ? (
          <div className="nav-group">Operations</div>
        ) : null}
        {can(PERM.reportsManage) ? <Item to="/reports" label="Reports" /> : null}
        {can(PERM.payoutsManage) ? <Item to="/payouts" label="Payouts" /> : null}

        {me?.isSuperAdmin ? (
          <>
            <div className="nav-group">Access</div>
            <Item to="/administrators" label="Administrators" />
          </>
        ) : null}

        <div className="sidebar-foot">
          <ThemeToggle />
          <div className="who">
            {me?.name ?? me?.loginId}{' '}
            {me?.isSuperAdmin ? <span className="badge info">super</span> : null}
          </div>
          <div className="host">{apiBaseUrl || '(no API base set)'}</div>
          <button className="link" style={{ marginTop: 8 }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
