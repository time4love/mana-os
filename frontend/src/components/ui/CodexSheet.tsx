"use client";

import * as React from "react";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { useAccount } from "wagmi";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
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
import { Button } from "@/components/ui/button";

import heCodex from "@/content/codex/he.json";
import enCodex from "@/content/codex/en.json";

const codexByLocale = {
  he: heCodex as Record<CodexChapterId, { title: string; body: string }>,
  en: enCodex as Record<CodexChapterId, { title: string; body: string }>,
};

/** Serializable context from the current page (e.g. proposal, profile) for the Architect Oracle. */
export type CodexContextData = Record<string, unknown> | string | null | undefined;

export interface CodexSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the static philosophical chapter is shown at the top. */
  chapterId?: CodexChapterId;
  /** When provided, injected into the Architect Oracle so it can answer in context (e.g. which proposal the user is viewing). */
  contextData?: CodexContextData;
  /** Optional i18n label for the close button (e.g. "Close" / "סגור") */
  closeLabel?: string;
  /** Placeholder for the chat input (defaults from architect dict). */
  chatPlaceholder?: string;
  /** Label for the Oracle in messages (defaults from architect dict). */
  oracleLabel?: string;
  /** Label for the user in messages (defaults from architect dict). */
  youLabel?: string;
  /** Label for the send button. */
  chatSendLabel?: string;
}

/**
 * The Living Codex — sliding side panel: static chapter (if chapterId) + context-aware Architect chat.
 * AI omnipresence is PULL-based: the user opens the Codex to consult the Oracle; contextData is injected
 * so the Oracle knows what they are looking at (e.g. proposal, profile). No PUSH chat bubbles.
 */
export function CodexSheet({
  open,
  onOpenChange,
  chapterId,
  contextData,
  closeLabel,
  chatPlaceholder,
  oracleLabel,
  youLabel,
  chatSendLabel,
}: CodexSheetProps) {
  const { locale, tArchitect } = useLocale();
  const { address } = useAccount();
  const [input, setInput] = useState("");

  const content = chapterId ? codexByLocale[locale]?.[chapterId] : null;
  const side: SheetContentSide = locale === "he" ? "start" : "end";

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/oracle/architect",
      body: {
        locale,
        proposerWallet: address ?? undefined,
        contextData: contextData ?? undefined,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const closeBtnLabel = closeLabel ?? (locale === "he" ? "סגור" : "Close");
  const placeholder = chatPlaceholder ?? tArchitect("chatPlaceholder");
  const oracle = oracleLabel ?? tArchitect("oracleLabel");
  const you = youLabel ?? tArchitect("youLabel");
  const sendLabel = chatSendLabel ?? tArchitect("chatSend");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="flex flex-col max-h-[100dvh]">
        <SheetHeader>
          <SheetTitle className="text-primary">
            {content ? content.title : (locale === "he" ? "ספר הידע" : "The Codex")}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col min-h-0 gap-4">
          {content && (
            <div className="shrink-0">
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground text-sm">
                {content.body}
              </p>
            </div>
          )}
          {/* Context-aware Architect chat: Oracle knows contextData (e.g. current proposal). */}
          <div className="flex flex-col flex-1 min-h-0 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {locale === "he" ? "שוחח עם האורקל" : "Consult the Oracle"}
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px] max-h-[240px]">
              {messages.length === 0 && (
                <p className="text-muted-foreground text-sm italic">
                  {locale === "he"
                    ? "שאל על הפילוסופיה או על מה שאתה צופה בו."
                    : "Ask about the philosophy or what you're viewing."}
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-primary/15 border border-primary/40 text-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {message.role === "user" ? you : oracle}
                    </p>
                    <div className="space-y-1">
                      {message.parts?.map((part, partIndex) => {
                        if (part.type === "text") {
                          return (
                            <p key={partIndex} className="whitespace-pre-wrap break-words">
                              {part.text}
                            </p>
                          );
                        }
                        if (
                          part.type === "tool-submit_feature_proposal" &&
                          part.state === "input-streaming"
                        ) {
                          return (
                            <p key={partIndex} className="text-muted-foreground italic">
                              …
                            </p>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="mt-3 flex gap-2 shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={placeholder}
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="sm">
                {isLoading ? "…" : sendLabel}
              </Button>
            </form>
          </div>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <button
              type="button"
              className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={closeBtnLabel}
            >
              {closeBtnLabel}
            </button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
