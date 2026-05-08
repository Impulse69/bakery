# POS Cart and Checkout Separation Design

## Purpose
To improve the usability of the Point of Sale (POS) interface by dedicating the entire right-hand pane to the shopping cart (order queue) and moving the transaction completion (checkout) flow into a modal popup. This prevents the checkout controls from blocking the view of the queued items.

## Architecture & Components

1.  **CartPanel (`apps/desktop/src/renderer/components/pos/CartPanel.tsx`)**
    *   The `CartPanel` component will be expanded to take up the full height of the `cartArea`.
    *   A "Proceed to Checkout" button will be added to the bottom of the `CartPanel`, below the totals.
    *   This button will be disabled if the cart is empty or if there are invalid items (e.g., insufficient stock).

2.  **CheckoutModal (New Component: `apps/desktop/src/renderer/components/pos/CheckoutModal.tsx`)**
    *   A new modal component utilizing the existing `Modal` UI primitive (`@bakery/ui`).
    *   It will wrap the `PaymentSection` component, surfacing it only when the user decides to checkout.

3.  **POSPage (`apps/desktop/src/renderer/pages/POSPage.tsx`)**
    *   Will manage a new state variable: `isCheckoutModalOpen`.
    *   Instead of rendering `PaymentSection` directly underneath `CartPanel`, it will render `CartPanel` alone in the `.cartArea` container.
    *   When the "Proceed to Checkout" button is clicked in `CartPanel`, `isCheckoutModalOpen` becomes true.
    *   When true, the `CheckoutModal` (containing `PaymentSection`) is rendered over the page.
    *   Upon successful completion of the sale, generating an invoice, or saving a draft, the modal will close.

## Data Flow
*   State management remains within `POSPage.tsx` (cart items, customer, payment method, amount tendered).
*   `CartPanel` will receive an `onProceedToCheckout` callback to trigger the modal.
*   `PaymentSection` continues to receive its existing props from `POSPage`, but it is now mounted conditionally inside the `CheckoutModal`.

## Error Handling & Edge Cases
*   If the user closes the modal without completing the sale, the cart state is preserved.
*   If the cart becomes invalid (e.g., an external event depletes inventory), the "Proceed to Checkout" button is disabled. If the modal is already open, the `PaymentSection`'s Complete Sale button remains disabled (existing behavior).

## Testing
*   Verify that adding items to the cart fills the vertical space properly without being squished.
*   Verify that clicking "Proceed to Checkout" opens the modal.
*   Verify that completing a sale in the modal closes it and resets the cart.
*   Verify that closing the modal via an X button or clicking outside preserves the cart.
