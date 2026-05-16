import { useState, useEffect, useCallback } from 'react';
import type { AuditLog } from '@bakery/types';
import { Modal } from '@bakery/ui';
import { api } from '../../lib/api';
import styles from './AuditDrawer.module.css';

interface Props {
  userId: string;
  userName: string;
  from: string;
  to: string;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  item_added: 'Added item',
  item_quantity_changed: 'Changed quantity',
  item_removed: 'Removed item',
  payment_added: 'Recorded payment',
  payment_voided: 'Voided payment',
  password_reset: 'Reset password',
};

const ENTITY_LABEL: Record<string, string> = {
  sales_order: 'order',
  sales_order_item: 'line item',
  payment: 'payment',
  product: 'product',
  user: 'user',
};

function formatJson(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function AuditDrawer({ userId, userName, from, to, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', userId);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
      params.set('limit', '100');
      const res = await api.get<{ data: AuditLog[] }>(`/audit?${params.toString()}`);
      setLogs(res.data ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Modal isOpen onClose={onClose} title={`Activity — ${userName}`} size="lg">
      {loading ? (
        <p className={styles.loading}>Loading activity…</p>
      ) : logs.length === 0 ? (
        <p className={styles.empty}>No recorded activity in this range.</p>
      ) : (
        <ul className={styles.timeline}>
          {logs.map((log) => (
            <li key={log.id} className={styles.entry}>
              <div className={styles.entryHead}>
                <span className={styles.action}>{ACTION_LABEL[log.action] ?? log.action}</span>
                <span className={styles.entityChip}>
                  {ENTITY_LABEL[log.entity] ?? log.entity}
                </span>
                <span className={styles.time}>
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.reason && <p className={styles.reason}>"{log.reason}"</p>}
              {(log.beforeJson != null || log.afterJson != null) && (
                <div className={styles.diff}>
                  {log.beforeJson != null && (
                    <div className={styles.diffCol}>
                      <span className={styles.diffLabel}>Before</span>
                      <pre className={styles.diffPre}>{formatJson(log.beforeJson)}</pre>
                    </div>
                  )}
                  {log.afterJson != null && (
                    <div className={styles.diffCol}>
                      <span className={styles.diffLabel}>After</span>
                      <pre className={styles.diffPre}>{formatJson(log.afterJson)}</pre>
                    </div>
                  )}
                </div>
              )}
              <div className={styles.entryFoot}>
                <span className={styles.entityId}>{log.entityId}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
