-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estimatedArrival" TIMESTAMP(3),
ADD COLUMN     "etaMinutes" INTEGER,
ADD COLUMN     "lastLocationLat" DOUBLE PRECISION,
ADD COLUMN     "lastLocationLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationTime" TIMESTAMP(3),
ADD COLUMN     "osrmDuration" INTEGER;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
