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

import butterRollImg from '../../assets/products/butter_roll.png';
import chickenPieImg from '../../assets/products/chicken_pie.png';
import chocolateCakeImg from '../../assets/products/chocolate_cake.png';
import cocaColaImg from '../../assets/products/coca_cola.png';
import doughnutImg from '../../assets/products/doughnut.png';
import meatPieImg from '../../assets/products/meat_pie.png';
import redVelvetImg from '../../assets/products/red_velvet.png';
import sausageRollImg from '../../assets/products/sausage_roll.png';
import springWaterImg from '../../assets/products/spring_water.png';

const CATEGORY_ICONS: Record<string, string> = {
  Bread: breadIcon,
  Pastry: pastryIcon,
  Cake: cakeIcon,
  Snack: snackIcon,
  Drink: drinkIcon,
  Other: otherIcon,
};

const PRODUCT_IMAGES: Record<string, string> = {
  'Butter Roll (6 pack)': butterRollImg,
  'Chicken Pie': chickenPieImg,
  'Chocolate Cake': chocolateCakeImg,
  'Coca-Cola 500ml': cocaColaImg,
  'Doughnut (Sugared)': doughnutImg,
  'Meat Pie': meatPieImg,
  'Red Velvet Cake': redVelvetImg,
  'Sausage Roll': sausageRollImg,
  'Spring Water 500ml': springWaterImg,
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
