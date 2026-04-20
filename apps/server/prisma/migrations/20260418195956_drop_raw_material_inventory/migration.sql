/*
  Warnings:

  - You are about to drop the column `inventoryItemId` on the `purchase_order_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `purchase_orders` table. All the data in the column will be lost.
  - You are about to drop the `inventory_count_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory_counts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventory_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stock_movements` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `productId` to the `purchase_order_line_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "inventory_count_items" DROP CONSTRAINT "inventory_count_items_inventoryCountId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_count_items" DROP CONSTRAINT "inventory_count_items_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_counts" DROP CONSTRAINT "inventory_counts_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "inventory_counts" DROP CONSTRAINT "inventory_counts_locationId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_line_items" DROP CONSTRAINT "purchase_order_line_items_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_inventoryItemId_fkey";

-- DropIndex
DROP INDEX "purchase_orders_supplierId_idx";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "daily_production_targets" ADD COLUMN     "status" "ProductionBatchStatus" NOT NULL DEFAULT 'in_progress';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'pcs';

-- AlterTable
ALTER TABLE "purchase_order_line_items" DROP COLUMN "inventoryItemId",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN "supplierId",
ADD COLUMN     "customerId" TEXT;

-- DropTable
DROP TABLE "inventory_count_items";

-- DropTable
DROP TABLE "inventory_counts";

-- DropTable
DROP TABLE "inventory_items";

-- DropTable
DROP TABLE "stock_movements";

-- DropEnum
DROP TYPE "InventoryCountStatus";

-- DropEnum
DROP TYPE "StockAdjustmentType";

-- CreateTable
CREATE TABLE "product_stock_adjustments" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityChange" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_stock_adjustments_productId_idx" ON "product_stock_adjustments"("productId");

-- CreateIndex
CREATE INDEX "purchase_orders_customerId_idx" ON "purchase_orders"("customerId");

-- AddForeignKey
ALTER TABLE "product_stock_adjustments" ADD CONSTRAINT "product_stock_adjustments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
