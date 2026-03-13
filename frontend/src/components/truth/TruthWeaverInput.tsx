"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { anchorPrismDraft } from "@/app/actions/truthWeaver";
import type { EdgeRelationship, EpistemicPrismResult } from "@/types/truth";
import { Button } from "@/components/ui/button";
import { ClaimEvaluationCard } from "@/components/truth/ClaimEvaluationCard";
import { ForgeChat } from "@/components/truth/ForgeChat";
import { Paperclip } from "lucide-react";

/** Attach PDF — solarpunk CTA for Epistemic Prism upload. */
const ATTACH_PDF = {
  he: "חבר מסמך הגות (PDF)",
  en: "Attach PDF Document",
};

/** Serene pulsing loading copy for Prism analysis (no urgency). */
const PRISM_LOADING = {
  he: "המנסרה מנתחת את מרכיבי הלוגיקה…",
  en: "The Epistemic Prism is mapping the logical structure…",
};

const PRISM_HEADING = {
  he: "המנסרה האפיסטמית עיבדה את המסמך",
  en: "The Epistemic Prism has shattered the document",
};

/** Main CTA: anchor the semantic tree to The Weave. */
const ANCHOR_WEAVE_CTA = {
  he: "עגן עץ סמנטי למארג",
  en: "Anchor Framework to The Weave",
};

const THESIS_LABEL = {
  he: "תזת המסמך",
  en: "Document thesis",
};

/** Serene success note after anchoring prism to the weave. */
const ANCHOR_SUCCESS_NOTE = {
  he: "נזרעו זרעי אמת עתידים במארג.",
  en: "Truth frameworks anchored in the weave.",
};

export type TruthWeaverInputVariant = "full" | "pdf-only";

interface TruthWeaverInputProps {
  authorWallet: string;
  parentId?: string;
  relationship?: EdgeRelationship;
  onAnchored?: (nodeId: string) => void;
  onEdgeAttached?: (edgeId: string) => void;
  /** When "pdf-only", only the Attach PDF / Prism pipeline is shown (no Forge chat). Used when Forge lives in ForgeSheet. */
  variant?: TruthWeaverInputVariant;
  className?: string;
}

