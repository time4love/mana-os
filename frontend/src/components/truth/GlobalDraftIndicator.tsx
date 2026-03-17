"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileEdit } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";

export function GlobalDraftIndicator() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [draftInfo, setDraftInfo] = useState<{ arenaId: string; count: number } | null>(null);

  useEffect(() => {
    let foundDraft: { arenaId: string; count: number } | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("mana_sieve_draft_")) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) ?? "{}") as {
            transcript?: string;
            processedClaims?: unknown[];
          };
          const count = data.processedClaims?.length ?? 0;
          if (count > 0 || (data.transcript?.length ?? 0) > 0) {
            const arenaId = key.replace("mana_sieve_draft_", "");
            foundDraft = { arenaId, count };
            break;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    setDraftInfo(foundDraft);
  }, [pathname]);

  if (!draftInfo || pathname === `/truth/node/${draftInfo.arenaId}`) return null;

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-500">
      <Link
        href={`/truth/node/${draftInfo.arenaId}?openDraft=true`}
        className="pointer-events-auto flex items-center gap-3 bg-primary text-white px-5 py-3 rounded-full shadow-soft-md border border-primary/30 hover:opacity-95 hover:scale-105 transition-all min-w-0 max-w-[min(100%,22rem)]"
      >
        <FileEdit className="size-4 shrink-0" aria-hidden />
        <div className="flex flex-col text-start min-w-0">
          <span className="text-sm font-bold leading-tight text-white">
            {locale === "he" ? "טיוטת קציר פעילה" : "Active Harvest Draft"}
          </span>
          <span className="text-xs text-white/90 mt-0.5">
            {locale === "he" ? "לחץ לחזרה לזירה" : "Click to return to Arena"}
          </span>
        </div>
      </Link>
    </div>
  );
}
