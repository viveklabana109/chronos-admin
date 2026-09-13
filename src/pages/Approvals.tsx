import { useMemo, useState } from 'react';
import { api, identityFileUrl, ApiError } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime, bytes, money } from '../lib/format';
import { Badge, ConfirmButton, Modal, TableCard, useToast } from '../components/ui';
import { useCan } from '../lib/auth';
import { PERM } from '../lib/permissions';
import type { AdminUser, IdentityFile } from '../lib/types';

/**
 * The two queues an admin actually works: identity submissions and listings.
 *
 * Both come out of `/admin/users` — there is no `/admin/listings` list route,
 * the listing is nested on its provider's row. So one fetch feeds both tables
 * and one reload refreshes both after a decision.
 */

const PENDING_IDENTITY = ['identity_under_review', 'under_review', 'pending', 'submitted'];
const PENDING_LISTING = ['under_review', 'pending'];

function DocView({ file }: { file: IdentityFile | null }) {
  if (!file) return null;
  const isImage = (file.mimeType ?? '').startsWith('image/');
  return (
    <div className="doc">
      {isImage ? (
        <img src={identityFileUrl(file.id)} alt={file.fileType} />
      ) : (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <a href={identityFileUrl(file.id)} target="_blank" rel="noreferrer">
            Open {file.originalFilename}
          </a>
        </div>
      )}
      <div className="doc-meta">
        <div>
          <strong>{file.fileType.replace(/_/g, ' ')}</strong>
          {file.documentType ? ` · ${file.documentType.replace(/_/g, ' ')}` : ''}
        </div>
        <div>
          {file.originalFilename} · {bytes(file.sizeBytes)}
        </div>
        <a href={identityFileUrl(file.id)} target="_blank" rel="noreferrer">
          Open full size
        </a>
      </div>
    </div>
  );
}

