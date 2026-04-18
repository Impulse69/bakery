import { useState, useMemo, useRef, useEffect } from 'react';
import type { Product } from '@bakery/types';
import { Input } from '@bakery/ui';
import styles from './ProductSearch.module.css';

interface ProductSearchProps {
  products: Product[];
  onSelect: (product: Product) => void;
  placeholder?: string;
}

export function ProductSearch({
  products,
  onSelect,
  placeholder = 'Search products to add...',
}: ProductSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return products.slice(0, 10);
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={styles.searchInput}
      />

      {isOpen && (
        <div className={styles.dropdown}>
          {filtered.length > 0 ? (
            <div className={styles.list}>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className={styles.item}
                  onClick={() => handleSelect(p)}
                >
                  <div className={styles.itemName}>{p.name}</div>
                  <div className={styles.itemSub}>{p.sku} | {p.category}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>No products found.</div>
          )}
        </div>
      )}
    </div>
  );
}
