import { redirect } from "next/navigation";
import { isPublicSignupEnabled } from "@/lib/auth/public-signup";

export const dynamic = "force-dynamic";

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  if (!isPublicSignupEnabled()) {
    redirect("/login");
  }
  return children;
}
