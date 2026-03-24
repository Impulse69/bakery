import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductVariant, Customer, PaymentMethod, SalesOrder } from '@bakery/types';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { PaymentSection } from '../components/pos/PaymentSection';
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
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const subtotal = cart.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxTotal = cart.reduce((s, item) => s + item.tax * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal + taxTotal - discount);

  const createOrder = useCallback(async () => {
    const items = cart.map((item) => ({
      productId: item.product.id,
      variantId: item.variant?.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: 0,
      tax: item.tax,
    }));

    const order = await api.post<SalesOrder>('/sales-orders', {
      customerId: customerId || undefined,
      locationId: DEFAULT_LOCATION_ID,
      items,
    });

    return order;
  }, [cart, customerId]);

  const handleCompleteSale = async () => {
    setLoading(true);
    try {
      const order = await createOrder();

      await api.post(`/sales-orders/${order.id}/payments`, {
        amount: grandTotal,
        method: paymentMethod,
      });

      showToast(`Sale completed! Order ${order.orderNumber}`);
      setCart([]);
      setDiscount(0);
      setAmountTendered(0);
      setCustomerId('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sale failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const order = await createOrder();
      showToast(`Draft saved! Order ${order.orderNumber}`);
      setCart([]);
      setDiscount(0);
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
          onRemoveItem={removeItem}
          discount={discount}
          onDiscountChange={setDiscount}
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
          loading={loading}
          cartEmpty={cart.length === 0}
        />
      </div>
    </div>
  );
}
