import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Staff Login | Bhoomi Fitness",
  description: "Bhoomi Fitness staff portal: members, payments and attendance.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={jakarta.className}>{children}</div>;
}
