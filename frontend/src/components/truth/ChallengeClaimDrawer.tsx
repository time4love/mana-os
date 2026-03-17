"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetClose,
} from "@/components/ui/sheet";
import { ForgeChat, type ForgeChatConfig } from "@/components/truth/ForgeChat";

const CHALLENGE_BUTTON = { he: "הפרך טענה זו", en: "Challenge Claim" };
const CHALLENGE_HEADING = { he: "מפריכים טענה", en: "Challenging the Claim" };
const CHALLENGE_SUBTITLE = { he: "הצג ראיות סותרות או כשל לוגי. סוקרטס יעזור לך להשחיז את חץ ההפרכה.", en: "Show counter-evidence or a logical flaw. Socrates will help you sharpen the refutation." };
const PLACEHOLDER = {
  he: "הצג ראיות סותרות או כשל לוגי בטענה זו…",
  en: "Show counter-evidence or a logical flaw in this claim…",
};
const FORGE_SEND = { he: "שלח", en: "Send" };

const TRUNCATE_LEN = 120;

interface ChallengeClaimDrawerProps {
  authorWallet: string;
  parentId: string;
  targetNodeContext: string;
}

function truncateContext(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd() + "…";
}

export function ChallengeClaimDrawer({
  authorWallet,
  parentId,
  targetNodeContext,
}: ChallengeClaimDrawerProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const router = useRouter();
  const isRtl = locale === "he";
  const sheetSide = isRtl ? "start" : "end";

  const config: ForgeChatConfig = {
    apiEndpoint: "/api/oracle/forge",
    placeholder: locale === "he" ? PLACEHOLDER.he : PLACEHOLDER.en,
    submitLabel: locale === "he" ? FORGE_SEND.he : FORGE_SEND.en,
    showTriageMappingLabel: true,
  };

  function handleAnchored() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-full border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        aria-label={isRtl ? CHALLENGE_BUTTON.he : CHALLENGE_BUTTON.en}
      >
        <Swords className="size-4" aria-hidden />
        {isRtl ? CHALLENGE_BUTTON.he : CHALLENGE_BUTTON.en}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={sheetSide}
          className="flex !h-dvh max-h-dvh flex-col max-w-md w-full p-0 gap-0 overflow-hidden"
          preventBackdropClose
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="flex-none border-b border-border bg-muted/30 px-6 py-4 text-start flex flex-row items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold text-foreground text-amber-700 dark:text-amber-300">
                {isRtl ? CHALLENGE_HEADING.he : CHALLENGE_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1 text-start">
                {isRtl ? CHALLENGE_SUBTITLE.he : CHALLENGE_SUBTITLE.en}
              </p>
              <div
                className="mt-3 border-s-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/20 dark:border-amber-600/40 p-3 rounded-e-md italic text-muted-foreground text-sm text-start"
                role="region"
                aria-label={isRtl ? CHALLENGE_HEADING.he : CHALLENGE_HEADING.en}
              >
                <p className="leading-relaxed line-clamp-4 text-start">
                  {truncateContext(targetNodeContext, TRUNCATE_LEN)}
                </p>
              </div>
            </div>
            <SheetClose
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isRtl ? "סגור" : "Close"}
            >
              <X className="size-5" aria-hidden />
            </SheetClose>
          </SheetHeader>
          <SheetBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ForgeChat
                authorWallet={authorWallet}
                parentId={parentId}
                relationship="challenges"
                targetNodeContext={targetNodeContext}
                config={config}
                onAnchored={handleAnchored}
                className="flex-1 min-h-0 border-0 shadow-none rounded-none"
              />
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
