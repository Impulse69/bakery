import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductStockAdjustment } from '@bakery/types';
import { Button, Input, Select, DataTable, StatCard } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './ReportsPage.module.css';

type Tab = 'daily' | 'stock' | 'sales';

interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalExpenses: number;
  profit: number;
}

interface SalesProduct {
  product: { id: string; name: string; sku: string };
  totalQuantity: number;
  totalRevenue: number;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function get30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

const stockColumns: DataTableColumn<ProductStockAdjustment>[] = [
  {
    key: 'createdAt',
    label: 'Date',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: 'quantityChange',
    label: 'Quantity',
    render: (row) => (
      <span style={{ fontWeight: 700 }}>
        {row.quantityChange > 0 ? '+' : ''}{row.quantityChange}
      </span>
    ),
  },
  { key: 'reason', label: 'Reason', render: (row) => row.reason || '—' },
];

const salesColumns: DataTableColumn<SalesProduct>[] = [
  {
    key: 'product',
    label: 'Product',
    render: (row) => row.product.name,
  },
  {
    key: 'sku',
    label: 'SKU',
    render: (row) => row.product.sku,
  },
  {
    key: 'totalQuantity',
    label: 'Qty Sold',
  },
  {
    key: 'totalRevenue',
    label: 'Revenue',
    render: (row) => formatCurrency(row.totalRevenue),
  },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('daily');

  const [reportDate, setReportDate] = useState(getToday());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [stockItemId, setStockItemId] = useState('');
  const [stockFrom, setStockFrom] = useState(get30DaysAgo());
  const [stockTo, setStockTo] = useState(getToday());
  const [adjustments, setAdjustments] = useState<ProductStockAdjustment[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const [salesFrom, setSalesFrom] = useState(get30DaysAgo());
  const [salesTo, setSalesTo] = useState(getToday());
  const [salesData, setSalesData] = useState<SalesProduct[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: Product[] }>('/products?limit=100')
      .then((r) => setProducts(r.data))
      .catch(() => {});
  }, []);

  const fetchDailyReport = useCallback(async () => {
    if (!reportDate) return;
    setDailyLoading(true);
    try {
      const data = await api.get<DailyReport>(`/reports/daily?date=${reportDate}`);
      setDailyReport(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load report', 'error');
      setDailyReport(null);
    } finally {
      setDailyLoading(false);
    }
  }, [reportDate, showToast]);

  useEffect(() => {
    if (activeTab === 'daily') fetchDailyReport();
  }, [activeTab, fetchDailyReport]);

  const fetchStockReport = async () => {
    if (!stockItemId) {
      showToast('Select a product', 'error');
      return;
    }
    setStockLoading(true);
    try {
      let params = `/reports/stock-adjustment?productId=${stockItemId}`;
      if (stockFrom) params += `&from=${new Date(stockFrom).toISOString()}`;
      if (stockTo) params += `&to=${new Date(stockTo + 'T23:59:59').toISOString()}`;
      const data = await api.get<ProductStockAdjustment[]>(params);
      setAdjustments(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load stock data', 'error');
    } finally {
      setStockLoading(false);
    }
  };

  const fetchSalesReport = async () => {
    setSalesLoading(true);
    try {
      let params = '/reports/sales-by-product?';
      if (salesFrom) params += `from=${new Date(salesFrom).toISOString()}&`;
      if (salesTo) params += `to=${new Date(salesTo + 'T23:59:59').toISOString()}`;
      const data = await api.get<SalesProduct[]>(params);
      setSalesData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load sales data', 'error');
    } finally {
      setSalesLoading(false);
    }
  };

  const itemOptions: SelectOption[] = products.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Analytics</span>
          <h1 className={styles.heading}>Reports</h1>
          <p className={styles.heroQuote}>
            <em>Daily totals, stock movements, product performance.</em>
          </p>
        </div>
      </header>

      <div className={styles.ledgerCard}>
        <div className={styles.tabsRow}>
          <button
            className={`${styles.tab} ${activeTab === 'daily' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            Daily Summary
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'stock' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('stock')}
          >
            Stock Movement
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'sales' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            Sales by Product
          </button>
        </div>
      </div>

      {activeTab === 'daily' && (
        <>
          <div className={styles.ledgerCard}>
            <div className={styles.filters}>
              <Input
                label="Date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
          </div>
          {dailyLoading ? (
            <p>Loading report...</p>
          ) : dailyReport ? (
            <div className={styles.statsGrid}>
              <div className={styles.statTile}>
                <StatCard label="Total Orders" value={dailyReport.totalOrders} />
              </div>
              <div className={styles.statTile}>
                <StatCard label="Revenue" value={formatCurrency(dailyReport.totalRevenue)} />
              </div>
              <div className={styles.statTile}>
                <StatCard label="Tax Collected" value={formatCurrency(dailyReport.totalTax)} />
              </div>
              <div className={styles.statTile}>
                <StatCard label="Expenses" value={formatCurrency(dailyReport.totalExpenses)} />
              </div>
              <div className={styles.statTile}>
                <StatCard
                  label="Profit"
                  value={formatCurrency(dailyReport.profit)}
                  trend={dailyReport.profit > 0 ? 'up' : dailyReport.profit < 0 ? 'down' : 'neutral'}
                />
              </div>
            </div>
          ) : (
            <p>No data for this date</p>
          )}
        </>
      )}

      {activeTab === 'stock' && (
        <>
          <div className={styles.ledgerCard}>
            <div className={styles.filters}>
              <Select
                label="Product"
                options={itemOptions}
                value={stockItemId}
                onChange={(e) => setStockItemId(e.target.value)}
                placeholder="Select product"
              />
              <Input
                label="From"
                type="date"
                value={stockFrom}
                onChange={(e) => setStockFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={stockTo}
                onChange={(e) => setStockTo(e.target.value)}
              />
              <Button onClick={fetchStockReport} loading={stockLoading}>Load</Button>
            </div>
          </div>
          <div className={styles.tableCard}>
            <DataTable
              columns={stockColumns}
              data={adjustments}
              loading={stockLoading}
              emptyMessage="No adjustments found"
            />
          </div>
        </>
      )}

      {activeTab === 'sales' && (
        <>
          <div className={styles.ledgerCard}>
            <div className={styles.filters}>
              <Input
                label="From"
                type="date"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
              />
              <Button onClick={fetchSalesReport} loading={salesLoading}>Load</Button>
            </div>
          </div>
          <div className={styles.tableCard}>
            <DataTable
              columns={salesColumns}
              data={salesData}
              loading={salesLoading}
              emptyMessage="No sales data found"
            />
          </div>
        </>
      )}
    </div>
  );
}
