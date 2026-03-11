"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export default function ArchitectPage() {
  const { locale, tArchitect, tProposals } = useLocale();
  const { address } = useAccount();
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/oracle/architect",
      body: {
        locale,
        proposerWallet: address ?? undefined,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const showSuccessCard = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        if (
          part.type === "tool-submit_feature_proposal" &&
          (part.state === "output-available" || part.state === "input-available")
        ) {
          const out = (part as { output?: { ok?: boolean } }).output;
          if (out?.ok) return true;
        }
      }
    }
    return false;
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <main
      className="min-h-screen flex flex-col bg-background"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1 p-6">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="text-primary underline underline-offset-2"
            >
              {tProposals("navHome")}
            </Link>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/profile"
              className="text-primary underline underline-offset-2"
            >
              {tProposals("navProfile")}
            </Link>
          </div>
        </nav>

        <motion.header
          className="mb-8 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
            <BookOpen className="size-4" aria-hidden />
            <span>{tArchitect("title")}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl leading-tight max-w-xl mx-auto">
            {tArchitect("header")}
          </h1>
        </motion.header>

        <AnimatePresence mode="wait">
          {showSuccessCard && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-soft-md"
            >
              <p className="text-lg font-semibold text-primary mb-1">
                {tArchitect("successTitle")}
              </p>
              <p className="text-muted-foreground text-sm">
                {tArchitect("successMessage")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-12">
                {tArchitect("placeholder")}
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary/15 border border-primary/40 text-foreground"
                      : "bg-muted/50 border border-border text-foreground"
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {message.role === "user"
                      ? tArchitect("youLabel")
                      : tArchitect("oracleLabel")}
                  </p>
                  <div className="space-y-2 text-sm">
                    {message.parts?.map((part, partIndex) => {
                      if (part.type === "text") {
                        return (
                          <p
                            key={partIndex}
                            className="whitespace-pre-wrap break-words"
                          >
                            {part.text}
                          </p>
                        );
                      }
                      if (
                        part.type === "tool-submit_feature_proposal" &&
                        part.state === "input-streaming"
                      ) {
                        return (
                          <p
                            key={partIndex}
                            className="text-muted-foreground italic"
                          >
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

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-border bg-muted/20"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tArchitect("chatPlaceholder")}
                disabled={isLoading}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={tArchitect("chatPlaceholder")}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? "…" : tArchitect("chatSend")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
