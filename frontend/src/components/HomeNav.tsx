"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";

export function HomeNav() {
  const { t, tProposals } = useLocale();
  return (
    <nav className="flex flex-wrap items-center gap-4">
      <Link
        href="/profile"
        className="text-primary underline underline-offset-2"
      >
        {t("title")}
      </Link>
      <Link
        href="/proposals/new"
        className="text-primary underline underline-offset-2"
      >
        {tProposals("navNewProposal")}
      </Link>
    </nav>
  );
}
