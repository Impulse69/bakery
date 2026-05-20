import { useId, useState, useEffect, useRef } from 'react';
import styles from './MoneyInput.module.css';

interface Props {
  label?: string;
  /** Major-unit string (e.g. "10.00"). Parent owns the canonical value. */
  value: string;
  /** Called with a sanitized major-unit string on every keystroke. */
  onChange: (next: string) => void;
  /** Called with the blur-formatted "X.XX" string. Optional. */
  onBlur?: (formatted: string) => void;
  placeholder?: string;
  /** Currency glyph rendered as a prefix (default GH₵). */
  prefix?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Money input designed for finance entry, not generic numbers.
 *
 * Why not <Input type="number">: the browser's number-typed input strips
 * trailing zeros, eats decimal points mid-typing in some locales, blocks
 * states like "1." while you're still typing, and the shared <Input> here
 * has a value-coercion branch that broke editing existing prices.
 *
 * Behaviour:
 * - type="text" + inputMode="decimal" so the soft-keyboard is numeric on
 *   touch devices but the desktop user has full control.
 * - During typing: accepts only digits and at most one '.'. Junk keystrokes
 *   are silently dropped (no fight with the cursor).
 * - On blur: empty -> "0.00"; "5" -> "5.00"; ".5" -> "0.50"; "10.5" ->
 *   "10.50"; anything weirder is parsed via Number() and re-emitted as
 *   X.XX so the parent always sees finance-standard formatting.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '0.00',
  prefix = 'GH₵',
  disabled,
  autoFocus,
}: Props) {
  const id = useId();
  // Local mirror lets us re-format on blur without lagging keystrokes.
  const [draft, setDraft] = useState(value);
  const lastExternalValue = useRef(value);

  // Sync from outside (e.g. when parent loads a different product).
  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      setDraft(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Drop anything that isn't a digit or a single dot.
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    const safe =
      firstDot === -1
        ? cleaned
        : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    setDraft(safe);
    onChange(safe);
  };

  const handleBlur = () => {
    const formatted = formatMoney(draft);
    setDraft(formatted);
    onChange(formatted);
    onBlur?.(formatted);
  };

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.wrap}>
        <span className={styles.prefix} aria-hidden="true">{prefix}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          // Tells password managers and form autofill to stay out of money fields.
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          className={styles.input}
        />
      </div>
    </div>
  );
}

/** Coerce a free-typed string to canonical "X.XX". Empty -> "0.00". */
export function formatMoney(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n) || s.trim() === '') return '0.00';
  return n.toFixed(2);
}
