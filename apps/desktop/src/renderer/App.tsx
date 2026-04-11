import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { POSPage } from './pages/POSPage';
import { SalesOrdersPage } from './pages/SalesOrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductionPage } from './pages/ProductionPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { InventoryCountsPage } from './pages/InventoryCountsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AutoUpdater } from './components/AutoUpdater';

export function App() {
  return (
    <>
      <AutoUpdater />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales-orders" element={<SalesOrdersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/inventory-counts" element={<InventoryCountsPage />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
