"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Loader2, Anchor, Sparkles } from "lucide-react";
import { useAccount } from "wagmi";
import { useLocale } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import type { SieveProcessedClaim, SieveSupportedTheory } from "@/types/truth";
import { getDisplayBlock } from "@/lib/utils/truthRosetta";

const LABELS = {
  runSieve: { he: "הפעל נפה", en: "Run Sieve" },
  pasteTranscript: { he: "הדבק כאן תמלול (יוטיוב, טיקטוק, פודקאסט…)", en: "Paste transcript here (YouTube, TikTok, podcast…)" },
  processing: { he: "הנחיל מנתח את התמלול…", en: "The Swarm is analyzing the transcript…" },
  anchorHarvest: { he: "עגן קציר למארג", en: "Anchor Harvest" },
  supportsA: { he: "תומך בתיאוריה א'", en: "Supports Theory A" },
  supportsB: { he: "תומך בתיאוריה ב'", en: "Supports Theory B" },
  neutral: { he: "ניטרלי", en: "Neutral" },
  noClaims: { he: "לא נמצאו טענות לוגיות בתמלול.", en: "No logical claims found in the transcript." },
  connectWallet: { he: "חבר ארנק כדי לעגן קציר.", en: "Connect wallet to anchor harvest." },
  harvestAnchored: { he: "הקציר עוגן במארג.", en: "Harvest anchored to the Weave." },
} as const;

interface TranscriptSieveProps {
  arenaId: string;
  theoryAEn: string;
  theoryAHe: string;
  theoryBEn: string;
  theoryBHe: string;
}

type Phase = "idle" | "processing" | "harvest";

function claimContentV2(claim: SieveProcessedClaim) {
  const sl = claim.source_locale.trim().toLowerCase();
  return {
    canonical_en: claim.canonical_en,
    source_locale: claim.source_locale,
    locales: claim.local_translation ? { [sl]: claim.local_translation } : {},
  };
}

function getClaimAssertion(claim: SieveProcessedClaim, locale: "he" | "en"): string {
  return getDisplayBlock(claimContentV2(claim), locale).assertion;
}

function getClaimReasoning(claim: SieveProcessedClaim, locale: "he" | "en"): string {
  return getDisplayBlock(claimContentV2(claim), locale).reasoning ?? "";
}

