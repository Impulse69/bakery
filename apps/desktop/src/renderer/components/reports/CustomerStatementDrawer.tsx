import { useState, useEffect, useCallback } from 'react';
import { Modal, Button } from '@bakery/ui';
import type { CustomerStatement, AgingBuckets } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { DateRangePicker } from './DateRangePicker';
import type { DateRange } from './DateRangePicker';
import { CustomerStatement as PrintableStatement } from '../CustomerStatement';
import styles from './CustomerStatementDrawer.module.css';

interface Props {
  customerId: string;
  initialRange: DateRange;
  onClose: () => void;
}

const AGING_LABELS: { key: keyof AgingBuckets; label: string; color: string }[] = [
  { key: 'bucket_0_30',    label: '0–30 d',    color: '#2f9e6a' },
  { key: 'bucket_31_60',   label: '31–60 d',   color: '#5ba36d' },
  { key: 'bucket_61_90',   label: '61–90 d',   color: '#c89a3c' },
  { key: 'bucket_91_180',  label: '91–180 d',  color: '#e07b3c' },
  { key: 'bucket_181_365', label: '181–365 d', color: '#c44545' },
  { key: 'bucket_over_365',label: '> 365 d',   color: '#7a1f1f' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Open',
  confirmed: 'Confirmed',
  picked: 'Picked',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
  });
}

function rangeToParams(r: DateRange): string {
  const p = new URLSearchParams();
  p.set('from', new Date(r.from).toISOString());
  p.set('to', new Date(r.to + 'T23:59:59').toISOString());
  return p.toString();
}

function agingTotal(b: AgingBuckets): number {
  return AGING_LABELS.reduce((sum, x) => sum + b[x.key].amount, 0);
}

export function CustomerStatementDrawer({ customerId, initialRange, onClose }: Props) {
  const { showToast } = useToast();
  const [range, setRange] = useState<DateRange>(initialRange);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintable, setShowPrintable] = useState(false);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<CustomerStatement>(
        `/customers/${customerId}/statement?${rangeToParams(range)}`,
      );
      setStatement(data);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load statement', 'error');
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, range, showToast]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const title = statement ? `Statement — ${statement.customer.name}` : 'Customer Statement';

  return (
    <Modal isOpen onClose={onClose} title={title} size="lg">
      {loading && !statement ? (
        <p className={styles.loading}>Loading statement…</p>
      ) : !statement ? (
        <p className={styles.empty}>No statement available.</p>
      ) : (
        <div className={styles.body}>
          <CustomerHeader customer={statement.customer} />

          <DateRangePicker value={range} onChange={setRange} />

          <div className={styles.totalsRow}>
            <Totals
              label="Purchased (in range)"
              value={formatCurrency(statement.totals.purchased)}
              meta={`${statement.totals.orderCount} order${statement.totals.orderCount === 1 ? '' : 's'}`}
            />
            <Totals label="Paid" value={formatCurrency(statement.totals.paid)} accent="green" />
            <Totals label="Outstanding (in range)" value={formatCurrency(statement.totals.outstanding)} accent="red" />
            <Totals label="Credit balance (current)" value={formatCurrency(statement.customer.creditBalance)} />
          </div>

          <AgingSection aging={statement.aging} />

          <OrdersTable orders={statement.ordersInRange} />

          <TopProductsList items={statement.topProductsInRange} />

          <div className={styles.footer}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={() => setShowPrintable(true)}>🧾 Print Statement</Button>
          </div>
        </div>
      )}

      {showPrintable && statement && (
        <PrintableStatement
          statement={statement}
          onClose={() => setShowPrintable(false)}
        />
      )}
    </Modal>
  );
}

/* ── pieces ───────────────────────────────────────────────────── */

function CustomerHeader({ customer }: { customer: CustomerStatement['customer'] }) {
  return (
    <div className={styles.customerHeader}>
      <div>
        <div className={styles.customerName}>{customer.name}</div>
        <div className={styles.customerMeta}>
          {customer.phone && <span>{customer.phone}</span>}
          {customer.email && <span>{customer.email}</span>}
          <span>Customer since {fmtDate(customer.customerSince)}</span>
        </div>
        {customer.address && <div className={styles.customerAddress}>{customer.address}</div>}
      </div>
    </div>
  );
}

interface TotalsProps {
  label: string;
  value: string;
  meta?: string;
  accent?: 'green' | 'red';
}

function Totals({ label, value, meta, accent }: TotalsProps) {
  const cls = accent === 'green' ? styles.tileGreen : accent === 'red' ? styles.tileRed : '';
  return (
    <div className={`${styles.tile} ${cls}`}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
      {meta && <div className={styles.tileMeta}>{meta}</div>}
    </div>
  );
}

function AgingSection({ aging }: { aging: AgingBuckets }) {
  const total = agingTotal(aging);
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>Outstanding invoices — aging</h4>
        <span className={styles.sectionMeta}>{formatCurrency(total)} total unpaid</span>
      </div>
      {total <= 0 ? (
        <div className={styles.agingClean}>All invoices paid — no outstanding balance.</div>
      ) : (
        <>
          <div className={styles.agingBar}>
            {AGING_LABELS.map((b) => {
              const seg = aging[b.key];
              const pct = total > 0 ? (seg.amount / total) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={b.key}
                  className={styles.agingSeg}
                  style={{ flexBasis: `${pct}%`, background: b.color }}
                  title={`${b.label}: ${seg.count} invoices · ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div className={styles.agingLegend}>
            {AGING_LABELS.map((b) => {
              const seg = aging[b.key];
              return (
                <div key={b.key} className={styles.agingLegendItem}>
                  <span className={styles.agingDot} style={{ background: b.color }} />
                  <div>
                    <div className={styles.agingLegendLabel}>{b.label}</div>
                    <div className={styles.agingLegendAmount}>{formatCurrency(seg.amount)}</div>
                    <div className={styles.agingLegendCount}>
                      {seg.count} {seg.count === 1 ? 'invoice' : 'invoices'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OrdersTable({ orders }: { orders: CustomerStatement['ordersInRange'] }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Orders in range</h4>
      {orders.length === 0 ? (
        <p className={styles.emptyInline}>No orders in this range.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order #</th>
                <th className={styles.right}>Items</th>
                <th className={styles.right}>Total</th>
                <th className={styles.right}>Paid</th>
                <th className={styles.right}>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{fmtDate(o.createdAt)}</td>
                  <td className={styles.mono}>{o.orderNumber}</td>
                  <td className={styles.right}>{o.itemCount}</td>
                  <td className={styles.right}>{formatCurrency(o.total)}</td>
                  <td className={styles.right}>{formatCurrency(o.amountPaid)}</td>
                  <td className={`${styles.right} ${o.balanceDue > 0 ? styles.neg : styles.dim}`}>
                    {formatCurrency(o.balanceDue)}
                  </td>
                  <td>
                    <span className={`${styles.statusChip} ${styles[`s_${o.status}`] ?? ''}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopProductsList({ items }: { items: CustomerStatement['topProductsInRange'] }) {
  if (items.length === 0) return null;
  const maxQty = Math.max(...items.map((i) => i.quantity), 1);
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Top products bought</h4>
      <div className={styles.productsList}>
        {items.map((p) => (
          <div key={p.name} className={styles.productRow}>
            <span className={styles.productName}>{p.name}</span>
            <div className={styles.productTrack}>
              <div className={styles.productFill} style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
            </div>
            <span className={styles.productQty}>{p.quantity}</span>
            <span className={styles.productRev}>{formatCurrency(p.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
