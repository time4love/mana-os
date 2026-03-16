"use client";

import { useLocale } from "@/lib/i18n/context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetClose,
} from "@/components/ui/sheet";
import { ForgeChat } from "@/components/truth/ForgeChat";
import type { EdgeRelationship } from "@/types/truth";
import { X } from "lucide-react";

const ROOT_HEADING = {
  he: "יציקת יסודות למארג",
  en: "Forging a New Root Proposition",
};

const ROOT_SUBTITLE = {
  he: "הנחת יסוד חדשה במרחב האמת",
  en: "A new foundational premise in the truth space",
};

const CHALLENGE_CONTEXT_LABEL = {
  he: "מאתגרים את ההנחה",
  en: "Challenging premise",
};

const SUPPORT_CONTEXT_LABEL = {
  he: "מחזקים את ההנחה",
  en: "Supporting premise",
};

const BRANCH_HEADING = {
  he: "לטש תובנה במארג",
  en: "Refine an insight in the Weave",
};

const BRANCH_SUBTITLE = {
  he: "האורקל יסווג את היחס לוגית — תמיכה או אתגר",
  en: "The Logician will classify the relationship — support or challenge",
};

const TRUNCATE_LEN = 120;

export type ForgeSheetMode = "root" | "challenge" | "support" | "branch";

interface ForgeSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetNodeContext: string | null;
  mode: ForgeSheetMode;
  authorWallet: string;
  /** When true, Forge runs in Macro-Arena initiation mode (root topic; tag 'macro-arena'). */
  isArenaMode?: boolean;
  parentId?: string;
  relationship?: EdgeRelationship;
  onAnchored?: (nodeId: string) => void;
  onEdgeAttached?: (edgeId: string) => void;
}

function truncateContext(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd() + "…";
}

export function ForgeSheet({
  isOpen,
  onOpenChange,
  targetNodeContext,
  mode,
  authorWallet,
  isArenaMode = false,
  parentId,
  relationship,
  onAnchored,
  onEdgeAttached,
}: ForgeSheetProps) {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const sheetSide = isRtl ? "start" : "end";

  const handleAnchored = (nodeId: string) => {
    onAnchored?.(nodeId);
    onOpenChange(false);
  };

  const isRoot = mode === "root";
  const isBranch = mode === "branch";
  const contextLabel =
    mode === "challenge"
      ? (locale === "he" ? CHALLENGE_CONTEXT_LABEL.he : CHALLENGE_CONTEXT_LABEL.en)
      : mode === "support"
        ? (locale === "he" ? SUPPORT_CONTEXT_LABEL.he : SUPPORT_CONTEXT_LABEL.en)
        : null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetSide}
        className="flex h-full max-h-full flex-col max-w-md w-full p-0 gap-0"
        preventBackdropClose
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Fixed top: context anchor (flex-none) + explicit close */}
        <SheetHeader className="flex-none border-b border-border bg-muted/30 px-6 py-4 text-start flex flex-row items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
          {isRoot ? (
            <>
              <SheetTitle className="text-lg font-semibold text-foreground">
                {locale === "he" ? ROOT_HEADING.he : ROOT_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1 text-start">
                {locale === "he" ? ROOT_SUBTITLE.he : ROOT_SUBTITLE.en}
              </p>
            </>
          ) : isBranch ? (
            <>
              <SheetTitle className="text-lg font-semibold text-foreground">
                {locale === "he" ? BRANCH_HEADING.he : BRANCH_HEADING.en}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1 text-start">
                {locale === "he" ? BRANCH_SUBTITLE.he : BRANCH_SUBTITLE.en}
              </p>
              <div
                className="mt-3 border-s-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/20 dark:border-amber-600/40 p-3 rounded-e-md italic text-muted-foreground text-sm text-start mb-4"
                role="region"
                aria-label={locale === "he" ? BRANCH_HEADING.he : BRANCH_HEADING.en}
              >
                <p className="leading-relaxed line-clamp-4 text-start">
                  {targetNodeContext
                    ? truncateContext(targetNodeContext, TRUNCATE_LEN)
                    : locale === "he"
                      ? "אין הקשר צומת."
                      : "No node context."}
                </p>
              </div>
            </>
          ) : (
            <>
              <SheetTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-start">
                {contextLabel}
              </SheetTitle>
              <div
                className="mt-3 border-s-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/20 dark:border-amber-600/40 p-3 rounded-e-md italic text-muted-foreground text-sm text-start mb-4"
                role="region"
                aria-label={contextLabel ?? undefined}
              >
                <p className="leading-relaxed line-clamp-4 text-start">
                  {targetNodeContext
                    ? truncateContext(targetNodeContext, TRUNCATE_LEN)
                    : locale === "he"
                      ? "אין הקשר צומת."
                      : "No node context."}
                </p>
              </div>
            </>
          )}
          </div>
          <SheetClose
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={locale === "he" ? "סגור" : "Close"}
          >
            <X className="size-5" aria-hidden />
          </SheetClose>
        </SheetHeader>
        {/* Scrollable middle + fixed bottom live inside ForgeChat */}
        <SheetBody className="flex flex-1 flex-col min-h-0 px-0 overflow-hidden">
          <div className="flex h-full flex-col min-h-0">
            <ForgeChat
              authorWallet={authorWallet}
              parentId={parentId}
              relationship={relationship}
              targetNodeContext={targetNodeContext ?? undefined}
              isArenaMode={isArenaMode}
              onAnchored={handleAnchored}
              onEdgeAttached={onEdgeAttached}
              className="flex-1 min-h-0 border-0 shadow-none rounded-none"
            />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
