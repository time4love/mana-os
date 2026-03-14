"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { anchorForgeDraft } from "@/app/actions/truthWeaver";
import { DraftNodeCard, type ForgeDraft } from "@/components/truth/DraftNodeCard";
import type { EdgeRelationship, MatchTruthNodeResult } from "@/types/truth";

const SHOW_MORE = { he: "קרא עוד", en: "Show More" };
const SHOW_LESS = { he: "צמצם", en: "Show Less" };

/** Renders inline markdown: **bold**, *italic*, and line breaks. No external deps. */
function SimpleMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n/);
  return (
    <div className={`space-y-2 whitespace-pre-wrap text-start leading-relaxed break-words ${className}`}>
      {parts.map((line, i) => {
        const tokens: React.ReactNode[] = [];
        let rest = line;
        let key = 0;
        while (rest.length > 0) {
          const bold = rest.match(/^\*\*(.+?)\*\*/);
          const italic = rest.match(/^\*([^*]+?)\*/);
          if (bold) {
            tokens.push(
              <strong key={key++} className="font-semibold text-primary">
                {bold[1]}
              </strong>
            );
            rest = rest.slice(bold[0].length);
          } else if (italic) {
            tokens.push(
              <em key={key++} className="italic">
                {italic[1]}
              </em>
            );
            rest = rest.slice(italic[0].length);
          } else {
            const nextBold = rest.indexOf("**");
            const nextItalic = rest.indexOf("*");
            const next =
              nextBold === -1 && nextItalic === -1
                ? rest.length
                : nextBold === -1
                  ? nextItalic
                  : nextItalic === -1
                    ? nextBold
                    : Math.min(nextBold, nextItalic);
            const skip = next <= 0 ? 1 : next;
            tokens.push(rest.slice(0, skip));
            rest = rest.slice(skip);
          }
        }
        return (
          <p key={i} className="leading-relaxed [&:empty]:h-2">
            {tokens}
          </p>
        );
      })}
    </div>
  );
}

interface ExpandableBubbleTextProps {
  text: string;
  maxLength?: number;
  className?: string;
}

