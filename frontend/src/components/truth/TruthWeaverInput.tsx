"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { proposeTruthNode, attachTruthEdge, anchorPrismDraft } from "@/app/actions/truthWeaver";
import type { MatchTruthNodeResult, EdgeRelationship, EpistemicPrismResult } from "@/types/truth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClaimEvaluationCard } from "@/components/truth/ClaimEvaluationCard";
import { Paperclip } from "lucide-react";

const PLACEHOLDER = {
  he: "שתף הנחת יסוד או מסקנה לוגית…",
  en: "Share a foundational premise or deduction…",
};

const ANCHOR_BTN = {
  he: "עגן למארג",
  en: "Anchor to the Graph",
};

/** Attach PDF — solarpunk CTA for Epistemic Prism upload. */
const ATTACH_PDF = {
  he: "חבר מסמך הגות (PDF)",
  en: "Attach PDF Document",
};

const ANALYZE_AS_DOC = {
  he: "נתח כטקסט מסמך",
  en: "Analyze as document",
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

const RESONANCE_MESSAGE = {
  he: "שוזר המשמעויות מזהה הדהוד זהה במארג האמת…",
  en: "The Semantic Weaver senses structural resonance elsewhere in the graph…",
};

const ATTACH_EDGE = {
  he: "חבר את הטיעון שלי כאן",
  en: "Attach My Edge Here",
};

const BYPASS_ANCHOR = {
  he: "הניואנס שלי שונה במהותו — עגן כצומת חדש",
  en: "My nuance is strictly different, anchor it newly.",
};

const SIMILARITY_LABEL = {
  he: "דמיון",
  en: "Similarity",
};

/** Serene success note after anchoring prism to the weave. */
const ANCHOR_SUCCESS_NOTE = {
  he: "נזרעו זרעי אמת עתידים במארג.",
  en: "Truth frameworks anchored in the weave.",
};

interface TruthWeaverInputProps {
  authorWallet: string;
  parentId?: string;
  relationship?: EdgeRelationship;
  onAnchored?: (nodeId: string) => void;
  onEdgeAttached?: (edgeId: string) => void;
  className?: string;
}

export function TruthWeaverInput({
  authorWallet,
  parentId,
  relationship,
  onAnchored,
  onEdgeAttached,
  className = "",
}: TruthWeaverInputProps) {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [pendingContent, setPendingContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prismAnchoring, setPrismAnchoring] = useState(false);
  const [prismDraft, setPrismDraft] = useState<EpistemicPrismResult | null>(null);
  const [anchorSuccessNote, setAnchorSuccessNote] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchTruthNodeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const router = useRouter();

  const placeholder = locale === "he" ? PLACEHOLDER.he : PLACEHOLDER.en;
  const anchorBtn = locale === "he" ? ANCHOR_BTN.he : ANCHOR_BTN.en;
  const resonanceMsg = locale === "he" ? RESONANCE_MESSAGE.he : RESONANCE_MESSAGE.en;
  const attachEdge = locale === "he" ? ATTACH_EDGE.he : ATTACH_EDGE.en;
  const bypassAnchor = locale === "he" ? BYPASS_ANCHOR.he : BYPASS_ANCHOR.en;
  const similarityLabel = locale === "he" ? SIMILARITY_LABEL.he : SIMILARITY_LABEL.en;

  async function handleSubmit(forceBypass: boolean) {
    const text = (forceBypass ? pendingContent : content).trim();
    if (!text) return;

    setError(null);
    if (!forceBypass) {
      setLoading(true);
      setMatches(null);
    }

    const result = await proposeTruthNode(
      text,
      authorWallet,
      parentId,
      relationship,
      forceBypass
    );

    setLoading(false);

    if (result.status === "resonance_found") {
      setPendingContent(text);
      setMatches(result.matches);
      return;
    }

    if (result.status === "anchored") {
      setContent("");
      setPendingContent("");
      setMatches(null);
      onAnchored?.(result.nodeId);
      return;
    }

    setError(result.error);
  }

  async function handleAttachHere(matchId: string) {
    const text = pendingContent.trim();
    if (!text) return;

    setAttachingId(matchId);
    setError(null);

    const result = await attachTruthEdge(
      matchId,
      text,
      authorWallet,
      relationship ?? "supports"
    );

    setAttachingId(null);

    if (result.success) {
      setPendingContent("");
      setMatches(null);
      onEdgeAttached?.(result.edgeId);
    } else {
      setError(result.error);
    }
  }

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

  async function handleAnalyzeTextAsDocument() {
    const text = content.trim();
    if (!text) return;
    setError(null);
    setPrismDraft(null);
    setIsAnalyzing(true);

    const formData = new FormData();
    formData.append("text", text);

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
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
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

  const showInterceptor = matches && matches.length > 0;
  const showPrismPreview = prismDraft && !isAnalyzing;
  const busy = loading || isAnalyzing || prismAnchoring;

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

      <AnimatePresence mode="wait">
        {!prismDraft ? (
          <motion.div
            key="input"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={showInterceptor ? pendingContent : content}
              onChange={(e) =>
                showInterceptor ? setPendingContent(e.target.value) : setContent(e.target.value)
              }
              placeholder={placeholder}
              rows={4}
              className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={busy}
              aria-label={placeholder}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={busy || !content.trim()}
                className="bg-primary text-primary-foreground shadow-soft hover:opacity-90"
              >
                {loading ? (locale === "he" ? "בודק…" : "Checking…") : anchorBtn}
              </Button>
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
              {content.trim().length > 100 && (
                <Button
                  type="button"
                  onClick={handleAnalyzeTextAsDocument}
                  disabled={busy}
                  className="border border-border bg-card text-foreground hover:bg-accent"
                >
                  {locale === "he" ? ANALYZE_AS_DOC.he : ANALYZE_AS_DOC.en}
                </Button>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      {showInterceptor && (
        <div
          className="rounded-lg border border-border bg-card/80 p-4 shadow-soft"
          role="status"
          aria-live="polite"
        >
          <p className="mb-3 text-sm text-muted-foreground">{resonanceMsg}</p>
          <ul className="flex flex-col gap-2">
            {matches!.map((m) => (
              <li key={m.id}>
                <Card className="overflow-hidden border-border bg-background/95 shadow-soft">
                  <CardContent className="p-4">
                    <p className="mb-2 text-sm text-foreground">{m.content}</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {similarityLabel}: {Math.round(m.similarity * 100)}%
                    </p>
                    <Button
                      type="button"
                      onClick={() => handleAttachHere(m.id)}
                      disabled={attachingId !== null}
                      className="border border-primary/50 bg-transparent text-primary hover:bg-primary/10"
                    >
                      {attachingId === m.id
                        ? (locale === "he" ? "מחבר…" : "Attaching…")
                        : attachEdge}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="mt-3 text-sm text-primary underline underline-offset-2 hover:no-underline"
          >
            {bypassAnchor}
          </button>
        </div>
      )}
    </div>
  );
}
