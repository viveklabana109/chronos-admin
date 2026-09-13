import { useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { Badge, ConfirmButton, Field, Modal, TableCard, useToast } from '../components/ui';
import { fromCsv, toCsv } from '../lib/format';
import type { Market, MarketCity } from '../lib/types';

/**
 * Markets are hierarchical: a country row first, then cities under it. The API
 * refuses a city whose country does not exist yet ("Add X as a country before
 * adding cities"), so the create form always starts from an existing country.
 */

type CreateDraft = {
  country: string;
  city: string;
  countryCode: string;
  timezone: string;
  status: string;
  sortOrder: number;
  note: string;
  aliases: string;
};

type EditDraft = {
  displayName: string;
  countryCode: string;
  timezone: string;
  status: string;
  sortOrder: number;
  note: string;
  aliases: string;
};

const EMPTY_CREATE: CreateDraft = {
  country: '',
  city: '',
  countryCode: '',
  timezone: '',
  status: 'live',
  sortOrder: 0,
  note: '',
  aliases: '',
};

export default function Markets() {
  const { data, loading, error, reload } = useResource<Market[]>('/admin/markets', (d) => d.markets ?? []);
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE);
  const [editing, setEditing] = useState<{ id: string; name: string; isCity: boolean } | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api('/admin/markets', {
        method: 'POST',
        body: {
          country: createDraft.country.trim(),
          city: createDraft.city.trim() || undefined,
          countryCode: createDraft.countryCode.trim() || undefined,
          timezone: createDraft.timezone.trim() || undefined,
          status: createDraft.status,
          sortOrder: createDraft.sortOrder,
          note: createDraft.note.trim() || undefined,
          aliases: toCsv(fromCsv(createDraft.aliases)) || undefined,
        },
      });
      toast.push(createDraft.city ? 'City added' : 'Country added');
      setCreating(false);
      setCreateDraft(EMPTY_CREATE);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not create', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editDraft) return;
    setBusy(true);
    try {
      await api(`/admin/markets/${editing.id}`, {
        method: 'PATCH',
        body: {
          displayName: editDraft.displayName.trim() || undefined,
          countryCode: editDraft.countryCode.trim() || undefined,
          timezone: editDraft.timezone.trim() || undefined,
          status: editDraft.status,
          sortOrder: editDraft.sortOrder,
          note: editDraft.note,
          aliases: toCsv(fromCsv(editDraft.aliases)),
        },
      });
      toast.push('Market saved');
      setEditing(null);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: Market | MarketCity, isCity: boolean) {
    const name = isCity ? (row as MarketCity).city : (row as Market).country;
    setEditDraft({
      displayName: name,
      countryCode: isCity ? '' : (row as Market).countryCode,
      timezone: row.timezone,
      status: row.status,
      sortOrder: row.sortOrder,
      note: row.note ?? '',
      aliases: toCsv(row.aliasKeys ?? []),
    });
    setEditing({ id: row.id, name, isCity });
  }

  async function remove(id: string, name: string) {
    try {
      await api(`/admin/markets/${id}`, { method: 'DELETE' });
      toast.push(`${name} removed`);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not remove', 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Markets</h1>
          <p>
            Where the platform operates. The gate reads a provider's <em>identity</em> city, so opening a city here is
            what lets people there create listings.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setCreateDraft(EMPTY_CREATE);
            setCreating(true);
          }}
        >
          Add market
        </button>
      </div>

      <TableCard
        title="Markets"
        count={data?.length}
        loading={loading}
        error={error}
        head={['Place', 'Status', 'Timezone', 'Aliases', 'Order', '']}
        empty="No markets yet — add a country first."
      >
        {(data ?? []).flatMap((m) => [
          <tr key={m.id}>
            <td>
              <strong>{m.country}</strong> {m.countryCode ? <span className="muted">{m.countryCode}</span> : null}
              {m.note ? <div className="muted">{m.note}</div> : null}
            </td>
            <td>
              <Badge value={m.status} />
            </td>
            <td className="nowrap">{m.timezone || '—'}</td>
            <td>{m.aliasKeys?.join(', ') || <span className="muted">—</span>}</td>
            <td>{m.sortOrder}</td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => openEdit(m, false)}>
                  Edit
                </button>
                <ConfirmButton
                  className="small danger"
                  label="Remove"
                  confirmLabel="Remove country"
                  title={`Remove ${m.country}?`}
                  body={<p>Its cities go with it, and nobody there can create a listing afterwards.</p>}
                  onConfirm={() => remove(m.id, m.country)}
                />
              </div>
            </td>
          </tr>,
          ...(m.cities ?? []).map((c) => (
            <tr key={c.id}>
              <td style={{ paddingLeft: 34 }}>
                {c.city}
                {c.note ? <div className="muted">{c.note}</div> : null}
              </td>
              <td>
                <Badge value={c.status} />
              </td>
              <td className="nowrap">{c.timezone || '—'}</td>
              <td>{c.aliasKeys?.join(', ') || <span className="muted">—</span>}</td>
              <td>{c.sortOrder}</td>
              <td className="actions">
                <div className="row end">
                  <button className="small" onClick={() => openEdit(c, true)}>
                    Edit
                  </button>
                  <ConfirmButton
                    className="small danger"
                    label="Remove"
                    confirmLabel="Remove city"
                    title={`Remove ${c.city}?`}
                    body={<p>Providers whose identity names this city can no longer create listings.</p>}
                    onConfirm={() => remove(c.id, c.city)}
                  />
                </div>
              </td>
            </tr>
          )),
        ])}
      </TableCard>

      {creating ? (
        <Modal
          title="Add market"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" onClick={() => void create()} disabled={busy || !createDraft.country.trim()}>
                {busy ? 'Saving…' : 'Add'}
              </button>
            </>
          }
        >
          <Field label="Country" hint="Must already exist as a country row before you can hang a city off it.">
            <input
              value={createDraft.country}
              onChange={(e) => setCreateDraft({ ...createDraft, country: e.target.value })}
              list="known-countries"
              autoFocus
            />
            <datalist id="known-countries">
              {(data ?? []).map((m) => (
                <option key={m.id} value={m.country} />
              ))}
            </datalist>
          </Field>
          <Field label="City" hint="Leave empty to create the country itself.">
            <input value={createDraft.city} onChange={(e) => setCreateDraft({ ...createDraft, city: e.target.value })} />
          </Field>
          <div className="field-grid">
            <Field label="Country code" hint="Two letters, e.g. IN.">
              <input
                value={createDraft.countryCode}
                onChange={(e) => setCreateDraft({ ...createDraft, countryCode: e.target.value })}
              />
            </Field>
            <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata.">
              <input
                value={createDraft.timezone}
                onChange={(e) => setCreateDraft({ ...createDraft, timezone: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                value={createDraft.status}
                onChange={(e) => setCreateDraft({ ...createDraft, status: e.target.value })}
              >
                <option value="live">Live</option>
                <option value="coming_soon">Coming soon</option>
              </select>
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={createDraft.sortOrder}
                onChange={(e) => setCreateDraft({ ...createDraft, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Aliases" hint="Comma separated — other spellings people type, e.g. “new delhi, delhi ncr”.">
            <input
              value={createDraft.aliases}
              onChange={(e) => setCreateDraft({ ...createDraft, aliases: e.target.value })}
            />
          </Field>
          <Field label="Note">
            <input value={createDraft.note} onChange={(e) => setCreateDraft({ ...createDraft, note: e.target.value })} />
          </Field>
        </Modal>
      ) : null}

      {editing && editDraft ? (
        <Modal
          title={`Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" onClick={() => void saveEdit()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <Field label="Display name">
            <input
              value={editDraft.displayName}
              onChange={(e) => setEditDraft({ ...editDraft, displayName: e.target.value })}
            />
          </Field>
          <div className="field-grid">
            {!editing.isCity ? (
              <Field label="Country code">
                <input
                  value={editDraft.countryCode}
                  onChange={(e) => setEditDraft({ ...editDraft, countryCode: e.target.value })}
                />
              </Field>
            ) : null}
            <Field label="Timezone">
              <input
                value={editDraft.timezone}
                onChange={(e) => setEditDraft({ ...editDraft, timezone: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}>
                <option value="live">Live</option>
                <option value="coming_soon">Coming soon</option>
              </select>
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={editDraft.sortOrder}
                onChange={(e) => setEditDraft({ ...editDraft, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Aliases" hint="Comma separated.">
            <input value={editDraft.aliases} onChange={(e) => setEditDraft({ ...editDraft, aliases: e.target.value })} />
          </Field>
          <Field label="Note">
            <input value={editDraft.note} onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })} />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
