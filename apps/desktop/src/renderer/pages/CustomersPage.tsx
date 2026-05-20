import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Customer, SalesOrder, Payment } from '@bakery/types';
import {
  DataTable, Pagination, Button, Modal, Input, SearchInput, OrderStatusBadge,
} from '@bakery/ui';
import type { DataTableColumn } from '@bakery/ui';
import { formatCurrency, can } from '@bakery/utils';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import { CustomerReport } from '../components/customers/CustomerReport';
import styles from './CustomersPage.module.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '—';
}

function formatShortDate(d: string | Date | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const columns: DataTableColumn<Customer>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  {
    key: 'creditBalance',
    label: 'Credit Balance',
    render: (row) => <span className={styles.num}>{formatCurrency(row.creditBalance)}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
];

const orderColumns: DataTableColumn<SalesOrder>[] = [
  { key: 'orderNumber', label: 'Order #', render: (row) => <span className={styles.mono}>{row.orderNumber}</span> },
  {
    key: 'createdAt',
    label: 'Date',
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    key: 'total',
    label: 'Total',
    render: (row) => <span className={styles.num}>{formatCurrency(row.total)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <OrderStatusBadge status={row.status} />,
  },
];

const paymentColumns: DataTableColumn<Payment>[] = [
  {
    key: 'date',
    label: 'Date',
    render: (row) => new Date(row.date).toLocaleDateString(),
  },
  {
    key: 'method',
    label: 'Method',
    render: (row) => row.method.toUpperCase(),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (row) => <span className={styles.num}>{formatCurrency(row.amount)}</span>,
  },
];

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

interface CustomerStats {
  totalSpent: number;
  totalOrders: number;
  lastOrderDate: string;
  weekStreak: number;
  periodic: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  topProducts: Array<{ name: string; quantity: number }>;
}

export function CustomersPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canDeactivate = user ? can(user.role, 'customers:delete') : false;
  // Cashier can't see the Leaderboard tab — it hits an admin/owner-only endpoint.
  const canSeeLeaderboard = user ? can(user.role, 'customers:view') && (user.role === 'admin' || user.role === 'owner') : false;
  const [activeTab, setActiveTab] = useState<'all' | 'leaderboard'>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedStats, setSelectedCustomerStats] = useState<CustomerStats | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'orders' | 'payments'>('overview');
  const [trendRange, setTrendRange] = useState<'1W' | '1M' | '1Q' | '1Y'>('1M');
  const [printing, setPrinting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'all') {
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
        const res = await api.get<{ data: Customer[]; total: number }>(
          `/customers?page=${page}&limit=${limit}${searchParam}`,
        );
        setCustomers(res.data);
        setTotal(res.total);
      } else if (activeTab === 'leaderboard') {
        const res = await api.get<any[]>('/customers/leaderboard');
        setLeaderboard(res);
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/customers', form);
      showToast('Customer created', 'success');
      setShowAddModal(false);
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (customer: Customer) => {
    try {
      const [full, stats] = await Promise.all([
        api.get<Customer>(`/customers/${customer.id}`),
        api.get<CustomerStats>(`/customers/${customer.id}/stats`)
      ]);
      setSelectedCustomer(full);
      setSelectedCustomerStats(stats);
      setDetailTab('overview');
    } catch (err: any) {
      showToast(err.message || 'Failed to load customer details', 'error');
    }
  };

  const handlePrintReport = async () => {
    if (!selectedCustomer) return;
    setPrinting(true);
    // allow the portal to mount before calling print
    await new Promise((r) => setTimeout(r, 40));
    const apiBridge = window.electronAPI;
    try {
      if (apiBridge?.printPreview) {
        await apiBridge.printPreview();
      } else {
        window.print();
      }
    } catch {
      try {
        await apiBridge?.printSystemPreview?.();
      } catch {
        window.print();
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedCustomer) return;
    const activating = !selectedCustomer.isActive;

    if (
      !activating &&
      !confirm(`Are you sure you want to deactivate ${selectedCustomer.name}?`)
    )
      return;

    try {
      if (activating) {
        await api.patch(`/customers/${selectedCustomer.id}`, { isActive: true });
        showToast("Customer activated", "success");
      } else {
        await api.delete(`/customers/${selectedCustomer.id}`);
        showToast("Customer deactivated", "success");
      }
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      showToast(
        err.message ||
          `Failed to ${activating ? "activate" : "deactivate"} customer`,
        "error",
      );
    }
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Customer Ledger</span>
          <h1 className={styles.heading}>Patrons</h1>
          <p className={styles.heroQuote}>
            <em>Regulars, leaders, and the people behind the numbers.</em>
          </p>
        </div>
        <div className={styles.heroAside}>
          <button className={styles.heroAction} onClick={openAddModal}>
            <span>＋</span> Add Customer
          </button>
        </div>
      </header>

      <div className={styles.ledgerCard}>
        <div className={styles.tabsRow}>
          <button
            className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          {canSeeLeaderboard && (
            <button
              className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboard
            </button>
          )}
        </div>
      </div>

      {activeTab === 'all' ? (
        <>
          <div className={styles.searchStrip}>
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name or phone..."
            />
          </div>

          <div className={styles.tableCard}>
            <DataTable
              columns={columns}
              data={customers}
              loading={loading}
              onRowClick={openDetail}
              emptyMessage="No customers on the ledger yet."
            />
          </div>

          {totalPages > 1 && (
            <div className={styles.pagerWrap}>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      ) : (
        <div className={styles.tableCard}>
          <DataTable
            columns={[
              { key: 'name', label: 'Customer' },
              { key: 'phone', label: 'Phone' },
              { key: 'totalOrders', label: 'Orders', render: (row: any) => <span className={styles.num}>{(row.totalOrders || 0).toLocaleString()}</span> },
              { key: 'totalSpent', label: 'Total Revenue', render: (row: any) => <span className={styles.num}>{formatCurrency(row.totalSpent || 0)}</span> },
            ]}
            data={leaderboard}
            loading={loading}
            onRowClick={openDetail}
          />
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Customer" size="md">
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={setField('name')} />
          <Input label="Phone" value={form.phone} onChange={setField('phone')} />
          <Input label="Email" type="email" value={form.email} onChange={setField('email')} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal — Patron Dossier */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => { setSelectedCustomer(null); setSelectedCustomerStats(null); }}
        title=""
        size="lg"
      >
        {selectedCustomer && (() => {
          const orders = selectedCustomer.salesOrders ?? [];
          const billable = orders.filter((o) => o.status !== 'cancelled');
          const ltv = selectedStats?.totalSpent ?? billable.reduce((s, o) => s + o.total, 0);
          const orderCount = selectedStats?.totalOrders ?? billable.length;
          const avgOrder = orderCount > 0 ? Math.round(ltv / orderCount) : 0;
          const topProducts = selectedStats?.topProducts?.slice(0, 5) ?? [];
          const topMax = topProducts.reduce((m, p) => Math.max(m, p.quantity), 0) || 1;
          const periodic = selectedStats?.periodic;
          const periodEntries: Array<[string, string, number]> = periodic ? [
            ['Today', 'D', periodic.daily],
            ['This Week', 'W', periodic.weekly],
            ['This Month', 'M', periodic.monthly],
            ['This Quarter', 'Q', periodic.quarterly],
            ['This Year', 'Y', periodic.yearly],
          ] : [];
          const periodMax = periodEntries.reduce((m, [, , v]) => Math.max(m, v), 0) || 1;

          // Build trend series from the customer's real orders
          const trendConfig: Record<typeof trendRange, { days: number; bucket: 'day' | 'week' | 'month'; format: Intl.DateTimeFormatOptions }> = {
            '1W': { days: 7,   bucket: 'day',   format: { weekday: 'short' } },
            '1M': { days: 30,  bucket: 'day',   format: { day: '2-digit', month: 'short' } },
            '1Q': { days: 90,  bucket: 'week',  format: { day: '2-digit', month: 'short' } },
            '1Y': { days: 365, bucket: 'month', format: { month: 'short' } },
          };
          const cfg = trendConfig[trendRange];
          const rangeStart = new Date();
          rangeStart.setHours(0, 0, 0, 0);
          rangeStart.setDate(rangeStart.getDate() - cfg.days + 1);

          const bucketKey = (d: Date) => {
            if (cfg.bucket === 'day') return d.toISOString().slice(0, 10);
            if (cfg.bucket === 'week') {
              const x = new Date(d);
              const day = x.getDay() === 0 ? 7 : x.getDay();
              x.setDate(x.getDate() - (day - 1));
              return x.toISOString().slice(0, 10);
            }
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          };

          const buckets = new Map<string, { label: string; revenue: number; orders: number; ts: number }>();
          const cursor = new Date(rangeStart);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          while (cursor <= today) {
            const k = bucketKey(cursor);
            if (!buckets.has(k)) {
              buckets.set(k, {
                label: cursor.toLocaleDateString('en-GB', cfg.format),
                revenue: 0,
                orders: 0,
                ts: cursor.getTime(),
              });
            }
            if (cfg.bucket === 'day') cursor.setDate(cursor.getDate() + 1);
            else if (cfg.bucket === 'week') cursor.setDate(cursor.getDate() + 7);
            else cursor.setMonth(cursor.getMonth() + 1);
          }
          for (const o of billable) {
            const od = new Date(o.createdAt);
            if (od < rangeStart) continue;
            const k = bucketKey(od);
            const b = buckets.get(k);
            if (b) { b.revenue += o.total; b.orders += 1; }
          }
          const trendData = Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
          const trendTotal = trendData.reduce((s, b) => s + b.revenue, 0);
          const trendPeak = trendData.reduce((m, b) => Math.max(m, b.revenue), 0);
          const rangeLabel: Record<typeof trendRange, string> = {
            '1W': 'past 7 days',
            '1M': 'past 30 days',
            '1Q': 'past 90 days',
            '1Y': 'past 12 months',
          };
          const recentOrders = [...orders]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 6);

          return (
            <div className={styles.dossier}>
              {/* Portrait strip */}
              <div className={styles.portraitStrip}>
                <div className={styles.monogram}>{initials(selectedCustomer.name)}</div>
                <div className={styles.portraitMain}>
                  <div className={styles.dossierEyebrow}>
                    <span>Patron Dossier</span>
                    <span className={styles.eyebrowDivider} />
                    <span className={styles.sinceText}>
                      Since {formatShortDate(selectedCustomer.createdAt)}
                    </span>
                  </div>
                  <h2 className={styles.patronName}>{selectedCustomer.name}</h2>
                  <div className={styles.contactChips}>
                    {selectedCustomer.phone && (
                      <span className={styles.chip}>📞 {selectedCustomer.phone}</span>
                    )}
                    {selectedCustomer.email && (
                      <span className={styles.chip}>✉ {selectedCustomer.email}</span>
                    )}
                    {selectedCustomer.address && (
                      <span className={styles.chip}>⌂ {selectedCustomer.address}</span>
                    )}
                    {!selectedCustomer.phone && !selectedCustomer.email && !selectedCustomer.address && (
                      <span className={styles.chipMuted}>No contact details on file</span>
                    )}
                  </div>
                </div>
                <div className={styles.ltvPlate}>
                  <div className={styles.ltvLabel}>Lifetime Value</div>
                  <div className={styles.ltvFigure}>{formatCurrency(ltv)}</div>
                  <div className={styles.ltvSub}>
                    {orderCount} order{orderCount === 1 ? '' : 's'}
                    {selectedStats?.weekStreak ? ` · 🔥 ${selectedStats.weekStreak}w streak` : ''}
                  </div>
                </div>
              </div>

              {/* KPI ribbon */}
              <div className={styles.kpiRibbon}>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Avg Order</div>
                  <div className={styles.kpiValue}>{formatCurrency(avgOrder)}</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Last Seen</div>
                  <div className={styles.kpiValue}>
                    {selectedStats?.lastOrderDate ? formatShortDate(selectedStats.lastOrderDate) : '—'}
                  </div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Credit</div>
                  <div className={`${styles.kpiValue} ${selectedCustomer.creditBalance > 0 ? styles.kpiDanger : ''}`}>
                    {formatCurrency(selectedCustomer.creditBalance)}
                  </div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Orders</div>
                  <div className={styles.kpiValue}>{orderCount.toLocaleString()}</div>
                </div>
              </div>

              {/* Action bar */}
              <div className={styles.actionBar}>
                <div className={styles.actionTabs}>
                  <button
                    className={`${styles.tab} ${detailTab === 'overview' ? styles.tabActive : ''}`}
                    onClick={() => setDetailTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`${styles.tab} ${detailTab === 'orders' ? styles.tabActive : ''}`}
                    onClick={() => setDetailTab('orders')}
                  >
                    Orders
                    <span className={styles.tabCount}>{orders.length}</span>
                  </button>
                  <button
                    className={`${styles.tab} ${detailTab === 'payments' ? styles.tabActive : ''}`}
                    onClick={() => setDetailTab('payments')}
                  >
                    Payments
                  </button>
                </div>
                <div className={styles.actionButtons}>
                  <button className={styles.actionGhost} onClick={handlePrintReport}>
                    🖨 Print Report
                  </button>
                  <button
                    className={styles.actionPrimary}
                    onClick={() => navigate(`/pos?customerId=${selectedCustomer.id}`)}
                  >
                    ＋ New Sale
                  </button>
                  {canDeactivate && (
                    <button
                      className={
                        selectedCustomer.isActive
                          ? styles.actionDanger
                          : styles.actionPrimary
                      }
                      onClick={handleToggleActive}
                    >
                      {selectedCustomer.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </div>

              {/* Tab content */}
              {detailTab === 'overview' && (
                <div className={styles.overviewGrid}>
                  {/* Cadence — horizontal progress dials */}
                  <section className={`${styles.sectionBlock} ${styles.fullSpan}`}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>01</span>
                      <span className={styles.sectionTitleText}>Cadence</span>
                      <span className={styles.sectionRule} />
                      <span className={styles.sectionHint}>share of patron's peak period</span>
                    </div>
                    {periodEntries.length > 0 ? (
                      <div className={styles.dialRow}>
                        {periodEntries.map(([label, glyph, value], idx) => {
                          const pct = periodMax > 0 ? Math.round((value / periodMax) * 100) : 0;
                          const isPeak = value > 0 && value === periodMax;
                          return (
                            <div key={label} className={styles.dialItem} style={{ animationDelay: `${idx * 70}ms` }}>
                              <div
                                className={`${styles.dial} ${isPeak ? styles.dialPeak : ''}`}
                                style={{ ['--fill' as any]: `${pct}` }}
                                aria-label={`${label}: ${formatCurrency(value)}, ${pct}% of peak`}
                              >
                                <div className={styles.dialInner}>
                                  <span className={styles.dialGlyph}>{glyph}</span>
                                  <span className={styles.dialValue}>{formatCurrency(value)}</span>
                                  <span className={styles.dialPct}>{pct}%</span>
                                </div>
                              </div>
                              <span className={styles.dialLabel}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={styles.emptyNote}>No cadence data yet.</div>
                    )}
                  </section>

                  {/* Trend chart — weekly / monthly / quarterly / yearly */}
                  <section className={`${styles.sectionBlock} ${styles.fullSpan}`}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>02</span>
                      <span className={styles.sectionTitleText}>Spending Trend</span>
                      <span className={styles.sectionRule} />
                      <div className={styles.trendToggle} role="tablist" aria-label="Trend range">
                        {(['1W', '1M', '1Q', '1Y'] as const).map((r) => (
                          <button
                            key={r}
                            role="tab"
                            aria-selected={trendRange === r}
                            className={`${styles.trendBtn} ${trendRange === r ? styles.trendBtnActive : ''}`}
                            onClick={() => setTrendRange(r)}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.trendCard}>
                      <div className={styles.trendHeader}>
                        <div>
                          <div className={styles.trendEyebrow}>Revenue · {rangeLabel[trendRange]}</div>
                          <div className={styles.trendTotal}>{formatCurrency(trendTotal)}</div>
                        </div>
                        <div className={styles.trendPeakChip}>
                          <span className={styles.trendPeakLabel}>Peak</span>
                          <span className={styles.trendPeakValue}>{formatCurrency(trendPeak)}</span>
                        </div>
                      </div>
                      <div className={styles.trendChart}>
                        {trendTotal > 0 ? (
                          <ResponsiveContainer>
                            <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="rgba(19,27,46,0.05)" vertical={false} />
                              <XAxis
                                dataKey="label"
                                fontSize={10}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(19,27,46,0.08)' }}
                                tick={{ fill: 'rgba(19,27,46,0.5)' }}
                                minTickGap={24}
                              />
                              <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'rgba(19,27,46,0.5)' }}
                                width={52}
                                tickFormatter={(v) => `₵${Math.round(Number(v) / 100)}`}
                              />
                              <Tooltip
                                cursor={{ stroke: 'rgba(19,27,46,0.12)' }}
                                contentStyle={{
                                  border: '1px solid rgba(19,27,46,0.1)',
                                  borderRadius: 10,
                                  background: '#fffefb',
                                  fontFamily: 'Manrope, Inter, sans-serif',
                                  fontSize: 12,
                                }}
                                formatter={(val, name) => {
                                  if (name === 'revenue') return [formatCurrency(Number(val)), 'Revenue'];
                                  return [val, name];
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#4f46e5"
                                strokeWidth={2.25}
                                fill="url(#trendFill)"
                                dot={false}
                                activeDot={{ r: 4, fill: '#4f46e5', stroke: '#fffefb', strokeWidth: 2 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className={styles.trendEmpty}>No purchases in the {rangeLabel[trendRange]}.</div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Favourites */}
                  <section className={styles.sectionBlock}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>03</span>
                      <span className={styles.sectionTitleText}>Most Reordered</span>
                      <span className={styles.sectionRule} />
                    </div>
                    {topProducts.length > 0 ? (
                      <div className={styles.favList}>
                        {topProducts.map((p, i) => (
                          <div key={p.name} className={styles.favRow}>
                            <span className={styles.favRank}>{String(i + 1).padStart(2, '0')}</span>
                            <span className={styles.favName}>{p.name}</span>
                            <div className={styles.favTrack}>
                              <div className={styles.favFill} style={{ width: `${(p.quantity / topMax) * 100}%` }} />
                            </div>
                            <span className={styles.favQty}>
                              <strong>{p.quantity}</strong>
                              <span className={styles.favQtyUnit}>units</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.emptyNote}>No product history yet.</div>
                    )}
                  </section>

                  {/* Recent orders */}
                  <section className={`${styles.sectionBlock} ${styles.fullSpan}`}>
                    <div className={styles.sectionHead}>
                      <span className={styles.sectionNum}>04</span>
                      <span className={styles.sectionTitleText}>Recent Orders</span>
                      <span className={styles.sectionRule} />
                    </div>
                    {recentOrders.length > 0 ? (
                      <div className={styles.timelineList}>
                        {recentOrders.map((o) => (
                          <div key={o.id} className={styles.timelineRow}>
                            <span className={styles.timelineMono}>{o.orderNumber}</span>
                            <span className={styles.timelineDate}>{formatShortDate(o.createdAt)}</span>
                            <OrderStatusBadge status={o.status} />
                            <span className={styles.timelineTotal}>{formatCurrency(o.total)}</span>
                            {o.balanceDue > 0 && (
                              <span className={styles.timelineBalance}>
                                balance {formatCurrency(o.balanceDue)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.emptyNote}>No orders yet.</div>
                    )}
                  </section>

                  {selectedCustomer.notes && (
                    <section className={`${styles.sectionBlock} ${styles.fullSpan} ${styles.notesBlock}`}>
                      <div className={styles.sectionHead}>
                        <span className={styles.sectionNum}>05</span>
                        <span className={styles.sectionTitleText}>Notes</span>
                        <span className={styles.sectionRule} />
                      </div>
                      <p className={styles.notesBody}>{selectedCustomer.notes}</p>
                    </section>
                  )}
                </div>
              )}

              {detailTab === 'orders' && (
                <div className={styles.tableCard}>
                  <DataTable
                    columns={orderColumns}
                    data={orders}
                    emptyMessage="No orders yet"
                  />
                </div>
              )}

              {detailTab === 'payments' && (
                <div className={styles.tableCard}>
                  <DataTable
                    columns={paymentColumns}
                    data={orders.flatMap((o) => o.payments ?? [])}
                    emptyMessage="No payments yet"
                  />
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {printing && selectedCustomer && (
        <CustomerReport customer={selectedCustomer} stats={selectedStats} />
      )}
    </div>
  );
}
