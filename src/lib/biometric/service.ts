import { AttendanceMethod, MemberStatus, type BiometricDevice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateOnlyIST, todayIST } from "@/lib/date-only";
import { createLogger } from "@/lib/logger";
import {
  cmdAddUser,
  cmdDeleteUser,
  cmdRestoreTemplate,
  type CapturedTemplate,
  type CommandResult,
  type Punch,
  type TemplateTable,
} from "./protocol";

const logger = createLogger("biometric");

const IST_OFFSET_MS = 330 * 60 * 1000;
/** How often a polling device triggers a membership → door-access re-check. */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Commands handed to a device per poll (devices choke on very large batches). */
const COMMANDS_PER_POLL = 20;

/** Start of the IST calendar day containing `t`, as a real instant. */
function istDayStart(t: Date): Date {
  return new Date(toDateOnlyIST(t).getTime() - IST_OFFSET_MS);
}

export async function findDevice(serialNumber: string | null): Promise<BiometricDevice | null> {
  const sn = serialNumber?.trim();
  if (!sn) return null;
  return prisma.biometricDevice.findUnique({ where: { serialNumber: sn } });
}

export async function touchDevice(device: BiometricDevice, ip: string | null): Promise<void> {
  await prisma.biometricDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), ...(ip ? { lastIp: ip.slice(0, 64) } : {}) },
  });
}

/**
 * Door scans → attendance. One attendance row per member per IST day (first scan wins);
 * later scans that day are ignored. Scans from before the device was registered are skipped
 * (a new device uploads its whole old log on first connect).
 */
