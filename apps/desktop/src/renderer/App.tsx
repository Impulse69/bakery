import { Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { POSPage } from './pages/POSPage';
import { SalesOrdersPage } from './pages/SalesOrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductionPage } from './pages/ProductionPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AutoUpdater } from './components/AutoUpdater';

// Wrap each route element so a single page's render crash gets caught and
// shown as a recoverable card instead of a white-screen full-app crash.
const safe = (node: ReactNode) => <ErrorBoundary>{node}</ErrorBoundary>;

export function App() {
  return (
    <>
      <AutoUpdater />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={safe(<DashboardPage />)} />
            <Route path="/pos" element={safe(<POSPage />)} />
            <Route path="/sales-orders" element={safe(<SalesOrdersPage />)} />
            <Route path="/products" element={safe(<ProductsPage />)} />
            <Route path="/inventory" element={safe(<InventoryPage />)} />
            <Route path="/production" element={safe(<ProductionPage />)} />
            <Route path="/suppliers" element={safe(<SuppliersPage />)} />
            <Route path="/expenses" element={safe(<ExpensesPage />)} />
            <Route path="/customers" element={safe(<CustomersPage />)} />
            <Route path="/reports" element={safe(<ReportsPage />)} />
            <Route path="/settings" element={safe(<SettingsPage />)} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
