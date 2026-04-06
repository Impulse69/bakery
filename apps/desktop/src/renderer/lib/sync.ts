import { db } from './db';
import { api } from './api';

let isSyncing = false;

export async function syncData() {
  if (isSyncing) return;
  if (!navigator.onLine) return;

  isSyncing = true;
  try {
    const pending = await db.syncQueue.where('status').equals('pending').sortBy('createdAt');
    if (pending.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[Sync] Found ${pending.length} pending operations. Starting sync...`);

    for (const op of pending) {
      try {
        switch (op.method) {
          case 'POST':
            await api.post(op.path, op.body);
            break;
          case 'PUT':
            await api.put(op.path, op.body);
            break;
          case 'PATCH':
            await api.patch(op.path, op.body);
            break;
          case 'DELETE':
            await api.delete(op.path);
            break;
        }
        
        // Remove from queue on success
        if (op.id) {
          await db.syncQueue.delete(op.id);
        }
      } catch (err) {
        console.error(`[Sync] Failed operation ${op.id}`, err);
        // Mark 4xx validation errors as failed so they don't block the queue indefinitely
        if (err instanceof Error && 'status' in err && (err as any).status < 500) {
            if (op.id) {
                await db.syncQueue.update(op.id, { status: 'failed', error: err.message });
            }
        } else {
            // Stop syncing if network drops or 500 server error happens again
            break; 
        }
      }
    }
    console.log(`[Sync] Sync complete.`);
  } finally {
    isSyncing = false;
  }
}

// Listen for network changes
window.addEventListener('online', syncData);

// Fallback interval just in case
setInterval(() => {
  if (navigator.onLine) {
    syncData();
  }
}, 30000);

// Kick off initial sync on load
setTimeout(syncData, 5000);
