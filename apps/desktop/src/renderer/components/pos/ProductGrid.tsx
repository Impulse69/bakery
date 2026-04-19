import { useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@bakery/types';
import { SearchInput, Modal, Button } from '@bakery/ui';
import { formatCurrency } from '@bakery/utils';
import styles from './ProductGrid.module.css';

import breadIcon from '../../assets/categories/bread.png';
import pastryIcon from '../../assets/categories/pastry.png';
import cakeIcon from '../../assets/categories/cake.png';
import snackIcon from '../../assets/categories/snack.png';
import drinkIcon from '../../assets/categories/drink.png';
import otherIcon from '../../assets/categories/other.png';

import sugarBreadImg from '../../assets/products/sugar_bread.png';
import teaBreadImg from '../../assets/products/tea_bread.png';
import butterBreadImg from '../../assets/products/butter_bread.png';
import wheatBreadImg from '../../assets/products/wheat_bread.png';
import cocoaBreadImg from '../../assets/products/cocoa_bread.png';

const CATEGORY_ICONS: Record<string, string> = {
  Bread: breadIcon,
  Pastry: pastryIcon,
  Cake: cakeIcon,
  Snack: snackIcon,
  Drink: drinkIcon,
  Other: otherIcon,
};

const PRODUCT_IMAGES: Record<string, string> = {
  'Sugar Bread': sugarBreadImg,
  'Tea Bread': teaBreadImg,
  'Butter Bread': butterBreadImg,
  'Wheat Bread': wheatBreadImg,
  'Cocoa Bread': cocoaBreadImg,
};

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

  const isSoldOut = (p: Product) => p.isAvailable === false || (p.stockQuantity ?? 0) <= 0;

  const handleClick = (product: Product) => {
    if (isSoldOut(product)) return;
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
      <div className={styles.searchWrap}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search breads, pastries, cakes…"
        />
      </div>
      <div className={styles.grid}>
        {filtered.map((product) => {
          const soldOut = isSoldOut(product);
          return (
            <button
              key={product.id}
              className={`${styles.card} ${soldOut ? styles.soldOut : ''}`}
              onClick={() => handleClick(product)}
              disabled={soldOut}
            >
              {soldOut && <span className={styles.soldOutBadge}>Sold Out</span>}
              <div className={styles.iconWrapper}>
                <img
                  src={PRODUCT_IMAGES[product.name] || CATEGORY_ICONS[product.category] || otherIcon}
                  alt={product.name}
                  className={styles.categoryIcon}
                />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.name}>{product.name}</span>
                <span className={styles.category}>{product.category}</span>
                <span className={styles.price}>{formatCurrency(product.price)}</span>
              </div>
            </button>
          );
        })}
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
