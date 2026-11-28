import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import { termsSections } from "@/lib/legal/content";
import { APP_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Terms of Service | ${APP_NAME}`,
  description: `Terms governing use of the ${APP_NAME} gym management platform.`,
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description={`Rules and conditions for using ${APP_NAME} as a gym operator or staff user.`}
      sections={termsSections}
    />
  );
}
