import { prisma } from '../lib/prisma.js';
import { sendSMS } from '@bakery/utils';

export async function checkLowStockAndAlert(itemId: string) {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) return;

    // Check if stock is low
    if (item.quantityOnHand <= (item.lowStockThreshold || 0)) {
      const alertPhone = process.env.ALERT_PHONE_NUMBER;
      
      if (!alertPhone) {
        console.warn('Low stock alert: ALERT_PHONE_NUMBER not set for item', item.name);
        return;
      }

      const message = `LOW STOCK ALERT: ${item.name} is running low. Current stock: ${item.quantityOnHand} ${item.unit}. Threshold: ${item.lowStockThreshold} ${item.unit}.`;
      
      console.log(`Triggering low stock SMS for ${item.name}...`);
      await sendSMS([alertPhone], message);
    }
  } catch (error) {
    console.error('Error in checkLowStockAndAlert:', error);
  }
}
