import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/middleware/rate-limit";
import { signupHandler } from "@/domains/identity/handlers/signup";
import { isPublicSignupEnabled } from "@/lib/auth/public-signup";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request, "strict");
  if (rl) return rl;
  if (!isPublicSignupEnabled()) {
    return NextResponse.json(
      { success: false, error: "Sign-up is closed. Ask the gym admin for access.", code: "SIGNUP_DISABLED" },
      { status: 403 },
    );
  }
  return signupHandler(request);
}