export function TruthWeaverInput({
  authorWallet,
  parentId,
  relationship,
  onAnchored,
  onEdgeAttached,
  variant = "full",
  className = "",
}: TruthWeaverInputProps) {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prismAnchoring, setPrismAnchoring] = useState(false);
  const [prismDraft, setPrismDraft] = useState<EpistemicPrismResult | null>(null);
  const [anchorSuccessNote, setAnchorSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgeContext, setForgeContext] = useState<{
    parentId?: string;
    targetNodeContext?: string;
  } | null>(null);
  const router = useRouter();

  const isPdfOnly = variant === "pdf-only";

  useEffect(() => {
    if (isPdfOnly) return;
    try {
      const raw = sessionStorage.getItem("truthForgeContext");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { parentId?: string; targetNodeContext?: string };
      if (parsed.parentId || parsed.targetNodeContext) {
        setForgeContext({
          parentId: parsed.parentId,
          targetNodeContext: parsed.targetNodeContext,
        });
      }
      sessionStorage.removeItem("truthForgeContext");
    } catch {
      // ignore
    }
  }, [isPdfOnly]);

  /** Native fetch to /api/truth/prism (bypasses Server Action size limits). */
  async function handlePrismUpload(file: File) {
    setError(null);
    setPrismDraft(null);
    setIsAnalyzing(true);

    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await fetch("/api/truth/prism", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError((json?.error as string) ?? res.statusText);
        return;
      }
      if (json.success && json.data) {
        setPrismDraft(json.data as EpistemicPrismResult);
      } else {
        setError((json?.error as string) ?? "Prism analysis failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handlePrismUpload(file);
  }

  async function handleAnchorPrism() {
    if (!prismDraft) return;
    setError(null);
    setAnchorSuccessNote(null);
    setPrismAnchoring(true);

    const result = await anchorPrismDraft(prismDraft, authorWallet);

    setPrismAnchoring(false);

    if (result.success) {
      setPrismDraft(null);
      onAnchored?.(result.thesisNodeId);
      const note = locale === "he" ? ANCHOR_SUCCESS_NOTE.he : ANCHOR_SUCCESS_NOTE.en;
      setAnchorSuccessNote(note);
      setTimeout(() => {
        router.push("/truth");
      }, 1600);
    } else {
      setError(result.error);
    }
  }

  const showPrismPreview = prismDraft && !isAnalyzing;
  const busy = isAnalyzing || prismAnchoring;

  return (
    <div
      className={`flex flex-col gap-4 ${className}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,text/plain"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden
      />

      {!isPdfOnly && (
        <AnimatePresence mode="wait">
          {!prismDraft ? (
            <motion.div
              key="forge-and-pdf"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3"
            >
              <ForgeChat
                authorWallet={authorWallet}
                parentId={forgeContext?.parentId ?? parentId}
                relationship={relationship}
                targetNodeContext={forgeContext?.targetNodeContext ?? undefined}
                onAnchored={onAnchored}
                onEdgeAttached={onEdgeAttached}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="border border-border bg-card text-foreground hover:bg-accent ring-2 ring-primary/20 ring-offset-2 ring-offset-background hover:ring-primary/40 transition-shadow shadow-soft"
                  aria-label={locale === "he" ? ATTACH_PDF.he : ATTACH_PDF.en}
                >
                  <Paperclip className="size-4 me-2 shrink-0" aria-hidden />
                  {locale === "he" ? ATTACH_PDF.he : ATTACH_PDF.en}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}

      {isPdfOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            variant="outline"
            className="border border-border bg-card text-foreground hover:bg-accent shadow-soft"
            aria-label={locale === "he" ? ATTACH_PDF.he : ATTACH_PDF.en}
          >
            <Paperclip className="size-4 me-2 shrink-0" aria-hidden />
            {locale === "he" ? ATTACH_PDF.he : ATTACH_PDF.en}
          </Button>
        </div>
      )}

      {isAnalyzing && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground animate-pulse"
          role="status"
          aria-live="polite"
        >
          {locale === "he" ? PRISM_LOADING.he : PRISM_LOADING.en}
        </motion.p>
      )}

      <AnimatePresence>
        {showPrismPreview && prismDraft && (
          <motion.section
            key="prism-mirror"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-xl border border-border bg-card/90 p-5 shadow-soft-md space-y-5"
            role="status"
            aria-live="polite"
          >
            <h3 className="text-base font-medium text-foreground">
              {locale === "he" ? PRISM_HEADING.he : PRISM_HEADING.en}
            </h3>

            {/* Document thesis — amber / soft gold */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                {locale === "he" ? THESIS_LABEL.he : THESIS_LABEL.en}
              </p>
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/50 px-4 py-3 shadow-soft">
                <p className="text-sm text-foreground leading-relaxed">
                  {prismDraft.documentThesis}
                </p>
              </div>
            </div>

            {/* Claims tree — ClaimEvaluationCard per claim */}
            <ul className="flex flex-col gap-4">
              {prismDraft.extractedClaims.map((claim, idx) => (
                <ClaimEvaluationCard
                  key={idx}
                  claim={claim}
                  index={idx}
                  locale={locale}
                />
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2 items-start">
              <Button
                type="button"
                onClick={handleAnchorPrism}
                disabled={prismAnchoring}
                className="bg-primary text-primary-foreground shadow-soft hover:opacity-90"
              >
                {prismAnchoring
                  ? (locale === "he" ? "עוגן…" : "Anchoring…")
                  : locale === "he"
                    ? ANCHOR_WEAVE_CTA.he
                    : ANCHOR_WEAVE_CTA.en}
              </Button>
              <button
                type="button"
                onClick={() => setPrismDraft(null)}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {locale === "he" ? "חבר מסמך אחר" : "Analyze another document"}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {anchorSuccessNote && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground shadow-soft"
            role="status"
            aria-live="polite"
          >
            {anchorSuccessNote}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
