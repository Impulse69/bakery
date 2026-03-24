import styles from './FormSection.module.css';

export interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <fieldset className={`${styles.section}${className ? ` ${className}` : ''}`}>
      <legend className={styles.legend}>{title}</legend>
      <div className={styles.content}>{children}</div>
    </fieldset>
  );
}
