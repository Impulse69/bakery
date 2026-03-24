import styles from './Card.module.css';

export interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, actions, className }: CardProps) {
  const hasHeader = title || actions;

  return (
    <div className={`${styles.card}${className ? ` ${className}` : ''}`}>
      {hasHeader && (
        <div className={styles.header}>
          <div className={styles.titles}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
