"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";
import { X, Lock } from "lucide-react";
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
import { CodexSheet } from "@/components/ui/CodexSheet";

const TACTICAL_BUTTON = { he: "♟️ שחק מהלך טקטי", en: "♟️ Play tactical move" };
const TACTICAL_HEADING = { he: "מגירת המהלך הטקטי", en: "Tactical Move Drawer" };
const TACTICAL_SUBTITLE = {
  he: "מטרה נעולה — הזינו את הראיות או הניגוד הלוגי שלכם. השופט ממיין בלבד; הוא לא ממציא חומר.",
  en: "Locked target — enter your evidence or logical counter. The Referee classifies only; it does not invent material.",
};
const TARGET_LABEL = { he: "מטרה", heTarget: "מטרה נעולה", en: "Target", enLocked: "Locked target" };
const PLACEHOLDER = {
  he: "הזינו כאן את ניסוח ההתקפה, הראיה או ההפרכה הגולמית…",
  en: "Enter your raw attack, evidence, or refutation…",
};
const FORGE_SEND = { he: "בחן מהלך מול השופט", en: "Evaluate move with Referee" };

interface TacticalMoveDrawerProps {
  targetNodeId: string;
  targetAssertion: string;
  arenaId?: string;
  tacticalSupportedTheoryHint?: "THEORY_A" | "THEORY_B";
  authorWallet: string;
  hasGenesisAnchor: boolean;
  onLockedClick?: () => void;
  onAnchored?: () => void;
}

export function TacticalMoveDrawer({
  targetNodeId,
  targetAssertion,
  arenaId,
  tacticalSupportedTheoryHint,
  authorWallet,
  hasGenesisAnchor,
  onLockedClick,
  onAnchored,
}: TacticalMoveDrawerProps) {
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
    onAnchored?.();
    router.refresh();
  }

  if (!authorWallet.trim()) return null;

  return (
    <>
      {hasGenesisAnchor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 rounded-full border-primary/35 hover:bg-primary/10 text-foreground shrink-0"
          aria-label={isRtl ? TACTICAL_BUTTON.he : TACTICAL_BUTTON.en}
        >
          {isRtl ? TACTICAL_BUTTON.he : TACTICAL_BUTTON.en}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (onLockedClick ? onLockedClick() : setSbtCodexOpen(true))}
          className="gap-1.5 rounded-full border-border/50 text-muted-foreground shrink-0 opacity-80"
          aria-label={isRtl ? `${TACTICAL_BUTTON.he} (נעול)` : `${TACTICAL_BUTTON.en} (locked)`}
        >
          <Lock className="size-3.5" aria-hidden />
          {isRtl ? TACTICAL_BUTTON.he : TACTICAL_BUTTON.en}
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
              <SheetTitle className="text-lg font-semibold text-foreground text-start">
                {isRtl ? TACTICAL_HEADING.he : TACTICAL_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground text-start leading-relaxed">
                {isRtl ? TACTICAL_SUBTITLE.he : TACTICAL_SUBTITLE.en}
              </p>
              <div
                className="mt-1 border-s-4 border-primary/40 bg-primary/5 p-3 rounded-e-md text-sm text-start space-y-1"
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
                arenaId={arenaId}
                targetNodeContext={targetAssertion}
                config={config}
                forgeDebateIntent="TACTICAL_STRIKE"
                tacticalSupportedTheoryHint={tacticalSupportedTheoryHint}
                cacheKeySuffix="tactical"
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
