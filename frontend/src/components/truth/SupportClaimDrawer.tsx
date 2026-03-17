"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { Shield, X } from "lucide-react";
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

const SUPPORT_BUTTON = { he: "בסס טענה זו", en: "Support Claim" };
const SUPPORT_HEADING = { he: "מבססים טענה", en: "Supporting the Claim" };
const SUPPORT_SUBTITLE = { he: "הבא ראיות או היגיון המבססים את הטענה. סוקרטס יעזור לך למצק אותם.", en: "Bring evidence or logic that supports the claim. Socrates will help you solidify them." };
const PLACEHOLDER = {
  he: "הבא ראיות או היגיון המבססים טענה זו…",
  en: "Bring evidence or logic that supports this claim…",
};
const FORGE_SEND = { he: "שלח", en: "Send" };

const TRUNCATE_LEN = 120;

interface SupportClaimDrawerProps {
  authorWallet: string;
  parentId: string;
  targetNodeContext: string;
}

function truncateContext(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd() + "…";
}

export function SupportClaimDrawer({
  authorWallet,
  parentId,
  targetNodeContext,
}: SupportClaimDrawerProps) {
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
        className="gap-2 rounded-full border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        aria-label={isRtl ? SUPPORT_BUTTON.he : SUPPORT_BUTTON.en}
      >
        <Shield className="size-4" aria-hidden />
        {isRtl ? SUPPORT_BUTTON.he : SUPPORT_BUTTON.en}
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
              <SheetTitle className="text-lg font-semibold text-foreground text-emerald-700 dark:text-emerald-300">
                {isRtl ? SUPPORT_HEADING.he : SUPPORT_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1 text-start">
                {isRtl ? SUPPORT_SUBTITLE.he : SUPPORT_SUBTITLE.en}
              </p>
              <div
                className="mt-3 border-s-4 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-600/40 p-3 rounded-e-md italic text-muted-foreground text-sm text-start"
                role="region"
                aria-label={isRtl ? SUPPORT_HEADING.he : SUPPORT_HEADING.en}
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
                relationship="supports"
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
