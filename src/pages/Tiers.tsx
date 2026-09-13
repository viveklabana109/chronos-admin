import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Check, Field, Modal, TableCard, YesNo, useToast } from '../components/ui';
import type { Tier } from '../lib/types';

type Draft = { value: string; label: string; description: string; sortOrder: number; isActive: boolean };
const EMPTY: Draft = { value: '', label: '', description: '', sortOrder: 0, isActive: true };

export default function Tiers() {
  const { data, loading, error, reload } = useResource<Tier[]>('/admin/experience-tiers', (d) => d.tiers ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<Tier | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (creating) {
        await api('/admin/experience-tiers', {
          method: 'POST',
          body: {
            value: draft.value.trim(),
            label: draft.label.trim() || undefined,
            description: draft.description.trim() || undefined,
            sortOrder: draft.sortOrder,
          },
        });
        toast.push('Tier created');
      } else if (editing) {
        await api(`/admin/experience-tiers/${editing.id}`, {
          method: 'PATCH',
          body: {
            label: draft.label.trim(),
            description: draft.description.trim(),
            sortOrder: draft.sortOrder,
            isActive: draft.isActive,
          },
        });
        toast.push('Tier saved');
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Experience tiers</h1>
          <p>The seniority a provider picks on their listing. Order decides how they read from junior to senior.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setDraft(EMPTY);
            setCreating(true);
          }}
        >
          New tier
        </button>
      </div>

      <TableCard
        title="Tiers"
        count={data?.length}
        loading={loading}
        error={error}
        head={['Value', 'Label', 'Description', 'Order', 'Active', '']}
      >
        {(data ?? []).map((t) => (
          <tr key={t.id}>
            <td>
              <strong>{t.value}</strong>
            </td>
            <td>{t.label}</td>
            <td>{t.description || <span className="muted">—</span>}</td>
            <td>{t.sortOrder}</td>
            <td>
              <YesNo value={t.isActive} />
            </td>
            <td className="actions">
              <button
                className="small"
                onClick={() => {
                  setDraft({
                    value: t.value,
                    label: t.label,
                    description: t.description,
                    sortOrder: t.sortOrder,
                    isActive: t.isActive,
                  });
                  setEditing(t);
                }}
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </TableCard>

      {creating || editing ? (
        <Modal
          title={creating ? 'New tier' : `Edit ${editing?.value}`}
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
          {creating ? (
            <Field label="Value" hint="What a listing stores. Fixed once created.">
              <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} autoFocus />
            </Field>
          ) : null}
          <Field label="Label">
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Description" hint="One line, shown next to the tier when a provider picks it.">
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
            />
          </Field>
          {!creating ? (
            <Check label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
