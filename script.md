# Bread Faculty — System Overview

This document explains how the Bread Faculty bakery management system works. It covers every module, every user role, and every workflow your staff will use day-to-day.

---

## What is Bread Faculty?

Bread Faculty is a bakery management system built for your shop. It has two interfaces:

1. **Desktop App** (Windows) — Used by your staff in the shop: cashiers, bakers, and admins. Handles sales, inventory, production, purchasing, and reporting.
2. **Web Dashboard** (coming soon) — A read-only view for the business owner to monitor sales, inventory, and reports remotely from any browser.

Both interfaces connect to a single **server** running on-premise in your shop. The server stores all data in a PostgreSQL database and keeps everything in sync in real time.

---

## User Roles

Every person who uses the system has an account with one of four roles. Each role determines what they can see and do.

### Admin
Full access to everything. Can manage products, inventory, suppliers, staff accounts, and all settings. This is for the shop manager or owner who operates the system daily.

### Cashier
Focused on sales. A cashier can:
- Use the POS to ring up sales
- View and manage sales orders
- Add and view customers
- View products and inventory (read-only)

A cashier **cannot** add products, adjust inventory, create purchase orders, or view financial reports.

### Baker
Focused on production. A baker can:
- View the dashboard
- Create and complete production batches
- View inventory levels (to check ingredient stock)
- View products and recipes

A baker **cannot** make sales, manage suppliers, or view financial reports.

### Owner (Web only)
Read-only access to everything. The owner can view all data — sales, inventory, reports, expenses — but cannot create, edit, or delete anything. This role is designed for the web dashboard so the owner can monitor the business remotely.

---

## Logging In

1. Open the Bread Faculty desktop app.
2. Enter your email address and password.
3. Click **Log In**.

If the credentials are correct, you're taken to the Dashboard. If not, an error message appears. The system remembers your login until you log out.

To **log out**, click the **Logout** button in the top-right corner of the screen. This is visible on every page.

---

## The Sidebar

The left side of the screen shows the navigation menu. It displays only the pages your role has access to. For example, a cashier won't see "Suppliers" or "Reports."

The menu items are:

| Menu Item | Who Can See It |
|-----------|----------------|
| Dashboard | Everyone |
| POS / New Sale | Admin, Cashier |
| Sales Orders | Admin, Cashier, Owner |
| Products | Everyone |
| Inventory | Admin, Cashier, Baker |
| Inventory Counts | Admin, Owner |
| Production | Admin, Baker |
| Suppliers | Admin, Owner |
| Purchase Orders | Admin, Owner |
| Expenses | Admin, Owner |
| Customers | Admin, Cashier |
| Reports | Admin, Owner |
| Settings | Admin |

---

## Dashboard

The dashboard is the home screen. It shows a summary of today's business at a glance:

- **Today's Sales Revenue** — Total money earned from sales today
- **Today's Order Count** — Number of orders placed today
- **Today's Expenses** — Total expenses recorded today
- **Today's Profit** — Revenue minus expenses

These numbers update in real time. When a cashier completes a sale at the POS, the dashboard updates automatically without refreshing.

---

## POS / New Sale (Point of Sale)

This is where cashiers ring up sales. The screen is split into two sections:

### Left Side — Product Grid
All available products are displayed as clickable tiles. Click a product to add it to the cart. If a product has **variants** (e.g., "Small Loaf" and "Large Loaf"), a popup appears asking which variant to add.

### Right Side — Cart & Payment

**Cart:**
- Shows all items added to the current sale
- Each line shows: product name, quantity, unit price, and line total
- Use **+** and **-** buttons to change quantities
- Click the **X** button to remove an item
- Enter a **discount** amount (optional) — this applies to the whole order

**Customer:**
- Select an existing customer from the dropdown, or leave as "Walk-in" for anonymous sales

**Payment:**
- Choose a payment method: **Cash**, **MoMo** (Mobile Money), **Card**, or **Credit**
- For cash payments, enter the **amount tendered** — the system calculates change automatically
- The **total**, **tax**, and **balance due** are displayed clearly

