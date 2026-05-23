import { useState, useEffect, useCallback, useMemo } from 'react';
import { StatCard, Select } from '@bakery/ui';
import type { SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import type {
  OperationsSummary,
  ProfitAnalysisRow,
  Product,
  ProductStockAdjustment,
} from '@bakery/types';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { DateRangePicker, initialRange } from './DateRangePicker';
import type { DateRange } from './DateRangePicker';
import styles from './OperationsPanel.module.css';

const BAR_COLORS = ['#e07b3c', '#131b2e', '#c89a3c', '#2f9e6a', '#8b5cf6', '#0ea5e9', '#d96b91', '#3b82f6'];

type StockRow = ProductStockAdjustment & {
  product?: { id: string; name: string; sku: string } | null;
};

type ProfitSortKey = 'productName' | 'quantity' | 'revenue' | 'profit' | 'margin';
type SortDir = 'asc' | 'desc';

function rangeToParams(range: DateRange): string {
  const params = new URLSearchParams();
  params.set('from', new Date(range.from).toISOString());
  params.set('to', new Date(range.to + 'T23:59:59').toISOString());
  return params.toString();
}

function fmtChartDate(iso: string): string {
  // Compact label like "May 14"
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function fmtRowDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function profitMargin(row: ProfitAnalysisRow): number {
  return row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
}

export function OperationsPanel() {
  const { showToast } = useToast();
  const [range, setRange] = useState<DateRange>(() => initialRange('month'));
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [profitRows, setProfitRows] = useState<ProfitAnalysisRow[]>([]);
  const [adjustments, setAdjustments] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockProductId, setStockProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<ProfitSortKey>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Load product list once for the stock filter dropdown
  useEffect(() => {
    api.get<{ data: Product[] }>('/products?limit=200')
      .then((r) => setProducts(r.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const stockParams = new URLSearchParams();
      stockParams.set('from', new Date(range.from).toISOString());
      stockParams.set('to', new Date(range.to + 'T23:59:59').toISOString());
      if (stockProductId) stockParams.set('productId', stockProductId);

      const [s, p, a] = await Promise.all([
        api.get<OperationsSummary>(`/reports/summary?${rangeToParams(range)}`),
        api.get<ProfitAnalysisRow[]>(`/reports/profit-analysis?${rangeToParams(range)}`),
        api.get<StockRow[]>(`/reports/stock-adjustment?${stockParams.toString()}`),
      ]);
      setSummary(s);
      setProfitRows(Array.isArray(p) ? p : []);
      setAdjustments(Array.isArray(a) ? a : []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load operations data', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, stockProductId, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const productOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'All products' },
      ...products.map((p) => ({ value: p.id, label: p.name })),
    ],
    [products],
  );

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const sortedProfit = useMemo(() => {
    const arr = [...profitRows];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'productName') {
        av = a.productName.toLowerCase();
        bv = b.productName.toLowerCase();
      } else if (sortKey === 'margin') {
        av = profitMargin(a);
        bv = profitMargin(b);
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return arr;
  }, [profitRows, sortKey, sortDir]);

  const topByProfit = useMemo(
    () => [...profitRows].sort((a, b) => b.profit - a.profit).slice(0, 8),
    [profitRows],
  );

  const handleSort = (key: ProfitSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'productName' ? 'asc' : 'desc');
    }
  };
  const sortInd = (key: ProfitSortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className={styles.wrap}>
      <DateRangePicker value={range} onChange={setRange} />

      {loading && !summary ? (
        <p className={styles.empty}>Loading operations…</p>
      ) : !summary ? (
        <p className={styles.empty}>No data available.</p>
      ) : (
        <>
          <div className={styles.statsRow}>
            <StatCard label="Orders" value={summary.totals.orders} />
            <StatCard label="Revenue" value={formatCurrency(summary.totals.revenue)} />
            <StatCard
              label="Profit"
              value={formatCurrency(summary.totals.marginalProfit)}
              trend={summary.totals.marginalProfit > 0 ? 'up' : summary.totals.marginalProfit < 0 ? 'down' : 'neutral'}
            />
            <StatCard label="Expenses" value={formatCurrency(summary.totals.expenses)} />
            <StatCard label="Margin" value={`${summary.totals.margin.toFixed(1)}%`} />
            <StatCard label="Tax collected" value={formatCurrency(summary.totals.tax)} />
          </div>

          <div className={styles.ledgerCard}>
            <div className={styles.chartTitle}>Revenue trend (in range)</div>
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer>
                <AreaChart data={summary.dailyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e07b3c" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#e07b3c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(19,27,46,.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    fontSize={11}
                    stroke="rgba(19,27,46,.5)"
                    tickFormatter={fmtChartDate}
                    minTickGap={20}
                  />
                  <YAxis
                    fontSize={11}
                    stroke="rgba(19,27,46,.5)"
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    labelFormatter={(label) => fmtChartDate(String(label))}
                    formatter={(val, name) => [
                      name === 'revenue' ? formatCurrency(Number(val)) : String(val),
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#e07b3c"
                    strokeWidth={2.5}
                    fill="url(#revFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.ledgerCard}>
            <div className={styles.chartTitle}>Top products by profit (in range)</div>
            {topByProfit.length === 0 ? (
              <p className={styles.emptyInline}>No sales in this range.</p>
            ) : (
              <div style={{ height: Math.max(120, topByProfit.length * 32 + 40), width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={topByProfit} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <XAxis type="number" fontSize={11} stroke="rgba(19,27,46,.5)"
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                    <YAxis type="category" dataKey="productName" fontSize={12} width={140} stroke="rgba(19,27,46,.6)" />
                    <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                    <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
                      {topByProfit.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className={styles.tableWrap}>
              <table className={styles.tbl}>
                <thead>
                  <tr>
                    <th className={styles.sortable} onClick={() => handleSort('productName')}>
                      Product{sortInd('productName')}
                    </th>
                    <th>SKU</th>
                    <th className={`${styles.sortable} ${styles.right}`} onClick={() => handleSort('quantity')}>
                      Qty{sortInd('quantity')}
                    </th>
                    <th className={`${styles.sortable} ${styles.right}`} onClick={() => handleSort('revenue')}>
                      Revenue{sortInd('revenue')}
                    </th>
                    <th className={styles.right}>Cost</th>
                    <th className={`${styles.sortable} ${styles.right}`} onClick={() => handleSort('profit')}>
                      Profit{sortInd('profit')}
                    </th>
                    <th className={`${styles.sortable} ${styles.right}`} onClick={() => handleSort('margin')}>
                      Margin %{sortInd('margin')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProfit.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyCell}>No sales in this range.</td>
                    </tr>
                  ) : sortedProfit.map((r, i) => {
                    const m = profitMargin(r);
                    return (
                      <tr key={`${r.sku}-${i}`}>
                        <td>{r.productName}</td>
                        <td className={styles.mono}>{r.sku}</td>
                        <td className={styles.right}>{r.quantity}</td>
                        <td className={styles.right}>{formatCurrency(r.revenue)}</td>
                        <td className={styles.right}>{formatCurrency(r.cost)}</td>
                        <td className={`${styles.right} ${r.profit < 0 ? styles.neg : styles.pos}`}>
                          {formatCurrency(r.profit)}
                        </td>
                        <td className={`${styles.right} ${m < 0 ? styles.neg : ''}`}>
                          {m.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.ledgerCard}>
            <div className={styles.stockHead}>
              <div className={styles.chartTitle}>Stock movement (in range)</div>
              <div className={styles.stockFilter}>
                <Select
                  label="Product"
                  options={productOptions}
                  value={stockProductId}
                  onChange={(e) => setStockProductId(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.tbl}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th className={styles.center}>Qty change</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.emptyCell}>No stock movements in this range.</td>
                    </tr>
                  ) : adjustments.map((a) => {
                    const productName =
                      a.product?.name ?? productMap.get(a.productId)?.name ?? '—';
                    const qty = a.quantityChange;
                    return (
                      <tr key={a.id}>
                        <td>{fmtRowDate(a.createdAt)}</td>
                        <td>{productName}</td>
                        <td className={`${styles.center} ${qty > 0 ? styles.pos : qty < 0 ? styles.neg : ''}`}>
                          {qty > 0 ? '+' : ''}{qty}
                        </td>
                        <td>{a.reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {adjustments.length === 200 && !stockProductId && (
              <p className={styles.cap}>Showing the 200 most recent. Pick a product to narrow.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
