"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { FileText, Loader2, Anchor, Sparkles, Filter, LinkIcon, Lock } from "lucide-react";
import { useAccount } from "wagmi";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import type { SieveProcessedClaim, SieveSupportedTheory, SieveTelemetry } from "@/types/truth";

const LABELS = {
  trigger: { he: "הגש כתב טענות / תמלול", en: "Submit Claims / Transcript" },
  title: { he: "הגשת כתב טענות", en: "Submit Statement of Claims" },
  pastePlaceholder: { he: "הדבק כאן תמלול או טקסט (יוטיוב, טיקטוק, פודקאסט, פוסט…)", en: "Paste transcript or text (YouTube, TikTok, podcast, post…)" },
  analyze: { he: "נתח טענות", en: "Analyze claims" },
  processing: { he: "נחיל הלוגיקה מנתח…", en: "The Logic Swarm is analyzing…" },
  noClaims: { he: "לא נמצאו טענות לוגיות.", en: "No logical claims found." },
  summaryPrefix: { he: "חילצנו", en: "Extracted" },
  summaryClaims: { he: "טענות עובדתיות.", en: "factual claims." },
  summarySupportA: { he: "תומכות בתיאוריה א'", en: "support Theory A" },
  summarySupportB: { he: "תומכות בתיאוריה ב'", en: "support Theory B" },
  summaryNeutral: { he: "ניטרליות.", en: "neutral." },
  anchorToArena: { he: "עגן טענות לזירה", en: "Anchor Claims to Arena" },
  anchored: { he: "הטענות עוגנו לזירה.", en: "Claims anchored to the arena." },
  connectWallet: { he: "חבר ארנק כדי לעגן.", en: "Connect wallet to anchor." },
  anotherTranscript: { he: "הזן טקסט אחר", en: "Enter another transcript" },
  alreadyAnchored: { he: "טענה זו כבר מעוגנת במארג", en: "Claim already anchored in the weave" },
  summaryAlreadyExist: { he: "מהן כבר במארג", en: "of them already exist in the weave" },
  telemetryTitle: { he: "מעקב נחיל", en: "Swarm telemetry" },
  telemetryExtractor: { he: "חילוץ", en: "Extractor" },
  telemetryScout: { he: "סקָאוּט (כפילויות)", en: "Scout (duplicates)" },
  telemetryLogician: { he: "לוגיקן (ציון)", en: "Logician (scored)" },
} as const;

interface SubmitClaimsDrawerProps {
  arenaId: string;
  theoryAEn: string;
  theoryAHe: string;
  theoryBEn: string;
  theoryBHe: string;
  /** When false, trigger shows as locked and onClick opens Codex (onLockedClick). Phase 10 Step 8: Sybil resistance. */
  hasGenesisAnchor?: boolean;
  /** Called when user clicks the locked trigger; open Codex for "sybil-resistance" chapter. */
  onLockedClick?: () => void;
}

type Phase = "idle" | "processing" | "harvest";

function getClaimAssertion(claim: SieveProcessedClaim, locale: "he" | "en"): string {
  if (locale === "he" && claim.assertionHe.trim()) return claim.assertionHe;
  return claim.assertionEn;
}

function buildSummary(
  processedClaims: SieveProcessedClaim[],
  theoryALabel: string,
  theoryBLabel: string,
  locale: "he" | "en"
): string {
  const total = processedClaims.length;
  if (total === 0) return locale === "he" ? LABELS.noClaims.he : LABELS.noClaims.en;
  const duplicateCount = processedClaims.filter((c) => c.matchedExistingNodeId != null).length;
  const pre = locale === "he" ? LABELS.summaryPrefix.he : LABELS.summaryPrefix.en;
  const claimsWord = locale === "he" ? LABELS.summaryClaims.he : LABELS.summaryClaims.en;
  const alreadyExist = locale === "he" ? LABELS.summaryAlreadyExist.he : LABELS.summaryAlreadyExist.en;

  const parts: string[] = [`${pre} ${total} ${claimsWord}`];
  if (duplicateCount > 0) {
    parts.push(`${duplicateCount} ${alreadyExist}`);
  }

  const a = processedClaims.filter((c) => c.supportedTheory === "THEORY_A").length;
  const b = processedClaims.filter((c) => c.supportedTheory === "THEORY_B").length;
  const n = processedClaims.filter((c) => c.supportedTheory === "NEUTRAL").length;
  const supportAEn = a === 1 ? "supports Theory A" : "support Theory A";
  const supportBEn = b === 1 ? "supports Theory B" : "support Theory B";
  if (a > 0) parts.push(`${a} ${locale === "he" ? LABELS.summarySupportA.he : supportAEn} (${theoryALabel})`);
  if (b > 0) parts.push(`${b} ${locale === "he" ? LABELS.summarySupportB.he : supportBEn} (${theoryBLabel})`);
  if (n > 0) parts.push(`${n} ${locale === "he" ? LABELS.summaryNeutral.he : LABELS.summaryNeutral.en}`);
  return parts.join(". ");
}

