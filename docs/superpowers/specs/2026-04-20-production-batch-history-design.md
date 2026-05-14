# Production Batch History — Design Spec

**Date:** 2026-04-20
**Status:** Approved, ready for implementation plan
**Scope:** Add a `Batch History` view to the existing Production page so admins and owners can audit past production days, see target-vs-actual variance per product, and drill into individual batches.

---

## 1. Goal

Give admins and owners an auditable ledger of every past production day: what was planned, what was actually produced, who produced it, and which batches contributed. Today the Production page only shows the current day's run; closed-out batches disappear from the workflow.

This is **not** an editing surface — it is an immutable record.

## 2. Non-goals

- No editing or re-opening of historical batches.
- No CSV/PDF export in v1.
- No baker-facing view (bakers stay on Daily Run only).
- No multi-location filter (the app currently treats production as single-location).

## 3. UX

### 3.1 Placement

Inside the existing `/production` page, a segmented control sits directly under the page header:

```
Production
Plan and close out the day's bakes.

[ Daily Run ] [ Batch History ]
```

`Daily Run` is the existing content. `Batch History` is the new tab. Tab state is local React state — no URL change. The segmented control reuses the existing pill-tab tokens (`.tab`, `.tabActive`) already established in SalesOrdersPage / CustomersPage.

### 3.2 Visibility

The segmented control itself is rendered only when `user.role === 'admin' || user.role === 'owner'`. Bakers see the page exactly as it is today, with no tab UI.

### 3.3 Batch History tab layout

```
Batch History
[ Date range  ] [ Product  ] [ Status  ] [ Search           ]

┌─────────────────────────────────────────────────────────────┐
│ Thu, 14 May 2026                              5 batches     │
│ Target: 420   Produced: 395   Shortage: 25   Completion: 94%│
│                                                             │
│ Sugar Bread   Target 120   Produced 110   Short 10  PB-0012 │
│ Tea Bread     Target 100   Produced 100   Hit target PB-0013│
│ Wheat Bread   Target 80    Produced 70    Short 10  PB-0014 │
│ Butter Bread  Target 60    Produced 60    Hit target PB-0015│
│ Cocoa Bread   Target 60    Produced 55    Short 5   PB-0016 │
└─────────────────────────────────────────────────────────────┘

[ Load earlier ]
```

Cards are stacked, newest day on top. Each per-product row is clickable and opens the detail modal. The day header is informational only (not clickable).

### 3.4 Filter bar

| Filter | Control | Default | Behavior |
|---|---|---|---|
| Date range | Two `<input type="date">` (from / to) | Last 30 days | Server-side filter |
| Product | `<select>` of available products + "All" | All | Server-side filter |
| Status | `<select>` with derived options + "All" | All | Server-side filter |
| Search | Text input | empty | Server-side filter; matches batch number OR product name (case-insensitive contains) |

All filters debounce at 200 ms and trigger a refetch. Changing any filter resets pagination to "page 1".

### 3.5 Derived status pill (per product row)

Computed server-side from `DailyProductionTarget.actualQty` vs `targetQty` and the underlying batch status:

| Derived | Condition | Pill style |
|---|---|---|
| `hit` | actual ≥ target AND batch.status = completed | green |
| `short` | actual < target AND batch.status = completed | warm orange |
| `surplus` | actual > target AND batch.status = completed | navy |
| `failed` | batch.status = failed | red |
| `in_progress` | batch.status = in_progress | muted |

When a product has multiple batches on the same day, the row's derived status is the worst of: any `failed` → `failed`; else any `in_progress` → `in_progress`; else compare summed `actualProduced` against the day's `targetQty`.

### 3.6 Day rollup math

```
totalTarget    = Σ DailyProductionTarget.targetQty   for productions on that date
totalProduced  = Σ ProductionBatch.quantityProduced  where batch.status ≠ failed
totalShortage  = max(0, totalTarget − totalProduced)
totalSurplus   = max(0, totalProduced − totalTarget)   // displayed only when > 0
completionPct  = totalTarget > 0
                 ? round(totalProduced / totalTarget × 100)
                 : 100
batchCount     = number of ProductionBatch rows for that date
```

The day strip shows: Target · Produced · Shortage **or** Surplus (whichever is non-zero, color-coded) · Completion %.

### 3.7 Detail modal

Triggered by clicking any per-product row. Header reads:

```
Production Details — Thu, 14 May 2026
Sugar Bread
```

Body (single product, one or more batches):

```
Target:          120
Carry-over:      15
Actual produced: 110
Shortage:        25
Status:          [Short]

── Batch PB-0012 ────────────────────────────────────────
Started:    14 May 2026, 6:02 AM
Completed:  14 May 2026, 4:31 PM
Recorded by: Admin User
Notes:       First proofing slow, oven 2 lagged.

── Batch PB-0019 ────────────────────────────────────────  (if more)
...
```

View-only. Single `Close` button. No edit affordances.

### 3.8 Empty / error states

- **Window has zero batches:** large empty card with a wheat glyph + copy "No production logged in this window. Try extending the date range." Filter bar stays visible.
- **API error:** toast (existing pattern) + a retry button on the empty card.
- **Loading:** skeleton day cards (3 placeholder cards). No spinner overlay.

## 4. Data model

No schema changes. We read from existing tables.

- `ProductionBatch` — id, productId, batchNumber, quantityProduced, status, startedAt, completedAt, producedBy, notes
- `DailyProductionTarget` — targetDate, productId, targetQty, carriedOverShortage, actualQty, shortage, status
- `Product` — name
- `User` — name (for `producedBy` resolution)

A "day" in the history is keyed by `targetDate` from `DailyProductionTarget` for the target side, and by `DATE(startedAt)` from `ProductionBatch` for the production side. Both must be normalized to the server's local date (no UTC drift on the boundary).

## 5. API

### 5.1 Endpoint

```
GET /api/production/history
```

Auth: `requireRole('admin', 'owner')`.

### 5.2 Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `from` | ISO date `YYYY-MM-DD` | `today - 30 days` | inclusive |
| `to` | ISO date `YYYY-MM-DD` | `today` | inclusive |
| `productId` | string | — | filter to one product |
| `status` | one of `hit\|short\|surplus\|failed\|in_progress` | — | filter on derived row status |
| `q` | string | — | matches batchNumber OR product.name (ILIKE) |
| `cursor` | ISO date | — | oldest date returned in the previous page; server returns days strictly earlier than `cursor` |
| `limit` | int | 30 | days per page, max 90 |

### 5.3 Response shape

```ts
type HistoryResponse = {
  days: HistoryDay[];
  nextCursor: string | null;  // null when no older data
};

type HistoryDay = {
  date: string;               // YYYY-MM-DD
  batchCount: number;
  totalTarget: number;
  totalProduced: number;
  totalShortage: number;      // 0 if none
  totalSurplus: number;       // 0 if none
  completionPct: number;
  rows: HistoryRow[];
};

type HistoryRow = {
  productId: string;
  productName: string;
  target: number;             // from DailyProductionTarget
  carryOver: number;          // carriedOverShortage
  actualProduced: number;     // summed across batches that day
  shortage: number;
  derivedStatus: 'hit' | 'short' | 'surplus' | 'failed' | 'in_progress';
  batches: HistoryBatch[];
};

type HistoryBatch = {
  id: string;
  batchNumber: string;
  quantityProduced: number;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  producedBy: { id: string; name: string };
};
```

`days` is sorted by `date` DESC. `rows` within a day are sorted by `productName` ASC. `batches` within a row are sorted by `startedAt` ASC.

### 5.4 Server algorithm

1. Resolve effective `from`/`to` (apply defaults, clamp `to ≤ today`).
2. Pull `DailyProductionTarget` where `targetDate BETWEEN from AND to` (and `productId` if filter set), include `product { name }`.
3. Pull `ProductionBatch` where `DATE(startedAt) BETWEEN from AND to` (and `productId` if filter set), include `product { name }`, `user { id, name }`.
4. Group both lists by `date` (YYYY-MM-DD) in a `Map<date, { targets, batches }>`.
5. For each day in the map, build `HistoryDay`:
   - Merge per-product rows from targets + batches into one row per productId.
   - Compute `actualProduced` = Σ batches where status ≠ failed, for that productId+date.
   - Compute `derivedStatus` per the rules in §3.5.
   - Compute rollups per §3.6.
6. Apply post-filters in JS: `status` filter drops rows that don't match, then drops days whose `rows` are empty after the filter. `q` filter does the same for product name / batch number matches.
7. Drop days where `batchCount === 0` (per §3.3: history only lists days that had at least one batch).
8. Sort days DESC, slice to `limit`, return `nextCursor = oldestReturnedDate` if more exist.

