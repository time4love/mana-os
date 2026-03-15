"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { RotateCcw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { useArchitectMode } from "@/lib/context/ArchitectModeContext";
import { Button } from "@/components/ui/button";
import { anchorForgeDraft } from "@/app/actions/truthWeaver";
import { DraftNodeCard, type ForgeDraft } from "@/components/truth/DraftNodeCard";
import type { EdgeRelationship, MatchTruthNodeResult } from "@/types/truth";

const SWARM_TELEMETRY_PREFIX = "[SWARM_TELEMETRY]:";
const SWARM_TELEMETRY_RAG_HEADER = "[Swarm Telemetry — RAG Injection]";

export interface RagTelemetryPayload {
  source: "rag";
  rawQuery?: string;
  query?: string;
  expandedQueryDisplay?: string;
  expandedQuery?: string;
  matchThreshold?: number;
  matchCount: number;
  matchBreakdown?: string;
  errorMessage?: string;
  topMatches: Array<{ id: string; similarity: number; contentPreview: string }>;
  systemPromptOverride: boolean;
}

/** Parses and strips out both the visible RAG header and the hidden JSON payload */
function parseTelemetryFromText(text: string): { telemetry: RagTelemetryPayload | null; visibleText: string } {
  const headerIdx = text.indexOf(SWARM_TELEMETRY_RAG_HEADER);
  const jsonIdx = text.indexOf(SWARM_TELEMETRY_PREFIX);

  let telemetry: RagTelemetryPayload | null = null;
  let visibleText = text;

  if (jsonIdx !== -1) {
    const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
    const after = text.slice(payloadStart);
    const endMatch = after.match(/\n\n/);
    const jsonEnd = endMatch ? endMatch.index! + endMatch[0].length : after.length;
    const jsonStr = after.slice(0, endMatch ? endMatch.index : undefined).trim();
    try {
      telemetry = JSON.parse(jsonStr) as RagTelemetryPayload;
    } catch {
      // ignore
    }
  }

  // Strip the entire telemetry block from the user's view
  if (headerIdx !== -1) {
    if (jsonIdx !== -1) {
      const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
      const after = text.slice(payloadStart);
      const endMatch = after.match(/\n\n/);
      const endCut = endMatch ? jsonIdx + SWARM_TELEMETRY_PREFIX.length + endMatch.index! + endMatch[0].length : text.length;
      visibleText = text.slice(0, headerIdx) + text.slice(endCut);
    } else {
      const nextDoubleNewline = text.indexOf("\n\n", headerIdx);
      visibleText = text.slice(0, headerIdx) + (nextDoubleNewline !== -1 ? text.slice(nextDoubleNewline + 2) : "");
    }
  } else if (jsonIdx !== -1) {
    const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
    const after = text.slice(payloadStart);
    const endMatch = after.match(/\n\n/);
    const endCut = endMatch ? jsonIdx + SWARM_TELEMETRY_PREFIX.length + endMatch.index! + endMatch[0].length : text.length;
    visibleText = text.slice(0, jsonIdx) + text.slice(endCut);
  }

  return { telemetry, visibleText: visibleText.trim() };
}

const SHOW_MORE = { he: "קרא עוד", en: "Show More" };
const SHOW_LESS = { he: "צמצם", en: "Show Less" };

const PORTAL_LINK_CLASS =
  "inline-flex items-center justify-center px-4 py-2 mt-3 mb-1 text-sm font-medium rounded-full shadow-sm transition-all duration-300 no-underline hover:scale-105 bg-primary text-primary-foreground hover:opacity-90 border border-primary/50";

