/**
 * Public self sign-up creates a brand-new owner account and gym.
 * Single-gym deployments (e.g. Bhoomi Fitness) keep it off; staff are added
 * from Settings → Team & access. Set ALLOW_PUBLIC_SIGNUP="true" to reopen it.
 */
export function isPublicSignupEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP?.trim() === "true";
}
