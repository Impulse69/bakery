import { useState, useEffect, useCallback } from 'react';
import type { InventoryItem, StockAdjustment } from '@bakery/types';
import { Button, Input, Select, DataTable, StatCard, Badge } from '@bakery/ui';
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

const ADJUSTMENT_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
  purchase: 'success',
  production: 'info',
  waste: 'danger',
  correction: 'warning',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function get30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

const stockColumns: DataTableColumn<StockAdjustment>[] = [
  {
    key: 'createdAt',
    label: 'Date',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: 'adjustmentType',
    label: 'Type',
    render: (row) => (
      <Badge variant={ADJUSTMENT_VARIANT[row.adjustmentType] ?? 'neutral'}>
        {row.adjustmentType.charAt(0).toUpperCase() + row.adjustmentType.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'quantityChange',
    label: 'Quantity',
    render: (row) => (
      <span style={{ fontWeight: 600 }}>
        {row.quantityChange > 0 ? '+' : ''}{row.quantityChange}
      </span>
    ),
  },
  { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
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

  // Daily tab
  const [reportDate, setReportDate] = useState(getToday());
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Stock tab
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockItemId, setStockItemId] = useState('');
  const [stockFrom, setStockFrom] = useState(get30DaysAgo());
  const [stockTo, setStockTo] = useState(getToday());
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Sales tab
  const [salesFrom, setSalesFrom] = useState(get30DaysAgo());
  const [salesTo, setSalesTo] = useState(getToday());
  const [salesData, setSalesData] = useState<SalesProduct[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  // Load inventory items for stock picker
  useEffect(() => {
    api.get<{ data: InventoryItem[] }>('/inventory?limit=100')
      .then((r) => setInventoryItems(r.data))
      .catch(() => {});
  }, []);

  // Auto-fetch daily report on date change
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
      showToast('Select an inventory item', 'error');
      return;
    }
    setStockLoading(true);
    try {
      let params = `/reports/stock-adjustment?itemId=${stockItemId}`;
      if (stockFrom) params += `&from=${new Date(stockFrom).toISOString()}`;
      if (stockTo) params += `&to=${new Date(stockTo + 'T23:59:59').toISOString()}`;
      const data = await api.get<StockAdjustment[]>(params);
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

  const itemOptions: SelectOption[] = inventoryItems.map((i) => ({
    value: i.id,
    label: `${i.name} (${i.unit})`,
  }));

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Reports</h1>
      </div>

      <div className={styles.tabs}>
        <Button
          variant={activeTab === 'daily' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('daily')}
        >
          Daily Summary
        </Button>
        <Button
          variant={activeTab === 'stock' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('stock')}
        >
          Stock Movement
        </Button>
        <Button
          variant={activeTab === 'sales' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('sales')}
        >
          Sales by Product
        </Button>
      </div>

      {/* Daily Summary Tab */}
      {activeTab === 'daily' && (
        <div>
          <div className={styles.filters}>
            <Input
              label="Date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          {dailyLoading ? (
            <p>Loading report...</p>
          ) : dailyReport ? (
            <div className={styles.statsGrid}>
              <StatCard label="Total Orders" value={dailyReport.totalOrders} />
              <StatCard label="Revenue" value={formatCurrency(dailyReport.totalRevenue)} />
              <StatCard label="Tax Collected" value={formatCurrency(dailyReport.totalTax)} />
              <StatCard label="Expenses" value={formatCurrency(dailyReport.totalExpenses)} />
              <StatCard
                label="Profit"
                value={formatCurrency(dailyReport.profit)}
                trend={dailyReport.profit > 0 ? 'up' : dailyReport.profit < 0 ? 'down' : 'neutral'}
              />
            </div>
          ) : (
            <p>No data for this date</p>
          )}
        </div>
      )}

      {/* Stock Movement Tab */}
      {activeTab === 'stock' && (
        <div>
          <div className={styles.filters}>
            <Select
              label="Inventory Item"
              options={itemOptions}
              value={stockItemId}
              onChange={(e) => setStockItemId(e.target.value)}
              placeholder="Select item"
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
          <DataTable
            columns={stockColumns}
            data={adjustments}
            loading={stockLoading}
            emptyMessage="No adjustments found"
          />
        </div>
      )}

      {/* Sales by Product Tab */}
      {activeTab === 'sales' && (
        <div>
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
          <DataTable
            columns={salesColumns}
            data={salesData}
            loading={salesLoading}
            emptyMessage="No sales data found"
          />
        </div>
      )}
    </div>
  );
}