**Actions:**
- **Complete Sale** — Finalizes the order, records the payment, and clears the cart. The order is immediately marked as "Paid."
- **Save as Draft** — Saves the order without payment. Useful for phone orders or orders being prepared for later pickup. The order appears in Sales Orders with "Draft" status.

### All amounts are in Ghana Cedis (GH₵)
Internally, the system stores all money in **pesewas** (1 cedi = 100 pesewas) for precision. But everything you see on screen is displayed in cedis with two decimal places.

---

## Sales Orders

This page shows all orders across their lifecycle. Use the **status tabs** at the top to filter:

| Tab | What It Shows |
|-----|---------------|
| All | Every order |
| Draft | Saved but not yet confirmed |
| Confirmed | Customer-confirmed orders |
| Invoiced | Orders with invoices generated |
| Paid | Fully paid orders |

The table shows: order number, customer name (or "Walk-in"), date, total amount, status, amount paid, and balance due. Click any row to open the **Order Detail** view.

### Order Detail Modal

The detail view shows:
- Full order information (number, date, customer, status)
- Line items table (product, quantity, unit price, discount, tax, total per line)
- Order totals (subtotal, tax, discount, grand total, paid, balance)
- Payment history (all payments made against this order)

### Order Lifecycle

Orders move through these statuses:

```
Draft → Confirmed → Picked → Invoiced → Paid
                                          ↑
         (any status can also → Cancelled)
```

At each stage, the detail modal shows the appropriate action button:
- **Draft**: "Confirm" button
- **Confirmed**: "Mark Picked" button (items have been prepared)
- **Picked**: "Generate Invoice" button
- **Invoiced**: "Add Payment" button — opens a payment form where you enter the amount and method
- When the balance due reaches zero, the order automatically moves to **Paid**

You can **cancel** an order at any stage (except Paid or already Cancelled).

---

## Products

The Products page lists all products with: name, category, SKU, price, number of variants, and active status.

### Adding a Product
1. Click **Add Product**
2. Fill in: Name, SKU (stock keeping unit — a unique code), Category (Bread, Pastry, Cake, Snack, Drink, Other), Price (in cedis), and optional Description
3. Click **Create**

### Editing a Product
Click any product row to open the edit modal. You can change any field and click **Update**. If the product has variants, they are shown at the bottom of the modal (name, SKU, price, and active status for each).

### Deactivating a Product
In the edit modal, click **Deactivate** to hide a product from the POS and product list. This is a soft delete — the product's sales history is preserved. It can be reactivated from the database.

---

## Inventory

The Inventory page tracks all raw materials and supplies. The table shows: item name, unit of measurement, current stock level, stock status badge, reorder level, and reorder quantity.

### Stock Status Badges
- **In Stock** (green) — Healthy stock level
- **Low Stock** (amber) — Stock is at or below the reorder level
- **Out of Stock** (red) — Zero or negative stock

### Adding an Inventory Item
1. Click **Add Item**
2. Fill in: Name, Unit (kg, g, l, ml, unit, pack), Quantity on Hand, Low Stock Threshold, Reorder Quantity
3. Click **Create**

### Item Detail (Click a Row)
Opens a detail modal with two tabs:

**Details Tab:**
- Shows all item information and current stock badge
- **Adjust Stock** button expands a form:
  - Enter a positive number to add stock (e.g., +50 after a delivery)
  - Enter a negative number to remove stock (e.g., -5 for waste)
  - Enter a reason (required)
  - Click **Submit Adjustment**

**Stock History Tab:**
- Shows all stock adjustments for this item: date, type (Purchase, Production, Waste, Correction), quantity change, and notes
- Useful for auditing — see exactly when and why stock changed

---

## Inventory Counts

Physical inventory counts let you verify actual stock against what the system thinks you have.

### Starting a New Count
1. Click **Start New Count**
2. The system creates a count sheet with every inventory item and its expected quantity (what the system says you should have)

