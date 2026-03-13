"use client";

import { useState, useRef } from "react";
import { useLocale } from "@/lib/i18n/context";
import { proposeTruthNode, attachTruthEdge, anchorPrismToGraph } from "@/app/actions/truthWeaver";
import { ingestDocumentAsPrism } from "@/app/actions/prismIngestion";
import type { MatchTruthNodeResult, EdgeRelationship, EpistemicPrismResult } from "@/types/truth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip } from "lucide-react";

const PLACEHOLDER = {
  he: "שתף הנחת יסוד או מסקנה לוגית…",
  en: "Share a foundational premise or deduction…",
};

const ANCHOR_BTN = {
  he: "עגן למארג",
  en: "Anchor to the Graph",
};

const UPLOAD_DOC = {
  he: "העלה מסמך (PDF)",
  en: "Upload Document (PDF)",
};

const ANALYZE_AS_DOC = {
  he: "נתח כטקסט מסמך",
  en: "Analyze as document",
};

const PRISM_LOADING = {
  he: "מנתח מבנים לוגיים…",
  en: "Analyzing logical structures…",
};

const PRISM_HEADING = {
  he: "המנסרה האפיסטמית עיבדה את המסמך",
  en: "The Epistemic Prism has shattered the document",
};

const ANCHOR_PRISM_BTN = {
  he: "עגן פריזמה לגרף",
  en: "Anchor Prism to Graph",
};

const THESIS_LABEL = {
  he: "תזת המסמך",
  en: "Document thesis",
};

const CLAIM_LABEL = { he: "טענה", en: "Claim" };
const SCORE_LABEL = { he: "ציון קוהרנטיות", en: "Coherence score" };
const REASONING_LABEL = { he: "נימוק", en: "Reasoning" };
const ASSUMPTIONS_LABEL = { he: "הנחות מובלעות", en: "Hidden assumptions" };
const CHALLENGE_LABEL = { he: "אתגר לקהילה", en: "Challenge for the community" };

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
  const [prismLoading, setPrismLoading] = useState(false);
  const [prismAnchoring, setPrismAnchoring] = useState(false);
  const [prismResult, setPrismResult] = useState<EpistemicPrismResult | null>(null);
  const [matches, setMatches] = useState<MatchTruthNodeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPrismResult(null);
    setPrismLoading(true);

    const formData = new FormData();
    formData.set("document", file);

    const result = await ingestDocumentAsPrism(formData);
    setPrismLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (result.success) {
      setPrismResult(result.data);
    } else {
      setError(result.error);
    }
  }

  async function handleAnalyzeTextAsDocument() {
    const text = content.trim();
    if (!text) return;
    setError(null);
    setPrismResult(null);
    setPrismLoading(true);

    const formData = new FormData();
    formData.set("text", text);

    const result = await ingestDocumentAsPrism(formData);
    setPrismLoading(false);

    if (result.success) {
      setPrismResult(result.data);
    } else {
      setError(result.error);
    }
  }

  async function handleAnchorPrism() {
    if (!prismResult) return;
    setError(null);
    setPrismAnchoring(true);

    const result = await anchorPrismToGraph(
      authorWallet,
      prismResult.documentThesis,
      prismResult.extractedClaims
    );

    setPrismAnchoring(false);

    if (result.success) {
      setPrismResult(null);
      onAnchored?.(result.thesisNodeId);
    } else {
      setError(result.error);
    }
  }

  const showInterceptor = matches && matches.length > 0;
  const showPrismPreview = prismResult && !prismLoading;
  const busy = loading || prismLoading || prismAnchoring;

  return (
    <div
      className={`flex flex-col gap-4 ${className}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden
      />

      <div className="flex flex-col gap-2">
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
            className="border border-border bg-card text-foreground hover:bg-accent"
          >
            <Paperclip className="size-4 me-2 shrink-0" aria-hidden />
            {locale === "he" ? UPLOAD_DOC.he : UPLOAD_DOC.en}
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
      </div>

      {prismLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          {locale === "he" ? PRISM_LOADING.he : PRISM_LOADING.en}
        </p>
      )}

      {showPrismPreview && (
        <div
          className="rounded-xl border border-border bg-card/90 p-5 shadow-soft space-y-5"
          role="status"
          aria-live="polite"
        >
          <h3 className="text-base font-medium text-foreground">
            {locale === "he" ? PRISM_HEADING.he : PRISM_HEADING.en}
          </h3>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              {locale === "he" ? THESIS_LABEL.he : THESIS_LABEL.en}
            </p>
            <Card className="border-border bg-background/95 shadow-soft">
              <CardContent className="p-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {prismResult.documentThesis}
                </p>
              </CardContent>
            </Card>
          </div>

          <ul className="flex flex-col gap-4">
            {prismResult.extractedClaims.map((claim, idx) => (
              <li key={idx}>
                <Card className="border-border bg-background/95 shadow-soft overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {locale === "he" ? CLAIM_LABEL.he : CLAIM_LABEL.en} {idx + 1}: {claim.assertion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {locale === "he" ? SCORE_LABEL.he : SCORE_LABEL.en}:
                      </span>{" "}
                      {claim.logicalCoherenceScore}/100
                    </p>
                    <p className="text-xs text-foreground">
                      <span className="text-muted-foreground">
                        {locale === "he" ? REASONING_LABEL.he : REASONING_LABEL.en}:
                      </span>{" "}
                      {claim.reasoning}
                    </p>
                    {claim.hiddenAssumptions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">
                          {locale === "he" ? ASSUMPTIONS_LABEL.he : ASSUMPTIONS_LABEL.en}
                        </p>
                        <ul className="list-disc list-inside text-xs text-foreground space-y-0.5">
                          {claim.hiddenAssumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-primary">
                      <span className="text-muted-foreground">
                        {locale === "he" ? CHALLENGE_LABEL.he : CHALLENGE_LABEL.en}:
                      </span>{" "}
                      {claim.challengePrompt}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            onClick={handleAnchorPrism}
            disabled={prismAnchoring}
            className="w-full sm:w-auto bg-primary text-primary-foreground shadow-soft hover:opacity-90"
          >
            {prismAnchoring
              ? (locale === "he" ? "עוגן…" : "Anchoring…")
              : locale === "he"
                ? ANCHOR_PRISM_BTN.he
                : ANCHOR_PRISM_BTN.en}
          </Button>
        </div>
      )}

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
