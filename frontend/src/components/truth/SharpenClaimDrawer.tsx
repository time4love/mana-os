"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { Hammer, Lock, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetClose,
} from "@/components/ui/sheet";
import { ForgeChat, type ForgeChatConfig } from "@/components/truth/ForgeChat";
import { CodexSheet } from "@/components/ui/CodexSheet";
import { Button } from "@/components/ui/button";

const SHARPEN_HEADING = { he: "מגירת הנפח — חידוד טענה", en: "The Blacksmith — Sharpen Claim" };
const SHARPEN_SUBTITLE = {
  he: "הוסיפו נתון, הבהרה או הדקות לוגית. הנפח ממזג עם הטקסט הקיים — בלי להמציא ראיות בשמכם.",
  en: "Add data, clarification, or logical nuance. The Blacksmith merges with the existing text — without inventing evidence for you.",
};
const TARGET_LABEL = { he: "מטרה", heTarget: "טענה לחידוד", en: "Target", enLocked: "Claim to sharpen" };
const PLACEHOLDER = {
  he: "מה בדיוק תרצו ללטש או להדק בטענה הזו?",
  en: "What exactly do you want to sharpen or tighten in this claim?",
};
const FORGE_SEND = { he: "לטש עם הנפח", en: "Forge with Blacksmith" };
const SHARPEN_CTA = { he: "לטש טענה זו", en: "Sharpen Claim" };

interface SharpenClaimDrawerProps {
  targetNodeId: string;
  targetAssertion: string;
  authorWallet: string;
  hasGenesisAnchor: boolean;
  onLockedClick?: () => void;
}

export function SharpenClaimDrawer({
  targetNodeId,
  targetAssertion,
  authorWallet,
  hasGenesisAnchor,
  onLockedClick,
}: SharpenClaimDrawerProps) {
  const [open, setOpen] = useState(false);
  const [sbtCodexOpen, setSbtCodexOpen] = useState(false);
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

  if (!authorWallet.trim()) return null;

  return (
    <>
      {hasGenesisAnchor ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-sm font-medium transition-colors"
          aria-label={isRtl ? SHARPEN_CTA.he : SHARPEN_CTA.en}
        >
          <Hammer className="size-4 shrink-0" aria-hidden />
          {isRtl ? SHARPEN_CTA.he : SHARPEN_CTA.en}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (onLockedClick ? onLockedClick() : setSbtCodexOpen(true))}
          className="gap-2 rounded-full border-emerald-500/20 text-muted-foreground shrink-0 opacity-80"
          aria-label={isRtl ? `${SHARPEN_CTA.he} (נעול)` : `${SHARPEN_CTA.en} (locked)`}
        >
          <Lock className="size-3.5" aria-hidden />
          {isRtl ? SHARPEN_CTA.he : SHARPEN_CTA.en}
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={sheetSide}
          className="flex !h-dvh max-h-dvh flex-col max-w-md w-full p-0 gap-0 overflow-hidden"
          preventBackdropClose
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="flex-none border-b border-border bg-muted/30 px-6 py-4 text-start flex flex-row items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <SheetTitle className="text-lg font-semibold text-foreground text-start flex items-center gap-2">
                <Hammer className="size-5 text-emerald-600 shrink-0" aria-hidden />
                {isRtl ? SHARPEN_HEADING.he : SHARPEN_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground text-start leading-relaxed">
                {isRtl ? SHARPEN_SUBTITLE.he : SHARPEN_SUBTITLE.en}
              </p>
              <div
                className="mt-1 border-s-4 border-emerald-500/40 bg-emerald-500/5 p-3 rounded-e-md text-sm text-start space-y-1"
                role="region"
                aria-label={isRtl ? TARGET_LABEL.heTarget : TARGET_LABEL.enLocked}
              >
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  {isRtl ? TARGET_LABEL.he : TARGET_LABEL.en}:
                </span>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap break-words">{targetAssertion}</p>
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
                parentId={targetNodeId}
                targetNodeContext={targetAssertion}
                config={config}
                forgeDebateIntent="sharpens"
                cacheKeySuffix="sharpen"
                onAnchored={handleAnchored}
                className="flex-1 min-h-0 border-0 shadow-none rounded-none"
              />
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
      <CodexSheet open={sbtCodexOpen} onOpenChange={setSbtCodexOpen} chapterId="sybil-resistance" />
    </>
  );
}
