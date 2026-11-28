import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Login | Bhoomi Fitness",
  description: "Bhoomi Fitness staff portal: members, payments and attendance.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
