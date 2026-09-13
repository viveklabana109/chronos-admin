import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime, humanise } from '../lib/format';
import { Badge, Modal, TableCard, useToast } from '../components/ui';
import type { Report } from '../lib/types';

const STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'];

export default function Reports() {
  const [status, setStatus] = useState('');
  const path = status ? `/admin/reports?status=${status}` : '/admin/reports';
  const { data, loading, error, reload } = useResource<Report[]>(path, (d) => d.reports ?? [], [status]);
  const toast = useToast();
  const [open, setOpen] = useState<Report | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  async function setReportStatus(id: string, next: string) {
    try {
      await api(`/admin/reports/${id}`, { method: 'PATCH', body: { status: next } });
      toast.push(`Marked ${next}`);
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not update', 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>What users have flagged — profiles, listings, messages.</p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      <TableCard
        title="Reports"
        count={rows.length}
        loading={loading}
        error={error}
        empty="Nothing has been reported."
        head={['Target', 'Reason', 'Reported', 'Status', '']}
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanise(s)}
              </option>
            ))}
          </select>
        }
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{humanise(r.targetType)}</strong>
              <div className="muted">{r.targetId}</div>
            </td>
            <td>
              <div>{humanise(r.reason)}</div>
              {r.details ? <div className="muted">{String(r.details).slice(0, 90)}</div> : null}
            </td>
            <td className="nowrap">{dateTime(r.createdAt)}</td>
            <td>
              <Badge value={r.status} />
            </td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => setOpen(r)}>
                  Details
                </button>
                <select
                  value={r.status}
                  onChange={(e) => void setReportStatus(r.id, e.target.value)}
                  style={{ width: 'auto' }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanise(s)}
                    </option>
                  ))}
                </select>
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

      {open ? (
        <Modal title="Report" onClose={() => setOpen(null)}>
          <dl className="kv">
            {Object.entries(open).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{humanise(k)}</dt>
                <dd style={{ wordBreak: 'break-word' }}>
                  {v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}
    </>
  );
}
