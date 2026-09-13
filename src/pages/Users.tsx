import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime } from '../lib/format';
import { Badge, ConfirmButton, Modal, TableCard, useToast } from '../components/ui';
import type { AdminUser } from '../lib/types';

export default function Users() {
  const [role, setRole] = useState('');
  const path = role ? `/admin/users?role=${role}` : '/admin/users';
  const { data, loading, error, reload } = useResource<AdminUser[]>(path, (d) => d.users ?? [], [role]);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<AdminUser | null>(null);

  // Search and status are filtered here rather than on the server: /admin/users
  // takes only a role filter, and the list is small enough that asking for it
  // all and narrowing in the browser is both simpler and faster than paging.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      if (status && u.accountStatus !== status) return false;
      if (!q) return true;
      return [u.fullName, u.email, u.phone, u.loginId, u.id].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [data, query, status]);

  const statuses = useMemo(
    () => Array.from(new Set((data ?? []).map((u) => u.accountStatus))).sort(),
    [data],
  );

  async function act(path: string, reason: string, okMessage: string) {
    try {
      await api(path, { method: 'POST', body: { reason: reason || undefined } });
      toast.push(okMessage);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Action failed', 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p>Every account on the platform. Suspending blocks sign-in and hides the account from discovery.</p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      <TableCard
        title="Accounts"
        count={rows.length}
        loading={loading}
        error={error}
        empty="No account matches these filters."
        head={['Name', 'Chronos ID', 'Contact', 'Role', 'Status', 'Joined', '']}
        actions={
          <div className="filters">
            <input
              className="search"
              placeholder="Search name, email, phone, ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="provider">Providers</option>
              <option value="renter">Renters</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {rows.map((u) => (
          <tr key={u.id}>
            <td>
              <div>
                <strong>{u.fullName}</strong>
              </div>
              <div className="muted">{u.legalName && u.legalName !== u.fullName ? u.legalName : u.id}</div>
            </td>
            <td className="nowrap">{u.loginId ?? <span className="muted">not minted</span>}</td>
            <td>
              <div>{u.email}</div>
              <div className="muted">{u.phone}</div>
            </td>
            <td>
              <Badge value={u.role} />
            </td>
            <td>
              <Badge value={u.accountStatus} />
            </td>
            <td className="nowrap">{dateTime(u.createdAt)}</td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => setOpen(u)}>
                  Details
                </button>
                {u.accountStatus === 'suspended' ? (
                  <ConfirmButton
                    className="small ok"
                    label="Reinstate"
                    confirmLabel="Reinstate account"
                    title={`Reinstate ${u.fullName}?`}
                    body={<p>They can sign in again and their listing returns to whatever state it was in.</p>}
                    onConfirm={() => act(`/admin/users/${u.id}/reinstate`, '', `${u.fullName} reinstated`)}
                  />
                ) : (
                  <ConfirmButton
                    className="small danger"
                    label="Suspend"
                    confirmLabel="Suspend account"
                    title={`Suspend ${u.fullName}?`}
                    body={<p>They cannot sign in, and they disappear from discovery until reinstated.</p>}
                    needsReason
                    reasonLabel="Reason"
                    onConfirm={(reason) => act(`/admin/users/${u.id}/suspend`, reason, `${u.fullName} suspended`)}
                  />
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

      {open ? (
        <Modal title={open.fullName} onClose={() => setOpen(null)} wide>
          <dl className="kv">
            <dt>User id</dt>
            <dd>{open.id}</dd>
            <dt>Chronos ID</dt>
            <dd>{open.loginId ?? '—'}</dd>
            <dt>Email</dt>
            <dd>
              {open.email} {open.isEmailVerified ? <span className="badge ok">verified</span> : <span className="badge warn">unverified</span>}
            </dd>
            <dt>Phone</dt>
            <dd>{open.phone}</dd>
            <dt>Role</dt>
            <dd>
              <Badge value={open.role} />
            </dd>
            <dt>Account status</dt>
            <dd>
              <Badge value={open.accountStatus} />
            </dd>
            <dt>Identity</dt>
            <dd>
              {open.isIdentityVerified ? <span className="badge ok">verified</span> : <span className="badge">not verified</span>}
            </dd>
            <dt>Location</dt>
            <dd>{[open.city, open.country].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Joined</dt>
            <dd>{dateTime(open.createdAt)}</dd>
            <dt>Last updated</dt>
            <dd>{dateTime(open.updatedAt)}</dd>
            {open.reviewNotes ? (
              <>
                <dt>Review notes</dt>
                <dd>{open.reviewNotes}</dd>
              </>
            ) : null}
            {open.providerListing ? (
              <>
                <dt>Listing</dt>
                <dd>
                  {open.providerListing.displayName} — <Badge value={open.providerListing.status} />
                  <div className="muted">
                    {(open.providerListing.categories ?? []).join(', ')} · {open.providerListing.location}
                  </div>
                </dd>
              </>
            ) : null}
          </dl>
        </Modal>
      ) : null}
    </>
  );
}
