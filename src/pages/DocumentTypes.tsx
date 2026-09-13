import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Check, Field, Modal, TableCard, YesNo, useToast } from '../components/ui';
import type { DocumentType } from '../lib/types';

type Draft = { docType: string; label: string; requiresFile: boolean; requiresValue: boolean; isActive: boolean };
const EMPTY: Draft = { docType: '', label: '', requiresFile: true, requiresValue: true, isActive: true };

export default function DocumentTypes() {
  const { data, loading, error, reload } = useResource<DocumentType[]>(
    '/admin/document-types',
    (d) => d.documentTypes ?? [],
  );
  const toast = useToast();
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (creating) {
        await api('/admin/document-types', {
          method: 'POST',
          body: {
            docType: draft.docType.trim(),
            label: draft.label.trim(),
            requiresFile: draft.requiresFile,
            requiresValue: draft.requiresValue,
          },
        });
        toast.push('Document type created');
      } else if (editing) {
        await api(`/admin/document-types/${editing.docType}`, {
          method: 'PATCH',
          body: {
            label: draft.label.trim(),
            requiresFile: draft.requiresFile,
            requiresValue: draft.requiresValue,
            isActive: draft.isActive,
          },
        });
        toast.push('Document type saved');
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
          <h1>Document types</h1>
          <p>
            The credentials a listing can be asked for — a licence, a registration certificate. Which categories owe
            which document is set on the next page.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setDraft(EMPTY);
            setCreating(true);
          }}
        >
          New document type
        </button>
      </div>

      <TableCard
        title="Document types"
        count={data?.length}
        loading={loading}
        error={error}
        head={['Key', 'Label', 'Needs a file', 'Needs a number', 'Active', '']}
      >
        {(data ?? []).map((d) => (
          <tr key={d.docType}>
            <td>
              <code>{d.docType}</code>
            </td>
            <td>{d.label}</td>
            <td>
              <YesNo value={d.requiresFile} />
            </td>
            <td>
              <YesNo value={d.requiresValue} />
            </td>
            <td>
              <YesNo value={d.isActive} />
            </td>
            <td className="actions">
              <button
                className="small"
                onClick={() => {
                  setDraft({ ...d });
                  setEditing(d);
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
          title={creating ? 'New document type' : `Edit ${editing?.docType}`}
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
              <button
                className="primary"
                onClick={() => void save()}
                disabled={busy || (creating && (!draft.docType.trim() || !draft.label.trim()))}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {creating ? (
            <Field label="Key" hint="Lowercase with underscores, e.g. driving_licence. Fixed once created.">
              <input value={draft.docType} onChange={(e) => setDraft({ ...draft, docType: e.target.value })} autoFocus />
            </Field>
          ) : null}
          <Field label="Label" hint="What the provider is asked for.">
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Check
            label="Requires a file upload"
            checked={draft.requiresFile}
            onChange={(v) => setDraft({ ...draft, requiresFile: v })}
          />
          <Check
            label="Requires a reference number"
            checked={draft.requiresValue}
            onChange={(v) => setDraft({ ...draft, requiresValue: v })}
          />
          {!creating ? (
            <Check label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
