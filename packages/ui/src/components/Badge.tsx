import styles from './Badge.module.css';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
