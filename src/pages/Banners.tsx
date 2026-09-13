import { useRef, useState } from 'react';
import { ApiError, api, apiBaseUrl } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime, toCsv, fromCsv } from '../lib/format';
import { Check, ConfirmButton, Field, Modal, TableCard, YesNo, useToast } from '../components/ui';
import type { Banner } from '../lib/types';

type Draft = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  actionType: string;
  actionValue: string;
  backgroundColor: string;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  targetRoles: string;
  targetMinAge: string;
  targetMaxAge: string;
  targetCities: string;
  targetLat: string;
  targetLng: string;
  targetRadiusKm: string;
};

const EMPTY: Draft = {
  title: '',
  subtitle: '',
  ctaLabel: '',
  actionType: '',
  actionValue: '',
  backgroundColor: '',
  placement: 'home',
  sortOrder: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
  targetRoles: '',
  targetMinAge: '',
  targetMaxAge: '',
  targetCities: '',
  targetLat: '',
  targetLng: '',
  targetRadiusKm: '',
};

function imageSrc(image: string): string {
  if (!image) return '';
  if (/^https?:\/\//.test(image)) return image;
  return `${apiBaseUrl}/files/${image}`;
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm"; the API returns a full ISO stamp. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDraft(d: Draft) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    title: d.title.trim(),
    subtitle: d.subtitle.trim(),
    ctaLabel: d.ctaLabel.trim(),
    actionType: d.actionType.trim(),
    actionValue: d.actionValue.trim(),
    backgroundColor: d.backgroundColor.trim(),
    placement: d.placement.trim(),
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : undefined,
    endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : undefined,
    targetRoles: toCsv(fromCsv(d.targetRoles)),
    targetMinAge: num(d.targetMinAge),
    targetMaxAge: num(d.targetMaxAge),
    targetCities: toCsv(fromCsv(d.targetCities)),
    targetLat: num(d.targetLat),
    targetLng: num(d.targetLng),
    targetRadiusKm: num(d.targetRadiusKm),
  };
}

