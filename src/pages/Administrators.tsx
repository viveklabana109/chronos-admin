import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useAuth } from '../lib/auth';
import { PERMISSION_LABELS } from '../lib/permissions';
import { Badge, ConfirmButton, Field, Modal, TableCard, useToast } from '../components/ui';

/**
 * Super admin only — the server enforces that, this page just exists for them.
 *
 * There is no "make someone a super admin" button on purpose. That tier comes
 * from CHRONOS_ADMIN_EMAILS and a restart, so offering it here would either be
 * a lie or would hand away the thing that separates the two tiers.
 */

type Administrator = {
  id: string;
  loginId: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  /** "active" | "suspended" — an admin account's own status, not a user's. */
  status: string;
  mustChangePassword: boolean;
  permissions: string[];
  lastLoginAt: string | null;
};

type CatalogEntry = { value: string; label: string; description: string };

function PermissionPicker({
  catalog,
  picked,
  onChange,
}: {
  catalog: CatalogEntry[];
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      {catalog.map((entry) => (
        <div className="field inline" key={entry.value} style={{ alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            id={`perm-${entry.value}`}
            checked={picked.includes(entry.value)}
            style={{ marginTop: 3 }}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...picked, entry.value]
                  : picked.filter((p) => p !== entry.value),
              )
            }
          />
          <label htmlFor={`perm-${entry.value}`}>
            <div>
              <strong>{entry.label}</strong> <code className="muted">{entry.value}</code>
            </div>
            <div className="muted">{entry.description}</div>
          </label>
        </div>
      ))}
    </>
  );
}

