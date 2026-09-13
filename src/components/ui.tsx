import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

/* ---------------------------------------------------------------- toasts */

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
type ToastApi = { push: (text: string, kind?: 'ok' | 'error') => void };

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={t.kind === 'error' ? 'toast error' : 'toast'}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/* ----------------------------------------------------------------- modal */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  // Escape closes. Without it a modal opened by mistake has to be dismissed by
  // hunting for the button, which is worse on a dense admin screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="link" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="field inline">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} id={label} />
      <label htmlFor={label}>{label}</label>
    </div>
  );
}

/* ---------------------------------------------------------------- badges */

export function Badge({ value }: { value: string | null | undefined }) {
  const v = (value ?? '').toLowerCase();
  let kind = '';
  if (['active', 'approved', 'live', 'paid', 'resolved', 'true'].includes(v)) kind = 'ok';
  else if (['under_review', 'identity_under_review', 'pending', 'draft', 'processing', 'coming_soon', 'open'].includes(v))
    kind = 'warn';
  else if (['rejected', 'identity_rejected', 'suspended', 'failed', 'paused'].includes(v)) kind = 'bad';
  else if (['renter', 'provider', 'reviewing'].includes(v)) kind = 'info';
  const text = (value ?? '—').replace(/[_-]+/g, ' ');
  return <span className={kind ? `badge ${kind}` : 'badge'}>{text}</span>;
}

export function YesNo({ value }: { value: boolean }) {
  return <span className={value ? 'badge ok' : 'badge'}>{value ? 'Yes' : 'No'}</span>;
}

/* ----------------------------------------------------------------- table */

/**
 * Tag every cell with the column it belongs to.
 *
 * Narrow screens drop the header row and restack each row as a card, and a
 * value with no label is unreadable there — "active" on its own says nothing.
 * Doing it here rather than in each page means the thirteen tables all got it
 * at once, and a column added later cannot forget.
 *
 * Deliberately shallow: it walks rows, then the cells directly inside them,
 * and touches nothing else. A row built some other way keeps rendering, just
 * without labels.
 */
function withColumnLabels(rows: ReactNode, head: string[]): ReactNode {
  return Children.map(rows, (row) => {
    if (!isValidElement(row) || row.type !== 'tr') return row;
    const cells = Children.toArray((row.props as { children?: ReactNode }).children);
    let column = 0;
    const labelled = cells.map((cell) => {
      if (!isValidElement(cell) || cell.type !== 'td') return cell;
      const label = head[column] ?? '';
      column += 1;
      if (!label) return cell;
      return cloneElement(cell as ReactElement<Record<string, unknown>>, { 'data-label': label });
    });
    return cloneElement(row as ReactElement<Record<string, unknown>>, undefined, labelled);
  });
}

export function TableCard({
  title,
  sub,
  actions,
  head,
  children,
  loading,
  error,
  empty,
  count,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  head: string[];
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: string;
  count?: number;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>
          {title} {count !== undefined ? <span className="sub">· {count}</span> : null}
          {sub ? <div className="sub">{sub}</div> : null}
        </h2>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
      {error ? (
        <div className="card-body">
          <div className="error-banner">{error}</div>
        </div>
      ) : loading ? (
        <div className="loading">Loading…</div>
      ) : count === 0 ? (
        <div className="empty">{empty ?? 'Nothing here yet.'}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h} className={h === '' ? 'nowrap' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{withColumnLabels(children, head)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- confirm */

export function ConfirmButton({
  label,
  confirmLabel,
  title,
  body,
  onConfirm,
  className,
  needsReason,
  reasonLabel,
}: {
  label: string;
  confirmLabel?: string;
  title: string;
  body?: ReactNode;
  onConfirm: (reason: string) => Promise<void> | void;
  className?: string;
  needsReason?: boolean;
  reasonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button className={className ?? 'small'} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <Modal
          title={title}
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <button onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm(reason);
                    setOpen(false);
                    setReason('');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Working…' : confirmLabel ?? 'Confirm'}
              </button>
            </>
          }
        >
          {body}
          {needsReason ? (
            <Field label={reasonLabel ?? 'Note'} hint="Stored on the record and shown to the user.">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
