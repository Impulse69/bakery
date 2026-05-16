import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Product } from "@bakery/types";
import {
  DataTable,
  Pagination,
  Button,
  Modal,
  Input,
  Select,
  Badge,
} from "@bakery/ui";
import type { DataTableColumn, SelectOption } from "@bakery/ui";
import { formatCurrency, can } from "@bakery/utils";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { useAuth } from "../store/AuthContext";
import styles from "./ProductsPage.module.css";

// Only one product category in this bakery — kept as a typed constant so the
// rest of the page (chip, glyph, server payload) stays readable without an enum.
const DEFAULT_CATEGORY = "bread";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "bread", label: "Bread" },
];

const CATEGORY_GLYPH: Record<string, string> = {
  bread: "🍞",
  Bread: "🍞",
};

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: DEFAULT_CATEGORY,
  sellingPriceDisplay: "",
  costPriceDisplay: "",
  description: "",
};

/** Helper: read selling price from product (handles legacy `price` field). */
function getSellingPrice(p: Product): number {
  return (p as Product & { sellingPrice?: number; price?: number }).sellingPrice
    ?? (p as { price?: number }).price
    ?? 0;
}

/** Helper: read cost price from product (handles legacy `wholesalePrice`). */
function getCostPrice(p: Product): number {
  return (p as Product & { costPrice?: number; wholesalePrice?: number }).costPrice
    ?? (p as { wholesalePrice?: number }).wholesalePrice
    ?? 0;
}

