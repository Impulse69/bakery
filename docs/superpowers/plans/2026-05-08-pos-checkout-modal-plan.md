# POS Cart and Checkout Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the transaction checkout flow from the main POS pane into a dedicated modal popup, dedicating the right-hand pane exclusively to the order queue.

**Architecture:** We will introduce a new `CheckoutModal` component that wraps the existing `PaymentSection`. `CartPanel` will receive a new "Proceed to Checkout" button. `POSPage` will manage the `isCheckoutModalOpen` state to orchestrate the flow.

**Tech Stack:** React, TypeScript, CSS Modules

---

### Task 1: Create `CheckoutModal` Component

**Files:**
- Create: `apps/desktop/src/renderer/components/pos/CheckoutModal.tsx`
- Create: `apps/desktop/src/renderer/components/pos/CheckoutModal.module.css`

- [ ] **Step 1: Write `CheckoutModal.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(19, 27, 46, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  background: #fffaf2;
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(19, 27, 46, 0.2);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(19, 27, 46, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: 1.25rem;
  color: #131b2e;
  font-weight: 700;
}

.closeBtn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: rgba(19, 27, 46, 0.5);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.closeBtn:hover {
  color: #131b2e;
}

.body {
  padding: 1.5rem;
  max-height: 70vh;
  overflow-y: auto;
}
```

- [ ] **Step 2: Write minimal implementation for `CheckoutModal.tsx`**

```tsx
import { ReactNode } from 'react';
import styles from './CheckoutModal.module.css';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function CheckoutModal({ isOpen, onClose, children }: CheckoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>Complete Sale</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </header>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/pos/CheckoutModal.tsx apps/desktop/src/renderer/components/pos/CheckoutModal.module.css
git commit -m "feat: add CheckoutModal component"
```

### Task 2: Update `CartPanel` Component

**Files:**
- Modify: `apps/desktop/src/renderer/components/pos/CartPanel.tsx`
- Modify: `apps/desktop/src/renderer/components/pos/CartPanel.module.css`

- [ ] **Step 1: Update `CartPanel.module.css` for button styling and layout**
Add these to the end of `CartPanel.module.css`:

```css
.panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.proceedRow {
  padding: 1.5rem;
  border-top: 1px solid rgba(19, 27, 46, 0.1);
  background: #fffaf2;
}

.proceedBtn {
  width: 100%;
  padding: 1rem;
  background: #e07b3c;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.125rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}

.proceedBtn:hover:not(:disabled) {
  background: #d06a2b;
}

.proceedBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Update `CartPanel.tsx` implementation**
Add `onProceedToCheckout` to `CartPanelProps` and render the button below the totals.

```tsx
// Inside CartPanelProps interface add:
  onProceedToCheckout?: () => void;

// Inside CartPanel function arguments add onProceedToCheckout
// Inside the component, find the end of the return statement. Right after <div className={styles.totals}...></div>, add the proceedRow:

      <div className={styles.totals} data-empty={isEmpty}>
        {taxTotal > 0 && (
          <div className={styles.totalRow}>
            <span>Tax</span>
            <span className={styles.num}>{formatCurrency(taxTotal)}</span>
          </div>
        )}
        <div className={styles.grandRow}>
          <span className={styles.grandLabel}>Total</span>
          <span className={styles.grandAmount}>{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className={styles.proceedRow}>
        <button 
          type="button" 
          className={styles.proceedBtn} 
          onClick={onProceedToCheckout}
          disabled={isEmpty || items.some(item => item.quantity > (item.product.stockQuantity || 0))}
        >
          Proceed to Checkout
        </button>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/pos/CartPanel.tsx apps/desktop/src/renderer/components/pos/CartPanel.module.css
git commit -m "feat: add proceed to checkout button in CartPanel"
```

### Task 3: Update `POSPage` Component

**Files:**
- Modify: `apps/desktop/src/renderer/pages/POSPage.tsx`

- [ ] **Step 1: Update `POSPage.tsx` implementation**
Add `isCheckoutModalOpen` state and `CheckoutModal` import. Update the return JSX.

```tsx
// Add import at the top
import { CheckoutModal } from '../components/pos/CheckoutModal';

// Inside POSPage component state declarations add:
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

// Update handleCompleteSale, handleGenerateInvoice, handleSaveDraft to close modal on success (inside their try blocks, after showToast):
      setIsCheckoutModalOpen(false);

// Update the render block (.cartArea)
      <div className={styles.cartArea}>
        <CartPanel
          items={cart}
          onUpdateQuantity={updateQuantity}
          onSetQuantity={setQuantity}
          onRemoveItem={removeItem}
          onProceedToCheckout={() => setIsCheckoutModalOpen(true)}
        />
        <CheckoutModal 
          isOpen={isCheckoutModalOpen} 
          onClose={() => setIsCheckoutModalOpen(false)}
        >
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
            isInvalid={isInvalid}
          />
        </CheckoutModal>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/pages/POSPage.tsx
git commit -m "feat: integrate CheckoutModal into POS flow"
```
