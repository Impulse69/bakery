import { prisma, remotePrisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

interface SyncConfig {
  table: string;
  timeColumn: string | null;
  parent?: string;
  parentTimeCol?: string;
}

const SYNC_ORDER: SyncConfig[] = [
  // Master Data
  { table: 'location', timeColumn: 'updatedAt' },
  { table: 'user', timeColumn: 'updatedAt' },
  { table: 'customer', timeColumn: 'updatedAt' },
  { table: 'product', timeColumn: 'updatedAt' },
  { table: 'productVariant', timeColumn: 'updatedAt' },
  { table: 'supplier', timeColumn: 'updatedAt' },
  { table: 'documentTemplate', timeColumn: 'updatedAt' },

  // Transactional Data
  { table: 'expense', timeColumn: 'createdAt' },
  { table: 'productStockAdjustment', timeColumn: 'createdAt' },

  { table: 'productionBatch', timeColumn: 'startedAt' },
  { table: 'dailyProductionTarget', timeColumn: 'updatedAt' },
  
  { table: 'purchaseOrder', timeColumn: 'createdAt' },
  { table: 'purchaseOrderLineItem', timeColumn: null, parent: 'purchaseOrder', parentTimeCol: 'createdAt' },

  { table: 'salesOrder', timeColumn: 'updatedAt' },
  { table: 'salesOrderItem', timeColumn: null, parent: 'salesOrder', parentTimeCol: 'updatedAt' },
  { table: 'payment', timeColumn: 'date' },
  
  // Reports
  { table: 'dailySalesSummary', timeColumn: 'createdAt' },
  { table: 'dailyProfitLoss', timeColumn: 'createdAt' },
];

let isSyncing = false;
let isRemoteAvailable = true;

export function startSyncService(intervalMs = 60 * 1000) { // Default every 1 minute
  if (!remotePrisma) {
    logger.info('DIRECT_URL not set or remote database unavailable. Sync disabled.');
    return;
  }
  
  logger.info({ intervalMs }, 'Cloud Sync service started');
  
  setInterval(async () => {
    if (isSyncing || !isRemoteAvailable) return;
    try {
      isSyncing = true;
      await runSync();
    } catch (err) {
      // If it's a schema mismatch (tables/columns missing), disable sync completely
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('does not exist in the current database')) {
        logger.error('Cloud Sync disabled due to remote database schema mismatch. Please run Prisma migrations on the remote database.');
        isRemoteAvailable = false;
      } else {
        logger.error({ err }, 'Cloud Sync failed');
      }
    } finally {
      isSyncing = false;
    }
  }, intervalMs);
}

async function runSync() {
  if (!remotePrisma) return;

  for (const config of SYNC_ORDER) {
    try {
      const localModel = (prisma as any)[config.table];
      const remoteModel = (remotePrisma as any)[config.table];

      if (!localModel || !remoteModel) continue;

      let remoteMaxDate = new Date(0);

      // Determine the latest sync point from remote
      if (config.timeColumn) {
        const latestRemote = await remoteModel.findFirst({
          orderBy: { [config.timeColumn]: 'desc' },
          take: 1,
        });
        if (latestRemote) {
          remoteMaxDate = latestRemote[config.timeColumn] || new Date(0);
        }
      } else if (config.parent && config.parentTimeCol) {
         // Sub-items don't have a time column, they just sync when the parent syncs
         // But to not query the whole table, we ask remote what its max parent time is? 
         // Wait, easier: we just don't try to find max for sub-items from remote, 
         // we query local items where parent's time > yesterday, etc.
         // Actually, if we just use a fixed lookback for sub-items:
         remoteMaxDate = new Date();
         remoteMaxDate.setHours(remoteMaxDate.getHours() - 24); // Sync last 24h of sub-items
      }

      // Build local query
      let whereClause = {};
      if (config.timeColumn) {
        whereClause = { [config.timeColumn]: { gt: remoteMaxDate } };
      } else if (config.parent && config.parentTimeCol) {
        whereClause = { [config.parent]: { [config.parentTimeCol]: { gt: remoteMaxDate } } };
      }

      const recordsToSync = await localModel.findMany({
        where: whereClause,
        orderBy: { id: 'asc' },
        take: 1000,
      });

      if (recordsToSync.length === 0) continue;

      // Upsert into remote
      let successCount = 0;
      for (const record of recordsToSync) {
        if (record.id) {
          try {
            await remoteModel.upsert({
              where: { id: record.id },
              create: record,
              update: record,
            });
            successCount++;
          } catch (upsertErr) {
             // Ignore duplicate key or foreign key races occasionally during active usage
          }
        }
      }
      
      if (successCount > 0) {
        logger.info({ table: config.table, count: successCount }, 'Cloud Sync pushed updates');
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ table: config.table, err: errMsg }, 'Cloud Sync error');
      
      // Bubble up structural errors so we can shut down the sync loop
      if (errMsg.includes('does not exist in the current database')) {
        throw err;
      }
    }
  }
}
