import { useEffect, useState, useCallback } from 'react';
import type {
  ExpenseCategory,
  ExpensePeriod,
  ExpenseSummaryResponse,
  ExpenseCategorySummary,
} from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import { api } from '../../lib/api';
import styles from './ExpenseCategoryCards.module.css';

interface Props {
  /** ISO date (YYYY-MM-DD) — inclusive lower bound. */
  from: string;
  /** ISO date (YYYY-MM-DD) — inclusive upper bound. */
  to: string;
  /** Currently selected category filter, if any. */
  activeCategory: ExpenseCategory | null;
  /** Notified when the user clicks a card; pass null to clear. */
  onSelectCategory: (cat: ExpenseCategory | null) => void;
  /** Period quick-pick currently active (for visual highlight). */
  activePeriod: ExpensePeriod | null;
  /** Notified when the user clicks a quick-pick — parent owns date state. */
  onSelectPeriod: (period: ExpensePeriod) => void;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  utilities: 'Utilities',
  wages: 'Wages',
  packaging: 'Packaging',
  ingredients: 'Ingredients',
  maintenance: 'Maintenance',
  other: 'Other',
};

const CATEGORY_ACCENTS: Record<ExpenseCategory, string> = {
  utilities: '#3b82f6',
  wages: '#e07b3c',
  packaging: '#94a3b8',
  ingredients: '#10b981',
  maintenance: '#c53030',
  other: '#6b7280',
};

const PERIOD_LABELS: Record<ExpensePeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export function ExpenseCategoryCards({
  from,
  to,
  activeCategory,
  onSelectCategory,
  activePeriod,
  onSelectPeriod,
}: Props) {
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
      const res = await api.get<ExpenseSummaryResponse>(`/expenses/summary?${params.toString()}`);
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const categories: ExpenseCategorySummary[] = summary?.categories ?? [];
  const grandTotal = summary?.total ?? 0;

  return (
    <section className={styles.wrap} aria-label="Expense summary">
      <div className={styles.periodBar}>
        <div className={styles.periodLabel}>Quick range</div>
        <div className={styles.periodBtns}>
          {(Object.keys(PERIOD_LABELS) as ExpensePeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.periodBtn} ${activePeriod === p ? styles.periodBtnActive : ''}`}
              onClick={() => onSelectPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className={styles.grandTotal}>
          <span className={styles.grandTotalLabel}>Total in range</span>
          <span className={styles.grandTotalValue}>
            {loading ? '—' : formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      <div className={styles.cards}>
        {categories.map((c) => {
          const isActive = activeCategory === c.category;
          const accent = CATEGORY_ACCENTS[c.category];
          return (
            <button
              key={c.category}
              type="button"
              className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
              onClick={() => onSelectCategory(isActive ? null : c.category)}
              style={{ ['--accent' as string]: accent }}
              aria-pressed={isActive}
            >
              <div className={styles.cardHead}>
                <span className={styles.cardDot} aria-hidden="true" />
                <span className={styles.cardLabel}>{CATEGORY_LABELS[c.category]}</span>
              </div>
              <div className={styles.cardValue}>{formatCurrency(c.total)}</div>
              <div className={styles.cardMeta}>
                <span>{c.count} {c.count === 1 ? 'entry' : 'entries'}</span>
                <span className={styles.cardPct}>{c.percentOfTotal.toFixed(1)}%</span>
              </div>
              <div className={styles.cardBar} aria-hidden="true">
                <div className={styles.cardBarFill} style={{ width: `${c.percentOfTotal}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <div className={styles.activeChipRow}>
          <span className={styles.activeChip}>
            Filtering: {CATEGORY_LABELS[activeCategory]}
            <button
              type="button"
              className={styles.activeChipClear}
              onClick={() => onSelectCategory(null)}
              aria-label="Clear category filter"
            >
              ×
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
