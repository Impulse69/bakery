import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/AuthContext';
import styles from './ProductionPage.module.css';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}


// NOTE: The legacy "Production Batches" tab was removed. The Production page is
// now a single-screen Daily Run cockpit. `ProductionBatch` rows are still
// auto-created server-side on Daily Run completion for stock + audit, but they
// have no dedicated UI surface.

// ─── Daily Run Tab ────────────────────────────────────────────────────────
type RunStatus = 'not_started' | 'in_progress' | 'completed';

const STATUS_META: Record<RunStatus, { label: string; helper: string; pulse: string }> = {
  not_started: {
    label: 'Awaiting Plan',
    helper: "Set today's targets per bread type to begin the production day.",
    pulse: 'planning',
  },
  in_progress: {
    label: 'On The Floor',
    helper: 'Bakers are producing — record actuals as batches come out of the oven.',
    pulse: 'active',
  },
  completed: {
    label: 'Day Closed',
    helper: "All actuals recorded. Any shortage carries forward to tomorrow's plan.",
    pulse: 'done',
  },
};

function WheatIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V11" />
      <path d="M12 11c-2-2-2-5 0-7 2 2 2 5 0 7Z" />
      <path d="M12 14c-3-1-5-3-5-6 3 1 5 3 5 6Z" />
      <path d="M12 14c3-1 5-3 5-6-3 1-5 3-5 6Z" />
      <path d="M12 18c-3-1-5-3-5-6 3 1 5 3 5 6Z" />
      <path d="M12 18c3-1 5-3 5-6-3 1-5 3-5 6Z" />
    </svg>
  );
}

function FlourBagIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8c0-2 2-3 5-3s5 1 5 3v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8Z" />
      <path d="M9 5l1.5-2h3L15 5" />
      <path d="M10 12h4" />
    </svg>
  );
}

function CarryIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3.5-7.1" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function DailyRunTab() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [dailyRun, setDailyRun] = useState<{ status: string, items: any[] } | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const [latestShortage, setLatestShortage] = useState<{ date: string, totalUnits: number } | null>(null);
  const [carryFromDate, setCarryFromDate] = useState<string | null>(null);
  const [showIntervention, setShowIntervention] = useState(false);

  const fetchDailyRun = useCallback(async (explicitCarryFrom?: string | null) => {
    setLoading(true);
    try {
      const carryParam = explicitCarryFrom !== undefined ? explicitCarryFrom : carryFromDate;
      const url = `/production/daily-run?date=${selectedDate}${carryParam ? `&carryFrom=${carryParam}` : ''}`;
      const res = await api.get<any>(url);

      setLatestShortage(res.latestShortage || null);
      if (res.status === 'not_started' && res.latestShortage && explicitCarryFrom === undefined && !carryFromDate) {
        setShowIntervention(true);
      } else {
        setShowIntervention(false);
      }

      let items = [];
      const newEdits: Record<string, number> = {};

      if (res.status === 'not_started') {
        items = res.suggestions;
        items.forEach((i: any) => newEdits[i.productId] = 0);
      } else {
        items = res.targets;
        items.forEach((i: any) => newEdits[i.productId] = res.status === 'in_progress' ? 0 : i.actualQty);
      }

      setDailyRun({ status: res.status, items });
      setEdits(newEdits);
    } catch {
      setDailyRun(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, carryFromDate]);

  useEffect(() => { fetchDailyRun(); }, [fetchDailyRun]);

  const handleEditChange = (productId: string, val: string) => {
    setEdits(prev => ({ ...prev, [productId]: Number(val) }));
  };

  const handleStartProduction = async () => {
    setSaving(true);
    try {
      const payload = dailyRun!.items.map(i => ({
        productId: i.productId,
        target: edits[i.productId] || 0,
        carriedOver: i.carriedOverShortage || 0,
      }));
      await api.post(`/production/daily-run?date=${selectedDate}`, payload);
      showToast('Production started for the day', 'success');
      fetchDailyRun();
    } catch (e: any) {
      showToast(e.message || 'Failed to start', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteProduction = async () => {
    setSaving(true);
    try {
      const payload = dailyRun!.items.map(i => ({
        productId: i.productId,
        actual: edits[i.productId] || 0,
      }));
      await api.patch(`/production/daily-run/complete?date=${selectedDate}`, payload);
      showToast('Production marked as completed', 'success');
      fetchDailyRun();
    } catch (e: any) {
      showToast(e.message || 'Failed to complete', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values ─────────────────────────────────────
  const items = dailyRun?.items ?? [];
  const status = (dailyRun?.status ?? 'not_started') as RunStatus;
  const meta = STATUS_META[status] ?? STATUS_META.not_started;

  const totalCarryOver = items.reduce((s, i) => s + (i.carriedOverShortage || 0), 0);
  const plannedTarget = status === 'not_started'
    ? items.reduce((s, i) => s + (edits[i.productId] || 0) + (i.carriedOverShortage || 0), 0)
    : items.reduce((s, i) => s + ((i.targetQty || 0) + (i.carriedOverShortage || 0)), 0);
  const totalProduced = items.reduce((s, i) => {
    if (status === 'completed') return s + (i.actualQty || 0);
    if (status === 'in_progress') return s + (edits[i.productId] || 0);
    return s;
  }, 0);
  const progressPct = plannedTarget > 0 ? Math.min(100, Math.round((totalProduced / plannedTarget) * 100)) : 0;

  const dateObj = new Date(selectedDate + 'T12:00:00');
  const isToday = selectedDate === getToday();
  const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayNum = dateObj.toLocaleDateString('en-GB', { day: '2-digit' });
  const monthYear = dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.dailyRun}>
      {/* ── Hero / Status Banner ── */}
      <header className={`${styles.runHero} ${styles[`hero_${status}`]}`}>
        <div className={styles.heroTexture} aria-hidden />
        <div className={styles.heroGrain} aria-hidden />
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={styles.heroEyebrow}>
              <span className={`${styles.statusDot} ${styles[`dot_${status}`]}`} />
              Production Run
              {isToday && <span className={styles.todayBadge}>Today</span>}
            </div>
            <div className={styles.dateBlock}>
              <span className={styles.dateDay}>{dayNum}</span>
              <div className={styles.dateText}>
                <span className={styles.dateWeekday}>{weekday}</span>
                <span className={styles.dateMonth}>{monthYear}</span>
              </div>
            </div>
            <p className={styles.heroHelper}>{meta.helper}</p>
          </div>

          <div className={styles.heroRight}>
            <span className={`${styles.statusChip} ${styles[`chip_${status}`]}`}>
              <span className={styles.chipPulse} />
              {meta.label}
            </span>
            <label className={styles.dateField}>
              <span className={styles.dateFieldLabel}>Plan for</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={styles.dateInput}
              />
            </label>
          </div>
        </div>
      </header>

      {/* ── Loading / Error / Empty / Content ── */}
      {loading ? (
        <div className={styles.skeletonShell}>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      ) : !dailyRun ? (
        <div className={styles.emptyShell}>
          <div className={styles.emptyIcon}><FlourBagIcon size={36} /></div>
          <h3 className={styles.emptyTitle}>Couldn&rsquo;t load today&rsquo;s plan</h3>
          <p className={styles.emptyBody}>The server didn&rsquo;t respond. Check that the API is running and try again.</p>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.emptyShell}>
          <div className={styles.emptyIcon}><WheatIcon size={36} /></div>
          <h3 className={styles.emptyTitle}>No bread products to schedule</h3>
          <p className={styles.emptyBody}>
            Daily Run pulls from the bread category in your catalog.
            Add a product under <span className={styles.emptyHint}>Product&nbsp;List</span> with category <span className={styles.emptyHint}>Bread</span> to start planning the day.
          </p>
        </div>
      ) : (
        <>
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

          {/* ── KPI Strip ── */}
          <div className={styles.kpiStrip}>
            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>Bread Types</span>
              <span className={styles.kpiValue}>{String(items.length).padStart(2, '0')}</span>
              <span className={styles.kpiFoot}>active in catalog</span>
            </div>

            <div className={`${styles.kpiTile} ${totalCarryOver > 0 ? styles.kpiCarry : ''}`}>
              <span className={styles.kpiLabel}>Carry-Over</span>
              <span className={styles.kpiValue}>
                {totalCarryOver > 0 && <span className={styles.kpiPlus}>+</span>}
                {totalCarryOver}
              </span>
              <span className={styles.kpiFoot}>{totalCarryOver > 0 ? 'units owed from yesterday' : 'no debt to clear'}</span>
            </div>

            <div className={styles.kpiTile}>
              <span className={styles.kpiLabel}>{status === 'not_started' ? "Today's Plan" : 'Total Target'}</span>
              <span className={styles.kpiValue}>{plannedTarget.toLocaleString()}</span>
              <span className={styles.kpiFoot}>units across all lanes</span>
            </div>

            {status !== 'not_started' && (
              <div className={`${styles.kpiTile} ${styles.kpiProgress}`}>
                <span className={styles.kpiLabel}>Progress</span>
                <div className={styles.dialWrap}>
                  <svg viewBox="0 0 56 56" className={styles.dial}>
                    <circle cx="28" cy="28" r="24" className={styles.dialBg} />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      className={styles.dialFill}
                      style={{
                        strokeDasharray: `${(progressPct / 100) * 150.8} 150.8`,
                      }}
                    />
                  </svg>
                  <span className={styles.dialPct}>{progressPct}%</span>
                </div>
                <span className={styles.kpiFoot}>{totalProduced.toLocaleString()} / {plannedTarget.toLocaleString()} units</span>
              </div>
            )}
          </div>

          {/* ── Production Lanes ── */}
          <section className={styles.lanesSection}>
            <div className={styles.lanesHead}>
              <div>
                <h3 className={styles.lanesTitle}>Production Lanes</h3>
                <p className={styles.lanesSub}>One row per bread type — track target, carry, and actuals.</p>
              </div>
              <span className={styles.lanesCount}>
                <WheatIcon size={14} /> {items.length} lanes
              </span>
            </div>

            <div className={styles.laneList}>
              {items.map((item, idx) => {
                const editVal = edits[item.productId] ?? 0;
                const baseTarget = (item.targetQty || 0) + (item.carriedOverShortage || 0);
                const target = status === 'not_started' ? editVal + (item.carriedOverShortage || 0) : baseTarget;
                const produced = status === 'completed' ? (item.actualQty || 0) : (status === 'in_progress' ? editVal : 0);
                const lanePct = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
                const shortage = Math.max(0, baseTarget - produced);
                const surplus = Math.max(0, produced - baseTarget);

                return (
                  <article key={item.productId} className={`${styles.lane} ${styles[`lane_${status}`]}`}>
                    <div className={styles.laneIdent}>
                      <span className={styles.laneIndex}>{String(idx + 1).padStart(2, '0')}</span>
                      <div className={styles.laneNameBlock}>
                        <h4 className={styles.laneName}>{item.product?.name}</h4>
                        <span className={styles.laneSku}>{item.product?.sku}</span>
                      </div>
                    </div>

                    <div className={styles.laneCenter}>
                      {item.carriedOverShortage > 0 && (
                        <span className={styles.carryChip} title={`${item.carriedOverShortage} units rolled over from the previous run`}>
                          <CarryIcon size={12} />
                          <span>+{item.carriedOverShortage} from yesterday</span>
                        </span>
                      )}

                      {status === 'not_started' && (
                        <div className={styles.totalGoal}>
                          <span className={styles.totalGoalLabel}>Total to bake</span>
                          <span className={styles.totalGoalValue}>
                            {((edits[item.productId] || 0) + (item.carriedOverShortage || 0)).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {status === 'in_progress' && (
                        <div className={styles.laneProgress}>
                          <div className={styles.laneTrack}>
                            <div
                              className={`${styles.laneFill} ${lanePct >= 100 ? styles.laneFillDone : ''}`}
                              style={{ width: `${lanePct}%` }}
                            />
                            <span className={styles.laneTrackLabel}>
                              {produced.toLocaleString()} <span className={styles.muted}>/</span> {baseTarget.toLocaleString()}
                            </span>
                          </div>
                          <span className={styles.lanePct}>{lanePct}%</span>
                        </div>
                      )}

                      {status === 'completed' && (
                        <div className={styles.laneOutcome}>
                          <span className={styles.outcomeStat}>
                            <span className={styles.outcomeLabel}>Made</span>
                            <span className={styles.outcomeValue}>{(item.actualQty || 0).toLocaleString()}</span>
                          </span>
                          <span className={styles.outcomeStat}>
                            <span className={styles.outcomeLabel}>Target</span>
                            <span className={styles.outcomeValue}>{baseTarget.toLocaleString()}</span>
                          </span>
                          {shortage > 0 ? (
                            <span className={styles.shortChip}>
                              ↻ Short {shortage} → tomorrow
                            </span>
                          ) : surplus > 0 ? (
                            <span className={styles.surplusChip}>+{surplus} surplus</span>
                          ) : (
                            <span className={styles.hitChip}>✓ Target hit</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.laneAction}>
                      <label className={styles.qtyField}>
                        <span className={styles.qtyFieldLabel}>
                          {status === 'not_started' ? "Today's target" : status === 'in_progress' ? 'Actual produced' : 'Actual'}
                        </span>
                        <div className={styles.qtyInputWrap}>
                          <input
                            type="number"
                            min={0}
                            value={editVal === 0 ? '' : editVal}
                            placeholder="0"
                            onChange={(e) => handleEditChange(item.productId, e.target.value)}
                            disabled={status === 'completed'}
                            className={styles.qtyInput}
                          />
                          <span className={styles.qtyUnit}>units</span>
                        </div>
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Action Footer ── */}
          {status !== 'completed' && (
            <footer className={styles.actionDock}>
              <div className={styles.dockSummary}>
                {status === 'not_started' ? (
                  <>
                    <strong>{plannedTarget.toLocaleString()}</strong>
                    <span> units planned across </span>
                    <strong>{items.length}</strong>
                    <span> bread {items.length === 1 ? 'type' : 'types'}</span>
                    {totalCarryOver > 0 && (
                      <>
                        <span className={styles.dockSep}>·</span>
                        <span>includes</span>
                        <strong className={styles.dockCarry}> +{totalCarryOver}</strong>
                        <span> carried from yesterday</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{totalProduced.toLocaleString()}</strong>
                    <span> of </span>
                    <strong>{plannedTarget.toLocaleString()}</strong>
                    <span> units produced</span>
                    <span className={styles.dockSep}>·</span>
                    <strong className={styles.dockPct}>{progressPct}%</strong>
                    <span> of plan</span>
                  </>
                )}
              </div>
              <button
                className={styles.dockAction}
                onClick={status === 'not_started' ? handleStartProduction : handleCompleteProduction}
                disabled={saving || (status === 'not_started' && plannedTarget === 0)}
              >
                <span>
                  {saving
                    ? (status === 'not_started' ? 'Starting day…' : 'Closing day…')
                    : (status === 'not_started' ? 'Lock targets & start day' : 'Close out the day')}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ProductionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Production</h1>
          <p className={styles.subheading}>Plan and close out the day&rsquo;s bakes.</p>
        </div>
      </div>

      {isAdmin ? (
        <DailyRunTab />
      ) : (
        <div className={styles.emptyShell}>
          <div className={styles.emptyIcon}><FlourBagIcon size={36} /></div>
          <h3 className={styles.emptyTitle}>Production planning is admin-only</h3>
          <p className={styles.emptyBody}>
            Ask an admin or owner to set today&rsquo;s targets. You&rsquo;ll see live stock updates on the POS as bakes roll out.
          </p>
        </div>
      )}
    </div>
  );
}
