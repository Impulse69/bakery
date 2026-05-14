import { Modal } from '@bakery/ui';
import type { HistoryRow, DerivedStatus } from './BatchHistory';
import styles from './BatchHistoryDetailModal.module.css';

interface Props {
  open: boolean;
  dayDate: string;
  row: HistoryRow | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<DerivedStatus, string> = {
  hit: 'Target hit',
  short: 'Short',
  surplus: 'Surplus',
  failed: 'Failed',
  in_progress: 'In progress',
};

function formatDayHeader(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function batchStatusLabel(status: 'in_progress' | 'completed' | 'failed'): string {
  if (status === 'in_progress') return 'In progress';
  if (status === 'failed') return 'Failed';
  return 'Completed';
}

export function BatchHistoryDetailModal({ open, dayDate, row, onClose }: Props) {
  return (
    <Modal isOpen={open} onClose={onClose} title="" size="lg">
      {row && (
        <div className={styles.body}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Production Details</span>
            <h2 className={styles.title}>{formatDayHeader(dayDate)}</h2>
            <p className={styles.product}>{row.productName}</p>
          </div>

          {/* Product totals */}
          <div className={styles.totals}>
            <div className={styles.totalCell}>
              <span className={styles.totalLabel}>Target</span>
              <span className={styles.totalValue}>{row.target.toLocaleString()}</span>
            </div>
            <div className={styles.totalCell}>
              <span className={styles.totalLabel}>Carry-over</span>
              <span className={styles.totalValue}>{row.carryOver.toLocaleString()}</span>
            </div>
            <div className={styles.totalCell}>
              <span className={styles.totalLabel}>Actual produced</span>
              <span className={styles.totalValue}>{row.actualProduced.toLocaleString()}</span>
            </div>
            <div className={styles.totalCell}>
              <span className={styles.totalLabel}>Shortage</span>
              <span className={`${styles.totalValue} ${row.shortage > 0 ? styles.totalShort : ''}`}>
                {row.shortage.toLocaleString()}
              </span>
            </div>
            <div className={styles.totalCell}>
              <span className={styles.totalLabel}>Status</span>
              <span className={`${styles.statusPill} ${styles[`status_${row.derivedStatus}`]}`}>
                {STATUS_LABEL[row.derivedStatus]}
              </span>
            </div>
          </div>

          {/* Per-batch */}
          <div className={styles.batchHeading}>
            <span className={styles.batchEyebrow}>Batches</span>
            <span className={styles.batchCount}>{row.batches.length}</span>
          </div>

          <div className={styles.batchList}>
            {row.batches.length === 0 ? (
              <p className={styles.noBatches}>No batches were logged for this product on this day.</p>
            ) : (
              row.batches.map((b) => (
                <div key={b.id} className={styles.batchCard}>
                  <div className={styles.batchTop}>
                    <span className={styles.batchNum}>{b.batchNumber}</span>
                    <span className={`${styles.batchStatus} ${styles[`batchStatus_${b.status}`]}`}>
                      {batchStatusLabel(b.status)}
                    </span>
                    <span className={styles.batchQty}>
                      <strong>{b.quantityProduced.toLocaleString()}</strong>
                      <span className={styles.batchQtyUnit}>units</span>
                    </span>
                  </div>
                  <dl className={styles.batchMeta}>
                    <div className={styles.metaRow}>
                      <dt>Started</dt>
                      <dd>{formatTime(b.startedAt)}</dd>
                    </div>
                    <div className={styles.metaRow}>
                      <dt>Completed</dt>
                      <dd>{formatTime(b.completedAt)}</dd>
                    </div>
                    <div className={styles.metaRow}>
                      <dt>Recorded by</dt>
                      <dd>{b.producedBy.name}</dd>
                    </div>
                    {b.notes && (
                      <div className={`${styles.metaRow} ${styles.metaRowFull}`}>
                        <dt>Notes</dt>
                        <dd className={styles.notes}>{b.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.closeBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
