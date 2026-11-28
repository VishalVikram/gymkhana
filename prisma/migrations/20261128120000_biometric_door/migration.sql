-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "gymId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricUser" (
    "id" TEXT NOT NULL,
    "gymId" UUID NOT NULL,
    "memberId" TEXT NOT NULL,
    "pin" INTEGER NOT NULL,
    "accessGranted" BOOLEAN NOT NULL DEFAULT false,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricTemplate" (
    "id" TEXT NOT NULL,
    "biometricUserId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricCommand" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "returnCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BiometricCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_serialNumber_key" ON "BiometricDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "BiometricDevice_gymId_idx" ON "BiometricDevice"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricUser_memberId_key" ON "BiometricUser"("memberId");

-- CreateIndex
CREATE INDEX "BiometricUser_gymId_idx" ON "BiometricUser"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricUser_gymId_pin_key" ON "BiometricUser"("gymId", "pin");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricTemplate_biometricUserId_tableName_slot_key" ON "BiometricTemplate"("biometricUserId", "tableName", "slot");

-- CreateIndex
CREATE INDEX "BiometricCommand_deviceId_status_idx" ON "BiometricCommand"("deviceId", "status");

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricUser" ADD CONSTRAINT "BiometricUser_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricUser" ADD CONSTRAINT "BiometricUser_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricTemplate" ADD CONSTRAINT "BiometricTemplate_biometricUserId_fkey" FOREIGN KEY ("biometricUserId") REFERENCES "BiometricUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricCommand" ADD CONSTRAINT "BiometricCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

