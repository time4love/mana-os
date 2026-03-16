"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { createArenaConfig } from "@/components/truth/ForgeChat";
import { ForgeSheet } from "@/components/truth/ForgeSheet";
import { useEffect, useMemo, useState } from "react";

const HEADING = {
  he: "יזום זירת דיון חדשה",
  en: "Initiate New Arena",
};

const CONNECT_PROMPT = {
  he: "חברו ארנק כדי ליצור זירת דיון במארג האמת.",
  en: "Connect your wallet to create an arena in the Truth Weave.",
};

const BACK_TO_WEAVE = {
  he: "חזרה למרחב האמת",
  en: "Back to the Epistemic Weave",
};

export default function NewArenaPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const { address } = useAccount();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (address) setSheetOpen(true);
  }, [address]);

  const handleOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) router.push("/truth");
  };

  const handleAnchored = () => {
    router.push("/truth");
  };

  const arenaConfig = useMemo(() => createArenaConfig(locale), [locale]);
  const isRtl = locale === "he";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-4 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link
          href="/truth"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {isRtl ? (
            <>
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
              {BACK_TO_WEAVE.he}
            </>
          ) : (
            <>
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
              {BACK_TO_WEAVE.en}
            </>
          )}
        </Link>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {locale === "he" ? HEADING.he : HEADING.en}
          </h1>
          {!address && (
            <p className="text-muted-foreground">
              {locale === "he" ? CONNECT_PROMPT.he : CONNECT_PROMPT.en}
            </p>
          )}
        </header>

        {address && (
          <ForgeSheet
            isOpen={sheetOpen}
            onOpenChange={handleOpenChange}
            targetNodeContext={null}
            mode="root"
            config={arenaConfig}
            authorWallet={address}
            onAnchored={handleAnchored}
          />
        )}
      </div>
    </main>
  );
}
