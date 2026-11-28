/**
 * eSSL / ZKTeco ADMS push endpoint. Set the device's "Cloud server" to this app's domain;
 * it then calls /iclock/cdata, /iclock/getrequest and /iclock/devicecmd on its own.
 * Devices are trusted by serial number, which must be registered in Settings → Biometric door.
 */
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import {
  formatCommands,
  handshakeReply,
  parseAttlog,
  parseCommandResults,
  parseTemplates,
} from "@/lib/biometric/protocol";
import {
  SYNC_INTERVAL_MS,
  completeCommands,
  findDevice,
  recordPunches,
  storeTemplates,
  syncGymAccess,
  takeCommands,
  touchDevice,
} from "@/lib/biometric/service";

export const dynamic = "force-dynamic";

const logger = createLogger("iclock");

function text(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function endpoint(path: string[]): string {
  return (path[0] ?? "").toLowerCase().replace(/\.aspx$/, "");
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

async function resolveDevice(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get("SN") ?? req.nextUrl.searchParams.get("sn");
  const device = await findDevice(sn);
  if (!device) {
    logger.warn("unregistered biometric device", { sn: sn?.slice(0, 40) });
    return null;
  }
  await touchDevice(device, clientIp(req));
  return device;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const ep = endpoint((await ctx.params).path);
  if (ep === "ping") return text("OK");
  const device = await resolveDevice(req);
  if (!device) return text("Unknown device", 401);

  try {
    if (ep === "cdata") {
      return text(handshakeReply(device.serialNumber));
    }
    if (ep === "getrequest") {
      if (!device.lastSyncAt || Date.now() - device.lastSyncAt.getTime() > SYNC_INTERVAL_MS) {
        await syncGymAccess(device.gymId);
      }
      return text(formatCommands(await takeCommands(device.id)));
    }
    return text("OK");
  } catch (e) {
    logger.error("iclock GET failed", e as Error);
    return text("OK"); // never wedge the device; it retries on its own schedule
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const ep = endpoint((await ctx.params).path);
  const device = await resolveDevice(req);
  if (!device) return text("Unknown device", 401);

  const body = await req.text().catch(() => "");
  try {
    if (ep === "cdata") {
      const table = (req.nextUrl.searchParams.get("table") ?? "").toUpperCase();
      if (table === "ATTLOG") {
        const punches = parseAttlog(body);
        await recordPunches(device, punches);
        return text(`OK: ${punches.length}`);
      }
      if (["OPERLOG", "FINGERTMP", "FACE", "BIODATA"].includes(table)) {
        await storeTemplates(device, parseTemplates(body, table));
        return text("OK");
      }
      return text("OK");
    }
    if (ep === "devicecmd") {
      await completeCommands(device.id, parseCommandResults(body));
      return text("OK");
    }
    return text("OK");
  } catch (e) {
    logger.error("iclock POST failed", e as Error);
    // Non-OK makes the device resend the batch later, so data isn't lost.
    return text("ERROR", 500);
  }
}
