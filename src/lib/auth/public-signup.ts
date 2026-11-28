/**
 * Public self sign-up creates a brand-new owner account and gym.
 * On by default (Bhoomi Fitness asked for a sign-up option on the login page).
 * Set ALLOW_PUBLIC_SIGNUP="false" in Vercel to close it again.
 */
export function isPublicSignupEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase() !== "false";
}
