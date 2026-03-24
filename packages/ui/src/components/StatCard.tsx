import styles from './StatCard.module.css';

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') {
    return (
      <span className={`${styles.trend} ${styles.up}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M3 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className={`${styles.trend} ${styles.down}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 12V2M3 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`${styles.trend} ${styles.neutral}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function StatCard({ label, value, trend, icon, className }: StatCardProps) {
  return (
    <div className={`${styles.card}${className ? ` ${className}` : ''}`}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.content}>
        <p className={styles.label}>{label}</p>
        <div className={styles.valueRow}>
          <p className={styles.value}>{value}</p>
          {trend && <TrendIndicator trend={trend} />}
        </div>
      </div>
    </div>
  );
}
