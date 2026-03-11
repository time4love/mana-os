"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
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
import { getProposalContextForCodex, type ProposalContextForCodex } from "@/app/actions/upgrades";

import heCodex from "@/content/codex/he.json";
import enCodex from "@/content/codex/en.json";

const codexByLocale = {
  he: heCodex as Record<CodexChapterId, { title: string; body: string }>,
  en: enCodex as Record<CodexChapterId, { title: string; body: string }>,
};

/** Prefix for the hidden user message that carries full proposal context to the Proposal Oracle. Never shown in UI. */
export const SYSTEM_INIT_PREFIX = "[SYSTEM_INIT]";

/** User message sent invisibly to trigger the Architect Oracle's proactive greeting (legacy / non-proposal mode). */
const INIT_GREETING_TRIGGER = {
  he: "פתחתי את ספר הידע כדי לצפות בהצעה הזו. קבל את פני וסכם איפה הקהילה עומדת, ואז שאל איך תוכל לעזור.",
  en: "I've just opened the Codex to view this proposal. Please greet me and summarize where the community stands, then ask how you can help.",
};

/** Serializable context from the current page (e.g. proposal, profile) for the Architect Oracle. */
export type CodexContextData = Record<string, unknown> | string | null | undefined;

export type CodexSheetMode = "architect" | "proposal";

export interface CodexSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When "proposal", chat uses the Proposal Oracle (Village Elder). When "architect", uses the Architect Oracle. Default: "architect". */
  mode?: CodexSheetMode;
  /** When provided, the static philosophical chapter is shown at the top. */
  chapterId?: CodexChapterId;
  /** When provided, injected into the Architect Oracle so it can answer in context (e.g. which proposal they are viewing). For proposal mode, used to derive proposalId to fetch full context. */
  contextData?: CodexContextData;
  /** Optional i18n label for the close button (e.g. "Close" / "סגור") */
  closeLabel?: string;
  /** Placeholder for the chat input (defaults from architect dict). */
  chatPlaceholder?: string;
  /** Label for the Oracle in messages (defaults from architect dict, or Village Elder in proposal mode). */
  oracleLabel?: string;
  /** Label for the user in messages (defaults from architect dict). */
  youLabel?: string;
  /** Label for the send button. */
  chatSendLabel?: string;
}

function getProposalIdFromContext(contextData: CodexContextData): string | null {
  if (!contextData || typeof contextData !== "object" || !("proposal" in contextData)) return null;
  const proposal = (contextData as { proposal?: { id?: string } }).proposal;
  return proposal && typeof proposal === "object" && typeof proposal.id === "string"
    ? proposal.id
    : null;
}

/**
 * The Living Codex — sliding side panel: static chapter (if chapterId) + context-aware Architect chat.
 * When opened with a proposal, fetches full context (upgrades + discourse) and triggers a proactive
 * AI greeting so the Oracle is "present" and already knows the proposal.
 */