export function SubmitClaimsDrawer({
  arenaId,
  theoryAEn,
  theoryAHe,
  theoryBEn,
  theoryBHe,
  hasGenesisAnchor = true,
  onLockedClick,
}: SubmitClaimsDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { address } = useAccount();
  const isRtl = locale === "he";

  const STORAGE_KEY = `mana_sieve_draft_${arenaId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [processedClaims, setProcessedClaims] = useState<SieveProcessedClaim[]>([]);
  const [telemetry, setTelemetry] = useState<SieveTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchorStatus, setAnchorStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  function resetDrawer() {
    setPhase("idle");
    setTranscript("");
    setProcessedClaims([]);
    setTelemetry(null);
    setError(null);
    setAnchorStatus("idle");
  }

  // 1. Load draft from sessionStorage & handle ?openDraft=true
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          transcript?: string;
          processedClaims?: SieveProcessedClaim[];
          telemetry?: SieveTelemetry | null;
        };
        if (parsed.transcript) setTranscript(parsed.transcript);
        if (parsed.processedClaims?.length) {
          setProcessedClaims(parsed.processedClaims);
          setPhase("harvest");
        }
        if (parsed.telemetry) setTelemetry(parsed.telemetry);
      }
    } catch (e) {
      console.error("Failed to load draft", e);
    }
    if (searchParams?.get("openDraft") === "true") {
      setIsOpen(true);
    }
  }, [arenaId, searchParams]);

  // 2. Auto-save draft to sessionStorage (include telemetry so harvest view restores fully)
  useEffect(() => {
    if (transcript.trim().length > 0 || processedClaims.length > 0) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ transcript, processedClaims, telemetry })
      );
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [transcript, processedClaims, telemetry, arenaId]);

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      setIsOpen(true);
      return;
    }
    const hasUnsavedData = transcript.trim().length > 0 || processedClaims.length > 0;
    if (hasUnsavedData) {
      const confirmMsg =
        locale === "he"
          ? "ישנם נתונים שלא עוגנו. האם אתה בטוח שברצונך לסגור ולאבד אותם?"
          : "Unanchored claims exist. Close and discard?";
      if (window.confirm(confirmMsg)) {
        setTranscript("");
        setProcessedClaims([]);
        sessionStorage.removeItem(STORAGE_KEY);
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }

  async function runSieve() {
    const trimmed = transcript.trim();
    if (trimmed.length < 50) {
      setError(locale === "he" ? "הטקסט קצר מדי." : "Text too short.");
      return;
    }
    setError(null);
    setPhase("processing");
    try {
      const res = await fetch("/api/oracle/sieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: trimmed,
          arenaId,
          theoryA: theoryAEn,
          theoryB: theoryBEn,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? data?.detail ?? "Sieve failed");
        setPhase("idle");
        return;
      }
      setProcessedClaims(data.processedClaims ?? []);
      setTelemetry(data.telemetry ?? null);
      setPhase("harvest");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setPhase("idle");
    }
  }

  async function anchorToArena() {
    const claimsToAnchor = processedClaims.filter((c) => !c.matchedExistingNodeId);
    if (!address || claimsToAnchor.length === 0) return;
    setAnchorStatus("pending");
    setError(null);
    try {
      const res = await fetch("/api/oracle/sieve/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arenaId,
          claims: claimsToAnchor,
          authorWallet: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? data?.detail ?? "Anchor failed");
        setAnchorStatus("error");
        return;
      }
      setAnchorStatus("done");
      router.refresh();
      resetDrawer();
      sessionStorage.removeItem(STORAGE_KEY);
      setIsOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setAnchorStatus("error");
    }
  }

  const claimsA = processedClaims.filter((c) => c.supportedTheory === "THEORY_A");
  const claimsB = processedClaims.filter((c) => c.supportedTheory === "THEORY_B");
  const claimsNeutral = processedClaims.filter((c) => c.supportedTheory === "NEUTRAL");
  const claimsToAnchor = processedClaims.filter((c) => !c.matchedExistingNodeId);
  const theoryALabel = locale === "he" ? theoryAHe : theoryAEn;
  const theoryBLabel = locale === "he" ? theoryBHe : theoryBEn;
  const summary = buildSummary(processedClaims, theoryALabel.slice(0, 40), theoryBLabel.slice(0, 40), locale);

  const triggerLabel = locale === "he" ? LABELS.trigger.he : LABELS.trigger.en;
  const lockedTitle =
    locale === "he" ? "נדרש חותם מאנה (SBT) להגשת תמלול" : "Genesis Anchor (SBT) required to submit transcript";

  if (!hasGenesisAnchor && onLockedClick) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onLockedClick}
        className="inline-flex items-center justify-center gap-2 rounded-xl border-border/50 bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-soft opacity-80 cursor-not-allowed hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-muted"
        aria-label={triggerLabel}
        title={lockedTitle}
      >
        <Lock className="size-4 shrink-0" aria-hidden />
        {triggerLabel}
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary shadow-soft transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={triggerLabel}
      >
        <FileText className="size-4 shrink-0" aria-hidden />
        {triggerLabel}
      </SheetTrigger>
      <SheetContent
        side={isRtl ? "start" : "end"}
        className="flex max-w-md flex-col gap-0"
        preventBackdropClose={phase === "processing"}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Filter className="size-5 text-primary" aria-hidden />
            {locale === "he" ? LABELS.title.he : LABELS.title.en}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="flex-1 overflow-y-auto pt-4" dir={isRtl ? "rtl" : "ltr"}>
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={locale === "he" ? LABELS.pastePlaceholder.he : LABELS.pastePlaceholder.en}
                  rows={8}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[180px]"
                  aria-label={locale === "he" ? LABELS.pastePlaceholder.he : LABELS.pastePlaceholder.en}
                />
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={runSieve}
                  className="w-full border-primary/40 text-primary hover:bg-primary/10 focus-visible:ring-primary/40"
                  aria-label={locale === "he" ? LABELS.analyze.he : LABELS.analyze.en}
                >
                  <Filter className="size-4 me-2 shrink-0" aria-hidden />
                  {locale === "he" ? LABELS.analyze.he : LABELS.analyze.en}
                </Button>
              </motion.div>
            )}

            {phase === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="rounded-full bg-primary/10 p-4"
                >
                  <Loader2 className="size-8 text-primary animate-spin" aria-hidden />
                </motion.div>
                <p className="text-sm font-medium text-muted-foreground text-center">
                  {locale === "he" ? LABELS.processing.he : LABELS.processing.en}
                </p>
                <Sparkles className="size-5 text-primary/70" aria-hidden />
              </motion.div>
            )}

            {phase === "harvest" && (
              <motion.div
                key="harvest"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {telemetry != null && (
                  <div
                    className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground"
                    role="status"
                    aria-label={locale === "he" ? LABELS.telemetryTitle.he : LABELS.telemetryTitle.en}
                  >
                    <p className="mb-1.5 font-semibold uppercase tracking-wider text-foreground/80">
                      {locale === "he" ? LABELS.telemetryTitle.he : LABELS.telemetryTitle.en}
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      <li>
                        {locale === "he" ? LABELS.telemetryExtractor.he : LABELS.telemetryExtractor.en}: {telemetry.extractedCount}
                      </li>
                      <li>
                        {locale === "he" ? LABELS.telemetryScout.he : LABELS.telemetryScout.en}: {telemetry.duplicateCount}
                      </li>
                      <li>
                        {locale === "he" ? LABELS.telemetryLogician.he : LABELS.telemetryLogician.en}: {telemetry.processedCount}
                      </li>
                    </ul>
                  </div>
                )}
                <p className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-foreground leading-relaxed">
                  {summary}
                </p>
                {processedClaims.length > 0 && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-1">
                      <HarvestColumn
                        titlePrefix={locale === "he" ? "תומך בתיאוריה א': " : "Supports Theory A: "}
                        theoryName={locale === "he" ? theoryAHe : theoryAEn}
                        claims={claimsA}
                        locale={locale}
                        variant="supports"
                      />
                      <HarvestColumn
                        titlePrefix={locale === "he" ? "תומך בתיאוריה ב': " : "Supports Theory B: "}
                        theoryName={locale === "he" ? theoryBHe : theoryBEn}
                        claims={claimsB}
                        locale={locale}
                        variant="challenges"
                      />
                      <HarvestColumn
                        titlePrefix={locale === "he" ? "ניטרלי" : "Neutral"}
                        theoryName={undefined}
                        claims={claimsNeutral}
                        locale={locale}
                        variant="neutral"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                    {address ? (
                      <Button
                        type="button"
                        onClick={anchorToArena}
                        disabled={anchorStatus === "pending" || claimsToAnchor.length === 0}
                        className="w-full bg-primary text-primary-foreground shadow-soft hover:opacity-90"
                        aria-label={locale === "he" ? LABELS.anchorToArena.he : LABELS.anchorToArena.en}
                      >
                        {anchorStatus === "pending" ? (
                          <Loader2 className="size-4 me-2 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <Anchor className="size-4 me-2 shrink-0" aria-hidden />
                        )}
                        {anchorStatus === "done"
                          ? (locale === "he" ? LABELS.anchored.he : LABELS.anchored.en)
                          : (locale === "he" ? LABELS.anchorToArena.he : LABELS.anchorToArena.en)}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">
                        {locale === "he" ? LABELS.connectWallet.he : LABELS.connectWallet.en}
                      </p>
                    )}
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPhase("idle");
                    setError(null);
                    setAnchorStatus("idle");
                  }}
                >
                  {locale === "he" ? LABELS.anotherTranscript.he : LABELS.anotherTranscript.en}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function HarvestColumn({
  titlePrefix,
  theoryName,
  claims,
  locale,
  variant,
}: {
  titlePrefix: string;
  theoryName?: string;
  claims: SieveProcessedClaim[];
  locale: "he" | "en";
  variant: "supports" | "challenges" | "neutral";
}) {
  const bg =
    variant === "supports"
      ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60"
      : variant === "challenges"
        ? "bg-stone-100/80 dark:bg-stone-900/30 border-stone-300/50"
        : "bg-secondary/20 border-border/50";

  const titleColor =
    variant === "supports"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "challenges"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  if (claims.length === 0) return null;

  return (
    <div className={`rounded-xl border p-3 shadow-soft ${bg}`}>
      <h3 className={`text-lg font-bold mb-2 ${titleColor}`}>
        {titlePrefix}
        {theoryName != null && theoryName.trim() !== "" ? (
          <span className="text-foreground font-medium block mt-1 text-base">{theoryName}</span>
        ) : (
          <span className="font-medium"> ({claims.length})</span>
        )}
      </h3>
      {theoryName != null && theoryName.trim() !== "" && (
        <p className="text-xs text-muted-foreground mb-2">({claims.length})</p>
      )}
      <ul className="space-y-2">
        {claims.map((claim, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: locale === "he" ? 6 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`rounded-xl border px-4 py-3 shadow-soft ${
              claim.matchedExistingNodeId ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/80"
            }`}
          >
            {claim.matchedExistingNodeId && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                <LinkIcon className="size-3" aria-hidden />
                {locale === "he" ? LABELS.alreadyAnchored.he : LABELS.alreadyAnchored.en}
                <Link
                  href={`/truth/node/${claim.matchedExistingNodeId}`}
                  className="ms-1 underline decoration-primary/50 hover:decoration-primary focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
                  aria-label={locale === "he" ? "צלול לצומת" : "Dive to node"}
                >
                  {locale === "he" ? "צלול לצומת" : "Dive to node"}
                </Link>
              </div>
            )}
            <p className="text-sm text-foreground leading-relaxed line-clamp-2">
              {getClaimAssertion(claim, locale)}
            </p>
            <span
              className="mt-1.5 inline-block font-mono text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"
              aria-label={`Coherence ${claim.logicalCoherenceScore}`}
            >
              {claim.logicalCoherenceScore}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
