-- CreateTable
CREATE TABLE "CityStamp" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "line" TEXT,
    "source" TEXT NOT NULL DEFAULT 'template',
    "inkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityStamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityStamp_tripId_city_key" ON "CityStamp"("tripId", "city");

-- AddForeignKey
ALTER TABLE "CityStamp" ADD CONSTRAINT "CityStamp_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
