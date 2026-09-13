import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime } from '../lib/format';
import { useToast } from '../components/ui';
import type { Setting } from '../lib/types';

const GROUP_LABELS: Record<string, string> = {
  money: 'Money',
  booking: 'Booking policy',
  listings: 'Listings',
  markets: 'Markets',
  discovery: 'Discovery',
  banners: 'Banners',
  content: 'Uploads and chat',
  location: 'Live location',
  limits: 'Rate limits',
  auth: 'Sign-in and OTP',
  abuse: 'Abuse budgets',
};

/**
 * Display order, because the server sorts by group name and alphabetical puts
 * `abuse` and `auth` — the two nobody edits day to day — above the money keys
 * people came here for. Groups not listed fall to the bottom in whatever order
 * they arrived, so a new group on the server shows up without a release.
 */
const GROUP_ORDER = [
  'money',
  'booking',
  'listings',
  'discovery',
  'location',
  'content',
  'banners',
  'markets',
  'limits',
  'auth',
  'abuse',
];

const TIER_NOTE =
  'Authentication and abuse limits. Only a super admin can change these — everyone with the settings ' +
  'permission can read them, because an admin who cannot see the lockout window cannot explain it to anyone.';

/**
 * One row per knob, saved individually.
 *
 * A "save everything" button would be worse here: each key is validated and
 * audited on its own (`PATCH /admin/settings/{key}`), so a bulk save that
 * half-succeeded would leave the screen unable to say which half.
 */
function Row({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const [value, setValue] = useState(setting.value);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const dirty = value !== setting.value;
  // `canEdit` comes from the server, which enforces it either way. Rendering it
  // here is so an admin without the tier sees a locked row and the reason for
  // it, rather than a live-looking field that answers 403 on save.
  const locked = !setting.canEdit;

  async function save(next?: string) {
    const payload = next ?? value;
    setBusy(true);
    try {
      await api(`/admin/settings/${setting.key}`, {
        method: 'PATCH',
        body: { value: setting.type === 'bool' ? payload === 'true' : payload },
      });
      toast.push(`${setting.label} saved`);
      onSaved();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not save', 'error');
      setValue(setting.value);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await api(`/admin/settings/${setting.key}`, { method: 'DELETE' });
      toast.push(`${setting.label} reset to default`);
      onSaved();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not reset', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td data-label="Setting">
        <div>
          <strong>{setting.label}</strong>
        </div>
        <div className="muted">{setting.description}</div>
        <div className="muted" style={{ marginTop: 2 }}>
          <code>{setting.key}</code>
          {setting.min || setting.max ? ` · allowed ${setting.min ?? '−∞'} to ${setting.max ?? '∞'}` : ''}
        </div>
        {setting.tier === 'super' ? (
          <div style={{ marginTop: 6 }}>
            <span className="badge warn">{locked ? 'Super admin only' : 'Super admin'}</span>
          </div>
        ) : null}
      </td>
      <td data-label="Value" style={{ minWidth: 190 }}>
        {setting.type === 'bool' ? (
          <select
            value={value}
            disabled={busy || locked}
            onChange={(e) => {
              setValue(e.target.value);
              void save(e.target.value);
            }}
          >
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        ) : (
          <input
            value={value}
            disabled={busy || locked}
            inputMode={setting.type === 'timezone' ? 'text' : 'decimal'}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dirty && void save()}
          />
        )}
      </td>
      <td data-label="State" className="nowrap">
        <div className="muted">default {setting.default}</div>
        {setting.isOverridden ? (
          <div className="muted">changed {dateTime(setting.updatedAt)}</div>
        ) : (
          <div className="muted">using default</div>
        )}
      </td>
      <td className="actions">
        <div className="row end">
          <button className="small primary" disabled={!dirty || busy || locked} onClick={() => void save()}>
            Save
          </button>
          <button
            className="small"
            disabled={!setting.isOverridden || busy || locked}
            onClick={() => void reset()}
          >
            Reset
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Settings() {
  const { data, loading, error, reload } = useResource<Setting[]>('/admin/settings', (d) => d.settings ?? []);

  const groups = useMemo(() => {
    const out = new Map<string, Setting[]>();
    for (const s of data ?? []) {
      const list = out.get(s.group) ?? [];
      list.push(s);
      out.set(s.group, list);
    }
    const rank = (group: string) => {
      const index = GROUP_ORDER.indexOf(group);
      return index === -1 ? GROUP_ORDER.length : index;
    };
    return Array.from(out.entries()).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [data]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Platform settings</h1>
          <p>
            Live values — a change takes effect on the next request, with no deploy. Money and policy keys are frozen
            onto each booking when it is created, so changing one never rewrites a booking that already exists.
          </p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="loading">Loading…</div> : null}

      {groups.map(([group, settings]) => (
        <div className="card" key={group}>
          <div className="card-head">
            <h2>{GROUP_LABELS[group] ?? group}</h2>
            {settings.every((s) => s.tier === 'super') ? <p className="muted">{TIER_NOTE}</p> : null}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  // The value is part of the key on purpose. Row keeps the edit
                  // in local state, so after a save or a reset reloads the list
                  // React would reuse the instance and keep showing the old
                  // number while the server held a different one — a panel that
                  // lies about the value it just changed. Remounting on a
                  // server-value change costs nothing: it only fires after a
                  // reload, never while someone is typing.
                  <Row key={`${s.key}:${s.value}`} setting={s} onSaved={reload} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
