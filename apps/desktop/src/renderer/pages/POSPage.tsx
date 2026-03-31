import { useState, useEffect, useCallback } from 'react';
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
  const [discountPct, setDiscountPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<SalesOrder | null>(null);

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
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    setCart((prev) => {
      const updated = [...prev];
      if (quantity <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity };
      }
      return updated;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const subtotal = cart.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = cart.reduce((s, item) => s + item.tax * item.quantity, 0);
  const discountAmount = Math.round(subtotal * discountPct / 100);
  const grandTotal = Math.max(0, subtotal + taxTotal - discountAmount);

  const createOrder = useCallback(async () => {
    const items = cart.map((item) => ({
      productId: item.product.id,
      variantId: item.variant?.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: Math.round(item.quantity * item.unitPrice * discountPct / 100),
      tax: item.tax,
    }));

    const order = await api.post<SalesOrder>('/sales-orders', {
      customerId: customerId || undefined,
      locationId: DEFAULT_LOCATION_ID,
      items,
    });

    return order;
  }, [cart, customerId, discountPct]);

  const handleCompleteSale = async () => {
    setLoading(true);
    try {
      const order = await createOrder();

      await api.post(`/sales-orders/${order.id}/payments`, {
        amount: grandTotal,
        method: paymentMethod,
      });

      setLastCompletedOrder(order);
      showToast(`Sale completed! Order ${order.orderNumber}`);
      setCart([]);
      setDiscountPct(0);
      setAmountTendered(0);
      setCustomerId('');
      
      // Auto-print receipt if needed or just let the button handle it
      // handlePrintReceipt(); 
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sale failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = useCallback(() => {
    if (!lastCompletedOrder) {
      showToast('No recent order to print', 'error');
      return;
    }
    // Receipt overlay is already visible after sale; trigger print directly
    window.print();
  }, [lastCompletedOrder, showToast]);

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const order = await createOrder();
      showToast(`Draft saved! Order ${order.orderNumber}`);
      setCart([]);
      setDiscountPct(0);
      setCustomerId('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save draft', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.productArea}>
        <h1 className={styles.heading}>POS / New Sale</h1>
        <ProductGrid products={products} onAddToCart={addToCart} />
      </div>
      <div className={styles.cartArea}>
        <CartPanel
          items={cart}
          onUpdateQuantity={updateQuantity}
          onSetQuantity={setQuantity}
          onRemoveItem={removeItem}
          discountPct={discountPct}
          onDiscountPctChange={setDiscountPct}
        />
        <PaymentSection
          customers={customers}
          selectedCustomerId={customerId}
          onCustomerChange={setCustomerId}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          amountTendered={amountTendered}
          onAmountTenderedChange={setAmountTendered}
          grandTotal={grandTotal}
          onCompleteSale={handleCompleteSale}
          onSaveDraft={handleSaveDraft}
          onPrintReceipt={handlePrintReceipt}
          loading={loading}
          cartEmpty={cart.length === 0}
          hasLastOrder={!!lastCompletedOrder}
        />
      </div>
      {lastCompletedOrder && (
        <Receipt
          order={lastCompletedOrder}
          onClose={() => setLastCompletedOrder(null)}
        />
      )}
    </div>
  );
}