export async function recordPunches(device: BiometricDevice, punches: Punch[]): Promise<number> {
  if (punches.length === 0) return 0;
  const notBefore = new Date(device.createdAt.getTime() - 24 * 60 * 60 * 1000);
  const pins = [...new Set(punches.map((p) => p.pin))];
  const users = await prisma.biometricUser.findMany({
    where: { gymId: device.gymId, pin: { in: pins } },
    select: { pin: true, memberId: true },
  });
  const memberByPin = new Map(users.map((u) => [u.pin, u.memberId]));

  let created = 0;
  const sorted = [...punches].sort((a, b) => a.time.getTime() - b.time.getTime());
  for (const p of sorted) {
    if (p.time < notBefore || p.time.getTime() > Date.now() + 10 * 60 * 1000) continue;
    const memberId = memberByPin.get(p.pin);
    if (!memberId) continue;
    const dayStart = istDayStart(p.time);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const existing = await prisma.attendance.findFirst({
      where: { gymId: device.gymId, memberId, checkIn: { gte: dayStart, lt: dayEnd } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.attendance.create({
      data: {
        gymId: device.gymId,
        memberId,
        checkIn: p.time,
        method: AttendanceMethod.BIOMETRIC,
        location: `Door: ${device.name}`.slice(0, 120),
      },
    });
    created++;
  }
  return created;
}

/**
 * Fingerprint/face templates enrolled on a device are saved, so a member whose access was
 * removed (expiry) gets them back on renewal without re-enrolling. They're also copied to the
 * gym's other doors.
 */
export async function storeTemplates(
  device: BiometricDevice,
  templates: CapturedTemplate[],
): Promise<number> {
  if (templates.length === 0) return 0;
  const users = await prisma.biometricUser.findMany({
    where: { gymId: device.gymId, pin: { in: [...new Set(templates.map((t) => t.pin))] } },
    select: { id: true, pin: true, accessGranted: true },
  });
  const byPin = new Map(users.map((u) => [u.pin, u]));
  const others = await prisma.biometricDevice.findMany({
    where: { gymId: device.gymId, id: { not: device.id } },
    select: { id: true },
  });

  let stored = 0;
  for (const t of templates) {
    const user = byPin.get(t.pin);
    if (!user) continue;
    const prev = await prisma.biometricTemplate.findUnique({
      where: {
        biometricUserId_tableName_slot: {
          biometricUserId: user.id,
          tableName: t.table,
          slot: t.slot,
        },
      },
      select: { data: true },
    });
    if (prev?.data === t.data) continue;
    await prisma.biometricTemplate.upsert({
      where: {
        biometricUserId_tableName_slot: {
          biometricUserId: user.id,
          tableName: t.table,
          slot: t.slot,
        },
      },
      create: { biometricUserId: user.id, tableName: t.table, slot: t.slot, data: t.data },
      update: { data: t.data },
    });
    stored++;
    if (user.accessGranted && others.length > 0) {
      await prisma.biometricCommand.createMany({
        data: others.map((d) => ({
          deviceId: d.id,
          command: cmdRestoreTemplate(t.table, t.data),
        })),
      });
    }
  }
  return stored;
}

/** Commands to grant door access: create the user, then restore any saved templates. */
async function grantCommands(biometricUserId: string, pin: number, name: string): Promise<string[]> {
  const templates = await prisma.biometricTemplate.findMany({
    where: { biometricUserId },
    orderBy: [{ tableName: "asc" }, { slot: "asc" }],
  });
  return [
    cmdAddUser(pin, name),
    ...templates.map((t) => cmdRestoreTemplate(t.tableName as TemplateTable, t.data)),
  ];
}

export type AccessDecision = { allowed: boolean; validUntil: Date | null };

/** Door access follows the membership: allowed through the last membership end date (IST). */
export function decideAccess(
  member: { deletedAt: Date | null; status: MemberStatus; nextRenewalDate: Date | null },
  latestEnd: Date | null,
  today: Date = todayIST(),
): AccessDecision {
  if (member.deletedAt) return { allowed: false, validUntil: latestEnd };
  const end = latestEnd ?? member.nextRenewalDate;
  if (end) return { allowed: end.getTime() >= today.getTime(), validUntil: end };
  return { allowed: member.status === MemberStatus.ACTIVE, validUntil: null };
}

export type SyncSummary = { granted: number; revoked: number; devices: number };

/**
 * Compare each enrolled member's membership with what's on the doors and queue changes:
 * expired → delete from devices (door stops opening); renewed → re-add with saved templates.
 */
export async function syncGymAccess(gymId: string): Promise<SyncSummary> {
  const devices = await prisma.biometricDevice.findMany({ where: { gymId }, select: { id: true } });
  const users = await prisma.biometricUser.findMany({
    where: { gymId },
    select: {
      id: true,
      pin: true,
      accessGranted: true,
      validUntil: true,
      Member: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          nextRenewalDate: true,
        },
      },
    },
  });
  if (users.length === 0) {
    await prisma.biometricDevice.updateMany({ where: { gymId }, data: { lastSyncAt: new Date() } });
    return { granted: 0, revoked: 0, devices: devices.length };
  }

  const ends = await prisma.membership.groupBy({
    by: ["memberId"],
    where: { gymId, memberId: { in: users.map((u) => u.Member.id) } },
    _max: { endDate: true },
  });
  const endByMember = new Map(ends.map((e) => [e.memberId, e._max.endDate]));
  const today = todayIST();

  let granted = 0;
  let revoked = 0;
  for (const u of users) {
    const d = decideAccess(u.Member, endByMember.get(u.Member.id) ?? null, today);
    const validChanged = (u.validUntil?.getTime() ?? null) !== (d.validUntil?.getTime() ?? null);
    if (d.allowed === u.accessGranted) {
      if (validChanged) {
        await prisma.biometricUser.update({ where: { id: u.id }, data: { validUntil: d.validUntil } });
      }
      continue;
    }
    const commands = d.allowed
      ? await grantCommands(u.id, u.pin, u.Member.name)
      : [cmdDeleteUser(u.pin)];
    await prisma.$transaction([
      prisma.biometricCommand.createMany({
        data: devices.flatMap((dev) => commands.map((command) => ({ deviceId: dev.id, command }))),
      }),
      prisma.biometricUser.update({
        where: { id: u.id },
        data: { accessGranted: d.allowed, validUntil: d.validUntil },
      }),
    ]);
    if (d.allowed) granted++;
    else revoked++;
  }
  await prisma.biometricDevice.updateMany({ where: { gymId }, data: { lastSyncAt: new Date() } });
  if (granted || revoked) logger.info("biometric sync", { gymId, granted, revoked });
  return { granted, revoked, devices: devices.length };
}

/** A newly added device gets every member who currently has access. */
export async function seedDevice(deviceId: string, gymId: string): Promise<number> {
  const users = await prisma.biometricUser.findMany({
    where: { gymId, accessGranted: true },
    select: { id: true, pin: true, Member: { select: { name: true } } },
    orderBy: { pin: "asc" },
  });
  const data: { deviceId: string; command: string }[] = [];
  for (const u of users) {
    for (const command of await grantCommands(u.id, u.pin, u.Member.name)) {
      data.push({ deviceId, command });
    }
  }
  if (data.length) await prisma.biometricCommand.createMany({ data });
  return data.length;
}

/** Next batch of queued commands for a polling device (marked SENT). */
export async function takeCommands(deviceId: string): Promise<{ id: number; command: string }[]> {
  // Re-send anything sent >10 min ago with no result (device rebooted / lost it).
  await prisma.biometricCommand.updateMany({
    where: { deviceId, status: "SENT", sentAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    data: { status: "PENDING" },
  });
  const cmds = await prisma.biometricCommand.findMany({
    where: { deviceId, status: "PENDING" },
    orderBy: { id: "asc" },
    take: COMMANDS_PER_POLL,
    select: { id: true, command: true },
  });
  if (cmds.length) {
    await prisma.biometricCommand.updateMany({
      where: { id: { in: cmds.map((c) => c.id) } },
      data: { status: "SENT", sentAt: new Date() },
    });
  }
  return cmds;
}

export async function completeCommands(deviceId: string, results: CommandResult[]): Promise<void> {
  for (const r of results) {
    await prisma.biometricCommand.updateMany({
      where: { id: r.id, deviceId },
      data: {
        status: r.returnCode >= 0 ? "DONE" : "FAILED",
        returnCode: r.returnCode,
        completedAt: new Date(),
      },
    });
  }
}

/** Give every (non-deleted) member without one a door user ID: 1, 2, 3… per gym. */
export async function assignPins(gymId: string): Promise<number> {
  const missing = await prisma.member.findMany({
    where: { gymId, deletedAt: null, BiometricUser: null },
    select: { id: true },
    orderBy: { joinDate: "asc" },
  });
  if (missing.length === 0) return 0;
  const max = await prisma.biometricUser.aggregate({ where: { gymId }, _max: { pin: true } });
  let next = (max._max.pin ?? 0) + 1;
  await prisma.biometricUser.createMany({
    data: missing.map((m) => ({ gymId, memberId: m.id, pin: next++ })),
    skipDuplicates: true,
  });
  return missing.length;
}

/** Data for the Biometric door dashboard page. */
export async function getDoorOverview(gymId: string) {
  const [devices, users, unassignedMembers, doorCheckInsLast24h] = await Promise.all([
    prisma.biometricDevice.findMany({
      where: { gymId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { Commands: { where: { status: { in: ["PENDING", "SENT"] } } } } },
      },
    }),
    prisma.biometricUser.findMany({
      where: { gymId, Member: { deletedAt: null } },
      orderBy: { pin: "asc" },
      select: {
        pin: true,
        accessGranted: true,
        validUntil: true,
        Member: { select: { id: true, name: true, phone: true } },
        _count: { select: { Templates: true } },
      },
    }),
    prisma.member.count({ where: { gymId, deletedAt: null, BiometricUser: null } }),
    prisma.attendance.count({
      where: {
        gymId,
        method: AttendanceMethod.BIOMETRIC,
        checkIn: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return {
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt,
      lastSyncAt: d.lastSyncAt,
      pendingCommands: d._count.Commands,
    })),
    members: users.map((u) => ({
      memberId: u.Member.id,
      name: u.Member.name,
      phone: u.Member.phone,
      doorId: u.pin,
      accessGranted: u.accessGranted,
      validUntil: u.validUntil,
      enrolled: u._count.Templates > 0,
    })),
    unassignedMembers,
    doorCheckInsLast24h,
  };
}

export type AddDeviceResult = { ok: true; deviceId: string } | { ok: false; error: string };

/** Register a device for the gym, load it with everyone who has access, then apply changes. */
export async function addDevice(gymId: string, serialNumber: string, name: string): Promise<AddDeviceResult> {
  const sn = serialNumber.trim().toUpperCase();
  const taken = await prisma.biometricDevice.findUnique({ where: { serialNumber: sn } });
  if (taken) {
    return {
      ok: false,
      error: taken.gymId === gymId ? "This device is already added." : "This serial number is registered elsewhere.",
    };
  }
  const device = await prisma.biometricDevice.create({ data: { gymId, serialNumber: sn, name } });
  await seedDevice(device.id, gymId);
  await syncGymAccess(gymId);
  return { ok: true, deviceId: device.id };
}

export async function removeDevice(gymId: string, deviceId: string): Promise<void> {
  await prisma.biometricDevice.deleteMany({ where: { id: deviceId, gymId } });
}