function IdentityDetail({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const sub = user.identitySubmission;
  return (
    <Modal title={`Identity — ${user.fullName}`} onClose={onClose} wide>
      <dl className="kv">
        <dt>Legal name</dt>
        <dd>{sub?.fullLegalName ?? '—'}</dd>
        <dt>Account name</dt>
        <dd>{user.fullName}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Phone</dt>
        <dd>{user.phone}</dd>
        <dt>Address</dt>
        <dd>
          {[sub?.addressLine1, sub?.city, sub?.country].filter(Boolean).join(', ') || '—'}
        </dd>
        <dt>Submitted</dt>
        <dd>{dateTime(sub?.submittedAt)}</dd>
        <dt>Status</dt>
        <dd>
          <Badge value={sub?.status} />
        </dd>
        {sub?.reviewNotes ? (
          <>
            <dt>Previous note</dt>
            <dd>{sub.reviewNotes}</dd>
          </>
        ) : null}
      </dl>

      <h3 style={{ fontSize: 13, marginTop: 20, marginBottom: 10 }}>Documents</h3>
      <div className="doc-grid">
        <DocView file={sub?.governmentIdFile ?? null} />
        <DocView file={sub?.selfieFile ?? null} />
      </div>
      <p className="hint" style={{ marginTop: 12, color: 'var(--text-faint)', fontSize: 12 }}>
        Check the name and date of birth on the ID against the account, and that the selfie is the same person.
        Documents are served only to administrators and are never cached.
      </p>
    </Modal>
  );
}

function ListingDetail({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const l = user.providerListing!;
  return (
    <Modal title={`Listing — ${l.displayName}`} onClose={onClose} wide>
      <dl className="kv">
        <dt>Provider</dt>
        <dd>
          {user.fullName} · {user.loginId ?? '—'}
        </dd>
        <dt>Headline</dt>
        <dd>{l.title}</dd>
        <dt>Categories</dt>
        <dd>
          {l.categories?.length
            ? l.categories.map((c, i) => (
                <span key={c} className="badge" style={{ marginRight: 6 }}>
                  {i === 0 ? `${c} (primary)` : c}
                </span>
              ))
            : l.category}
        </dd>
        <dt>Experience</dt>
        <dd>{l.experienceTier}</dd>
        <dt>Rate</dt>
        <dd>{money(l.hourlyRate, l.currency)} / hour</dd>
        {l.rateCard?.length ? (
          <>
            <dt>Packages</dt>
            <dd>
              {l.rateCard.map((t) => (
                <div key={t.durationHours}>
                  {t.durationHours}h — {money(t.price, l.currency)}{' '}
                  <span className="muted">({money(t.effectiveHourlyRate, l.currency)}/h)</span>
                </div>
              ))}
            </dd>
          </>
        ) : null}
        <dt>Location</dt>
        <dd>{l.location}</dd>
        <dt>Submitted</dt>
        <dd>{dateTime(l.submittedAt)}</dd>
        <dt>Status</dt>
        <dd>
          <Badge value={l.status} />
        </dd>
      </dl>

      <h3 style={{ fontSize: 13, marginTop: 20, marginBottom: 6 }}>About</h3>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{l.description}</p>

      {l.portfolioImages?.length ? (
        <>
          <h3 style={{ fontSize: 13, marginTop: 20, marginBottom: 10 }}>Portfolio</h3>
          <div className="doc-grid">
            {l.portfolioImages.map((img) => (
              <div className="doc" key={img.id}>
                <img src={img.fileUrl} alt="" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

export default function Approvals() {
  const { data, loading, error, reload } = useResource<AdminUser[]>('/admin/users', (d) => d.users ?? []);
  const toast = useToast();
  // Both queues come out of one payload, but an admin granted only one of the
  // two review permissions can act on only one of them. Showing the other
  // would be a table of buttons that 403 — worse than not showing it.
  const can = useCan();
  const canIdentity = can(PERM.identityReview);
  const canListings = can(PERM.listingsReview);
  const [identityOpen, setIdentityOpen] = useState<AdminUser | null>(null);
  const [listingOpen, setListingOpen] = useState<AdminUser | null>(null);

  const users = useMemo(() => data ?? [], [data]);

  const identityQueue = useMemo(
    () =>
      users.filter((u) => {
        const s = (u.identitySubmission?.status ?? '').toLowerCase();
        return Boolean(u.identitySubmission) && PENDING_IDENTITY.includes(s);
      }),
    [users],
  );

  const listingQueue = useMemo(
    () => users.filter((u) => u.providerListing && PENDING_LISTING.includes((u.providerListing.status ?? '').toLowerCase())),
    [users],
  );

  async function act(path: string, reviewNotes: string, okMessage: string) {
    try {
      await api(path, { method: 'POST', body: { reviewNotes: reviewNotes || undefined } });
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
          <h1>Approvals</h1>
          <p>
            {canIdentity && canListings
              ? "Identity submissions and listings waiting on a decision. Approving identity mints the account's Chronos ID and lets them sign in; approving a listing is what grants provider capability."
              : canIdentity
                ? "Identity submissions waiting on a decision. Approving mints the account's Chronos ID and lets them sign in."
                : 'Listings waiting on a decision. Approving is what grants provider capability.'}
          </p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      {canIdentity ? (
      <TableCard
        title="Identity submissions"
        sub="Look at both documents before deciding."
        head={['Name', 'Contact', 'Location', 'Submitted', 'Status', '']}
        loading={loading}
        error={error}
        count={identityQueue.length}
        empty="No identity submissions are waiting."
      >
        {identityQueue.map((u) => (
          <tr key={u.id}>
            <td>
              <div>
                <strong>{u.fullName}</strong>
              </div>
              <div className="muted">{u.identitySubmission?.fullLegalName}</div>
            </td>
            <td>
              <div>{u.email}</div>
              <div className="muted">{u.phone}</div>
            </td>
            <td>{[u.identitySubmission?.city, u.identitySubmission?.country].filter(Boolean).join(', ') || '—'}</td>
            <td className="nowrap">{dateTime(u.identitySubmission?.submittedAt)}</td>
            <td>
              <Badge value={u.identitySubmission?.status} />
            </td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => setIdentityOpen(u)}>
                  Review
                </button>
                <ConfirmButton
                  className="small ok"
                  label="Approve"
                  confirmLabel="Approve identity"
                  title={`Approve ${u.fullName}?`}
                  body={
                    <p>
                      This activates the account and mints its Chronos ID. Only do it after opening the documents — an
                      approval cannot be taken back by approving again.
                    </p>
                  }
                  needsReason
                  reasonLabel="Review note (optional)"
                  onConfirm={(note) => act(`/admin/identity/${u.id}/approve`, note, `${u.fullName} approved`)}
                />
                <ConfirmButton
                  className="small danger"
                  label="Reject"
                  confirmLabel="Reject identity"
                  title={`Reject ${u.fullName}?`}
                  body={<p>The user is told why, and can submit again.</p>}
                  needsReason
                  reasonLabel="Reason shown to the user"
                  onConfirm={(note) => act(`/admin/identity/${u.id}/reject`, note, `${u.fullName} rejected`)}
                />
              </div>
            </td>
          </tr>
        ))}
      </TableCard>
      ) : null}

      {canListings ? (
      <TableCard
        title="Listings"
        sub="Approving grants provider capability and puts the listing on the map."
        head={['Listing', 'Provider', 'Categories', 'Rate', 'Submitted', '']}
        loading={loading}
        error={error}
        count={listingQueue.length}
        empty="No listings are waiting for review."
      >
        {listingQueue.map((u) => {
          const l = u.providerListing!;
          return (
            <tr key={l.id}>
              <td>
                <div>
                  <strong>{l.displayName}</strong>
                </div>
                <div className="muted">{l.title}</div>
              </td>
              <td>
                <div>{u.fullName}</div>
                <div className="muted">{u.loginId ?? '—'}</div>
              </td>
              <td>{(l.categories?.length ? l.categories : [l.category]).join(', ')}</td>
              <td className="nowrap">{money(l.hourlyRate, l.currency)}/h</td>
              <td className="nowrap">{dateTime(l.submittedAt)}</td>
              <td className="actions">
                <div className="row end">
                  <button className="small" onClick={() => setListingOpen(u)}>
                    Review
                  </button>
                  <ConfirmButton
                    className="small ok"
                    label="Approve"
                    confirmLabel="Approve listing"
                    title={`Approve "${l.displayName}"?`}
                    body={<p>The provider becomes bookable and appears in discovery.</p>}
                    needsReason
                    reasonLabel="Review note (optional)"
                    onConfirm={(note) => act(`/admin/listings/${l.id}/approve`, note, 'Listing approved')}
                  />
                  <ConfirmButton
                    className="small danger"
                    label="Reject"
                    confirmLabel="Reject listing"
                    title={`Reject "${l.displayName}"?`}
                    body={<p>The provider can edit a rejected listing and resubmit.</p>}
                    needsReason
                    reasonLabel="Reason shown to the provider"
                    onConfirm={(note) => act(`/admin/listings/${l.id}/reject`, note, 'Listing rejected')}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </TableCard>
      ) : null}

      {identityOpen ? <IdentityDetail user={identityOpen} onClose={() => setIdentityOpen(null)} /> : null}
      {listingOpen ? <ListingDetail user={listingOpen} onClose={() => setListingOpen(null)} /> : null}
    </>
  );
}
