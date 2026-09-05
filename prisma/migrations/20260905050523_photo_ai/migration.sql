-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "aiCaption" TEXT,
ADD COLUMN     "aiScore" INTEGER,
ADD COLUMN     "aiStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "aiTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "firstMoment" TEXT;
