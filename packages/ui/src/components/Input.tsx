import { useId } from 'react';
import styles from './Input.module.css';

export interface InputProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  disabled,
  id: externalId,
  className,
}: InputProps) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;

  return (
    <div className={`${styles.field}${className ? ` ${className}` : ''}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${styles.input}${error ? ` ${styles.inputError}` : ''}`}
      />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
