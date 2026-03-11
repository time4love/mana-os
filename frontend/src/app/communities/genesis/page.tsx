"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { manifestCommunitySeed } from "@/app/actions/communities";
import type { CommunitySeed } from "@/lib/oracle/schema";

const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

export default function GenesisPage() {
  const router = useRouter();
  const { locale, tCommunities, tProposals } = useLocale();
  const { address } = useAccount();
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/oracle/genesis",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const handleManifest = useCallback(
    async (seed: CommunitySeed) => {
      if (!address)
        return { success: false as const, error: "Wallet not connected" };
      const result = await manifestCommunitySeed(address, seed);
      if (result.success) router.push("/communities/seeds");
      return result;
    },
    [address, router]
  );

  const lastToolSeed = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const parts = messages[i].parts ?? [];
      for (const part of parts) {
        if (
          part.type === "tool-manifest_community_seed" &&
          (part.state === "input-available" || part.state === "output-available") &&
          part.input &&
          "name" in part.input &&
          "vision" in part.input &&
          "requiredCriticalMass" in part.input
        ) {
          return part.input as CommunitySeed;
        }
      }
    }
    return null;
  })();

  return (
    <main
      className="min-h-screen flex flex-col p-6 sm:p-8"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1">
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
              href="/communities/seeds"
              className="text-primary underline underline-offset-2"
            >
              {tCommunities("navSeeds")}
            </Link>
          </div>
        </nav>

        <motion.h1
          className="text-2xl font-semibold tracking-tight text-foreground mb-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
        >
          {tCommunities("genesisTitle")}
        </motion.h1>
        <p className="text-muted-foreground text-sm mb-6">
          {locale === "he"
            ? "אורקל הגנסיס יסייע לך לחשב את המסה הקריטית ולשתול זרע קהילה."
            : "The Genesis Oracle will help you calculate critical mass and plant a community seed."}
        </p>

        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-muted-foreground text-sm text-center py-8"
              >
                {tCommunities("genesisPlaceholder")}
              </motion.p>
            )}
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, ...transition }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary/15 border border-primary/40 text-foreground"
                      : "bg-muted/50 border border-border text-foreground"
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {message.role === "user"
                      ? tProposals("youLabel")
                      : locale === "he"
                        ? "אורקל הגנסיס"
                        : "Genesis Oracle"}
                  </p>
                  <div className="space-y-3 text-sm">
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
                        part.type === "tool-manifest_community_seed" &&
                        part.state === "input-streaming"
                      ) {
                        return (
                          <p
                            key={partIndex}
                            className="text-muted-foreground italic"
                          >
                            {tProposals("loading")}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {lastToolSeed && (
            <CommunitySeedCard
              seed={lastToolSeed}
              onManifest={handleManifest}
              address={address}
              locale={locale}
              tCommunities={tCommunities}
            />
          )}

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-border bg-muted/30"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tCommunities("genesisPlaceholder")}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={tCommunities("genesisPlaceholder")}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? "…" : tProposals("chatSend")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function CommunitySeedCard({
  seed,
  onManifest,
  address,
  locale,
  tCommunities,
}: {
  seed: CommunitySeed;
  onManifest: (s: CommunitySeed) => Promise<{ success: boolean; error?: string }>;
  address: string | undefined;
  locale: string;
  tCommunities: (key: string) => string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!address || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onManifest(seed);
      if (!result.success) setError(result.error ?? null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="mx-4 mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-soft"
    >
      <h3 className="text-sm font-medium text-foreground mb-2">
        {seed.name}
      </h3>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
        {seed.vision}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {tCommunities("criticalMass")}: {seed.requiredCriticalMass}
      </p>
      {address ? (
        <>
          <Button
            onClick={handleClick}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary text-primary-foreground shadow-soft hover:opacity-90"
          >
            {isSubmitting
              ? (locale === "he" ? "יוצר זרע…" : "Creating seed…")
              : (locale === "he" ? "הגשם זרע (ממתין להגשמה)" : "Manifest seed (pending manifestation)")}
          </Button>
          {error && (
            <p className="mt-2 text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {locale === "he" ? "חבר ארנק כדי להגשים את הזרע." : "Connect wallet to manifest the seed."}
        </p>
      )}
    </motion.div>
  );
}