### Performing the Count
3. For each item, enter the **actual quantity** you physically counted
4. The **discrepancy** column automatically shows the difference (actual - expected)
5. Click **Save Progress** at any time to save your work without finishing

### Completing the Count
6. When all items are counted, click **Complete Count**
7. The system automatically creates stock adjustments for every item where the actual quantity differs from the expected quantity
8. Inventory levels are updated to match your physical count

### Viewing Past Counts
The main table shows all counts with their date, status (In Progress, Completed, Cancelled), who created it, and how many items were counted. Click any row to view the details.

---

## Production

The Production page tracks what your bakers produce each day.

### Viewing Batches
- Use the **date picker** to view batches for any day (defaults to today)
- The table shows: batch number, recipe name, quantity produced, status, start time, and completion time
- **In Progress** batches have a **Complete** button

### Creating a New Batch
1. Click **New Batch**
2. Select a **Recipe** from the dropdown (shows recipe name and yield per batch)
3. Enter the **quantity** to produce and the **unit**
4. The modal shows an **Ingredients Required** table:
   - Each ingredient's name, the amount needed for your quantity, unit, current stock level, and stock status
   - This lets you verify you have enough ingredients before starting
5. Add optional notes
6. Click **Create Batch**

When a batch is created, the system **automatically deducts** the required ingredients from inventory. For example, if a bread recipe uses 2kg of flour and you make 10 batches, 20kg of flour is deducted from your flour inventory.

### Completing a Batch
Click the **Complete** button on any in-progress batch. This marks it as finished and records the completion time.

---

## Suppliers

Simple management of your ingredient and supply vendors.

### Viewing Suppliers
The table shows: name, contact person, phone, email, and city.

### Adding a Supplier
1. Click **Add Supplier**
2. Fill in contact information (name, contact person, email, phone) and address details (address, city, postal code, country)
3. Optionally add payment terms (e.g., "Net 30", "Cash on delivery")
4. Click **Create**

### Editing a Supplier
Click any row to open the edit modal. Update any fields and click **Update**.

---

## Purchase Orders

Track orders you place with suppliers for ingredients and supplies.

### Viewing Purchase Orders
- Use **status tabs** to filter: All, Draft, Submitted, Received, Cancelled
- The table shows: PO number, supplier name, total amount, status, order date, and expected delivery date

### Creating a Purchase Order
1. Click **New Purchase Order**
2. Select a **Supplier** from the dropdown
3. Set an **Expected Delivery Date** (optional)
4. Add **Line Items**:
   - Select an inventory item from the dropdown
   - Enter quantity, unit, and unit cost (in cedis)
   - The line total is calculated automatically
   - Click **+ Add Item** to add more lines
   - Click **X** to remove a line
5. The **grand total** updates as you add items
6. Click **Create**

### Purchase Order Lifecycle

```
Draft → Submitted → Received
          ↓
       Cancelled
```

Click any PO row to open the detail view. Action buttons appear based on the current status:

- **Draft**: "Submit" (marks as sent to supplier) or "Cancel"
- **Submitted**: "Mark Received" or "Cancel"
- **Received**: No actions (complete)

**When you mark a PO as Received**, the system **automatically adds** the ordered quantities to your inventory. For example, if you ordered 100kg of flour, your flour inventory increases by 100kg.

---

## Expenses

Track all business expenses.

### Viewing Expenses
- Use the **date range picker** (From / To) to filter expenses by date. Defaults to the current month.
- The table shows: expense number, category, description, amount, payment method, and date
- A **Page Total** appears below the table showing the sum of expenses on the current page

### Recording an Expense
1. Click **Add Expense**
2. Fill in:
   - **Category**: Utilities, Wages, Packaging, Ingredients, Maintenance, or Other
   - **Description**: What the expense was for
   - **Amount**: In cedis
   - **Payment Method**: Cash, MoMo, Card, or Credit
   - **Date**: When the expense occurred
   - **Receipt URL**: Optional link to a receipt image
   - **Notes**: Optional additional details
3. Click **Save**

---

## Customers

Manage your regular customers and their credit balances.

