import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import styles from './LowStockBell.module.css';

interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
}

const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_CAP = 5;

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function LowStockBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellControls = useAnimationControls();
  const prevSignatureRef = useRef<string>('');

  // Re-measure bell position whenever the dropdown opens or the window resizes.
  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  const fetchLowStock = useCallback(async () => {
    try {
      const data = await api.get<LowStockItem[]>('/inventory/low-stock');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // Silent — alerts are a soft signal; don't toast on failure.
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchLowStock();
    const handle = window.setInterval(fetchLowStock, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [fetchLowStock]);

  // Socket refresh on inventory changes
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => fetchLowStock();
    socket.on('inventory:update', refresh);
    socket.on('stock:updated', refresh);
    return () => {
      socket.off('inventory:update', refresh);
      socket.off('stock:updated', refresh);
    };
  }, [fetchLowStock]);

  // Outside-click + Escape close. The dropdown lives in a portal, so we have
  // to consult its ref too — clicks inside it would otherwise look "outside".
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrap = wrapRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inWrap && !inDropdown) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const soldOutCount = items.filter((i) => i.quantityOnHand <= 0).length;
  const count = items.length;
  const hasAlerts = count > 0;
  const tone: 'red' | 'amber' | 'none' = soldOutCount > 0 ? 'red' : hasAlerts ? 'amber' : 'none';

  // Alert signature — when this changes, replay the bell shake.
  const signature = useMemo(
    () => items.map((i) => `${i.id}:${i.quantityOnHand}`).join('|'),
    [items],
  );

  // Replay the ringing animation whenever the alert set changes (and isn't empty).
  // Programmatic control beats the `key={signature}` remount trick because it
  // doesn't tear down the badge / dropdown state mid-animation.
  useEffect(() => {
    const prev = prevSignatureRef.current;
    prevSignatureRef.current = signature;
    if (!signature) return; // no alerts → don't animate
    if (prev === signature) return; // unchanged → don't animate
    bellControls.start({
      scale: [1, 1.35, 0.95, 1.2, 1],
      rotate: [0, -18, 16, -14, 10, -6, 0],
      transition: { duration: 0.9, ease: 'easeInOut' },
    });
  }, [signature, bellControls]);

  const handleViewInventory = () => {
    setOpen(false);
    navigate('/inventory');
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <motion.button
        type="button"
        className={`${styles.bellBtn} ${hasAlerts ? styles.bellBtnActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={hasAlerts ? `${count} stock alert${count === 1 ? '' : 's'}` : 'No stock alerts'}
        aria-label={hasAlerts ? `${count} stock alerts` : 'Stock alerts'}
        aria-expanded={open}
        aria-haspopup="menu"
        animate={bellControls}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <BellIcon />
        {hasAlerts && (
          <span
            className={`${styles.badge} ${tone === 'red' ? styles.badgeRed : styles.badgeAmber}`}
            aria-hidden="true"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </motion.button>

      {createPortal(
      <AnimatePresence>
        {open && anchor && (
          <motion.div
            ref={dropdownRef}
            className={styles.dropdown}
            role="menu"
            style={{ top: anchor.top, right: anchor.right }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className={styles.header}>
              <span className={styles.title}>Stock Alerts</span>
              <span className={styles.summary}>
                {hasAlerts
                  ? `${count} item${count === 1 ? '' : 's'}${soldOutCount > 0 ? ` · ${soldOutCount} sold out` : ''}`
                  : 'All stocked'}
              </span>
            </div>

            {!hasAlerts ? (
              <div className={styles.empty}>
                <p className={styles.emptyMsg}>No low-stock items right now.</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {items.slice(0, DROPDOWN_CAP).map((item) => {
                  const out = item.quantityOnHand <= 0;
                  return (
                    <li key={item.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <span className={styles.rowName}>{item.name}</span>
                        <span className={styles.rowMeta}>
                          {Math.max(0, item.quantityOnHand).toLocaleString()} {item.unit}
                          {item.lowStockThreshold > 0 && (
                            <span className={styles.rowThreshold}>
                              {' '}
                              · reorder at {item.lowStockThreshold}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={`${styles.pill} ${out ? styles.pillOut : styles.pillLow}`}>
                        {out ? 'Sold out' : 'Low'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {count > DROPDOWN_CAP && (
              <div className={styles.more}>
                +{count - DROPDOWN_CAP} more
              </div>
            )}

            <div className={styles.footer}>
              <button type="button" className={styles.viewBtn} onClick={handleViewInventory}>
                View Inventory
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
