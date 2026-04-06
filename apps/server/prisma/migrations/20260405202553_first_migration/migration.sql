/*
  Warnings:

  - You are about to drop the column `actual` on the `daily_production_targets` table. All the data in the column will be lost.
  - You are about to drop the column `carriedOver` on the `daily_production_targets` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `daily_production_targets` table. All the data in the column will be lost.
  - You are about to drop the column `target` on the `daily_production_targets` table. All the data in the column will be lost.
  - You are about to drop the column `recipeId` on the `production_batches` table. All the data in the column will be lost.
  - You are about to drop the `recipe_ingredients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `recipes` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[targetDate,productId]` on the table `daily_production_targets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetDate` to the `daily_production_targets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `production_batches` table without a default value. This is not possible if the table is not empty.
  - Made the column `wholesalePrice` on table `products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unitWholesalePrice` on table `sales_order_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "production_batches" DROP CONSTRAINT "production_batches_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_recipeId_fkey";

-- DropIndex
DROP INDEX "daily_production_targets_productId_date_key";

-- AlterTable
ALTER TABLE "daily_production_targets" DROP COLUMN "actual",
DROP COLUMN "carriedOver",
DROP COLUMN "date",
DROP COLUMN "target",
ADD COLUMN     "actualQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "carriedOverShortage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetDate" DATE NOT NULL,
ADD COLUMN     "targetQty" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "production_batches" DROP COLUMN "recipeId",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "wholesalePrice" SET NOT NULL;

-- AlterTable
ALTER TABLE "sales_order_items" ALTER COLUMN "unitWholesalePrice" SET NOT NULL;

-- DropTable
DROP TABLE "recipe_ingredients";

-- DropTable
DROP TABLE "recipes";

-- CreateIndex
CREATE UNIQUE INDEX "daily_production_targets_targetDate_productId_key" ON "daily_production_targets"("targetDate", "productId");

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
