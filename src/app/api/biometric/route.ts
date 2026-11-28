import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ApiErrors } from "@/lib/api-handler";
import { hasPermission } from "@/lib/permissions";
import { getGymContext, GymContextError } from "@/domains/tenancy";
import { createLogger } from "@/lib/logger";
import {
  addDevice,
  assignPins,
  getDoorOverview,
  removeDevice,
  syncGymAccess,
} from "@/lib/biometric/service";

export const dynamic = "force-dynamic";

const logger = createLogger("api-biometric");

/** Dashboard data for Attendance → Biometric door. */
export async function GET(req: NextRequest) {
  try {
    const { gymId } = await getGymContext(req);
    const overview = await getDoorOverview(gymId);
    return NextResponse.json({ server: { host: req.nextUrl.host }, ...overview });
  } catch (e) {
    if (e instanceof GymContextError) return ApiErrors.unauthorized();
    logger.error("biometric GET failed", e as Error);
    return ApiErrors.internal("Failed to load biometric door settings");
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("addDevice"),
    serialNumber: z
      .string()
      .trim()
      .min(4, "Serial number looks too short")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Serial number: letters and numbers only"),
    name: z.string().trim().min(1).max(60),
  }),
  z.object({ action: z.literal("removeDevice"), deviceId: z.string().min(1) }),
  z.object({ action: z.literal("assignDoorIds") }),
  z.object({ action: z.literal("syncNow") }),
]);

export async function POST(req: NextRequest) {
  try {
    const { gymId } = await getGymContext(req);
    const session = await auth();
    if (!hasPermission(session, "canEditMembers")) {
      return ApiErrors.forbidden("You don't have permission to manage door access.");
    }
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    const body = parsed.data;

    switch (body.action) {
      case "addDevice": {
        const r = await addDevice(gymId, body.serialNumber, body.name);
        return r.ok ? NextResponse.json(r) : ApiErrors.validationError(r.error);
      }
      case "removeDevice":
        await removeDevice(gymId, body.deviceId);
        return NextResponse.json({ ok: true });
      case "assignDoorIds": {
        const assigned = await assignPins(gymId);
        const sync = await syncGymAccess(gymId);
        return NextResponse.json({ ok: true, assigned, ...sync });
      }
      default: {
        const sync = await syncGymAccess(gymId);
        return NextResponse.json({ ok: true, ...sync });
      }
    }
  } catch (e) {
    if (e instanceof GymContextError) return ApiErrors.unauthorized();
    logger.error("biometric POST failed", e as Error);
    return ApiErrors.internal("Failed to update biometric door settings");
  }
}
