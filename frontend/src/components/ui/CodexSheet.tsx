"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/context";
import type { CodexChapterId } from "@/lib/codex";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
  SheetClose,
  type SheetContentSide,
} from "@/components/ui/sheet";

import heCodex from "@/content/codex/he.json";
import enCodex from "@/content/codex/en.json";

const codexByLocale = {
  he: heCodex as Record<CodexChapterId, { title: string; body: string }>,
  en: enCodex as Record<CodexChapterId, { title: string; body: string }>,
};

export interface CodexSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: CodexChapterId;
  /** Optional i18n label for the close button (e.g. "Close" / "סגור") */
  closeLabel?: string;
}

/**
 * The Living Codex — sliding side panel that shows the philosophical/operational
 * chapter for the current step. Slides from the reading-direction edge (end in LTR, start in RTL).
 */
export function CodexSheet({
  open,
  onOpenChange,
  chapterId,
  closeLabel,
}: CodexSheetProps) {
  const { locale } = useLocale();
  const content = codexByLocale[locale]?.[chapterId];
  const side: SheetContentSide = locale === "he" ? "start" : "end";

  if (!content) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-primary">{content.title}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
            {content.body}
          </p>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <button
              type="button"
              className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={closeLabel}
            >
              {closeLabel ?? (locale === "he" ? "סגור" : "Close")}
            </button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
