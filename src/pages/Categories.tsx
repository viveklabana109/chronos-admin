import { useRef, useState } from 'react';
import { ApiError, api, apiBaseUrl } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Check, ConfirmButton, Field, Modal, TableCard, YesNo, useToast } from '../components/ui';
import type { Category } from '../lib/types';

type Draft = { value: string; label: string; icon: string; sortOrder: number; isActive: boolean };

const EMPTY: Draft = { value: '', label: '', icon: '', sortOrder: 0, isActive: true };

function imageSrc(image: string): string {
  if (!image) return '';
  if (/^https?:\/\//.test(image)) return image;
  return `${apiBaseUrl}/files/${image}`;
}

export default function Categories() {
  const { data, loading, error, reload } = useResource<Category[]>('/admin/categories', (d) => d.categories ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  function openCreate() {
    setDraft(EMPTY);
    setCreating(true);
  }

  function openEdit(row: Category) {
    setDraft({ value: row.value, label: row.label, icon: row.icon, sortOrder: row.sortOrder, isActive: row.isActive });
    setEditing(row);
  }

  async function save() {
    setBusy(true);
    try {
      if (creating) {
        // `value` is the identity a listing stores; it cannot be edited later,
        // which is why it only appears on the create form.
        await api('/admin/categories', {
          method: 'POST',
          body: {
            value: draft.value.trim(),
            label: draft.label.trim() || undefined,
            icon: draft.icon.trim() || undefined,
            sortOrder: draft.sortOrder,
          },
        });
        toast.push('Category created');
      } else if (editing) {
        await api(`/admin/categories/${editing.id}`, {
          method: 'PATCH',
          body: {
            label: draft.label.trim(),
            icon: draft.icon.trim(),
            sortOrder: draft.sortOrder,
            isActive: draft.isActive,
          },
        });
        toast.push('Category saved');
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

  async function upload(categoryId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      await api(`/admin/categories/${categoryId}/image`, { method: 'POST', form });
      toast.push('Image updated');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    }
  }

  const form = (
    <>
      {creating ? (
        <Field
          label="Value"
          hint="What a listing stores, e.g. “Event Planner”. Fixed once created — listings point at it."
        >
          <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} autoFocus />
        </Field>
      ) : null}
      <div className="field-grid">
        <Field label="Label" hint="Shown to users. Defaults to the value.">
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </Field>
        <Field label="Icon" hint="A single emoji.">
          <input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
        </Field>
        <Field label="Sort order" hint="Lower comes first in the app.">
          <input
            type="number"
            value={draft.sortOrder}
            onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
          />
        </Field>
      </div>
      {!creating ? (
        <Check
          label="Active"
          checked={draft.isActive}
          onChange={(v) => setDraft({ ...draft, isActive: v })}
        />
      ) : null}
    </>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p>
            The services a provider can list under. Deactivating one hides it from new listings without touching the
            listings that already use it.
          </p>
        </div>
        <button className="primary" onClick={openCreate}>
          New category
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
        title="Categories"
        count={data?.length}
        loading={loading}
        error={error}
        head={['', 'Value', 'Label', 'Icon', 'Order', 'Active', '']}
      >
        {(data ?? []).map((c) => (
          <tr key={c.id}>
            <td>
              {c.image ? <img className="thumb" src={imageSrc(c.image)} alt="" /> : <span className="muted">—</span>}
            </td>
            <td>
              <strong>{c.value}</strong>
              <div className="muted">{c.slug}</div>
            </td>
            <td>{c.label}</td>
            <td style={{ fontSize: 18 }}>{c.icon || '—'}</td>
            <td>{c.sortOrder}</td>
            <td>
              <YesNo value={c.isActive} />
            </td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => openEdit(c)}>
                  Edit
                </button>
                <button
                  className="small"
                  onClick={() => {
                    setUploadFor(c.id);
                    fileInput.current?.click();
                  }}
                >
                  {c.image ? 'Replace image' : 'Add image'}
                </button>
                {c.image ? (
                  <ConfirmButton
                    className="small danger"
                    label="Clear image"
                    confirmLabel="Clear image"
                    title={`Remove the image for ${c.label}?`}
                    body={<p>The category keeps working; it just loses its artwork.</p>}
                    onConfirm={async () => {
                      try {
                        await api(`/admin/categories/${c.id}/image`, { method: 'DELETE' });
                        toast.push('Image cleared');
                        await reload();
                      } catch (err) {
                        toast.push(err instanceof ApiError ? err.message : 'Could not clear', 'error');
                      }
                    }}
                  />
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

      {creating || editing ? (
        <Modal
          title={creating ? 'New category' : `Edit ${editing?.value}`}
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
              <button className="primary" onClick={() => void save()} disabled={busy || (creating && !draft.value.trim())}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {form}
        </Modal>
      ) : null}
    </>
  );
}
