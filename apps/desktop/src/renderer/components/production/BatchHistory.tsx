import { useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react';
import type { Product } from '@bakery/types';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { BatchHistoryDay } from './BatchHistoryDay';
import { BatchHistoryDetailModal } from './BatchHistoryDetailModal';
import styles from './BatchHistory.module.css';

// Local error boundary so a render-time exception inside the history view
// surfaces in the UI instead of crashing the whole renderer to a blank window.
class HistoryErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[BatchHistory] render error', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className={styles.errorCard}>
          <p className={styles.errorMsg}>
            Batch History crashed while rendering: {this.state.error.message}
          </p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => this.setState({ error: null })}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export type DerivedStatus = 'hit' | 'short' | 'surplus' | 'failed' | 'in_progress';

export interface HistoryBatch {
  id: string;
  batchNumber: string;
  quantityProduced: number;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  producedBy: { id: string; name: string };
}

export interface HistoryRow {
  productId: string;
  productName: string;
  target: number;
  carryOver: number;
  actualProduced: number;
  shortage: number;
  derivedStatus: DerivedStatus;
  batches: HistoryBatch[];
}

export interface HistoryDay {
  date: string;
  batchCount: number;
  totalTarget: number;
  totalProduced: number;
  totalShortage: number;
  totalSurplus: number;
  completionPct: number;
  rows: HistoryRow[];
}

interface HistoryResponse {
  days: HistoryDay[];
  nextCursor: string | null;
}

const STATUS_OPTIONS: { value: '' | DerivedStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'hit', label: 'Target hit' },
  { value: 'short', label: 'Short' },
  { value: 'surplus', label: 'Surplus' },
  { value: 'failed', label: 'Failed' },
  { value: 'in_progress', label: 'In progress' },
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toISO(d);
}

function WheatGlyph() {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 10v46" stroke="#131b2e" strokeWidth="2" strokeLinecap="round" />
      <g stroke="#e07b3c" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M32 20c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 20c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
        <path d="M32 30c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 30c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
        <path d="M32 40c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 40c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
        <path d="M32 50c-4.5-2.5-9-2.5-12 0 3 2.5 7.5 2.5 12 0zM32 50c4.5-2.5 9-2.5 12 0-3 2.5-7.5 2.5-12 0z" />
      </g>
    </svg>
  );
}

export function BatchHistory() {
  return (
    <HistoryErrorBoundary>
      <BatchHistoryInner />
    </HistoryErrorBoundary>
  );
}

function BatchHistoryInner() {
  const { showToast } = useToast();

  // Filters
  const [from, setFrom] = useState<string>(thirtyDaysAgoISO());
  const [to, setTo] = useState<string>(toISO(new Date()));
  const [productId, setProductId] = useState<string>('');
  const [status, setStatus] = useState<'' | DerivedStatus>('');
  const [q, setQ] = useState<string>('');

  // Data
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selected, setSelected] = useState<{ dayDate: string; row: HistoryRow } | null>(null);

  // Product dropdown source
  const [products, setProducts] = useState<Product[]>([]);

  // Track latest request to drop stale responses
  const requestSeq = useRef(0);

  // Load product list once
  useEffect(() => {
    api
      .get<{ data: Product[] }>('/products?limit=200')
      .then((res) => setProducts(res.data ?? []))
      .catch(() => {
        /* silently ignore — search still works without the dropdown */
      });
  }, []);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<HistoryResponse | null> => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (productId) params.set('productId', productId);
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      if (cursor) params.set('cursor', cursor);

      try {
        const res = await api.get<HistoryResponse>(`/production/history?${params.toString()}`);
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load history';
        if (/403|forbidden/i.test(msg)) {
          setError('History is restricted to admin and owner roles.');
        } else {
          setError(msg);
        }
        return null;
      }
    },
    [from, to, productId, status, q],
  );

  // Debounced refetch on filter change
  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      const res = await fetchPage(null);
      if (seq !== requestSeq.current) return; // stale
      if (res) {
        setDays(res.days);
        setNextCursor(res.nextCursor);
      } else {
        setDays([]);
        setNextCursor(null);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetchPage(nextCursor);
    if (res) {
      setDays((prev) => [...prev, ...res.days]);
      setNextCursor(res.nextCursor);
    } else {
      showToast('Failed to load earlier history', 'error');
    }
    setLoadingMore(false);
  }, [fetchPage, nextCursor, loadingMore, showToast]);

  const retry = useCallback(async () => {
    setError(null);
    setLoading(true);
    const res = await fetchPage(null);
    if (res) {
      setDays(res.days);
      setNextCursor(res.nextCursor);
    }
    setLoading(false);
  }, [fetchPage]);

  return (
    <div className={styles.wrap}>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={toISO(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={styles.filterInput}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | DerivedStatus)}
            className={styles.filterInput}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className={`${styles.filterGroup} ${styles.searchGroup}`}>
          <label className={styles.filterLabel}>Search</label>
          <input
            type="text"
            value={q}
            placeholder="Product name or batch #"
            onChange={(e) => setQ(e.target.value)}
            className={styles.filterInput}
          />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className={styles.skeletonStack}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonCard} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : error ? (
        <div className={styles.errorCard}>
          <p className={styles.errorMsg}>{error}</p>
          <button type="button" className={styles.retryBtn} onClick={retry}>Retry</button>
        </div>
      ) : days.length === 0 ? (
        <div className={styles.emptyCard}>
          <WheatGlyph />
          <h3 className={styles.emptyTitle}>No production logged in this window</h3>
          <p className={styles.emptyBody}>Try extending the date range or clearing filters.</p>
        </div>
      ) : (
        <>
          <div className={styles.dayStack}>
            {days.map((day) => (
              <BatchHistoryDay
                key={day.date}
                day={day}
                onRowClick={(row) => setSelected({ dayDate: day.date, row })}
              />
            ))}
          </div>

          {nextCursor && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load earlier'}
              </button>
            </div>
          )}
        </>
      )}

      <BatchHistoryDetailModal
        open={!!selected}
        dayDate={selected?.dayDate ?? ''}
        row={selected?.row ?? null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
