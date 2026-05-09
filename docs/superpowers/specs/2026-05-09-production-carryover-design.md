# Design Spec: Specific Source Production Carry-Over

The "Yesterday" carry-over logic in the Production module is currently misleading because it pulls stale shortages from months ago without user consent or clarity. This spec defines a redesign where users explicitly choose their carry-over source day or start fresh.

## 1. Problem Statement
- Stale shortages from months ago are automatically applied to today's production plan.
- The UI labels these as "from yesterday," which is factually incorrect and confusing.
- Users lack a mechanism to "write off" old debt and start a clean production day.

## 2. Proposed Solution: Option A (Specific Source)
We will introduce an "Intervention Step" in the production planning phase. If a shortage is detected on *any* previous day, the user must explicitly choose whether to inherit that debt or ignore it for the current run.

### 2.1 Backend Changes (`apps/server/src/routes/production.ts`)
- **Modify `GET /api/production/daily-run`:**
    - Perform a query to find the **most recent** `DailyProductionTarget` record where `shortage > 0`.
    - Return a new `latestShortage` object: `{ date: string, totalUnits: number } | null`.
    - Accept an optional query parameter `carryFrom: string` (ISO date).
    - If `carryFrom` is provided, populate `carriedOverShortage` fields in the suggestions using that specific date's shortages.
    - If `carryFrom` is omitted or null, populate `carriedOverShortage` as `0`.
- **Logic Safeguard:** Ensure that even if a date is older than yesterday, the date is explicitly tracked and returned.

### 2.2 Frontend Changes (`apps/desktop/src/renderer/pages/ProductionPage.tsx`)
- **New State:** `carryOverChoice: 'pending' | 'applied' | 'ignored'`.
- **Pre-Planning Banner:**
    - If `latestShortage` is returned from the API and the day is `not_started`, display a high-visibility intervention banner.
    - Message: "Unfinished production found: [Total] units short from [Date]."
    - Actions:
        - **[Start Fresh]**: Sets `carryFrom=null` and re-fetches suggestions with 0 carry-overs.
        - **[Carry from [Date]]**: Sets `carryFrom=[Date]` and re-fetches suggestions with the specific day's shortages.
- **Improved Labels:**
    - Replace "+X from yesterday" with "+X from [Date]" (e.g., `+5 from Mar 14`) in the production lanes.
    - Format the date concisely (e.g., "14 Mar").

### 2.3 Data Flow
1. User opens Production page for a new day.
2. Frontend calls `GET /api/production/daily-run?date=YYYY-MM-DD`.
3. Backend responds with `status: 'not_started'`, `suggestions: [...]` (with 0 carry-over by default), and `latestShortage: { date: '2026-03-14', total: 52 }`.
4. Frontend shows "Backlog Found" banner.
5. User clicks "Carry from March 14".
6. Frontend calls `GET /api/production/daily-run?date=YYYY-MM-DD&carryFrom=2026-03-14`.
7. Backend returns suggestions populated with March 14 shortages.
8. User proceeds with planning.

## 3. Testing & Validation
- **Case 1: No previous shortages.** Ensure the banner never appears and `latestShortage` is null.
- **Case 2: Stale shortages exist.** Verify the banner shows the correct date and total.
- **Case 3: "Start Fresh" path.** Confirm that even if debt exists, the plan starts at 0 if the user ignores it.
- **Case 4: "Carry From" path.** Confirm that the correct shortages are inherited and the UI labels show the specific date.

## 4. Documentation Impact
- Update internal "Help" or "Training" docs to explain that "Yesterday's debt" is no longer automatic and must be manually accepted or cleared.