/** Extract markdown links to /truth/node/* so we can always render them as buttons (never truncated). */
function extractTruthNodeLinks(text: string): { label: string; href: string }[] {
  const links: { label: string; href: string }[] =[];
  const re = /\[([^\]]*)\]\((\/truth\/node\/[^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    links.push({ label: m[1], href: m[2] });
  }
  return links;
}

/** Strip truth-node markdown links from text (so we can truncate body without cutting a link). */
function stripTruthNodeLinks(text: string): string {
  return text.replace(/\[[^\]]*\]\(\/truth\/node\/[^)]*\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Renders inline markdown: **bold**, *italic*, [label](url) links as portal buttons, and line breaks. */
function SimpleMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n/);
  return (
    <div className={`space-y-2 whitespace-pre-wrap text-start leading-relaxed break-words ${className}`}>
      {parts.map((line, i) => {
        const tokens: React.ReactNode[] =[];
        let rest = line;
        let key = 0;
        while (rest.length > 0) {
          const linkMatch = rest.match(/^\[([^\]]*)\]\(([^)]*)\)/);
          const bold = rest.match(/^\*\*(.+?)\*\*/);
          const italic = rest.match(/^\*([^*]+?)\*/);
          if (linkMatch) {
            const [, label, href] = linkMatch;
            const isInternal = typeof href === "string" && href.startsWith("/");
            tokens.push(
              isInternal ? (
                <Link key={key++} href={href} className={PORTAL_LINK_CLASS}>
                  {label}
                </Link>
              ) : (
                <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={PORTAL_LINK_CLASS}>
                  {label}
                </a>
              )
            );
            rest = rest.slice(linkMatch[0].length);
          } else if (bold) {
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
            const nextLink = rest.search(/\[/);
            const nextBold = rest.indexOf("**");
            const nextItalic = rest.indexOf("*");
            const candidates = [nextLink, nextBold, nextItalic].filter((n) => n >= 0);
            const next = candidates.length > 0 ? Math.min(...candidates) : rest.length;
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

function ExpandableBubbleText({ text, maxLength = 250, className = "" }: ExpandableBubbleTextProps) {
  const { locale } = useLocale();
  const hasPortalLinks = /\]\(\/truth\/node\//.test(text);
  const [expanded, setExpanded] = useState(hasPortalLinks);
  const bodyOnly = stripTruthNodeLinks(text);
  const isLong = bodyOnly.length > maxLength;
  const displayText = !isLong ? bodyOnly : expanded ? bodyOnly : `${bodyOnly.slice(0, maxLength)}...`;
  const extractedLinks = extractTruthNodeLinks(text);

  const showMoreLabel = locale === "he" ? SHOW_MORE.he : SHOW_MORE.en;
  const showLessLabel = locale === "he" ? SHOW_LESS.he : SHOW_LESS.en;

  return (
    <motion.div layout className={`space-y-1.5 ${className}`}>
      <motion.div layout initial={false}>
        <SimpleMarkdown text={displayText} />
      </motion.div>
      {extractedLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2" role="navigation" aria-label="Links to truth nodes">
          {extractedLinks.map((link) => (
            <Link key={link.href} href={link.href} className={PORTAL_LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
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
  },[]);

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
  he: "נסח טענה או אתגר לוגי… הכבשן ינחה אותך.",
  en: "State a thesis or logical challenge… The Forge will guide you.",
};

const FORGE_SEND = { he: "שלח", en: "Send" };

const RELEASE_THOUGHT_LABEL = { he: "שחרר קו מחשבה", en: "Release thought trace" };
const RELEASE_THOUGHT_TOOLTIP = { he: "טהר כבשן", en: "Purify the forge" };
const CONFIRM_RELEASE = { he: "להתחיל דף נקי?", en: "Start with a blank slate?" };
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
  const { isArchitectMode } = useArchitectMode();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [lastWriteTelemetry, setLastWriteTelemetry] = useState<string[] | null>(null);

  const cacheKey = getForgeCacheKey(parentId);

  const initialMessages = useMemo((): UIMessage[] => {
    if (typeof sessionStorage === "undefined") return[];
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return[];
      const parsed = JSON.parse(raw) as { messages?: unknown[] };
      if (!Array.isArray(parsed?.messages)) return [];
      return parsed.messages as UIMessage[];
    } catch {
      return[];
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
        architectMode: isArchitectMode,
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

  /** Drafts from the latest draft_epistemic_nodes tool result (batch triage grid). */
  const draftsToRender = useMemo((): Array<ForgeDraft & { matchedExistingNodeId?: string | null }> => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        const p = part as {
          type?: string;
          state?: string;
          output?: { drafts?: Array<Record<string, unknown>> };
        };
        if (p.type !== "tool-draft_epistemic_nodes") continue;
        const rawDrafts = p.output?.drafts ?? (p as { result?: { drafts?: Array<Record<string, unknown>> } }).result?.drafts;
        if (!Array.isArray(rawDrafts) || rawDrafts.length === 0) continue;
        const drafts = rawDrafts as Array<Record<string, unknown>>;
        return drafts.map((c) => ({
          assertionEn: (c.assertionEn as string) ?? "",
          assertionHe: (c.assertionHe as string) ?? "",
          logicalCoherenceScore: typeof c.logicalCoherenceScore === "number" ? c.logicalCoherenceScore : 0,
          reasoningEn: (c.reasoningEn as string) ?? "",
          reasoningHe: (c.reasoningHe as string) ?? "",
          hiddenAssumptionsEn: Array.isArray(c.hiddenAssumptionsEn) ? (c.hiddenAssumptionsEn as string[]) : [],
          hiddenAssumptionsHe: Array.isArray(c.hiddenAssumptionsHe) ? (c.hiddenAssumptionsHe as string[]) : [],
          challengePromptEn: (c.challengePromptEn as string) ?? "",
          challengePromptHe: (c.challengePromptHe as string) ?? "",
          relationshipToContext: (c.relationshipToContext as "supports" | "challenges") ?? "supports",
          thematicTags: Array.isArray(c.thematicTags) ? (c.thematicTags as string[]) : [],
          matchedExistingNodeId: typeof c.matchedExistingNodeId === "string" ? c.matchedExistingNodeId : null,
        })) as Array<ForgeDraft & { matchedExistingNodeId?: string | null }>;
      }
    }
    return [];
  }, [messages]);

  const [semanticDuplicates, setSemanticDuplicates] = useState<MatchTruthNodeResult[] | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<ForgeDraft | null>(null);

  async function handleAnchor(draft: ForgeDraft, forceBypass?: boolean) {
    setAnchorError(null);
    setSemanticDuplicates(null);
    setDuplicateDraft(null);
    setLastWriteTelemetry(null);
    setIsAnchoring(true);
    const dynamicRelationship = draft.relationshipToContext ?? relationship ?? "supports";
    const normalizedDraft = {
      ...draft,
      thematicTags: draft.thematicTags ?? [],
    };
    const result = await anchorForgeDraft(
      normalizedDraft,
      authorWallet,
      parentId,
      dynamicRelationship,
      forceBypass ?? false
    );
    setLastWriteTelemetry(result.writeTelemetry ?? null);
    setIsAnchoring(false);
    if (result.success) {
      setSemanticDuplicates(null);
      setDuplicateDraft(null);
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {
        // ignore
      }
      onAnchored?.(result.nodeId);
      router.push(parentId ? `/truth/node/${parentId}` : "/truth");
      return;
    }
    const hasSemanticResonance =
      result.success === false &&
      "duplicates" in result &&
      Array.isArray(result.duplicates) &&
      result.duplicates.length > 0;
    if (hasSemanticResonance) {
      setSemanticDuplicates(result.duplicates as MatchTruthNodeResult[]);
      setDuplicateDraft(draft);
      return;
    }
    setAnchorError("error" in result ? result.error : "An error occurred");
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
        
        {messages.map((message) => {
          let lastTelemetry: RagTelemetryPayload | null = null;
          let rawTelemetryContent: string | null = null;

          return (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} flex-col gap-2 w-full`}>
              
              {/* Message Bubble */}
              <div className={`max-w-[90%] text-start overflow-visible ${message.role === "user" ? "self-end bg-primary/15 text-foreground border border-primary/20 rounded-2xl rounded-se-none px-4 py-3" : "self-start bg-muted/60 text-foreground border border-border rounded-2xl rounded-ss-none px-4 py-3"}`}>
                <div className="space-y-2 text-sm text-start overflow-visible">
                  {(() => {
                    const parts = message.parts ??[];
                    let hasVisible = false;
                    const rendered = parts.map((part, partIndex) => {
                      const p = part as {
                        type?: string;
                        text?: string;
                        state?: string;
                        errorText?: string;
                        output?: {
                          drafts?: Array<Record<string, unknown>>;
                          nodes?: Array<{ id: string; assertionEn?: string; assertionHe?: string }>;
                        };
                      };
                      
                      if (p.type === "text" && "text" in p && typeof p.text === "string") {
                        const { telemetry, visibleText } = parseTelemetryFromText(p.text);
                        if (telemetry) {
                          lastTelemetry = telemetry;
                          rawTelemetryContent = p.text;
                        }
                        if (visibleText.trim()) {
                          hasVisible = true;
                          return <ExpandableBubbleText key={partIndex} text={visibleText} maxLength={250} />;
                        }
                        return null;
                      }

                      // RAG Portals: show existing nodes when AI called show_existing_nodes
                      if (
                        p.type === "tool-show_existing_nodes" &&
                        (p.state === "output-available" || p.state === "result") &&
                        Array.isArray(p.output?.nodes) &&
                        p.output.nodes.length > 0
                      ) {
                        const nodes = p.output.nodes;
                        if (nodes.length === 0) return null;
                        hasVisible = true;
                        return (
                          <div
                            key={partIndex}
                            className="w-full max-w-full overflow-hidden flex flex-col gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mt-2 box-border"
                          >
                            <p className="text-sm font-semibold text-primary mb-1 break-words">
                              שערים לצמתים חופפים (Portals to Existing Nodes):
                            </p>
                            {nodes.map((node) => (
                              <div key={node.id} className="flex flex-col gap-2 p-3 bg-background rounded-lg shadow-sm border border-border/50 min-w-0 overflow-hidden">
                                <p className="text-xs text-muted-foreground line-clamp-2 italic break-words">
                                  &quot;{node.assertionHe || node.assertionEn || ""}&quot;
                                </p>
                                <Link
                                  href={`/truth/node/${node.id}`}
                                  className="self-end text-xs font-medium px-4 py-1.5 rounded-full transition-all no-underline bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                  צלול לצומת זה 🌊
                                </Link>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      // Epistemic Triage: batch tool output is rendered as grid below (draftsToRender)
                      if (
                        p.type === "tool-draft_epistemic_nodes" &&
                        (p.state === "output-available" || p.state === "result") &&
                        Array.isArray(p.output?.drafts) &&
                        p.output.drafts.length > 0
                      ) {
                        hasVisible = true;
                        return (
                          <p key={partIndex} className="text-muted-foreground italic text-start text-xs mt-1">
                            {locale === "he" ? "מיפוי טענות להלן." : "Claim mapping below."}
                          </p>
                        );
                      }
                      if (
                        p.type === "tool-draft_epistemic_nodes" &&
                        (p.state === "input-streaming" || p.state === "partial-call" || p.state === "input-available")
                      ) {
                        hasVisible = true;
                        return <p key={partIndex} className="text-muted-foreground italic text-start">{locale === "he" ? "הכבשן מנתח טענות…" : "The Forge is triaging claims…"}</p>;
                      }
                      if (p.type === "tool-draft_epistemic_nodes" && p.state === "output-error" && "errorText" in p && p.errorText) {
                        hasVisible = true;
                        return <p key={partIndex} className="text-destructive text-sm" role="alert">{locale === "he" ? "שגיאה: " : "Error: "}{p.errorText}</p>;
                      }
                      return null;
                    });

                    if (message.role === "assistant" && parts.length > 0 && !hasVisible) {
                      return <p key="placeholder" className="text-muted-foreground italic text-start">{locale === "he" ? "הכבשן מעבד…" : "The Forge is processing…"}</p>;
                    }
                    return rendered;
                  })()}
                </div>
              </div>

              {/* Architect Mode Telemetry Console */}
              {message.role === "assistant" && isArchitectMode && (rawTelemetryContent || lastTelemetry) && (() => {
                const raw = rawTelemetryContent;
                const tel = lastTelemetry;
                if (raw && !tel) {
                  return (
                    <div className="self-start max-w-[90%] w-full rounded-lg border border-border bg-black/80 text-emerald-400 px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap" role="region" aria-label="Swarm Telemetry">
                      {raw}
                    </div>
                  );
                }
                if (!tel) return null;
                const telemetry = tel as RagTelemetryPayload;
                return (
                  <div className="self-start max-w-[90%] w-full rounded-lg border border-border bg-black/80 text-emerald-400 px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap" role="region" aria-label="Swarm Telemetry - RAG Injection">
                    <p className="text-amber-400/90 font-semibold mb-1.5">[Swarm Telemetry — RAG Injection]</p>
                    <p className="text-zinc-400">Raw Query: &apos;{telemetry.rawQuery ?? telemetry.query ?? ""}&apos;</p>
                    <p className="text-zinc-400">Expanded (AI) Vector Query: &apos;{telemetry.expandedQueryDisplay ?? telemetry.expandedQuery ?? "FAILED_TO_EXPAND_USED_RAW"}&apos;</p>
                    <p className="text-zinc-400">Match Threshold: {(telemetry.matchThreshold ?? 0.5).toFixed(2)}</p>
                    <p className="text-zinc-400">Vector Search Result: Found {telemetry.matchCount} matching Node(s).</p>
                    {telemetry.matchBreakdown && <pre className="text-zinc-500 text-xs mt-1 mb-1 overflow-x-auto">{telemetry.matchBreakdown}</pre>}
                    {telemetry.errorMessage && <p className="text-red-400/90 mt-1" role="alert">{telemetry.errorMessage}</p>}
                    {telemetry.systemPromptOverride && <p className="text-emerald-500/90 mt-1">System prompt override initiated.</p>}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start flex-col gap-2" role="status" aria-live="polite" aria-label={locale === "he" ? "האורקל מתבונן" : "The Oracle is contemplating"}>
            <div className="self-start bg-muted/30 text-muted-foreground border border-primary/10 rounded-2xl rounded-ss-none px-4 py-3 flex items-center gap-2 max-w-[90%]">
              <Sparkles className="size-4 shrink-0 animate-pulse text-primary/70" aria-hidden />
              <span className="text-sm">
                {locale === "he" ? "האורקל מתבונן" : "The Oracle is contemplating"}
                <span className="inline-flex ms-0.5" aria-hidden>
                  <span className="animate-pulse opacity-70" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-pulse opacity-70" style={{ animationDelay: "200ms" }}>.</span>
                  <span className="animate-pulse opacity-70" style={{ animationDelay: "400ms" }}>.</span>
                </span>
              </span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {draftsToRender.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-4 mt-2 w-full max-w-full overflow-hidden grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 box-border"
            >
              {draftsToRender.map((claim, idx) => {
                const draft = claim as ForgeDraft;
                const isThisDuplicate = duplicateDraft?.assertionEn === draft.assertionEn;
                return (
                  <DraftNodeCard
                    key={`${draft.assertionEn.slice(0, 40)}-${idx}`}
                    draft={draft}
                    onAnchor={() => handleAnchor(draft, false)}
                    isAnchoring={isAnchoring}
                    authorWallet={authorWallet}
                    parentId={parentId}
                    relationship={relationship}
                    matchedExistingNodeId={"matchedExistingNodeId" in claim ? claim.matchedExistingNodeId ?? null : null}
                    semanticDuplicates={isThisDuplicate ? semanticDuplicates : null}
                    onForcePlant={isThisDuplicate ? () => handleAnchor(draft, true) : undefined}
                    writeTelemetry={lastWriteTelemetry}
                    isArchitectMode={isArchitectMode}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {anchorError && (
          <p className="text-sm text-destructive text-start" role="alert">{anchorError}</p>
        )}
      </div>

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