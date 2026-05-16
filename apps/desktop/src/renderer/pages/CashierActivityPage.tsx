import { CashierActivity } from '../components/reports/CashierActivity';
import styles from './CashierActivityPage.module.css';

/** Stand-alone sidebar surface for the per-cashier audit + revenue rollup.
 *  Reuses the existing CashierActivity component from the Reports page. */
export function CashierActivityPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>Accountability</span>
          <h1 className={styles.heading}>Cashier Activity</h1>
          <p className={styles.heroQuote}>
            <em>Who sold what, who edited what, who's the top earner today.</em>
          </p>
        </div>
      </header>

      <CashierActivity />
    </div>
  );
}