export default function Banners() {
  const { data, loading, error, reload } = useResource<Banner[]>('/admin/banners', (d) => d.banners ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  function openEdit(b: Banner) {
    setDraft({
      title: b.title,
      subtitle: b.subtitle ?? '',
      ctaLabel: b.ctaLabel ?? '',
      actionType: b.actionType ?? '',
      actionValue: b.actionValue ?? '',
      backgroundColor: b.backgroundColor ?? '',
      placement: b.placement ?? 'home',
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
      targetRoles: (b.targeting?.roles ?? []).join(', '),
      targetMinAge: b.targeting?.minAge != null ? String(b.targeting.minAge) : '',
      targetMaxAge: b.targeting?.maxAge != null ? String(b.targeting.maxAge) : '',
      targetCities: (b.targeting?.cities ?? []).join(', '),
      targetLat: b.targeting?.lat != null ? String(b.targeting.lat) : '',
      targetLng: b.targeting?.lng != null ? String(b.targeting.lng) : '',
      targetRadiusKm: b.targeting?.radiusKm != null ? String(b.targeting.radiusKm) : '',
    });
    setEditing(b);
  }

  async function save() {
    setBusy(true);
    try {
      if (creating) {
        await api('/admin/banners', { method: 'POST', body: fromDraft(draft) });
        toast.push('Banner created');
      } else if (editing) {
        await api(`/admin/banners/${editing.id}`, { method: 'PATCH', body: fromDraft(draft) });
        toast.push('Banner saved');
      }
      setCreating(false);
      setEditing(null);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function upload(bannerId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      await api(`/admin/banners/${bannerId}/image`, { method: 'POST', form });
      toast.push('Image updated');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Banners</h1>
          <p>
            Promotional cards in the app. A banner is only shown when it is active <em>and</em> inside its schedule — the
            “Live” column is the server's own answer to both.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setDraft(EMPTY);
            setCreating(true);
          }}
        >
          New banner
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadFor) void upload(uploadFor, file);
          e.target.value = '';
          setUploadFor(null);
        }}
      />

      <TableCard
        title="Banners"
        count={data?.length}
        loading={loading}
        error={error}
        head={['', 'Title', 'Placement', 'Schedule', 'Targeted', 'Active', 'Live', '']}
        empty="No banners yet."
      >
        {(data ?? []).map((b) => (
          <tr key={b.id}>
            <td>{b.image ? <img className="thumb" src={imageSrc(b.image)} alt="" /> : <span className="muted">—</span>}</td>
            <td>
              <strong>{b.title}</strong>
              <div className="muted">{b.subtitle}</div>
            </td>
            <td>{b.placement}</td>
            <td className="nowrap">
              <div className="muted">from {dateTime(b.startsAt)}</div>
              <div className="muted">to {dateTime(b.endsAt)}</div>
            </td>
            <td>
              <YesNo value={Boolean(b.targeting?.isTargeted)} />
            </td>
            <td>
              <YesNo value={b.isActive} />
            </td>
            <td>
              <YesNo value={Boolean(b.isLive)} />
            </td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => openEdit(b)}>
                  Edit
                </button>
                <button
                  className="small"
                  onClick={() => {
                    setUploadFor(b.id);
                    fileInput.current?.click();
                  }}
                >
                  {b.image ? 'Replace image' : 'Add image'}
                </button>
                {b.image ? (
                  <ConfirmButton
                    className="small"
                    label="Clear image"
                    confirmLabel="Clear image"
                    title={`Remove the image for “${b.title}”?`}
                    onConfirm={async () => {
                      try {
                        await api(`/admin/banners/${b.id}/image`, { method: 'DELETE' });
                        toast.push('Image cleared');
                        await reload();
                      } catch (err) {
                        toast.push(err instanceof ApiError ? err.message : 'Could not clear', 'error');
                      }
                    }}
                  />
                ) : null}
                <ConfirmButton
                  className="small danger"
                  label="Delete"
                  confirmLabel="Delete banner"
                  title={`Delete “${b.title}”?`}
                  body={<p>This cannot be undone.</p>}
                  onConfirm={async () => {
                    try {
                      await api(`/admin/banners/${b.id}`, { method: 'DELETE' });
                      toast.push('Banner deleted');
                      await reload();
                    } catch (err) {
                      toast.push(err instanceof ApiError ? err.message : 'Could not delete', 'error');
                    }
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

      {creating || editing ? (
        <Modal
          title={creating ? 'New banner' : `Edit “${editing?.title}”`}
          wide
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          footer={
            <>
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="primary" onClick={() => void save()} disabled={busy || !draft.title.trim()}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="field-grid">
            <Field label="Title">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
            </Field>
            <Field label="Subtitle">
              <input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
            </Field>
            <Field label="CTA label">
              <input value={draft.ctaLabel} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} />
            </Field>
            <Field label="Placement">
              <input value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value })} />
            </Field>
            <Field label="Action type" hint="What tapping it does, e.g. category or url.">
              <input value={draft.actionType} onChange={(e) => setDraft({ ...draft, actionType: e.target.value })} />
            </Field>
            <Field label="Action value">
              <input value={draft.actionValue} onChange={(e) => setDraft({ ...draft, actionValue: e.target.value })} />
            </Field>
            <Field label="Background colour" hint="Hex, e.g. #F43F5E.">
              <input
                value={draft.backgroundColor}
                onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              />
            </Field>
            <Field label="Starts at">
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </Field>
            <Field label="Ends at">
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </Field>
          </div>

          <Check label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />

          <h3 style={{ fontSize: 13, marginTop: 18, marginBottom: 8 }}>Who sees it</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Leave everything empty to show it to everyone.
          </p>
          <div className="field-grid">
            <Field label="Roles" hint="Comma separated: renter, provider.">
              <input value={draft.targetRoles} onChange={(e) => setDraft({ ...draft, targetRoles: e.target.value })} />
            </Field>
            <Field label="Cities" hint="Comma separated.">
              <input value={draft.targetCities} onChange={(e) => setDraft({ ...draft, targetCities: e.target.value })} />
            </Field>
            <Field label="Min age">
              <input
                type="number"
                value={draft.targetMinAge}
                onChange={(e) => setDraft({ ...draft, targetMinAge: e.target.value })}
              />
            </Field>
            <Field label="Max age">
              <input
                type="number"
                value={draft.targetMaxAge}
                onChange={(e) => setDraft({ ...draft, targetMaxAge: e.target.value })}
              />
            </Field>
            <Field label="Latitude">
              <input value={draft.targetLat} onChange={(e) => setDraft({ ...draft, targetLat: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <input value={draft.targetLng} onChange={(e) => setDraft({ ...draft, targetLng: e.target.value })} />
            </Field>
            <Field label="Radius (km)">
              <input
                value={draft.targetRadiusKm}
                onChange={(e) => setDraft({ ...draft, targetRadiusKm: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