export function TranscriptSieve({
  arenaId,
  theoryAEn,
  theoryAHe,
  theoryBEn,
  theoryBHe,
}: TranscriptSieveProps) {
  const { locale } = useLocale();
  const { address } = useAccount();
  const isRtl = locale === "he";

  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [processedClaims, setProcessedClaims] = useState<SieveProcessedClaim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchorStatus, setAnchorStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  async function runSieve() {
    const trimmed = transcript.trim();
    if (trimmed.length < 50) {
      setError(locale === "he" ? "התמלול קצר מדי." : "Transcript too short.");
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
      setPhase("harvest");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setPhase("idle");
    }
  }

  async function anchorHarvest() {
    if (!address || processedClaims.length === 0) return;
    setAnchorStatus("pending");
    setError(null);
    try {
      const res = await fetch("/api/oracle/sieve/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arenaId,
          claims: processedClaims,
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
      setProcessedClaims([]);
      setPhase("idle");
      setTranscript("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setAnchorStatus("error");
    }
  }

  const claimsA = processedClaims.filter((c) => c.supportedTheory === "THEORY_A");
  const claimsB = processedClaims.filter((c) => c.supportedTheory === "THEORY_B");
  const claimsNeutral = processedClaims.filter((c) => c.supportedTheory === "NEUTRAL");

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-border bg-card/60 p-5 sm:p-6 shadow-soft"
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={locale === "he" ? "נפת התמלולים" : "Transcript Sieve"}
    >
      <div className="flex items-center gap-2 mb-4">
        <Filter className="size-5 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold text-foreground">
          {locale === "he" ? "נפת התמלולים" : "Transcript Sieve"}
        </h2>
      </div>

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
              placeholder={locale === "he" ? LABELS.pasteTranscript.he : LABELS.pasteTranscript.en}
              rows={6}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[140px]"
              aria-label={locale === "he" ? LABELS.pasteTranscript.he : LABELS.pasteTranscript.en}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="button"
              onClick={runSieve}
              className="border-primary/40 text-primary hover:bg-primary/10 focus-visible:ring-primary/40"
              aria-label={locale === "he" ? LABELS.runSieve.he : LABELS.runSieve.en}
            >
              <Filter className="size-4 me-2 shrink-0" aria-hidden />
              {locale === "he" ? LABELS.runSieve.he : LABELS.runSieve.en}
            </Button>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-full bg-primary/10 p-4"
            >
              <Loader2 className="size-8 text-primary animate-spin" aria-hidden />
            </motion.div>
            <p className="text-sm font-medium text-muted-foreground">
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
            {processedClaims.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {locale === "he" ? LABELS.noClaims.he : LABELS.noClaims.en}
              </p>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                  <HarvestColumn
                    title={locale === "he" ? LABELS.supportsA.he : LABELS.supportsA.en}
                    theoryLabel={locale === "he" ? theoryAHe : theoryAEn}
                    claims={claimsA}
                    locale={locale}
                    variant="supports"
                  />
                  <HarvestColumn
                    title={locale === "he" ? LABELS.supportsB.he : LABELS.supportsB.en}
                    theoryLabel={locale === "he" ? theoryBHe : theoryBEn}
                    claims={claimsB}
                    locale={locale}
                    variant="challenges"
                  />
                  <HarvestColumn
                    title={locale === "he" ? LABELS.neutral.he : LABELS.neutral.en}
                    theoryLabel=""
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
                    onClick={anchorHarvest}
                    disabled={anchorStatus === "pending" || processedClaims.length === 0}
                    className="bg-primary text-primary-foreground shadow-soft hover:opacity-90"
                    aria-label={locale === "he" ? LABELS.anchorHarvest.he : LABELS.anchorHarvest.en}
                  >
                    {anchorStatus === "pending" ? (
                      <Loader2 className="size-4 me-2 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <Anchor className="size-4 me-2 shrink-0" aria-hidden />
                    )}
                    {anchorStatus === "done"
                      ? (locale === "he" ? LABELS.harvestAnchored.he : LABELS.harvestAnchored.en)
                      : (locale === "he" ? LABELS.anchorHarvest.he : LABELS.anchorHarvest.en)}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {locale === "he" ? LABELS.connectWallet.he : LABELS.connectWallet.en}
                  </p>
                )}
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhase("idle");
                setError(null);
                setAnchorStatus("idle");
              }}
            >
              {locale === "he" ? "הזן תמלול אחר" : "Enter another transcript"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function HarvestColumn({
  title,
  theoryLabel,
  claims,
  locale,
  variant,
}: {
  title: string;
  theoryLabel: string;
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

  return (
    <div className={`rounded-xl border p-4 shadow-soft ${bg}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </h3>
      {theoryLabel && (
        <p className="text-xs text-foreground/80 mb-3 line-clamp-2">{theoryLabel}</p>
      )}
      <ul className="space-y-3">
        {claims.map((claim, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: locale === "he" ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-border/50 bg-background/80 p-3 shadow-soft"
          >
            <p className="text-sm text-foreground leading-relaxed">
              {getClaimAssertion(claim, locale)}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className="font-mono text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"
                aria-label={`Coherence ${claim.logicalCoherenceScore}`}
              >
                {claim.logicalCoherenceScore}
              </span>
            </div>
            {getClaimReasoning(claim, locale).trim() && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {getClaimReasoning(claim, locale)}
              </p>
            )}
          </motion.li>
        ))}
      </ul>
      {claims.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">—</p>
      )}
    </div>
  );
}
