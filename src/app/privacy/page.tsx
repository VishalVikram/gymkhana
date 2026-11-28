import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/legal-page-layout";
import { privacySections } from "@/lib/legal/content";
import { APP_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `How ${APP_NAME} collects, uses, and protects personal and member data.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How we handle personal data for gym operators, staff, and members recorded in the system."
      sections={privacySections}
    />
  );
}
