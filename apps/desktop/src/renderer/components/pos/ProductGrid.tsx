import { useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@bakery/types';
import { SearchInput, Modal, Button } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [search, setSearch] = useState('');
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  const handleClick = (product: Product) => {
    const activeVariants = product.variants?.filter((v) => v.isActive);
    if (activeVariants && activeVariants.length > 0) {
      setVariantProduct(product);
    } else {
      onAddToCart(product);
    }
  };

  const handleVariantSelect = (variant: ProductVariant) => {
    if (variantProduct) {
      onAddToCart(variantProduct, variant);
      setVariantProduct(null);
    }
  };

  return (
    <div className={styles.container}>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search products..."
      />
      <div className={styles.grid}>
        {filtered.map((product) => (
          <button
            key={product.id}
            className={styles.card}
            onClick={() => handleClick(product)}
          >
            <span className={styles.name}>{product.name}</span>
            <span className={styles.category}>{product.category}</span>
            <span className={styles.price}>{formatCurrency(product.price)}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className={styles.empty}>No products found</p>
        )}
      </div>

      <Modal
        isOpen={!!variantProduct}
        onClose={() => setVariantProduct(null)}
        title={`Select variant — ${variantProduct?.name}`}
        size="sm"
      >
        <div className={styles.variants}>
          {variantProduct?.variants
            ?.filter((v) => v.isActive)
            .map((variant) => (
              <Button
                key={variant.id}
                variant="secondary"
                onClick={() => handleVariantSelect(variant)}
                className={styles.variantBtn}
              >
                {variant.name} — {formatCurrency(variant.price)}
              </Button>
            ))}
        </div>
      </Modal>
    </div>
  );
}
