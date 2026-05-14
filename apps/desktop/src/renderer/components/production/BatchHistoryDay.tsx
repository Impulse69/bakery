import type { HistoryDay, HistoryRow, DerivedStatus } from './BatchHistory';
import styles from './BatchHistoryDay.module.css';

interface Props {
  day: HistoryDay;
  onRowClick: (row: HistoryRow) => void;
}

const STATUS_LABEL: Record<DerivedStatus, string> = {
  hit: 'Target hit',
  short: 'Short',
  surplus: 'Surplus',
  failed: 'Failed',
  in_progress: 'In progress',
};

function formatDayHeader(iso: string): string {
  // iso = YYYY-MM-DD — build a local Date at midday to avoid timezone surprises
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatVariance(actual: number, target: number): { label: string; tone: 'short' | 'surplus' | 'hit' } {
  if (target === 0) {
    if (actual === 0) return { label: '—', tone: 'hit' };
    return { label: `+${actual}`, tone: 'surplus' };
  }
  const diff = actual - target;
  if (diff === 0) return { label: 'on target', tone: 'hit' };
  if (diff > 0) return { label: `+${diff}`, tone: 'surplus' };
  return { label: `${diff}`, tone: 'short' };
}

export function BatchHistoryDay({ day, onRowClick }: Props) {
  const showShortage = day.totalShortage > 0;
  const showSurplus = !showShortage && day.totalSurplus > 0;

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.eyebrow}>Production day</span>
          <h3 className={styles.heading}>{formatDayHeader(day.date)}</h3>
        </div>
        <span className={styles.batchChip}>
          <strong>{day.batchCount}</strong>
          <span className={styles.batchChipLabel}>{day.batchCount === 1 ? 'batch' : 'batches'}</span>
        </span>
      </header>

      <div className={styles.rollupStrip}>
        <div className={styles.rollup}>
          <span className={styles.rollupLabel}>Target</span>
          <span className={styles.rollupValue}>{day.totalTarget.toLocaleString()}</span>
        </div>
        <div className={styles.rollup}>
          <span className={styles.rollupLabel}>Produced</span>
          <span className={styles.rollupValue}>{day.totalProduced.toLocaleString()}</span>
        </div>
        {(showShortage || showSurplus) && (
          <div className={styles.rollup}>
            <span className={styles.rollupLabel}>{showShortage ? 'Shortage' : 'Surplus'}</span>
            <span className={`${styles.rollupValue} ${showShortage ? styles.rollupShort : styles.rollupSurplus}`}>
              {showShortage ? `−${day.totalShortage.toLocaleString()}` : `+${day.totalSurplus.toLocaleString()}`}
            </span>
          </div>
        )}
        <div className={styles.rollup}>
          <span className={styles.rollupLabel}>Completion</span>
          <span className={`${styles.rollupValue} ${day.completionPct >= 100 ? styles.rollupOk : ''}`}>
            {day.completionPct}%
          </span>
        </div>
      </div>

      <div className={styles.rows}>
        {day.rows.map((row) => {
          const variance = formatVariance(row.actualProduced, row.target);
          return (
            <button
              key={row.productId}
              type="button"
              className={styles.row}
              onClick={() => onRowClick(row)}
              aria-label={`View ${row.productName} on ${formatDayHeader(day.date)}`}
            >
              <span className={styles.rowName}>{row.productName}</span>
              <span className={styles.rowCell}>
                <span className={styles.rowCellLabel}>Target</span>
                <span className={styles.rowCellValue}>{row.target.toLocaleString()}</span>
              </span>
              <span className={styles.rowCell}>
                <span className={styles.rowCellLabel}>Produced</span>
                <span className={styles.rowCellValue}>{row.actualProduced.toLocaleString()}</span>
              </span>
              <span className={`${styles.variancePill} ${styles[`variance_${variance.tone}`]}`}>
                {variance.label}
              </span>
              <span className={`${styles.statusPill} ${styles[`status_${row.derivedStatus}`]}`}>
                {STATUS_LABEL[row.derivedStatus]}
              </span>
              <span className={styles.batchNums}>
                {row.batches.map((b) => (
                  <span key={b.id} className={styles.batchNum}>{b.batchNumber}</span>
                ))}
              </span>
              <span className={styles.chevron} aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
