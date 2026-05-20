import { useState } from 'react';
import { Button, Modal } from '@bakery/ui';
import { api } from '../../lib/api';
import { clearLocalCache } from '../../lib/db';
import { useToast } from '../Toast';
import styles from './DevToolsCard.module.css';

type Level = 'transactions' | 'catalog' | 'full';

const LEVEL_INFO: Record<Level, { title: string; blurb: string; wipes: string }> = {
  transactions: {
    title: 'Reset Transactions',
    blurb: 'Clear all sales, payments, production batches, stock adjustments, expenses, and audit logs.',
    wipes: 'Sales orders, payments, production batches, daily targets, stock adjustments, expenses, audit logs, daily summaries. Products, users, customers, suppliers, and locations are kept.',
  },
  catalog: {
    title: 'Reset Catalog + Transactions',
    blurb: 'Everything in Reset Transactions, plus products, customers, and suppliers.',
    wipes: 'All transactional data + products, product variants, customers, suppliers. Users, locations, and document templates are kept.',
  },
  full: {
    title: 'Full Reset',
    blurb: 'Wipe every table. The admin user and Main Store are recreated automatically.',
    wipes: 'Everything. The default admin (admin@bakery.com / admin123) and Main Store location are recreated. You will be logged out.',
  },
};

export function DevToolsCard() {
  const toast = useToast();
  const [pending, setPending] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (level: Level) => {
    setBusy(true);
    try {
      await api.post('/dev/reset', { level });
      toast.showToast(`Reset (${level}) complete. Reloading…`, 'success');
      setPending(null);
      // Full reset recreates the admin user — your current JWT is for the old
      // user row and will 401 on next request. Drop it so reload lands on login.
      if (level === 'full') {
        localStorage.removeItem('bakery_token');
        localStorage.removeItem('bakery_user');
      }
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Reset failed', 'error');
      setBusy(false);
    }
  };

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h2>Developer Tools</h2>
        <span className={styles.devTag}>DEV ONLY</span>
      </header>
      <p className={styles.intro}>
        Quickly start fresh for testing. Each level wipes a different slice of the database and reseeds a baseline.
      </p>

      <div className={styles.grid}>
        {(Object.keys(LEVEL_INFO) as Level[]).map((lvl) => (
          <article key={lvl} className={styles.tile}>
            <h3>{LEVEL_INFO[lvl].title}</h3>
            <p>{LEVEL_INFO[lvl].blurb}</p>
            <Button variant="danger" onClick={() => setPending(lvl)}>
              {LEVEL_INFO[lvl].title}
            </Button>
          </article>
        ))}
        <article className={styles.tile}>
          <h3>Clear Local Cache</h3>
          <p>
            Wipes this device&rsquo;s IndexedDB (products, customers, sales orders, pending sync queue).
            Use after a reset if you&rsquo;re seeing phantom duplicate rows.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await clearLocalCache();
                toast.showToast('Local cache cleared. Reloading…', 'success');
                setTimeout(() => window.location.reload(), 600);
              } catch (err) {
                toast.showToast(err instanceof Error ? err.message : 'Failed to clear cache', 'error');
              }
            }}
          >
            Clear Local Cache
          </Button>
        </article>
      </div>

      <Modal
        isOpen={pending !== null}
        onClose={() => !busy && setPending(null)}
        title={pending ? LEVEL_INFO[pending].title : ''}
      >
        {pending && (
          <div className={styles.modalBody}>
            <p><strong>This will wipe:</strong></p>
            <p>{LEVEL_INFO[pending].wipes}</p>
            <p className={styles.warn}>This cannot be undone.</p>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => run(pending)} disabled={busy}>
                {busy ? 'Resetting…' : 'Yes, wipe it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
