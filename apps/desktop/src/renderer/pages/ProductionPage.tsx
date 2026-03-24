import { useState, useEffect, useCallback } from 'react';
import type { ProductionBatch, Recipe } from '@bakery/types';
import { DataTable, Pagination, Button, Modal, Input, Select, Badge, FormSection, StockBadge } from '@bakery/ui';
import type { DataTableColumn, SelectOption } from '@bakery/ui';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import styles from './ProductionPage.module.css';

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'danger'> = {
  in_progress: 'info',
  completed: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function ProductionPage() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());

  // New batch modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ProductionBatch[]; total: number }>(
        `/production?page=${page}&limit=${limit}&date=${selectedDate}`,
      );
      setBatches(res.data);
      setTotal(res.total);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [page, selectedDate]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Fetch recipes once
  useEffect(() => {
    api
      .get<{ data: Recipe[] }>('/recipes?limit=100')
      .then((res) => setRecipes(res.data))
      .catch(() => {});
  }, []);

  const openNewModal = () => {
    setSelectedRecipeId('');
    setQuantity('');
    setQuantityUnit('');
    setNotes('');
    setShowNewModal(true);
  };

  const handleRecipeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedRecipeId(id);
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      setQuantityUnit(recipe.yieldUnit);
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedRecipeId || !quantity) {
      showToast('Recipe and quantity are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/production', {
        recipeId: selectedRecipeId,
        quantityProduced: Number(quantity),
        quantityUnit,
        notes: notes || undefined,
      });
      showToast('Production batch created', 'success');
      setShowNewModal(false);
      fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to create batch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleting(batchId);
    try {
      await api.patch(`/production/${batchId}/complete`);
      showToast('Batch completed', 'success');
      fetchBatches();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete batch', 'error');
    } finally {
      setCompleting(null);
    }
  };

  const recipeOptions: SelectOption[] = recipes.map((r) => ({
    value: r.id,
    label: `${r.name} (yields ${r.yieldQuantity} ${r.yieldUnit})`,
  }));

  const multiplier = selectedRecipe && Number(quantity)
    ? Number(quantity) / selectedRecipe.yieldQuantity
    : 0;

  const columns: DataTableColumn<ProductionBatch>[] = [
    { key: 'batchNumber', label: 'Batch #', sortable: true },
    {
      key: 'recipe',
      label: 'Recipe',
      render: (row: any) => row.recipe?.name ?? '—',
    },
    {
      key: 'quantityProduced',
      label: 'Quantity',
      render: (row) => `${row.quantityProduced} ${row.quantityUnit}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'startedAt',
      label: 'Started',
      render: (row) => new Date(row.startedAt).toLocaleTimeString(),
    },
    {
      key: 'completedAt',
      label: 'Completed',
      render: (row) => row.completedAt ? new Date(row.completedAt).toLocaleTimeString() : '—',
    },
    {
      key: 'actions',
      label: '',
      render: (row) =>
        row.status === 'in_progress' ? (
          <Button
            size="sm"
            onClick={(e) => handleComplete(row.id, e)}
            loading={completing === row.id}
          >
            Complete
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.heading}>Production</h1>
        <Button onClick={openNewModal}>New Batch</Button>
      </div>

      <div className={styles.filters}>
        <Input
          label="Production Date"
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
        />
      </div>

      <DataTable
        columns={columns}
        data={batches}
        loading={loading}
        emptyMessage="No batches found for this date"
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Production Batch" size="md">
        <div className={styles.form}>
          <Select
            label="Recipe"
            options={recipeOptions}
            value={selectedRecipeId}
            onChange={handleRecipeChange}
            placeholder="Select recipe"
          />
          <Input
            label="Quantity Produced"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Unit"
            value={quantityUnit}
            onChange={(e) => setQuantityUnit(e.target.value)}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {selectedRecipe && selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
            <FormSection title="Ingredients Required">
              <table className={styles.ingredientsTable}>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Required</th>
                    <th>Unit</th>
                    <th>In Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecipe.ingredients.map((ing) => {
                    const required = multiplier > 0
                      ? (ing.quantityRequired * multiplier).toFixed(2)
                      : ing.quantityRequired.toString();
                    const stock = ing.inventoryItem?.quantityOnHand ?? 0;
                    const threshold = ing.inventoryItem?.lowStockThreshold ?? 0;
                    return (
                      <tr key={ing.id}>
                        <td>{ing.inventoryItem?.name ?? '—'}</td>
                        <td>{required}</td>
                        <td>{ing.unit}</td>
                        <td>{stock}</td>
                        <td>
                          <StockBadge currentStock={stock} reorderLevel={threshold} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </FormSection>
          )}

          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreateBatch} loading={saving}>Create Batch</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
