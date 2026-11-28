import { LocaleProvider } from "@/components/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/i18n/locale-provider";
import Link from "next/link";
import { APP_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Member Portal | ${APP_NAME}`,
  description: "Book classes, pay dues, and view your membership",
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Link href="/member" className="font-semibold">
                {APP_NAME}
              </Link>
              <Link href="/member/supplements" className="text-sm text-muted-foreground hover:text-foreground">
                Supplements
              </Link>
            </div>
            <LanguageSwitcher />
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
      </div>
    </LocaleProvider>
  );
}