export function ProductsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const canSeeCost = user ? can(user.role, "products:cost-view") : false;
  // Only admin/owner can mutate the catalog. Cashier sees a read-only list.
  const canEditCatalog = user
    ? can(user.role, "products:create") || can(user.role, "products:edit")
    : false;
  const canCreateProduct = user ? can(user.role, "products:create") : false;
  const canDeleteProduct = user ? can(user.role, "products:delete") : false;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [includeInactive, setIncludeInactive] = useState(true);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const columns: DataTableColumn<Product>[] = useMemo(() => {
    const base: DataTableColumn<Product>[] = [
      {
        key: "name",
        label: "Product",
        sortable: true,
        render: (row) => (
          <div className={styles.productCell}>
            <span className={styles.productGlyph} aria-hidden="true">
              {CATEGORY_GLYPH[row.category] ?? "📦"}
            </span>
            <div className={styles.productText}>
              <span className={styles.productName}>{row.name}</span>
              {row.description && (
                <span className={styles.productDesc}>{row.description}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        render: (row) => <span className={styles.mono}>{row.sku}</span>,
      },
      {
        key: "sellingPrice",
        label: "Selling Price",
        sortable: true,
        render: (row) => (
          <span className={styles.priceCell}>{formatCurrency(getSellingPrice(row))}</span>
        ),
      },
    ];

    // Cost + Margin columns are admin/owner-only — cashier never sees cost data.
    if (canSeeCost) {
      base.push(
        {
          key: "costPrice",
          label: "Cost",
          render: (row) => (
            <span className={styles.priceCell}>{formatCurrency(getCostPrice(row))}</span>
          ),
        },
        {
          key: "margin",
          label: "Margin",
          render: (row) => {
            const sp = getSellingPrice(row);
            const cp = getCostPrice(row);
            const margin = sp - cp;
            const pct = cp > 0 ? Math.round((margin / cp) * 100) : null;
            const tone = margin < 0 ? styles.marginNeg : styles.marginPos;
            return (
              <span className={`${styles.priceCell} ${tone}`}>
                {formatCurrency(margin)}
                {pct !== null && (
                  <span className={styles.marginPct}> ({pct >= 0 ? "+" : ""}{pct}%)</span>
                )}
              </span>
            );
          },
        },
      );
    }

    base.push({
      key: "isActive",
      label: "Status",
      render: (row) => (
        <Badge variant={row.isActive ? "success" : "danger"}>
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    });

    return base;
  }, [canSeeCost]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Product[]; total: number }>(
        `/products?page=${page}&limit=${limit}&includeInactive=${includeInactive}`,
      );
      setProducts(res.data);
      setTotal(res.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, includeInactive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openAddModal = useCallback(() => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openAddModal();
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, openAddModal]);

  const openEditModal = async (product: Product) => {
    try {
      const full = await api.get<Product>(`/products/${product.id}`);
      setEditingProduct(full);
      setForm({
        name: full.name,
        sku: full.sku,
        category: full.category,
        sellingPriceDisplay: (getSellingPrice(full) / 100).toFixed(2),
        costPriceDisplay: (getCostPrice(full) / 100).toFixed(2),
        description: full.description ?? "",
      });
      setShowModal(true);
    } catch (err: any) {
      showToast(err.message || "Failed to load product", "error");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category) {
      showToast("Name and category are required", "error");
      return;
    }
    const sellingPrice = Math.round(Number(form.sellingPriceDisplay) * 100);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      showToast("Invalid selling price", "error");
      return;
    }
    const costPrice = form.costPriceDisplay.trim()
      ? Math.round(Number(form.costPriceDisplay) * 100)
      : 0;
    if (isNaN(costPrice) || costPrice < 0) {
      showToast("Invalid cost price", "error");
      return;
    }
    if (costPrice > sellingPrice) {
      const ok = window.confirm(
        "Cost price is higher than selling price — every sale will lose money. Save anyway?",
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        category: form.category,
        sellingPrice,
        costPrice,
      };
      // Only send SKU when editing (admin may want to change it); on create,
      // the server auto-generates a sequenced SKU from the category.
      if (editingProduct && form.sku.trim()) {
        body.sku = form.sku.trim();
      }
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, body);
        showToast("Product updated", "success");
      } else {
        await api.post("/products", body);
        showToast("Product created", "success");
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!editingProduct) return;
    const activating = !editingProduct.isActive;

    if (
      !activating &&
      !window.confirm(
        `Deactivate "${editingProduct.name}"? It will be hidden from the POS but kept on record.`,
      )
    )
      return;

    setSaving(true);
    try {
      if (activating) {
        await api.patch(`/products/${editingProduct.id}`, { isActive: true });
        showToast("Product activated", "success");
      } else {
        await api.delete(`/products/${editingProduct.id}`);
        showToast("Product deactivated", "success");
      }
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(
        err.message || `Failed to ${activating ? "activate" : "deactivate"}`,
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!editingProduct) return;
    const first = window.confirm(
      `Permanently delete "${editingProduct.name}"?\n\nThis removes the product and ALL related history — sales order lines, purchase order lines, production batches, daily targets, stock adjustments, and variants. This cannot be undone.\n\nPrefer "Deactivate" if you want to keep history.`,
    );
    if (!first) return;
    const second = window.confirm(
      `Last chance. "${editingProduct.name}" and every record referencing it will be wiped. Continue?`,
    );
    if (!second) return;
    
    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}?permanent=true`);
      showToast("Product permanently deleted", "success");
      closeModal();
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || "Failed to delete product", "error");
    } finally {
      setSaving(false);
    }
  };

  const setField =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const setSelectField =
    (field: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const activeCount = products.filter((p) => p.isActive).length;
  const categoryCount = new Set(products.map((p) => p.category)).size;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Catalog</span>
          <h1 className={styles.heading}>Products</h1>
          <p className={styles.sub}>
            Manage what's available on the terminal and the production sheet.
          </p>
        </div>
        <div className={styles.heroActions}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              color: "var(--bui-text-secondary)",
              fontSize: "0.875rem",
            }}
          >
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
            />
            Show inactive
          </label>
          {canCreateProduct && (
            <Button onClick={openAddModal}>＋ Add Product</Button>
          )}
        </div>
      </header>

      <div className={styles.kpiStrip}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Total on Page</span>
          <span className={styles.kpiValue}>{products.length}</span>
          <span className={styles.kpiFoot}>of {total} across catalog</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Active</span>
          <span className={styles.kpiValue}>{activeCount}</span>
          <span className={styles.kpiFoot}>listed on POS</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Categories</span>
          <span className={styles.kpiValue}>{categoryCount}</span>
          <span className={styles.kpiFoot}>on this page</span>
        </div>
      </div>

      <div className={styles.tableCard}>
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          // Only admin/owner can open the edit modal. Cashiers see a read-only list.
          onRowClick={canEditCatalog ? openEditModal : undefined}
          emptyMessage="No products yet — add your first SKU to get started."
        />
      </div>

      {totalPages > 1 && (
        <div className={styles.pagerWrap}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? "Edit Product" : "Add Product"}
        size="lg"
      >
        <div className={styles.form}>
          <Input label="Name" value={form.name} onChange={setField("name")} />
          {editingProduct && form.category !== DEFAULT_CATEGORY && (
            // Only surfaced when editing a legacy non-bread product, so the
            // admin can migrate it to the canonical category.
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              value={form.category}
              onChange={setSelectField("category")}
            />
          )}
          <Input
            label="Selling Price (GH₵)"
            type="number"
            value={form.sellingPriceDisplay}
            onChange={setField("sellingPriceDisplay")}
            placeholder="0.00"
          />
          {canSeeCost && (
            <Input
              label="Cost Price (GH₵)"
              type="number"
              value={form.costPriceDisplay}
              onChange={setField("costPriceDisplay")}
              placeholder="0.00"
            />
          )}
          {editingProduct && (
            <Input
              label="SKU"
              value={form.sku}
              onChange={setField("sku")}
              placeholder="Auto-generated on create"
            />
          )}

          <div className={styles.actions}>
            {editingProduct && (
              <>
                {canDeleteProduct && (
                  <Button
                    variant="ghost"
                    onClick={handlePermanentDelete}
                    loading={saving}
                  >
                    Delete permanently
                  </Button>
                )}
                <Button
                  variant={editingProduct.isActive ? "danger" : "primary"}
                  onClick={handleToggleActive}
                  loading={saving}
                >
                  {editingProduct.isActive ? "Deactivate" : "Activate"}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingProduct ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
