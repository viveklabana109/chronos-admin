import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../lib/useResource';
import { dateTime } from '../lib/format';
import { Badge } from '../components/ui';
import { useCan } from '../lib/auth';
import { PERM } from '../lib/permissions';
import type { AdminUser, Payout, Report } from '../lib/types';

function Stat({ label, value, attn, to }: { label: string; value: number | string; attn?: boolean; to?: string }) {
  const body = (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={attn && value ? 'value attn' : 'value'}>{value}</div>
    </div>
  );
  return to ? (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  ) : (
    body
  );
}

export default function Dashboard() {
  // Each tile asks only if this account may read it — an empty path makes
  // useResource skip the request, so a scoped admin sees a shorter dashboard
  // rather than a wall of permission errors.
  const can = useCan();
  const canUsers = can(PERM.usersView, PERM.identityReview, PERM.listingsReview);
  const users = useResource<AdminUser[]>(canUsers ? '/admin/users' : '', (d) => d.users ?? []);
  const reports = useResource<Report[]>(can(PERM.reportsManage) ? '/admin/reports' : '', (d) => d.reports ?? []);
  const payouts = useResource<Payout[]>(can(PERM.payoutsManage) ? '/admin/payouts' : '', (d) => d.payouts ?? []);

  const rows = useMemo(() => users.data ?? [], [users.data]);

  const pendingIdentity = rows.filter((u) => {
    const s = (u.identitySubmission?.status ?? '').toLowerCase();
    return Boolean(u.identitySubmission) && !['active', 'approved', 'rejected'].includes(s);
  });
  const pendingListings = rows.filter((u) =>
    ['under_review', 'pending'].includes((u.providerListing?.status ?? '').toLowerCase()),
  );
  const openReports = (reports.data ?? []).filter((r) => (r.status ?? '').toLowerCase() !== 'resolved');
  const pendingPayouts = (payouts.data ?? []).filter((p) => (p.status ?? '').toLowerCase() === 'processing');

  const providers = rows.filter((u) => u.role === 'provider').length;
  const suspended = rows.filter((u) => u.accountStatus === 'suspended').length;

  const recent = [...rows]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>What is waiting on a decision right now.</p>
        </div>
      </div>

      <div className="grid">
        {can(PERM.identityReview) ? (
          <Stat label="Identity waiting" value={pendingIdentity.length} attn to="/approvals" />
        ) : null}
        {can(PERM.listingsReview) ? (
          <Stat label="Listings waiting" value={pendingListings.length} attn to="/approvals" />
        ) : null}
        {can(PERM.reportsManage) ? (
          <Stat label="Open reports" value={openReports.length} attn to="/reports" />
        ) : null}
        {can(PERM.payoutsManage) ? (
          <Stat label="Payouts to settle" value={pendingPayouts.length} attn to="/payouts" />
        ) : null}
      </div>

      {can(PERM.usersView) ? (
        <div className="grid" style={{ marginTop: 14 }}>
          <Stat label="Total accounts" value={rows.length} to="/users" />
          <Stat label="Providers" value={providers} to="/users" />
          <Stat label="Suspended" value={suspended} to="/users" />
        </div>
      ) : null}

      {!canUsers && !can(PERM.reportsManage) && !can(PERM.payoutsManage) ? (
        <div className="card">
          <div className="empty">
            You do not have any permissions yet. Ask a super admin to grant you some.
          </div>
        </div>
      ) : null}

      {can(PERM.usersView) ? (
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Newest accounts</h2>
          <Link to="/users">See all</Link>
        </div>
        {users.loading ? (
          <div className="loading">Loading…</div>
        ) : users.error ? (
          <div className="card-body">
            <div className="error-banner">{users.error}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Name">{u.fullName}</td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Role">
                      <Badge value={u.role} />
                    </td>
                    <td data-label="Status">
                      <Badge value={u.accountStatus} />
                    </td>
                    <td data-label="Joined" className="nowrap">{dateTime(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : null}
    </>
  );
}
