"use client";

import { useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useLocale } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { ManaResourcePlanCard } from "@/components/proposals/ManaResourcePlanCard";
import type { ProposalResourcePlan } from "@/lib/oracle/schema";

export default function NewProposalPage() {
  const { locale, tProposals } = useLocale();
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/oracle",
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

  return (
    <main
      className="min-h-screen p-8 flex flex-col"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="text-emerald-400 underline underline-offset-2"
            >
              {tProposals("navHome")}
            </Link>
            <span className="text-neutral-500">|</span>
            <Link
              href="/profile"
              className="text-emerald-400 underline underline-offset-2"
            >
              {tProposals("navProfile")}
            </Link>
          </div>
          <LanguageSwitcher />
        </nav>

        <h1 className="text-2xl font-bold text-neutral-100 text-start mb-6">
          {tProposals("title")}
        </h1>

        <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-neutral-700 bg-neutral-900/60 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-neutral-500 text-sm text-center py-8">
                {tProposals("placeholder")}
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-emerald-900/40 border border-emerald-800/50 text-neutral-100"
                      : "bg-neutral-800/80 border border-neutral-700 text-neutral-200"
                  }`}
                >
                  <p className="text-xs font-medium text-neutral-400 mb-1.5">
                    {message.role === "user"
                      ? tProposals("youLabel")
                      : tProposals("oracleLabel")}
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
                        part.type === "tool-finalize_resource_plan" &&
                        (part.state === "input-available" ||
                          part.state === "output-available")
                      ) {
                        const plan =
                          part.input &&
                          "naturalResources" in part.input &&
                          "humanCapital" in part.input
                            ? (part.input as ProposalResourcePlan)
                            : (part as { output?: { plan?: ProposalResourcePlan } })
                                .output?.plan;
                        if (plan) {
                          return (
                            <ManaResourcePlanCard
                              key={partIndex}
                              plan={plan}
                              resultTitle={tProposals("resultTitle")}
                              naturalResourcesLabel={tProposals(
                                "naturalResources"
                              )}
                              humanCapitalLabel={tProposals("humanCapital")}
                            />
                          );
                        }
                      }
                      if (
                        part.type === "tool-finalize_resource_plan" &&
                        part.state === "input-streaming"
                      ) {
                        return (
                          <p
                            key={partIndex}
                            className="text-neutral-500 italic"
                          >
                            {tProposals("loading")}
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
            className="p-4 border-t border-neutral-700 bg-neutral-950/50"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tProposals("chatPlaceholder")}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-neutral-600 bg-neutral-800/80 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label={tProposals("chatPlaceholder")}
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
