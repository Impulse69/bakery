import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Product, ProductVariant, Customer, PaymentMethod, SalesOrder } from '@bakery/types';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { PaymentSection } from '../components/pos/PaymentSection';
import { Receipt } from '../components/pos/Receipt';
import styles from './POSPage.module.css';

export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  tax: number;
}

const DEFAULT_LOCATION_ID = 'default';

export function POSPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState(0);

  const [loading, setLoading] = useState(false);
  
  // Persisted last order for re-printing
  const [persistedLastOrder, setPersistedLastOrder] = useState<{ order: SalesOrder; type: 'receipt' | 'invoice' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [searchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('customerId');

  useEffect(() => {
    if (queryCustomerId && customers.some(c => c.id === queryCustomerId)) {
      setCustomerId(queryCustomerId);
    } else if (queryCustomerId && customers.length > 0) {
      // In case we haven't loaded them yet but we just loaded them.
      setCustomerId(queryCustomerId);
    }
  }, [queryCustomerId, customers]);

  useEffect(() => {
    api
      .get<{ data: Product[] }>('/products?limit=100')
      .then((res) => setProducts(res.data))
      .catch(() => showToast('Failed to load products', 'error'));

    api
      .get<{ data: Customer[] }>('/customers?limit=100')
      .then((res) => setCustomers(res.data))
      .catch(() => {});
  }, [showToast]);

  const addToCart = useCallback((product: Product, variant?: ProductVariant) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          (item.variant?.id ?? null) === (variant?.id ?? null),
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      }

      return [
        ...prev,
        {
          product,
          variant,
          quantity: 1,
          unitPrice: variant?.price ?? product.price,
          tax: 0,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = Math.max(0, updated[index].quantity + delta);
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
      return updated;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const subtotal = cart.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = cart.reduce((s, item) => s + item.tax * item.quantity, 0);
  const grandTotal = subtotal + taxTotal;

  const createOrder = useCallback(async () => {
    const items = cart.map((item) => ({
      productId: item.product.id,
      variantId: item.variant?.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      tax: item.tax,
    }));

    const order = await api.post<SalesOrder>('/sales-orders', {
      customerId: customerId || undefined,
      locationId: DEFAULT_LOCATION_ID,
      items,
    });

    return order;
  }, [cart, customerId]);

  const resetCart = () => {
    setCart([]);
    setAmountTendered(0);
    setCustomerId('');
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const order = await createOrder();
      await api.post(`/sales-orders/${order.id}/payments`, {
        amount: grandTotal,
        method: paymentMethod,
      });

      const fullOrder = await api.get<SalesOrder>(`/sales-orders/${order.id}`);
      setPersistedLastOrder({ order: fullOrder, type: 'invoice' });
      setShowPreview(true);
      showToast(`Sale completed! Order ${order.orderNumber}`);
      resetCart();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sale failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const order = await createOrder();
      const fullOrder = await api.get<SalesOrder>(`/sales-orders/${order.id}`);
      setPersistedLastOrder({ order: fullOrder, type: 'invoice' });
      setShowPreview(true);
      showToast(`Invoice generated for ${order.orderNumber}`);
      resetCart();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLast = useCallback(() => {
    if (!persistedLastOrder) {
      showToast('No recent order to print', 'error');
      return;
    }
    setShowPreview(true);
  }, [persistedLastOrder, showToast]);

  const handleSaveDraft = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const order = await createOrder();
      showToast(`Draft saved! Order ${order.orderNumber}`);
      resetCart();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save draft', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.productArea}>
        <header className={styles.terminalHeader}>
          <div className={styles.terminalTitleGroup}>
            <span className={styles.terminalEyebrow}>Sales Terminal</span>
            <h1 className={styles.terminalTitle}>Ring up an order</h1>
            <p className={styles.terminalSub}>Tap a product to add it to the ticket.</p>
          </div>
          <div className={styles.terminalMeta}>
            <span>In catalog</span>
            <strong>{products.length}</strong>
          </div>
        </header>
        <ProductGrid products={products} onAddToCart={addToCart} />
      </div>
      <div className={styles.cartArea}>
        <CartPanel
          items={cart}
          onUpdateQuantity={updateQuantity}
          onSetQuantity={setQuantity}
          onRemoveItem={removeItem}
        />
        <PaymentSection
          customers={customers}
          selectedCustomerId={customerId}
          onCustomerChange={setCustomerId}
          onCustomersChange={setCustomers}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          amountTendered={amountTendered}
          onAmountTenderedChange={setAmountTendered}
          grandTotal={grandTotal}
          onCompleteSale={handleCompleteSale}
          onGenerateInvoice={handleGenerateInvoice}
          onPrintLast={handlePrintLast}
          onSaveDraft={handleSaveDraft}
          loading={loading}
          cartEmpty={cart.length === 0}
          hasLastOrder={!!persistedLastOrder}
        />
      </div>
      {showPreview && persistedLastOrder && (
        <Receipt
          order={persistedLastOrder.order}
          type={persistedLastOrder.type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