The post-filter approach for `status` and `q` is acceptable because the page size is small (≤90 days). If profiling later shows hotspots we can push filters down.

## 6. Client architecture

### 6.1 Files

```
apps/desktop/src/renderer/pages/ProductionPage.tsx              (edit — add tabs)
apps/desktop/src/renderer/pages/ProductionPage.module.css       (edit — segmented styles)
apps/desktop/src/renderer/components/production/BatchHistory.tsx              (new)
apps/desktop/src/renderer/components/production/BatchHistory.module.css       (new)
apps/desktop/src/renderer/components/production/BatchHistoryDay.tsx           (new)
apps/desktop/src/renderer/components/production/BatchHistoryDay.module.css    (new)
apps/desktop/src/renderer/components/production/BatchHistoryDetailModal.tsx   (new)
apps/desktop/src/renderer/components/production/BatchHistoryDetailModal.module.css (new)
```

### 6.2 Component responsibilities

- **`ProductionPage.tsx`** — owns `tab: 'daily' | 'history'`. Renders the segmented control (admin/owner only) and conditionally renders either the existing daily content or `<BatchHistory />`. No other behavior changes.
- **`BatchHistory.tsx`** — owns filter state (`from`, `to`, `productId`, `status`, `q`), pagination state (`pages: HistoryDay[][]` and `nextCursor`), and the API fetch. Renders filter bar, day cards, "Load earlier" button, empty state, error state. Holds the currently-selected row for the detail modal.
- **`BatchHistoryDay.tsx`** — pure presentational. Props: one `HistoryDay`. Renders header strip and per-product rows. Emits `onRowClick(row, dayDate)`.
- **`BatchHistoryDetailModal.tsx`** — pure presentational. Props: `{ open, dayDate, row, onClose }`. Renders the modal contents.

### 6.3 Styling

Reuses existing baker's-ledger tokens — parchment `#fdf8f1`/`#f7ecdc`, navy `#131b2e`, warm orange `#e07b3c`/`#c85a2f`, ledger card (`#fffefb` bg, `1px solid rgba(19,27,46,0.08)`, 14px radius), monospaced batch numbers via `'JetBrains Mono'`, tabular-nums on numeric cells. Status pills follow the existing OrderStatusBadge palette mapped to derived statuses.

## 7. Edge cases

- **Day with targets but no batches:** excluded per §3.3.
- **Day with batches but no targets:** included; `target` and `completionPct` show as `—` and `100%` respectively in that row; the row's derivedStatus uses only batch status (`completed` → `surplus`, `failed` → `failed`, `in_progress` → `in_progress`).
- **Same product, multiple batches:** one row, multiple batches nested in the detail modal.
- **Cancelled batches:** the schema currently has no cancelled state on ProductionBatch (only in_progress/completed/failed), so no special handling needed.
- **Timezone:** server normalizes `startedAt` to `Africa/Accra` calendar date for grouping. Front-end displays already use `toLocaleDateString` and respect the user's locale.
- **Pagination collision with filters:** any filter change resets `pages` to `[]` and `nextCursor` to undefined before fetching.

## 8. Testing

Manual test plan (run after implementation):

1. As baker — open Production. Segmented control NOT visible. Page works as before.
2. As admin — open Production. Both tabs visible. Switch to History.
3. With no production data — empty state appears with the prompt to widen the range.
4. Seed two days of production with mixed hit/short/surplus/failed/in_progress batches. Verify:
   - Day rollup math matches expectations.
   - Each row's derived status pill is correct.
   - Clicking a row opens the modal with the right batch(es).
5. Filter by product — only that product's rows appear; days that had no batches for that product are dropped.
6. Filter by status `short` — only short rows show; days with zero shorts are dropped.
7. Filter by search "PB-0014" — only the matching row appears.
8. Set date range to today only — only today's batches appear (or empty state).
9. Click "Load earlier" — older days append; button hides when `nextCursor` is null.
10. As cashier — `/production` access should already be gated; verify the `/api/production/history` endpoint returns 403.

## 9. Rollout

Single commit branch off `beta-build`. No migrations. No env vars. No feature flag — admins-only role gating is sufficient.

## 10. Open questions

None at design lock. Anything that surfaces during planning gets folded into the implementation plan.
