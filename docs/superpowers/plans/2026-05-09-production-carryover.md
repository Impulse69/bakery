# Specific Source Production Carry-Over Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign production carry-over to allow users to explicitly choose a source date for shortages or start fresh, eliminating misleading "yesterday" labels.

**Architecture:**
- **Backend:** Update the `daily-run` endpoint to identify the latest shortage date and support a `carryFrom` parameter.
- **Frontend:** Implement an intervention banner in `ProductionPage` to handle the choice before planning starts.
- **Data Flow:** Explicit selection -> Refetch with source -> Plan with accurate labels.

**Tech Stack:** Node.js, Express, Prisma, React, TypeScript.

---

### Task 1: Backend - Latest Shortage Detection

**Files:**
- Modify: `apps/server/src/routes/production.ts`

- [ ] **Step 1: Update `GET /api/production/daily-run` to detect latest shortage**

Modify the route to find the most recent day with a shortage and calculate the total units.

```typescript
// Inside router.get('/daily-run', ...)
// ... after targetDate setup ...

// 1.5 Find the latest day with ANY shortage
const latestTargetWithShortage = await prisma.dailyProductionTarget.findFirst({
  where: {
    targetDate: { lt: targetDate },
    shortage: { gt: 0 },
    product: { isActive: true },
  },
  orderBy: { targetDate: 'desc' },
  select: { targetDate: true },
});

let latestShortage = null;
if (latestTargetWithShortage) {
  const date = latestTargetWithShortage.targetDate;
  const dayShortages = await prisma.dailyProductionTarget.aggregate({
    where: { targetDate: date, shortage: { gt: 0 } },
    _sum: { shortage: true },
  });
  latestShortage = {
    date: date.toISOString().split('T')[0],
    totalUnits: dayShortages._sum.shortage || 0,
  };
}

// Update the response to include latestShortage
// res.json({ status: ..., targets: ..., latestShortage });
```

- [ ] **Step 2: Support `carryFrom` query parameter**

If `carryFrom` is provided, fetch shortages from that date. Otherwise, default to 0.

```typescript
const carryFrom = req.query.carryFrom as string | undefined;
// ... in suggestions generation ...
const suggestions = await Promise.all(breadProducts.map(async (product) => {
  let shortage = 0;
  let sourceDate = null;

  if (carryFrom) {
    const prev = await prisma.dailyProductionTarget.findUnique({
      where: {
        targetDate_productId: {
          targetDate: new Date(carryFrom),
          productId: product.id,
        },
      },
    });
    shortage = prev?.shortage || 0;
    sourceDate = carryFrom;
  }

  return {
    productId: product.id,
    product,
    carriedOverShortage: shortage,
    sourceDate, // Include for UI labeling
  };
}));
```

- [ ] **Step 3: Verify backend changes via curl**

Run: `curl.exe -s "http://localhost:3003/api/production/daily-run?date=2026-05-10"`
Verify `latestShortage` object exists in JSON.

- [ ] **Step 4: Commit backend changes**

```bash
git add apps/server/src/routes/production.ts
git commit -m "feat(backend): add latest shortage detection and carryFrom support"
```

---

### Task 2: Frontend - Intervention Banner & State

**Files:**
- Modify: `apps/desktop/src/renderer/pages/ProductionPage.tsx`

- [ ] **Step 1: Add new state for carry-over management**

```typescript
// Inside DailyRunTab component
const [latestShortage, setLatestShortage] = useState<{ date: string, totalUnits: number } | null>(null);
const [carryFromDate, setCarryFromDate] = useState<string | null>(null);
const [showIntervention, setShowIntervention] = useState(false);
```

- [ ] **Step 2: Update `fetchDailyRun` to handle intervention logic**

```typescript
const fetchDailyRun = useCallback(async (explicitCarryFrom?: string | null) => {
  setLoading(true);
  try {
    const carryParam = explicitCarryFrom !== undefined ? explicitCarryFrom : carryFromDate;
    const url = `/production/daily-run?date=${selectedDate}${carryParam ? `&carryFrom=${carryParam}` : ''}`;
    const res = await api.get<any>(url);

    setLatestShortage(res.latestShortage || null);
    
    // Show intervention if not started and hasn't made a choice yet
    if (res.status === 'not_started' && res.latestShortage && explicitCarryFrom === undefined && !carryFromDate) {
      setShowIntervention(true);
    } else {
      setShowIntervention(false);
    }

    // ... existing items/edits setup ...
  } finally {
    setLoading(false);
  }
}, [selectedDate, carryFromDate]);
```

- [ ] **Step 3: Implement the high-visibility banner**

```tsx
// Inside DailyRunTab return, before the KPI Strip
{showIntervention && latestShortage && (
  <div className={styles.interventionBanner}>
    <div className={styles.interventionIcon}>⚠️</div>
    <div className={styles.interventionContent}>
      <h4>Unfinished production found</h4>
      <p>There are <strong>{latestShortage.totalUnits} units</strong> short from <strong>{new Date(latestShortage.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</strong>.</p>
    </div>
    <div className={styles.interventionActions}>
      <button onClick={() => { setCarryFromDate(null); fetchDailyRun(null); }}>Start Fresh</button>
      <button className={styles.primary} onClick={() => { setCarryFromDate(latestShortage.date); fetchDailyRun(latestShortage.date); }}>
        Carry from {new Date(latestShortage.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit frontend state and banner**

```bash
git add apps/desktop/src/renderer/pages/ProductionPage.tsx
git commit -m "feat(frontend): add production carry-over intervention banner"
```

---

### Task 3: Frontend - Styling & Labeling

**Files:**
- Modify: `apps/desktop/src/renderer/pages/ProductionPage.tsx`
- Modify: `apps/desktop/src/renderer/pages/ProductionPage.module.css`

- [ ] **Step 1: Update production lane labels to show specific source date**

```tsx
// Inside lane mapping
{item.carriedOverShortage > 0 && (
  <span className={styles.carryChip}>
    <CarryIcon size={12} />
    <span>+{item.carriedOverShortage} from {new Date(item.sourceDate || latestShortage?.date || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
  </span>
)}
```

- [ ] **Step 2: Add CSS for the intervention banner**

```css
.interventionBanner {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  animation: slideDown 0.3s ease-out;
}
/* ... add additional styles for content and actions ... */
```

- [ ] **Step 3: Build and test the full flow**

Run: `npm run build` in `apps/desktop`.
Verify the banner appears correctly for a new day when shortages exist.
Verify "Start Fresh" results in 0 carry-overs.
Verify "Carry from..." correctly populates the numbers and labels.

- [ ] **Step 4: Commit final UI polished changes**

```bash
git add apps/desktop/src/renderer/pages/ProductionPage.tsx apps/desktop/src/renderer/pages/ProductionPage.module.css
git commit -m "style(production): polish carry-over banner and lane labels"
```