export default function Administrators() {
  const { me } = useAuth();
  const admins = useResource<Administrator[]>('/admin/administrators', (d) => d.administrators ?? []);
  const catalog = useResource<CatalogEntry[]>('/admin/permissions', (d) => d.permissions ?? []);
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Administrator | null>(null);
  const [draft, setDraft] = useState({ fullName: '', email: '', phone: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Shown once, then gone — the server cannot produce it again.
  const [issued, setIssued] = useState<{ name: string; loginId: string; password: string } | null>(null);

  const entries = useMemo(
    () =>
      catalog.data ??
      Object.entries(PERMISSION_LABELS).map(([value, label]) => ({ value, label, description: '' })),
    [catalog.data],
  );

  const label = (value: string) => entries.find((e) => e.value === value)?.label ?? value;

  async function create() {
    setBusy(true);
    try {
      const body = await api<any>('/admin/administrators', {
        method: 'POST',
        body: { ...draft, permissions: picked },
      });
      setCreating(false);
      setIssued({
        name: draft.fullName,
        loginId: body.credentials.loginId,
        password: body.credentials.password,
      });
      setDraft({ fullName: '', email: '', phone: '' });
      setPicked([]);
      await admins.reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not create', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/admin/administrators/${editing.id}`, { method: 'PATCH', body: { permissions: picked } });
      toast.push('Permissions updated');
      setEditing(null);
      await admins.reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administrators</h1>
          <p>
            Who can sign in to this panel, and what each of them may do. A new administrator starts with nothing —
            tick only what they need.
          </p>
        </div>
        <div className="row">
          <button
            className="primary"
            onClick={() => {
              setDraft({ fullName: '', email: '', phone: '' });
              setPicked([]);
              setCreating(true);
            }}
          >
            Create admin
          </button>
        </div>
      </div>

      <div className="warn-banner">
        Super admins are set by <code>CHRONOS_ADMIN_EMAILS</code> and a restart — they hold every permission and
        cannot be edited or removed here.
      </div>

      <TableCard
        title="Administrators"
        count={admins.data?.length}
        loading={admins.loading}
        error={admins.error}
        head={['Name', 'Administrator ID', 'Tier', 'Can do', '']}
      >
        {(admins.data ?? []).map((a) => (
          <tr key={a.id}>
            <td>
              <div>
                <strong>{a.fullName}</strong>
              </div>
              <div className="muted">{a.email}</div>
            </td>
            <td className="nowrap">{a.loginId || <span className="muted">—</span>}</td>
            <td>
              {a.isSuperAdmin ? <span className="badge info">Super admin</span> : <Badge value="admin" />}
              {a.id === me?.id ? (
                <div className="muted" style={{ marginTop: 2 }}>
                  you
                </div>
              ) : null}
            </td>
            <td>
              {a.isSuperAdmin ? (
                <span className="muted">Everything</span>
              ) : a.permissions.length ? (
                a.permissions.map((p) => (
                  <span key={p} className="badge" style={{ marginRight: 6, marginBottom: 4, display: 'inline-block' }}>
                    {label(p)}
                  </span>
                ))
              ) : (
                <span className="muted">Nothing yet</span>
              )}
            </td>
            <td className="actions">
              {a.isSuperAdmin ? (
                <span className="muted">—</span>
              ) : (
                <div className="row end">
                  <button
                    className="small"
                    onClick={() => {
                      setPicked(a.permissions);
                      setEditing(a);
                    }}
                  >
                    Permissions
                  </button>
                  <ConfirmButton
                    className="small danger"
                    label="Suspend"
                    confirmLabel="Suspend access"
                    title={`Suspend ${a.fullName}?`}
                    body={
                      <p>
                        Their sessions end immediately and they can no longer sign in. The account is kept rather
                        than deleted, so everything they approved stays attributable — reinstate it here whenever
                        you like.
                      </p>
                    }
                    onConfirm={async () => {
                      try {
                        await api(`/admin/administrators/${a.id}`, { method: 'DELETE' });
                        toast.push('Administrator suspended');
                        await admins.reload();
                      } catch (err) {
                        toast.push(err instanceof ApiError ? err.message : 'Could not suspend', 'error');
                      }
                    }}
                  />
                </div>
              )}
            </td>
          </tr>
        ))}
      </TableCard>

      {creating ? (
        <Modal
          title="Create admin"
          wide
          onClose={() => setCreating(false)}
          footer={
            <>
              <button onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => void create()}
                disabled={busy || !draft.fullName.trim() || !draft.email.trim() || !draft.phone.trim()}
              >
                {busy ? 'Creating…' : 'Create and show credentials'}
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
            Makes the account outright — no signup, no emailed code. You get a Chronos ID and a password to hand
            over, shown once.
          </p>
          <div className="field-grid">
            <Field label="Full name">
              <input
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Email">
              <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field label="Phone" hint="With the country code, e.g. +9198…">
              <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
          </div>
          <h3 style={{ fontSize: 13, marginTop: 18, marginBottom: 4 }}>What they may do</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Tick only their job — "review listings" for someone approving listings, "review identity" for someone
            checking IDs. You can change this later.
          </p>
          <PermissionPicker catalog={entries} picked={picked} onChange={setPicked} />
        </Modal>
      ) : null}

      {issued ? (
        <Modal
          title={`Credentials for ${issued.name}`}
          onClose={() => setIssued(null)}
          footer={
            <button className="primary" onClick={() => setIssued(null)}>
              I have saved these
            </button>
          }
        >
          <div className="warn-banner">
            This password is shown once and cannot be recovered. Copy it now — if it is lost, they reset it from the
            sign-in screen.
          </div>
          <dl className="kv">
            <dt>Chronos ID</dt>
            <dd>
              <code>{issued.loginId}</code>
            </dd>
            <dt>Password</dt>
            <dd>
              <code>{issued.password}</code>
            </dd>
          </dl>
          <button
            style={{ marginTop: 14 }}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`Chronos ID: ${issued.loginId}\nPassword: ${issued.password}`)
                .then(() => toast.push('Copied'))
                .catch(() => toast.push('Could not copy — select the text instead', 'error'));
            }}
          >
            Copy both
          </button>
        </Modal>
      ) : null}

      {editing ? (
        <Modal
          title={`Permissions — ${editing.fullName}`}
          wide
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
            Saving replaces the whole set. Changes apply to their next request — they do not have to sign in again.
          </p>
          <PermissionPicker catalog={entries} picked={picked} onChange={setPicked} />
        </Modal>
      ) : null}
    </>
  );
}
