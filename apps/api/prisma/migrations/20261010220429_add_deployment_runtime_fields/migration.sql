-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "containerName" TEXT,
ADD COLUMN     "containerPort" INTEGER,
ADD COLUMN     "hostPort" INTEGER;
