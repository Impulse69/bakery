import { useState, useEffect, useRef } from 'react';
import styles from './SearchInput.module.css';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [internal, setInternal] = useState(value);
  const isFirstRender = useRef(true);

  // Sync internal state when external value changes
  useEffect(() => {
    setInternal(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => onChange(internal), debounceMs);
    return () => clearTimeout(timer);
  }, [internal, debounceMs, onChange]);

  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      <span className={styles.icon}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <input
        type="text"
        className={styles.input}
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
