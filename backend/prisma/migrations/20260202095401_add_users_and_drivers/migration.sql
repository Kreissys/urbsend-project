/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vehiclePlate]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleBrand` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleModel` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehiclePlate` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleType` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleYear` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criminalRecord" TEXT,
ADD COLUMN     "driverLicense" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "vehicleBrand" TEXT NOT NULL,
ADD COLUMN     "vehicleModel" TEXT NOT NULL,
ADD COLUMN     "vehiclePlate" TEXT NOT NULL,
ADD COLUMN     "vehicleSOAT" TEXT,
ADD COLUMN     "vehicleType" TEXT NOT NULL,
ADD COLUMN     "vehicleYear" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT DEFAULT 'Efectivo',
ADD COLUMN     "proofImage" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'client',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_vehiclePlate_key" ON "Driver"("vehiclePlate");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
