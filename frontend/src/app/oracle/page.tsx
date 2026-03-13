"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { ManaResourcePlanCard } from "@/components/proposals/ManaResourcePlanCard";
import type { ProposalResourcePlan, CommunitySeed } from "@/lib/oracle/schema";
import { resonateProposal, type ResonateProposalResult } from "@/app/actions/proposals";
import { manifestCommunitySeed } from "@/app/actions/communities";

type OracleType = "gatekeeper" | "genesis" | "planner" | "architect";

const ROUTE_TOOL_PREFIX = "tool-route_to_";

function getOracleApi(active: OracleType): string {
  if (active === "genesis") return "/api/oracle/genesis";
  if (active === "planner") return "/api/oracle";
  if (active === "architect") return "/api/oracle/architect";
  return "/api/oracle";
}

function extractRouteFromMessage(parts: Array<{ type: string }> | undefined): OracleType | null {
  if (!parts?.length) return null;
  for (const part of parts) {
    if (part.type.startsWith(ROUTE_TOOL_PREFIX)) {
      const name = part.type.slice(ROUTE_TOOL_PREFIX.length);
      if (name === "genesis" || name === "planner" || name === "architect") return name;
    }
  }
  return null;
}

function getFirstUserMessageText(messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>): string {
  for (const m of messages) {
    if (m.role !== "user" || !m.parts) continue;
    const textPart = m.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) return (textPart as { text: string }).text ?? "";
  }
  return "";
}

const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };

