/*
  Warnings:

  - A unique constraint covering the columns `[publicSlug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicUrl]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "publicSlug" TEXT,
ADD COLUMN     "publicUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_publicSlug_key" ON "Project"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_publicUrl_key" ON "Project"("publicUrl");
