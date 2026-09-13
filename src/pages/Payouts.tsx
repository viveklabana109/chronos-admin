import { useMemo, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { dateTime, humanise, money } from '../lib/format';
import { Badge, ConfirmButton, Modal, TableCard, useToast } from '../components/ui';
import type { Payout } from '../lib/types';

/**
 * Settlement is manual by design: the platform records that a payout was sent,
 * it does not send it. Marking one paid here is a bookkeeping entry made after
 * the bank transfer has actually happened elsewhere — which is why both actions
 * ask for confirmation and the failure path wants a reason.
 */
export default function Payouts() {
  const [status, setStatus] = useState('');
  const path = status ? `/admin/payouts?status=${status}` : '/admin/payouts';
  const { data, loading, error, reload } = useResource<Payout[]>(path, (d) => d.payouts ?? [], [status]);
  const toast = useToast();
  const [open, setOpen] = useState<Payout | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  async function settle(id: string, next: 'paid' | 'failed', reason: string) {
    try {
      await api(`/admin/payouts/${id}`, {
        method: 'PATCH',
        body: { status: next, reason: reason || undefined },
      });
      toast.push(next === 'paid' ? 'Marked paid' : 'Marked failed');
      await reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Could not update', 'error');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payouts</h1>
          <p>
            Withdrawal requests from providers. The transfer itself happens in your bank — record the outcome here once
            it has.
          </p>
        </div>
        <button onClick={() => void reload()}>Refresh</button>
      </div>

      <div className="warn-banner">
        Marking a payout <strong>paid</strong> does not move any money. It only records that you already sent it.
      </div>

      <TableCard
        title="Payouts"
        count={rows.length}
        loading={loading}
        error={error}
        empty="No payout requests."
        head={['Payout', 'Amount', 'Method', 'Requested', 'Status', '']}
        actions={
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        }
      >
        {rows.map((p) => (
          <tr key={p.id}>
            <td>
              <strong>{p.id}</strong>
              <div className="muted">{p.userId}</div>
            </td>
            <td className="nowrap">{money(p.amount as number, (p.currency as string) ?? 'INR')}</td>
            <td>{humanise(p.method)}</td>
            <td className="nowrap">{dateTime(p.createdAt)}</td>
            <td>
              <Badge value={p.status} />
              {p.reason ? <div className="muted">{String(p.reason)}</div> : null}
            </td>
            <td className="actions">
              <div className="row end">
                <button className="small" onClick={() => setOpen(p)}>
                  Details
                </button>
                {(p.status ?? '').toLowerCase() === 'processing' ? (
                  <>
                    <ConfirmButton
                      className="small ok"
                      label="Mark paid"
                      confirmLabel="Mark paid"
                      title="Record this payout as sent?"
                      body={
                        <p>
                          Only do this once the bank transfer has gone out. It releases the provider's record of the
                          withdrawal and cannot be undone by marking it paid again.
                        </p>
                      }
                      needsReason
                      reasonLabel="Reference (optional)"
                      onConfirm={(reason) => settle(p.id, 'paid', reason)}
                    />
                    <ConfirmButton
                      className="small danger"
                      label="Mark failed"
                      confirmLabel="Mark failed"
                      title="Record this payout as failed?"
                      body={<p>The amount returns to the provider's withdrawable balance.</p>}
                      needsReason
                      reasonLabel="What went wrong"
                      onConfirm={(reason) => settle(p.id, 'failed', reason)}
                    />
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

      {open ? (
        <Modal title={`Payout ${open.id}`} onClose={() => setOpen(null)}>
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
