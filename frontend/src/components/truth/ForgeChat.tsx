"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { anchorForgeDraft } from "@/app/actions/truthWeaver";
import { DraftNodeCard, type ForgeDraft } from "@/components/truth/DraftNodeCard";
import type { EdgeRelationship } from "@/types/truth";

const FORGE_PLACEHOLDER = {
  he: "נסח טענה או אתגר לוגי… המנסר ינחה אותך.",
  en: "State a thesis or logical challenge… The Forge will guide you.",
};

const FORGE_SEND = { he: "שלח", en: "Send" };

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

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/oracle/forge",
      body: {
        locale,
        targetNodeContext: targetNodeContext ?? undefined,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const latestDraft = useMemo((): ForgeDraft | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        const p = part as { type?: string; state?: string; output?: { draft?: ForgeDraft }; input?: ForgeDraft };
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

  async function handleAnchor() {
    if (!latestDraft) return;
    setAnchorError(null);
    setIsAnchoring(true);
    const result = await anchorForgeDraft(
      latestDraft,
      authorWallet,
      parentId,
      relationship ?? "supports"
    );
    setIsAnchoring(false);
    if (result.success) {
      onAnchored?.(result.nodeId);
      router.push(parentId ? `/truth/node/${parentId}` : "/truth");
    } else {
      setAnchorError(result.error);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const isRtl = locale === "he";

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft ${className}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Middle: only messages scroll */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 min-h-0">
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
                  ? "self-end bg-primary/10 text-primary-foreground border-primary/20 border rounded-2xl rounded-se-none px-4 py-3"
                  : "self-start bg-muted/60 text-foreground border border-border rounded-2xl rounded-ss-none px-4 py-3"
              }`}
            >
              <div className="space-y-2 text-sm text-start">
                {(message.parts ?? []).map((part, partIndex) => {
                  const p = part as { type?: string; text?: string; state?: string };
                  if (p.type === "text" && "text" in p) {
                    return (
                      <p key={partIndex} className="whitespace-pre-wrap break-words text-start">
                        {p.text}
                      </p>
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
                onAnchor={handleAnchor}
                isAnchoring={isAnchoring}
                authorWallet={authorWallet}
                parentId={parentId}
                relationship={relationship}
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
      <form onSubmit={handleSubmit} className="flex-none sticky bottom-0 border-t border-border bg-background/95 backdrop-blur py-4 px-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={locale === "he" ? FORGE_PLACEHOLDER.he : FORGE_PLACEHOLDER.en}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-start"
            aria-label="Forge input"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "…" : locale === "he" ? FORGE_SEND.he : FORGE_SEND.en}
          </Button>
        </div>
      </form>
    </div>
  );
}