### Viewing Customers
- Use the **search bar** to find customers by name or phone number
- The table shows: name, phone, email, credit balance, and registration date

### Adding a Customer
1. Click **Add Customer**
2. Fill in: Name (required), Phone, Email, Address, Notes
3. Click **Create**

### Customer Detail (Click a Row)
Opens a detail modal showing:
- Contact information (phone, email, address, notes)
- **Credit balance** (how much the customer owes or has prepaid)
- **Recent Orders** — A table of their last 20 sales orders with order number, date, total, and status

---

## Reports

The Reports page has three tabs for different types of analysis.

### Daily Summary
1. Select a **date** using the date picker
2. The system displays five stat cards:
   - **Total Orders** — Number of orders placed that day
   - **Revenue** — Total sales income
   - **Tax Collected** — Total tax from sales
   - **Expenses** — Total expenses recorded that day
   - **Profit** — Revenue minus expenses (shown with an up or down arrow)

### Stock Movement
Track how inventory moved over time:
1. Select an **Inventory Item** from the dropdown
2. Set a **date range** (From / To)
3. Click **Load**
4. A table shows every stock adjustment: date, type (Purchase, Production, Waste, Correction), quantity change (positive for additions, negative for deductions), and notes

This is useful for investigating why an item's stock level changed, or for identifying patterns like consistent waste.

### Sales by Product
See which products sell the most:
1. Set a **date range** (From / To)
2. Click **Load**
3. A table shows every product sold in that period, ranked by revenue: product name, SKU, quantity sold, and total revenue

---

## Currency

All monetary amounts throughout the system use **Ghana Cedis (GH₵)**:
- Displayed with two decimal places (e.g., GH₵ 12.50)
- Stored internally in pesewas (smallest unit) for precision — this prevents rounding errors
- When entering prices or amounts in forms, you type in cedis (e.g., "12.50") and the system handles the conversion

---

## Real-Time Updates

The system uses WebSocket connections to push updates in real time:
- When a sale is completed at the POS, the **Dashboard** updates immediately — no need to refresh
- Stock level changes (from sales, production, purchase receiving, or inventory counts) are broadcast to all connected clients

---

## Data Safety

- **Soft deletes**: Products are never truly deleted — they are deactivated. All historical sales data is preserved.
- **Transaction safety**: Complex operations (like creating a production batch that deducts multiple ingredients, or receiving a purchase order that stocks multiple items) happen atomically — either everything succeeds or nothing changes.
- **Auto-generated numbers**: Order numbers (SO-0001), PO numbers (PO-0001), expense numbers (EX-0001), and batch numbers (PB-0001) are auto-generated sequentially by the server. You never need to enter these manually.

---

## Technical Setup (for IT)

### Architecture
- **Desktop App**: Electron + React (TypeScript), runs on Windows
- **Server**: Node.js + Express + Socket.io, runs on the shop's machine
- **Database**: PostgreSQL
- **Remote Access**: Cloudflare Tunnel (planned) to expose the server securely for the web dashboard

### Server Configuration
- Default port: **3001**
- Environment variables:
  - `PORT` — Server port (default: 3001)
  - `DATABASE_URL` — PostgreSQL connection string
  - `JWT_SECRET` — Secret key for authentication tokens
- Health check: `GET http://localhost:3001/health`

### Desktop App Configuration
- Environment variables (in `.env` file):
  - `VITE_API_URL` — Server API URL (default: `http://localhost:3001/api`)
  - `VITE_SOCKET_URL` — Server WebSocket URL (default: `http://localhost:3001`)

---

## What's Not Built Yet

The following features are planned but not yet implemented:

1. **Web Dashboard** — The owner's remote browser interface. The server API already supports all the data the owner needs; only the frontend needs to be built.
2. **Settings Page** — User account management, location setup, and system configuration.
3. **Seed Data** — Initial data (default admin user, location, sample products) for first-time setup.
4. **Database Migrations** — Automated schema deployment for production.
5. **Cloudflare Tunnel** — Secure remote access without opening ports.
6. **Automated Testing** — Unit and integration tests.
