"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";

const NOT_FOUND_MSG = {
  he: "צומת לא נמצא במארג.",
  en: "Node not found in the weave.",
};

const BACK_LINK = {
  he: "חזרה למנוע האמת",
  en: "Back to Truth Engine",
};

export default function TruthNodeNotFound() {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const msg = locale === "he" ? NOT_FOUND_MSG.he : NOT_FOUND_MSG.en;
  const back = locale === "he" ? BACK_LINK.he : BACK_LINK.en;

  return (
    <main
      className="min-h-[calc(100vh-3.5rem)] px-4 py-16 flex flex-col items-center justify-center gap-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <p className="text-lg text-muted-foreground">{msg}</p>
      <Link
        href="/truth"
        className="text-primary hover:underline font-medium"
      >
        {back}
      </Link>
    </main>
  );
}