export default function OracleTentPage() {
  const router = useRouter();
  const { locale, tProposals, tCommunities, tArchitect, tOracle: tOracleDict } = useLocale();
  const { address } = useAccount();
  const [input, setInput] = useState("");
  const [activeOracle, setActiveOracle] = useState<OracleType>("gatekeeper");
  const [initialUserMessage, setInitialUserMessage] = useState<string | null>(null);
  const hasTriggeredOracleSend = useRef(false);

  const gatekeeperTransport = new DefaultChatTransport({
    api: "/api/oracle/gatekeeper",
    body: { locale },
  });

  const oracleApi = getOracleApi(activeOracle);
  const oracleTransport = new DefaultChatTransport({
    api: oracleApi,
    get body() {
      return {
        locale,
        ...(activeOracle === "architect" && { proposerWallet: address ?? undefined }),
      };
    },
  });

  const gatekeeperChat = useChat({
    transport: gatekeeperTransport,
  });

  const oracleChat = useChat({
    transport: oracleTransport,
  });

  const isGatekeeper = activeOracle === "gatekeeper";
  const gatekeeperMessages = gatekeeperChat.messages;
  const gatekeeperStatus = gatekeeperChat.status;
  const oracleMessages = oracleChat.messages;
  const oracleStatus = oracleChat.status;

  const isLoading =
    (isGatekeeper && (gatekeeperStatus === "submitted" || gatekeeperStatus === "streaming")) ||
    (!isGatekeeper && (oracleStatus === "submitted" || oracleStatus === "streaming"));

  // When gatekeeper finishes, detect route and switch oracle
  useEffect(() => {
    if (activeOracle !== "gatekeeper") return;
    if (gatekeeperStatus === "submitted" || gatekeeperStatus === "streaming") return;
    const last = gatekeeperMessages[gatekeeperMessages.length - 1];
    if (!last || last.role !== "assistant" || !last.parts?.length) return;

    const route = extractRouteFromMessage(last.parts as Array<{ type: string }>);
    if (!route) return;

    const firstText = getFirstUserMessageText(gatekeeperMessages);
    setActiveOracle(route);
    setInitialUserMessage(firstText || "");
    hasTriggeredOracleSend.current = false;
  }, [activeOracle, gatekeeperStatus, gatekeeperMessages]);

  // After switching, send the initial message to the specialized oracle once
  useEffect(() => {
    if (activeOracle === "gatekeeper") return;
    if (!initialUserMessage || hasTriggeredOracleSend.current) return;

    hasTriggeredOracleSend.current = true;
    oracleChat.sendMessage({ text: initialUserMessage });
  }, [activeOracle, initialUserMessage]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput("");

      if (isGatekeeper) {
        gatekeeperChat.sendMessage({ text: trimmed });
      } else {
        oracleChat.sendMessage({ text: trimmed });
      }
    },
    [input, isLoading, isGatekeeper, gatekeeperChat, oracleChat]
  );

  const handleResonate = useCallback(
    async (plan: ProposalResourcePlan, title: string, description: string): Promise<ResonateProposalResult> => {
      if (!address) return { success: false, error: "Wallet not connected" };
      const result = await resonateProposal(address, title, description, plan);
      if (result.success) router.push("/feed");
      return result;
    },
    [address, router]
  );

  const handleManifest = useCallback(
    async (seed: CommunitySeed) => {
      if (!address) return { success: false as const, error: "Wallet not connected" };
      const result = await manifestCommunitySeed(address, seed);
      if (result.success) router.push("/communities/seeds");
      return result;
    },
    [address, router]
  );

  const lastUserMessageText = (() => {
    const list = isGatekeeper ? gatekeeperMessages : oracleMessages;
    return getFirstUserMessageText(list);
  })();

  const guidingLabel =
    locale === "he" ? "אורקל השער מכוון אותך למומחה המתאים…" : "The Gatekeeper is guiding you to the right expert…";

  const tOracle = (key: string) => {
    if (key === "navTent") return tOracleDict("navTent");
    const oracleKeys: Record<string, string> = {
      title: tOracleDict("navTent"),
      placeholder:
        locale === "he"
          ? "ספר מה אתה רוצה ליצור — קהילה חדשה, פרויקט בקהילה קיימת, או לשאול על המערכת…"
          : "Tell us what you want to create — a new community, a project in an existing one, or ask about the system…",
      gatekeeperLabel: locale === "he" ? "אורקל השער" : "Gatekeeper",
      youLabel: tProposals("youLabel"),
      oracleLabel: tProposals("oracleLabel"),
      chatSend: tProposals("chatSend"),
      chatPlaceholder: tProposals("chatPlaceholder"),
    };
    return oracleKeys[key] ?? key;
  };

  const showGuidingAfterFirstUser =
    !isGatekeeper && initialUserMessage && oracleMessages.some((m) => m.role === "assistant");

  return (
    <main
      className="min-h-screen flex flex-col p-6 sm:p-8"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="text-primary underline underline-offset-2">
              {tProposals("navHome")}
            </Link>
            <span className="text-muted-foreground">|</span>
            <Link href="/profile" className="text-primary underline underline-offset-2">
              {tProposals("navProfile")}
            </Link>
          </div>
        </nav>

        <motion.h1
          className="text-2xl font-semibold tracking-tight text-foreground mb-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
        >
          {tOracle("navTent")}
        </motion.h1>
        <p className="text-muted-foreground text-sm mb-6">
          {tOracle("placeholder")}
        </p>

        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isGatekeeper && gatekeeperMessages.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-muted-foreground text-sm text-center py-8"
              >
                {tOracle("placeholder")}
              </motion.p>
            )}

            {isGatekeeper &&
              gatekeeperMessages.map((message, idx) => (
                <MessageBubble
                  key={message.id ?? idx}
                  message={message}
                  showGuidingForRoute={
                    idx === gatekeeperMessages.length - 1 &&
                    message.role === "assistant" &&
                    extractRouteFromMessage(message.parts as Array<{ type: string }> | undefined) != null
                  }
                  guidingLabel={guidingLabel}
                  youLabel={tOracle("youLabel")}
                  oracleLabel={tOracle("gatekeeperLabel")}
                />
              ))}

            {!isGatekeeper && (
              <>
                {initialUserMessage && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary/15 border border-primary/40 text-foreground">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{tOracle("youLabel")}</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{initialUserMessage}</p>
                    </div>
                  </div>
                )}
                {showGuidingAfterFirstUser && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 border border-border text-foreground">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{tOracle("gatekeeperLabel")}</p>
                      <p className="text-sm text-muted-foreground italic">{guidingLabel}</p>
                    </div>
                  </div>
                )}
                {oracleMessages
                  .filter(
                    (m, i) =>
                      !(initialUserMessage && i === 0 && m.role === "user")
                  )
                  .map((message, idx) => {
                    if (message.role === "user") {
                      const textPart = message.parts?.find((p) => (p as { type: string }).type === "text");
                      const text = textPart && "text" in textPart ? (textPart as { text: string }).text : "";
                      return (
                        <div key={message.id ?? `u-${idx}`} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary/15 border border-primary/40 text-foreground">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">{tOracle("youLabel")}</p>
                            <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <OracleMessageBubble
                        key={message.id ?? `o-${idx}`}
                        message={message}
                        activeOracle={activeOracle}
                        locale={locale}
                        tProposals={tProposals as (k: string) => string}
                        tCommunities={tCommunities as (k: string) => string}
                        tArchitect={tArchitect as (k: string) => string}
                        address={address}
                        lastUserMessageText={lastUserMessageText}
                        onResonate={handleResonate}
                        onManifest={handleManifest}
                      />
                    );
                  })}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-muted/30">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tOracle("chatPlaceholder")}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={tOracle("chatPlaceholder")}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? "…" : tOracle("chatSend")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({
  message,
  showGuidingForRoute,
  guidingLabel,
  youLabel,
  oracleLabel,
}: {
  message: { role: string; parts?: Array<{ type: string; text?: string }> };
  showGuidingForRoute: boolean;
  guidingLabel: string;
  youLabel: string;
  oracleLabel: string;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary/15 border border-primary/40 text-foreground"
            : "bg-muted/50 border border-border text-foreground"
        }`}
      >
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          {isUser ? youLabel : oracleLabel}
        </p>
        {showGuidingForRoute ? (
          <p className="text-sm text-muted-foreground italic">{guidingLabel}</p>
        ) : (
          <div className="space-y-3 text-sm">
            {message.parts?.map((part, partIndex) => {
              if (part.type === "text" && "text" in part) {
                return (
                  <p key={partIndex} className="whitespace-pre-wrap break-words">
                    {(part as { text: string }).text}
                  </p>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OracleMessageBubble({
  message,
  activeOracle,
  locale,
  tProposals,
  tCommunities,
  tArchitect,
  address,
  lastUserMessageText,
  onResonate,
  onManifest,
}: {
  message: { role: string; id?: string; parts?: Array<Record<string, unknown>> };
  activeOracle: OracleType;
  locale: string;
  tProposals: (k: string) => string;
  tCommunities: (k: string) => string;
  tArchitect: (k: string) => string;
  address: string | undefined;
  lastUserMessageText: string;
  onResonate: (plan: ProposalResourcePlan, title: string, description: string) => Promise<ResonateProposalResult>;
  onManifest: (seed: CommunitySeed) => Promise<{ success: boolean; error?: string }>;
}) {
  if (message.role !== "assistant") return null;

  const oracleLabel =
    activeOracle === "genesis"
      ? locale === "he"
        ? "אורקל הגנסיס"
        : "Genesis Oracle"
      : activeOracle === "architect"
        ? tArchitect("oracleLabel")
        : tProposals("oracleLabel");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="flex justify-start"
    >
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 border border-border text-foreground">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{oracleLabel}</p>
        <div className="space-y-3 text-sm">
          {message.parts?.map((part, partIndex) => {
            if (part.type === "text" && "text" in part) {
              return (
                <p key={partIndex} className="whitespace-pre-wrap break-words">
                  {(part as { text: string }).text}
                </p>
              );
            }
            if (
              part.type === "tool-finalize_resource_plan" &&
              (part.state === "input-available" || part.state === "output-available")
            ) {
              const plan =
                part.input &&
                typeof part.input === "object" &&
                "naturalResources" in part.input &&
                "humanCapital" in part.input
                  ? (part.input as ProposalResourcePlan)
                  : (part as { output?: { plan?: ProposalResourcePlan } }).output?.plan;
              if (plan) {
                return (
                  <ManaResourcePlanCard
                    key={partIndex}
                    plan={plan}
                    resultTitle={tProposals("resultTitle")}
                    naturalResourcesLabel={tProposals("naturalResources")}
                    humanCapitalLabel={tProposals("humanCapital")}
                    manaCyclesUnit={tProposals("manaCyclesUnit")}
                    showResonateCTA={!!address}
                    visionTitleLabel={tProposals("visionTitleLabel")}
                    visionTitlePlaceholder={tProposals("visionTitlePlaceholder")}
                    resonateButtonLabel={tProposals("resonateButtonLabel")}
                    visionSproutingMessage={tProposals("visionSproutingMessage")}
                    initialDescription={lastUserMessageText}
                    onResonate={onResonate}
                  />
                );
              }
            }
            if (
              part.type === "tool-manifest_community_seed" &&
              (part.state === "input-available" || part.state === "output-available") &&
              part.input &&
              typeof part.input === "object" &&
              "name" in part.input &&
              "vision" in part.input &&
              "requiredCriticalMass" in part.input
            ) {
              const seed = part.input as CommunitySeed;
              return (
                <CommunitySeedBubble
                  key={partIndex}
                  seed={seed}
                  locale={locale}
                  tCommunities={tCommunities}
                  address={address}
                  onManifest={onManifest}
                />
              );
            }
            if (
              (part.type === "tool-finalize_resource_plan" || part.type === "tool-manifest_community_seed") &&
              part.state === "input-streaming"
            ) {
              return (
                <p key={partIndex} className="text-muted-foreground italic">
                  {tProposals("loading")}
                </p>
              );
            }
            return null;
          })}
        </div>
      </div>
    </motion.div>
  );
}

function CommunitySeedBubble({
  seed,
  locale,
  tCommunities,
  address,
  onManifest,
}: {
  seed: CommunitySeed;
  locale: string;
  tCommunities: (k: string) => string;
  address: string | undefined;
  onManifest: (s: CommunitySeed) => Promise<{ success: boolean; error?: string }>;
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
      className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-soft"
    >
      <h3 className="text-sm font-medium text-foreground mb-2">{seed.name}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{seed.vision}</p>
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
