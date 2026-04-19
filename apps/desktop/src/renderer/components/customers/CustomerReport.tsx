import { createPortal } from 'react-dom';
import type { Customer } from '@bakery/types';
import { formatCurrency } from '@bakery/utils';
import styles from './CustomerReport.module.css';

interface CustomerStats {
  totalSpent: number;
  totalOrders: number;
  lastOrderDate: string;
  weekStreak: number;
  periodic: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  topProducts: Array<{ name: string; quantity: number }>;
}

interface Props {
  customer: Customer;
  stats: CustomerStats | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '—';
}

function formatDate(d: string | Date | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function CustomerReport({ customer, stats }: Props) {
  const orders = customer.salesOrders ?? [];
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  const ltv = stats?.totalSpent ?? orders.reduce((s, o) => s + o.total, 0);
  const orderCount = stats?.totalOrders ?? orders.length;
  const avgOrder = orderCount > 0 ? Math.round(ltv / orderCount) : 0;
  const topProducts = stats?.topProducts?.slice(0, 6) ?? [];
  const topMax = topProducts.reduce((m, p) => Math.max(m, p.quantity), 0) || 1;

  const periodic = stats?.periodic ?? { daily: 0, weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
  const periodEntries: Array<[string, number]> = [
    ['Today', periodic.daily],
    ['This Week', periodic.weekly],
    ['This Month', periodic.monthly],
    ['This Quarter', periodic.quarterly],
    ['This Year', periodic.yearly],
  ];
  const periodMax = periodEntries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  return createPortal(
    <div className={`${styles.printOnly} print-target`}>
      <div className={styles.page}>
        {/* Masthead */}
        <div className={styles.masthead}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>BF</div>
            <div>
              <div className={styles.brandName}>Bread Faculty</div>
              <div className={styles.brandSub}>Premium Bakery & Confectionery · Accra</div>
            </div>
          </div>
          <div className={styles.mastMeta}>
            <div className={styles.eyebrow}>Patron Dossier</div>
            <div className={styles.issuedLine}>Issued {formatDate(new Date())}</div>
          </div>
        </div>

        <div className={styles.rule} />

        {/* Portrait block */}
        <div className={styles.portraitBlock}>
          <div className={styles.monogram}>{initials(customer.name)}</div>
          <div className={styles.portraitMain}>
            <div className={styles.eyebrowSm}>Customer of Record</div>
            <h1 className={styles.patronName}>{customer.name}</h1>
            <div className={styles.contactLine}>
              <span>{customer.phone || '—'}</span>
              <span className={styles.dot}>·</span>
              <span>{customer.email || 'no email on file'}</span>
            </div>
            {customer.address && (
              <div className={styles.addressLine}>{customer.address}</div>
            )}
          </div>
          <div className={styles.ltvBlock}>
            <div className={styles.eyebrowSm}>Lifetime Value</div>
            <div className={styles.ltvFigure}>{formatCurrency(ltv)}</div>
            <div className={styles.ltvSub}>across {orderCount} order{orderCount === 1 ? '' : 's'}</div>
          </div>
        </div>

        {/* KPI ribbon */}
        <div className={styles.kpiRibbon}>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Avg Order</div>
            <div className={styles.kpiValue}>{formatCurrency(avgOrder)}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Last Seen</div>
            <div className={styles.kpiValue}>{stats?.lastOrderDate ? formatDate(stats.lastOrderDate) : '—'}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Credit Balance</div>
            <div className={`${styles.kpiValue} ${customer.creditBalance > 0 ? styles.kpiDanger : ''}`}>
              {formatCurrency(customer.creditBalance)}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Purchase Streak</div>
            <div className={styles.kpiValue}>{stats?.weekStreak ?? 0} wk</div>
          </div>
        </div>

        {/* Cadence */}
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionNum}>01</span>
            <span>Cadence</span>
            <span className={styles.sectionRule} />
          </div>
          <div className={styles.cadenceGrid}>
            {periodEntries.map(([label, value]) => (
              <div key={label} className={styles.cadenceRow}>
                <div className={styles.cadenceLabel}>{label}</div>
                <div className={styles.cadenceBarTrack}>
                  <div
                    className={styles.cadenceBarFill}
                    style={{ width: `${Math.max(2, (value / periodMax) * 100)}%` }}
                  />
                </div>
                <div className={styles.cadenceValue}>{formatCurrency(value)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Favourites */}
        {topProducts.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNum}>02</span>
              <span>Most Reordered</span>
              <span className={styles.sectionRule} />
            </div>
            <div className={styles.favGrid}>
              {topProducts.map((p, i) => (
                <div key={p.name} className={styles.favRow}>
                  <div className={styles.favRank}>{String(i + 1).padStart(2, '0')}</div>
                  <div className={styles.favName}>{p.name}</div>
                  <div className={styles.favBarTrack}>
                    <div className={styles.favBarFill} style={{ width: `${(p.quantity / topMax) * 100}%` }} />
                  </div>
                  <div className={styles.favQty}>
                    <strong>{p.quantity}</strong><span className={styles.favQtyUnit}>units</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNum}>03</span>
              <span>Recent Orders</span>
              <span className={styles.sectionRule} />
            </div>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td><span className={styles.orderNum}>{o.orderNumber}</span></td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td><span className={styles.statusPill}>{o.status.toUpperCase()}</span></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatCurrency(o.total)}</strong></td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(o.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div className={styles.footerRule} />
        <div className={styles.footer}>
          <div>
            <div className={styles.eyebrowSm}>Prepared by</div>
            <div className={styles.footerText}>Bread Faculty Bakery Management System</div>
          </div>
          <div className={styles.footerRight}>
            <div className={styles.eyebrowSm}>Patron since</div>
            <div className={styles.footerText}>{formatDate(customer.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