export function CodexSheet({
  open,
  onOpenChange,
  mode = "architect",
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
  const [proposalContext, setProposalContext] = useState<ProposalContextForCodex | null>(null);
  const [proposalContextLoading, setProposalContextLoading] = useState(false);
  const initialGreetingSentRef = useRef(false);

  const content = chapterId ? codexByLocale[locale]?.[chapterId] : null;
  const side: SheetContentSide = locale === "he" ? "start" : "end";
  const proposalId = open && mode === "proposal" ? getProposalIdFromContext(contextData) : null;

  const chatBody = React.useMemo(() => {
    if (mode === "proposal") {
      return { locale };
    }
    return {
      locale,
      proposerWallet: address ?? undefined,
      contextData: contextData ?? undefined,
    };
  }, [mode, locale, address, contextData]);

  const bodyRef = useRef(chatBody);
  bodyRef.current = chatBody;

  const oracleApi = mode === "proposal" ? "/api/oracle/proposal" : "/api/oracle/architect";

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: oracleApi,
      get body() {
        return bodyRef.current;
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const hasProposalContext = mode === "proposal" && proposalId !== null;
  const waitingForGreeting =
    hasProposalContext &&
    (proposalContext !== null || proposalContextLoading) &&
    messages.length === 0;
  const waitingForFirstReply =
    hasProposalContext && isLoading && messages.filter((m) => m.role === "assistant").length === 0;
  const showContemplating = waitingForGreeting || waitingForFirstReply;

  useEffect(() => {
    if (!open) {
      setProposalContext(null);
      setProposalContextLoading(false);
      return;
    }
    if (mode !== "proposal" || !proposalId) {
      setProposalContext(null);
      return;
    }
    let cancelled = false;
    setProposalContextLoading(true);
    getProposalContextForCodex(proposalId).then((result) => {
      if (cancelled) return;
      setProposalContextLoading(false);
      if (result.success) setProposalContext(result.context);
      else setProposalContext(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, proposalId]);

  useEffect(() => {
    if (!open) {
      initialGreetingSentRef.current = false;
      return;
    }
    if (mode !== "proposal") return;
    if (
      proposalContext &&
      messages.length === 0 &&
      !initialGreetingSentRef.current &&
      !proposalContextLoading
    ) {
      initialGreetingSentRef.current = true;
      const hiddenMessage = `${SYSTEM_INIT_PREFIX} The user has opened the Codex for the following proposal. DO NOT summarize the data—the user can already see it. Instead, deeply analyze the community upgrades and the micro-discourse. Provide ONE profound ecological, physical, or community-building insight about their specific debate or resources (e.g., if there is a conflict about plants, suggest permaculture synergies). Greet them warmly as the Village Elder and offer to weave this insight into the proposal. \n\nCONTEXT JSON: ${JSON.stringify(proposalContext)}`;
      sendMessage({ text: hiddenMessage });
    }
  }, [open, mode, proposalContext, proposalContextLoading, messages.length, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const isHiddenUserMessage = (message: { role: string; parts?: Array<{ type: string; text?: string }> }) => {
    if (message.role !== "user") return false;
    const text = message.parts?.find((p) => p.type === "text")?.text ?? "";
    const trimmed = text.trim();
    if (trimmed.startsWith(SYSTEM_INIT_PREFIX)) return true;
    const triggerHe = INIT_GREETING_TRIGGER.he.trim();
    const triggerEn = INIT_GREETING_TRIGGER.en.trim();
    return trimmed === triggerHe || trimmed === triggerEn;
  };

  const closeBtnLabel = closeLabel ?? (locale === "he" ? "סגור" : "Close");
  const placeholder = chatPlaceholder ?? tArchitect("chatPlaceholder");
  const oracle =
    oracleLabel ??
    (mode === "proposal" ? tArchitect("proposalOracleLabel") : tArchitect("oracleLabel"));
  const you = youLabel ?? tArchitect("youLabel");
  const sendLabel = chatSendLabel ?? tArchitect("chatSend");
  const contemplatingLabel = tArchitect("oracleContemplating");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="flex flex-col max-h-[100dvh]">
        <SheetHeader>
          <SheetTitle className="text-primary">
            {content ? content.title : (locale === "he" ? "ספר הידע" : "The Codex")}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col min-h-0 gap-4 overflow-hidden">
          {content && (
            <div className="shrink-0">
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground text-sm">
                {content.body}
              </p>
            </div>
          )}
          <div className="flex flex-col flex-1 min-h-0 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 shrink-0">
              {locale === "he" ? "שוחח עם האורקל" : "Consult the Oracle"}
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {showContemplating && (
                <p className="text-muted-foreground text-sm italic animate-pulse" role="status">
                  {contemplatingLabel}
                </p>
              )}
              {!showContemplating && messages.length === 0 && !hasProposalContext && (
                <p className="text-muted-foreground text-sm italic">
                  {locale === "he"
                    ? "שאל על הפילוסופיה או על מה שאתה צופה בו."
                    : "Ask about the philosophy or what you're viewing."}
                </p>
              )}
              {messages.map((message) => {
                if (isHiddenUserMessage(message)) return null;
                return (
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
                );
              })}
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
