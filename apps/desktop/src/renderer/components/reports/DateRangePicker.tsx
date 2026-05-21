import { Input } from '@bakery/ui';
import styles from './DateRangePicker.module.css';

export type Period =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | '7d'
  | '30d'
  | 'custom';

export interface DateRange {
  /** YYYY-MM-DD inclusive */
  from: string;
  /** YYYY-MM-DD inclusive */
  to: string;
  period: Period;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Which preset chips to render. Order is preserved. Custom is always rendered last if present. */
  presets?: Period[];
  className?: string;
}

const DEFAULT_PRESETS: Period[] = ['today', 'week', 'month', 'quarter', 'year', 'custom'];

const PRESET_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  '7d': '7d',
  '30d': '30d',
  custom: 'Custom',
};

/** YYYY-MM-DD in local time. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start of ISO week (Monday). */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  // JS: Sunday=0, Monday=1 ... -> Monday is 1, so offset = (day + 6) % 7
  const offset = (day + 6) % 7;
  out.setDate(out.getDate() - offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Compute the {from, to} pair for a preset. `custom` is a no-op — caller keeps existing dates. */
export function rangeForPreset(period: Period, currentFrom?: string, currentTo?: string): DateRange {
  const today = new Date();
  const todayISO = toISODate(today);

  switch (period) {
    case 'today':
      return { period, from: todayISO, to: todayISO };
    case 'week':
      return { period, from: toISODate(startOfWeek(today)), to: todayISO };
    case 'month':
      return { period, from: toISODate(startOfMonth(today)), to: todayISO };
    case 'quarter':
      return { period, from: toISODate(startOfQuarter(today)), to: todayISO };
    case 'year':
      return { period, from: toISODate(startOfYear(today)), to: todayISO };
    case '7d':
      return { period, from: toISODate(daysAgo(7)), to: todayISO };
    case '30d':
      return { period, from: toISODate(daysAgo(30)), to: todayISO };
    case 'custom':
      return { period, from: currentFrom ?? todayISO, to: currentTo ?? todayISO };
  }
}

/** Convenience: build the initial range for a given preset (uses today as anchor). */
export function initialRange(period: Period = 'month'): DateRange {
  return rangeForPreset(period);
}

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
}: DateRangePickerProps) {
  const handlePreset = (p: Period) => {
    if (p === 'custom') {
      onChange({ ...value, period: 'custom' });
      return;
    }
    onChange(rangeForPreset(p, value.from, value.to));
  };

  const handleFromChange = (next: string) => {
    onChange({ ...value, from: next, period: 'custom' });
  };

  const handleToChange = (next: string) => {
    onChange({ ...value, to: next, period: 'custom' });
  };

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.chips}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.chip} ${value.period === p ? styles.chipActive : ''}`}
            onClick={() => handlePreset(p)}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      <div className={styles.dateRow}>
        <Input
          label="From"
          type="date"
          value={value.from}
          onChange={(e) => handleFromChange(e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={value.to}
          onChange={(e) => handleToChange(e.target.value)}
        />
      </div>
    </div>
  );
}