function ExpandableBubbleText({
  text,
  maxLength = 250,
  className = "",
}: ExpandableBubbleTextProps) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > maxLength;
  const displayText = !isLong
    ? text
    : expanded
      ? text
      : `${text.slice(0, maxLength)}...`;

  const showMoreLabel = locale === "he" ? SHOW_MORE.he : SHOW_MORE.en;
  const showLessLabel = locale === "he" ? SHOW_LESS.he : SHOW_LESS.en;

  return (
    <motion.div layout className={`space-y-1.5 ${className}`}>
      <motion.div layout initial={false}>
        <SimpleMarkdown text={displayText} />
      </motion.div>
      {isLong && (
        <motion.button
          type="button"
          layout
          onClick={() => setExpanded(!expanded)}
          className="text-primary hover:text-primary/80 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-1.5 py-0.5 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? showLessLabel : showMoreLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

const MIN_TEXTAREA_PX = 44;
const MAX_TEXTAREA_PX = 240;

interface FluidForgeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  isSubmitting: boolean;
}

function FluidForgeInput({
  value,
  onChange,
  placeholder,
  disabled,
  onSubmit,
  submitLabel,
  isSubmitting,
}: FluidForgeInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, MIN_TEXTAREA_PX), MAX_TEXTAREA_PX);
    el.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <form onSubmit={onSubmit} className="flex-none sticky bottom-0 border-t border-border bg-background/95 backdrop-blur py-4 px-4">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={adjustHeight}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full min-h-[44px] max-h-[240px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-start leading-relaxed overflow-y-auto"
          aria-label="Forge input"
        />
        <Button type="submit" disabled={disabled || !value.trim()} className="shrink-0 self-end">
          {isSubmitting ? "…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const FORGE_CACHE_KEY_ROOT = "forge_draft_root_node";
function getForgeCacheKey(parentId: string | undefined): string {
  return parentId ? `forge_draft_parent_${parentId}` : FORGE_CACHE_KEY_ROOT;
}

const FORGE_PLACEHOLDER = {
  he: "נסח טענה או אתגר לוגי… המנסר ינחה אותך.",
  en: "State a thesis or logical challenge… The Forge will guide you.",
};

const FORGE_SEND = { he: "שלח", en: "Send" };

const RELEASE_THOUGHT_LABEL = {
  he: "שחרר קו מחשבה",
  en: "Release thought trace",
};
const RELEASE_THOUGHT_TOOLTIP = {
  he: "טהר כבשן",
  en: "Purify the forge",
};
const CONFIRM_RELEASE = {
  he: "להתחיל דף נקי?",
  en: "Start with a blank slate?",
};
const RELEASE_CONFIRM_THRESHOLD = 4;

interface ForgeChatProps {
  authorWallet: string;
  parentId?: string;
  relationship?: EdgeRelationship;
  targetNodeContext?: string | null;
  onAnchored?: (nodeId: string) => void;
  onEdgeAttached?: (edgeId: string) => void;
  className?: string;
}

export function ForgeChat({
  authorWallet,
  parentId,
  relationship,
  targetNodeContext,
  onAnchored,
  className = "",
}: ForgeChatProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const cacheKey = getForgeCacheKey(parentId);

  const initialMessages = useMemo((): UIMessage[] => {
    if (typeof sessionStorage === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { messages?: unknown[] };
      if (!Array.isArray(parsed?.messages)) return [];
      return parsed.messages as UIMessage[];
    } catch {
      return [];
    }
  }, [cacheKey]);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: cacheKey,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/oracle/forge",
      body: {
        locale,
        targetNodeContext: targetNodeContext ?? undefined,
      },
    }),
  });

  function handleReleaseThought() {
    if (messages.length >= RELEASE_CONFIRM_THRESHOLD) {
      const confirmMsg = locale === "he" ? CONFIRM_RELEASE.he : CONFIRM_RELEASE.en;
      if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;
    }
    setMessages([]);
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(cacheKey);
    } catch {
      // ignore
    }
    setAnchorError(null);
    setSemanticDuplicates(null);
  }

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ messages }));
    } catch {
      // ignore quota or parse errors
    }
  }, [cacheKey, messages]);

  const isLoading = status === "submitted" || status === "streaming";

  const latestDraft = useMemo((): ForgeDraft | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        const p = part as {
          type?: string;
          state?: string;
          output?: { draft?: ForgeDraft };
          input?: ForgeDraft & { relationshipToContext?: "supports" | "challenges" };
        };
        if (
          p.type === "tool-draft_epistemic_node" &&
          (p.state === "output-available" || p.state === "input-available")
        ) {
          const draft = p.output?.draft ?? p.input;
          if (draft?.assertion) return draft as ForgeDraft;
        }
      }
    }
    return null;
  }, [messages]);

  const [semanticDuplicates, setSemanticDuplicates] = useState<MatchTruthNodeResult[] | null>(null);

  async function handleAnchor(forceBypass?: boolean) {
    if (!latestDraft) return;
    setAnchorError(null);
    setSemanticDuplicates(null);
    setIsAnchoring(true);
    const dynamicRelationship = latestDraft.relationshipToContext ?? relationship ?? "supports";
    const result = await anchorForgeDraft(
      latestDraft,
      authorWallet,
      parentId,
      dynamicRelationship,
      forceBypass ?? false
    );
    setIsAnchoring(false);
    if (result.success) {
      setSemanticDuplicates(null);
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {
        // ignore
      }
      onAnchored?.(result.nodeId);
      router.push(parentId ? `/truth/node/${parentId}` : "/truth");
    } else if ("code" in result && result.code === "semantic_resonance") {
      setSemanticDuplicates(result.duplicates);
    } else {
      setAnchorError("error" in result ? result.error : "An error occurred");
    }
  }

  async function handleForcePlant() {
    if (!latestDraft) return;
    await handleAnchor(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const isRtl = locale === "he";

  const releaseLabel = locale === "he" ? RELEASE_THOUGHT_LABEL.he : RELEASE_THOUGHT_LABEL.en;
  const releaseTooltip = locale === "he" ? RELEASE_THOUGHT_TOOLTIP.he : RELEASE_THOUGHT_TOOLTIP.en;

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft ${className}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Middle: only messages scroll */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-0 relative">
        {messages.length > 0 && (
          <div className="flex justify-end mb-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReleaseThought}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full"
              title={releaseTooltip}
              aria-label={releaseLabel}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-start py-8">
            {locale === "he" ? FORGE_PLACEHOLDER.he : FORGE_PLACEHOLDER.en}
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] text-start ${
                message.role === "user"
                  ? "self-end bg-primary/15 text-foreground border border-primary/20 rounded-2xl rounded-se-none px-4 py-3"
                  : "self-start bg-muted/60 text-foreground border border-border rounded-2xl rounded-ss-none px-4 py-3"
              }`}
            >
              <div className="space-y-2 text-sm text-start">
                {(message.parts ?? []).map((part, partIndex) => {
                  const p = part as { type?: string; text?: string; state?: string };
                  if (p.type === "text" && "text" in p && p.text) {
                    return (
                      <ExpandableBubbleText
                        key={partIndex}
                        text={p.text}
                        maxLength={250}
                      />
                    );
                  }
                  if (
                    p.type === "tool-draft_epistemic_node" &&
                    (p.state === "input-streaming" || p.state === "partial-call")
                  ) {
                    return (
                      <p key={partIndex} className="text-muted-foreground italic text-start">
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
        <AnimatePresence>
          {latestDraft && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-2"
            >
              <DraftNodeCard
                draft={latestDraft}
                onAnchor={() => handleAnchor(false)}
                isAnchoring={isAnchoring}
                authorWallet={authorWallet}
                parentId={parentId}
                relationship={relationship}
                semanticDuplicates={semanticDuplicates}
                onForcePlant={handleForcePlant}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {anchorError && (
          <p className="text-sm text-destructive text-start" role="alert">
            {anchorError}
          </p>
        )}
      </div>
      {/* Fixed bottom: input area */}
      <FluidForgeInput
        value={input}
        onChange={setInput}
        placeholder={locale === "he" ? FORGE_PLACEHOLDER.he : FORGE_PLACEHOLDER.en}
        disabled={isLoading}
        onSubmit={handleSubmit}
        submitLabel={locale === "he" ? FORGE_SEND.he : FORGE_SEND.en}
        isSubmitting={isLoading}
      />
    </div>
  );
}
