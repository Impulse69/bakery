import { useState, useEffect } from 'react';
import type { Product } from '@bakery/types';
import { Button, Input, SearchInput, Select } from '@bakery/ui';
import type { SelectOption } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import { api } from '../../lib/api';
import { useToast } from '../Toast';
import { ReasonPicker } from './ReasonPicker';
import styles from './AddItemPicker.module.css';

interface Props {
  orderId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function getSellingPrice(p: Product): number {
  return (p as { sellingPrice?: number; price?: number }).sellingPrice
    ?? (p as { price?: number }).price
    ?? 0;
}

function getVariantPrice(v: { price?: number; sellingPrice?: number } | undefined): number {
  if (!v) return 0;
  return v.sellingPrice ?? v.price ?? 0;
}

/** Inline "add item to existing order" form used in OrderDetailModal. */
export function AddItemPicker({ orderId, onAdded, onCancel }: Props) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ data: Product[] }>('/products?limit=200&includeInactive=false')
      .then((res) => setProducts(res.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = products.find((p) => p.id === selectedId);
  const activeVariants = selected?.variants?.filter((v) => v.isActive) ?? [];

  const variantOptions: SelectOption[] = activeVariants.map((v) => ({
    value: v.id,
    label: `${v.name} — ${formatCurrency(getVariantPrice(v))}`,
  }));

  const computedUnitPrice = (() => {
    if (!selected) return 0;
    if (activeVariants.length > 0 && variantId) {
      return getVariantPrice(activeVariants.find((v) => v.id === variantId));
    }
    return getSellingPrice(selected);
  })();

  const qty = Math.max(1, parseInt(quantity, 10) || 0);
  const lineTotal = qty * computedUnitPrice;

  const handleAdd = async () => {
    if (!selected) {
      showToast('Pick a product first', 'error');
      return;
    }
    if (activeVariants.length > 0 && !variantId) {
      showToast('Pick a variant', 'error');
      return;
    }
    if (qty < 1) {
      showToast('Quantity must be at least 1', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please give a reason for adding this item', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/sales-orders/${orderId}/items`, {
        productId: selected.id,
        variantId: variantId || undefined,
        quantity: qty,
        unitPrice: computedUnitPrice,
        reason: reason.trim(),
      });
      showToast('Item added');
      onAdded();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add item', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <strong>Add item to order</strong>
        <span className={styles.preview}>
          {selected ? `${qty} × ${formatCurrency(computedUnitPrice)} = ${formatCurrency(lineTotal)}` : '—'}
        </span>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search product..." />

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>No products match.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.item} ${selectedId === p.id ? styles.itemActive : ''}`}
              onClick={() => {
                setSelectedId(p.id);
                setVariantId('');
              }}
            >
              <span>{p.name}</span>
              <span className={styles.itemPrice}>{formatCurrency(getSellingPrice(p))}</span>
            </button>
          ))
        )}
      </div>

      {selected && activeVariants.length > 0 && (
        <Select
          label="Variant"
          options={variantOptions}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          placeholder="Select variant"
        />
      )}

      <div className={styles.row}>
        <Input
          label="Quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      <div className={styles.reasonField}>
        <label className={styles.reasonLabel}>Reason (required)</label>
        <ReasonPicker
          value={reason}
          onChange={setReason}
          variant="comfy"
          otherPlaceholder="e.g. customer added one more on the way out"
        />
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleAdd} loading={saving}>Add item</Button>
      </div>
    </div>
  );
}
