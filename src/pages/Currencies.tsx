import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Check, Field, Modal, TableCard, YesNo, useToast } from '../components/ui';
import { dateTime } from '../lib/format';
import type { Currency } from '../lib/types';

type Draft = { rate: string; symbol: string; locale: string; decimalDigits: number; isActive: boolean };

export default function Currencies() {
  const { data, loading, error, reload } = useResource<Currency[]>('/admin/currencies', (d) => d.currencies ?? []);
  const toast = useToast();
  const [editing, setEditing] = useState<Currency | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing || !draft) return;
    setBusy(true);
    try {
      await api(`/admin/currencies/${editing.code}`, {
        method: 'PATCH',
        body: {
          rate: draft.rate,
          symbol: draft.symbol,
          locale: draft.locale,
          decimalDigits: draft.decimalDigits,
          isActive: draft.isActive,
        },
      });
      toast.push(`${editing.code} saved`);
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
          <h1>Currencies</h1>
          <p>Display currencies and their rate against the base. Prices are stored in the listing's own currency.</p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      <TableCard
        title="Currencies"
        count={data?.length}
        loading={loading}
        error={error}
        head={['Code', 'Symbol', 'Rate', 'Locale', 'Decimals', 'Active', 'Updated', '']}
      >
        {(data ?? []).map((c) => (
          <tr key={c.code}>
            <td>
              <strong>{c.code}</strong>
            </td>
            <td style={{ fontSize: 16 }}>{c.symbol}</td>
            <td>{c.rate}</td>
            <td>{c.locale}</td>
            <td>{c.decimalDigits}</td>
            <td>
              <YesNo value={c.isActive} />
            </td>
            <td className="nowrap">{dateTime(c.updatedAt)}</td>
            <td className="actions">
              <button
                className="small"
                onClick={() => {
                  setDraft({
                    rate: c.rate,
                    symbol: c.symbol,
                    locale: c.locale,
                    decimalDigits: c.decimalDigits,
                    isActive: c.isActive,
                  });
                  setEditing(c);
                }}
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </TableCard>

      {editing && draft ? (
        <Modal
          title={`Edit ${editing.code}`}
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
          <div className="field-grid">
            <Field label="Rate" hint="Units of this currency per one unit of the base.">
              <input value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} inputMode="decimal" />
            </Field>
            <Field label="Symbol">
              <input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
            </Field>
            <Field label="Locale" hint="e.g. en_IN — decides grouping and placement.">
              <input value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value })} />
            </Field>
            <Field label="Decimal digits">
              <input
                type="number"
                value={draft.decimalDigits}
                onChange={(e) => setDraft({ ...draft, decimalDigits: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Check label="Active" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
        </Modal>
      ) : null}
    </>
  );
}
