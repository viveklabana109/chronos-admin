import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Modal, TableCard, useToast } from '../components/ui';
import type { Category, DocumentType } from '../lib/types';

/**
 * Which categories owe which documents.
 *
 * `PUT /admin/category-documents/{value}` replaces the whole list for one
 * category, so the editor works on a full set rather than adding and removing
 * one at a time — that is what the endpoint means, and pretending otherwise
 * would make a half-applied edit look successful.
 */
export default function CategoryDocuments() {
  const reqs = useResource<Record<string, string[]>>('/admin/category-documents', (d) => d.requirements ?? {});
  const cats = useResource<Category[]>('/admin/categories', (d) => d.categories ?? []);
  const docs = useResource<DocumentType[]>('/admin/document-types', (d) => d.documentTypes ?? []);
  const toast = useToast();

  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const map = reqs.data ?? {};
    return (cats.data ?? []).map((c) => ({ category: c, required: map[c.value] ?? [] }));
  }, [cats.data, reqs.data]);

  const docLabel = useMemo(() => {
    const m = new Map((docs.data ?? []).map((d) => [d.docType, d.label]));
    return (key: string) => m.get(key) ?? key;
  }, [docs.data]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/admin/category-documents/${encodeURIComponent(editing)}`, {
        method: 'PUT',
        body: { documentTypes: picked },
      });
      toast.push(`Requirements saved for ${editing}`);
      setEditing(null);
      await reqs.reload();
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
          <h1>Category documents</h1>
          <p>
            What a listing must upload before it can be approved. A listing carrying several categories owes the union
            of their documents, asked for once.
          </p>
        </div>
        <button onClick={() => void reqs.reload()}>Refresh</button>
      </div>

      <TableCard
        title="Requirements"
        count={rows.length}
        loading={reqs.loading || cats.loading}
        error={reqs.error ?? cats.error}
        head={['Category', 'Required documents', '']}
      >
        {rows.map(({ category, required }) => (
          <tr key={category.id}>
            <td>
              <strong>{category.value}</strong>
              {!category.isActive ? <span className="badge" style={{ marginLeft: 8 }}>inactive</span> : null}
            </td>
            <td>
              {required.length ? (
                required.map((d) => (
                  <span key={d} className="badge info" style={{ marginRight: 6 }}>
                    {docLabel(d)}
                  </span>
                ))
              ) : (
                <span className="muted">None</span>
              )}
            </td>
            <td className="actions">
              <button
                className="small"
                onClick={() => {
                  setPicked(required);
                  setEditing(category.value);
                }}
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </TableCard>

      {editing ? (
        <Modal
          title={`Documents required for ${editing}`}
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
            Tick everything this category must supply. Saving replaces the whole list.
          </p>
          {(docs.data ?? []).map((d) => (
            <div className="field inline" key={d.docType}>
              <input
                type="checkbox"
                id={`doc-${d.docType}`}
                checked={picked.includes(d.docType)}
                onChange={(e) =>
                  setPicked((prev) => (e.target.checked ? [...prev, d.docType] : prev.filter((x) => x !== d.docType)))
                }
              />
              <label htmlFor={`doc-${d.docType}`}>
                {d.label} <span className="muted">({d.docType})</span>
                {!d.isActive ? <span className="badge" style={{ marginLeft: 6 }}>inactive</span> : null}
              </label>
            </div>
          ))}
          {!docs.data?.length ? <p className="muted">No document types exist yet.</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
