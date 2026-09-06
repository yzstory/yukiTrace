CREATE TABLE "Activity" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "actorId" TEXT,
  "source" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reviewedAt" TIMESTAMP(3),
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Activity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Activity_tripId_createdAt_idx" ON "Activity"("tripId", "createdAt");
CREATE INDEX "Activity_tripId_entity_refId_idx" ON "Activity"("tripId", "entity", "refId");
