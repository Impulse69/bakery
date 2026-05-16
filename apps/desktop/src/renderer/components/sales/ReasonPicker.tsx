import { useState, useEffect } from 'react';
import styles from './ReasonPicker.module.css';

interface Props {
  /** Current reason text. Empty string when nothing chosen yet. */
  value: string;
  /** Notified whenever the canonical reason text changes. */
  onChange: (reason: string) => void;
  /** Optional autofocus on mount. */
  autoFocus?: boolean;
  /** Layout — compact for inline-row use, comfy for picker dialogs. */
  variant?: 'compact' | 'comfy';
  /** Override the placeholder for the free-text fallback. */
  otherPlaceholder?: string;
}

/** Preset reasons cashiers will reach for most often.
 *  Keep this list short — long dropdowns are slower than free typing. */
const PRESETS: { label: string; value: string }[] = [
  { label: 'Customer added items', value: 'Customer added items' },
  { label: 'Customer reduced items', value: 'Customer reduced items' },
  { label: 'Customer cancelled item', value: 'Customer cancelled item' },
  { label: 'Wrong product entered', value: 'Wrong product entered' },
  { label: 'Wrong quantity entered', value: 'Wrong quantity entered' },
  { label: 'Pricing correction', value: 'Pricing correction' },
];

const OTHER = '__other__';

/** Pick a preset reason or write your own.
 *  Replaces the bare free-text input cashiers had to fill on every modification. */
export function ReasonPicker({
  value,
  onChange,
  autoFocus,
  variant = 'compact',
  otherPlaceholder = 'Describe the reason…',
}: Props) {
  const matchesPreset = PRESETS.some((p) => p.value === value);
  const initialChoice = value === '' ? '' : matchesPreset ? value : OTHER;
  const initialCustom = matchesPreset ? '' : value;

  const [choice, setChoice] = useState<string>(initialChoice);
  const [custom, setCustom] = useState<string>(initialCustom);

  // Reset when the caller wipes the value externally (e.g. after save).
  useEffect(() => {
    if (value === '') {
      setChoice('');
      setCustom('');
    }
  }, [value]);

  const handleSelect = (v: string) => {
    setChoice(v);
    if (v === '' ) {
      onChange('');
    } else if (v === OTHER) {
      onChange(custom);
    } else {
      onChange(v);
      setCustom('');
    }
  };

  const handleCustom = (v: string) => {
    setCustom(v);
    onChange(v);
  };

  return (
    <div className={`${styles.wrap} ${variant === 'comfy' ? styles.comfy : styles.compact}`}>
      <div className={styles.selectWrap}>
        <select
          className={styles.select}
          value={choice}
          onChange={(e) => handleSelect(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          aria-label="Reason"
        >
          <option value="" disabled>
            Pick a reason…
          </option>
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value={OTHER}>Other (type below)</option>
        </select>
        <span className={styles.chevron} aria-hidden="true">▾</span>
      </div>

      {choice === OTHER && (
        <input
          type="text"
          className={styles.customInput}
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder={otherPlaceholder}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      )}
    </div>
  );
}
