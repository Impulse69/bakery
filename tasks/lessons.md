# Learning Ledger: Bakery Management System

## Turborepo & Monorepo
- Turborepo >= v2 requires `tasks` (not `pipeline`) in `turbo.json`.
- Root `package.json` needs `"packageManager": "npm@10.8.2"` field.

## Prisma
- Schema renames require `@@map("old_table_name")` to preserve DB table names, then `npx prisma generate` before TypeScript can compile.
- After changing enums in Prisma, Zod validation schemas in route files must be updated manually — there's no codegen link between Prisma enums and Zod.

## Shared UI Library (packages/ui)
- CSS Modules work natively in both Next.js and Vite/Electron — no extra config needed. Good choice for cross-framework shared UI.
- Source-level consumption (`main: "src/index.ts"`) avoids a build step; consumers bundle the TS/CSS directly.
- Generic components like `DataTable<T>` must be declared as `function DataTable<T>(props: DataTableProps<T>)` — not `React.FC` — to preserve generic inference through barrel re-exports.
- SSR-safe Modal needs `useState(false)` + `useEffect(() => setMounted(true), [])` mount guard before calling `createPortal(children, document.body)`.

## Architecture
- Desktop and web share UI components and types; server shares only types and utils with frontends.
- `@bakery/ui` depends on `@bakery/types` (for domain-specific components like StockBadge, OrderStatusBadge) but NOT on `@bakery/utils`.

## Desktop Page Patterns
- All list pages follow the same pattern: `useCallback` fetch → `useEffect` trigger → DataTable + Pagination + Modal.
- Currency: store in pesewas, display via `formatCurrency(pesewas)` which divides by 100. Input fields show `value / 100`, submit with `Math.round(Number(v) * 100)`.
- Status tabs: array of `{ label, value }` driving a `statusFilter` state + query param.
- Detail modals: fetch full entity on row click (e.g., `GET /products/:id` for variants, `GET /customers/:id` for orders).
- Dynamic form arrays (e.g., PO line items): state is an array of objects, `addLineItem` pushes empty, `removeLineItem` splices by index.
- Server gaps: if a GET-by-ID endpoint is missing, add it to the server before building the page (as done for inventory-counts).
