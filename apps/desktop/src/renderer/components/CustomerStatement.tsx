import { createPortal } from 'react-dom';
import type { CustomerStatement as Statement, AgingBuckets } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './CustomerStatement.module.css';

interface Props {
  statement: Statement;
  onClose?: () => void;
}

const AGING_ROWS: { key: keyof AgingBuckets; label: string }[] = [
  { key: 'bucket_0_30',     label: 'Current (0–30 days)' },
  { key: 'bucket_31_60',    label: '31–60 days' },
  { key: 'bucket_61_90',    label: '61–90 days' },
  { key: 'bucket_91_180',   label: '91–180 days' },
  { key: 'bucket_181_365',  label: '181–365 days' },
  { key: 'bucket_over_365', label: 'Over 1 year' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Open',
  confirmed: 'Confirmed',
  picked: 'Picked',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function agingTotal(b: AgingBuckets): number {
  return AGING_ROWS.reduce((s, r) => s + b[r.key].amount, 0);
}

export function CustomerStatement({ statement, onClose }: Props) {
  const handlePrint = async () => {
    const api = window.electronAPI;
    if (api?.printPreview) {
      try {
        await api.printPreview();
        return;
      } catch (err) {
        console.warn('In-app PDF preview failed, falling back to system viewer', err);
        try {
          await api.printSystemPreview?.();
          return;
        } catch (err2) {
          console.warn('System PDF preview failed, falling back to window.print', err2);
        }
      }
    }
    window.print();
  };

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.previewCard}>
          <div className={styles.previewActions}>
            <button className={styles.printBtn} onClick={handlePrint}>🖨 Print</button>
            {onClose && <button className={styles.closeBtn} onClick={onClose}>✕ Close</button>}
          </div>
          <StatementContent statement={statement} />
        </div>
      </div>

      {createPortal(
        <div className={`${styles.printOnly} print-target`}>
          <StatementContent statement={statement} />
        </div>,
        document.body,
      )}
    </>
  );
}

function StatementContent({ statement }: { statement: Statement }) {
  const { customer, range, ordersInRange, totals, aging } = statement;
  const totalUnpaid = agingTotal(aging);

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.brandName}>Bread Faculty</h1>
          <p className={styles.brandSub}>Premium Bakery & Confectionery</p>
          <div className={styles.brandDetails}>
            <p>Prono Street, Tema, Ghana</p>
            <p>+233 277120057</p>
          </div>
        </div>
        <div className={styles.docMeta}>
          <h2 className={styles.docTitle}>STATEMENT</h2>
          <div className={styles.metaGrid}>
            <div className={styles.metaLabel}>Issued</div>
            <div className={styles.metaValue}>{fmt(new Date().toISOString())}</div>
            <div className={styles.metaLabel}>Period</div>
            <div className={styles.metaValue}>{fmt(range.from)} – {fmt(range.to)}</div>
            <div className={styles.metaLabel}>Customer since</div>
            <div className={styles.metaValue}>{fmt(customer.customerSince)}</div>
          </div>
        </div>
      </div>

      <div className={styles.billTo}>
        <h3 className={styles.sectionHeading}>STATEMENT FOR</h3>
        <p className={styles.customerName}>{customer.name}</p>
        {customer.phone   && <p>{customer.phone}</p>}
        {customer.email   && <p>{customer.email}</p>}
        {customer.address && <p>{customer.address}</p>}
      </div>

      <table className={styles.ordersTable}>
        <thead>
          <tr>
            <th>DATE</th>
            <th>ORDER #</th>
            <th>STATUS</th>
            <th style={{ textAlign: 'center' }}>ITEMS</th>
            <th style={{ textAlign: 'right' }}>TOTAL</th>
            <th style={{ textAlign: 'right' }}>PAID</th>
            <th style={{ textAlign: 'right' }}>BALANCE</th>
          </tr>
        </thead>
        <tbody>
          {ordersInRange.length === 0 ? (
            <tr>
              <td colSpan={7} className={styles.empty}>No orders in this period.</td>
            </tr>
          ) : (
            ordersInRange.map((o) => (
              <tr key={o.id}>
                <td>{fmt(o.createdAt)}</td>
                <td className={styles.mono}>{o.orderNumber}</td>
                <td>{STATUS_LABEL[o.status] ?? o.status}</td>
                <td style={{ textAlign: 'center' }}>{o.itemCount}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(o.total)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(o.amountPaid)}</td>
                <td
                  style={{ textAlign: 'right' }}
                  className={o.balanceDue > 0 ? styles.balanceHi : ''}
                >
                  {formatCurrency(o.balanceDue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className={styles.footerSection}>

        <div className={styles.agingBox}>
          <h3 className={styles.sectionHeading}>AR AGING (ALL UNPAID INVOICES)</h3>
          <table className={styles.agingTable}>
            <tbody>
              {AGING_ROWS.map((r) => {
                const seg = aging[r.key];
                return (
                  <tr key={r.key}>
                    <td className={r.key === 'bucket_over_365' ? styles.agingOver : ''}>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>{seg.count}</td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={r.key === 'bucket_over_365' ? styles.agingOver : ''}
                    >
                      {formatCurrency(seg.amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className={styles.agingTotalRow}>
                <td>Total outstanding</td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(totalUnpaid)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Purchased (this period)</span>
            <span>{formatCurrency(totals.purchased)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Paid (this period)</span>
            <span>{formatCurrency(totals.paid)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>Outstanding (this period)</span>
            <span>{formatCurrency(totals.outstanding)}</span>
          </div>
          <div className={styles.grandTotal}>
            <span>TOTAL OUTSTANDING (ALL TIME)</span>
            <span>{formatCurrency(totalUnpaid)}</span>
          </div>
          {customer.creditBalance !== 0 && (
            <div className={styles.creditRow}>
              <span>Credit balance</span>
              <span>{formatCurrency(customer.creditBalance)}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.signatures}>
        <div className={styles.sigBlock}>
          <div className={styles.sigLine} />
          <p>Authorized Signature</p>
        </div>
        <div className={styles.sigBlock}>
          <div className={styles.sigLine} />
          <p>Customer Signature & Date</p>
        </div>
      </div>

      <div className={styles.footerBrand}>
        <p>Please remit outstanding balances within 30 days of statement issue.</p>
        <p className={styles.footerSmall}>For queries: +233 277120057</p>
      </div>

    </div>
  );
}
