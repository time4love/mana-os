"use client";

import { useState, type ReactNode } from "react";
import type { CodexChapterId } from "@/lib/codex";
import { CodexSheet } from "@/components/ui/CodexSheet";

export interface ConceptWhisperProps {
  /** Codex chapter to open when the word is clicked. */
  chapterId: CodexChapterId;
  /** The word or phrase to show (e.g. "Mana"). Clicking it opens the Codex. */
  children: ReactNode;
  /** Optional class for the wrapper. */
  className?: string;
}

/**
 * Inline "Concept Whisper": wraps a term with a subtle pulsing glow.
 * On click/tap, opens the Living Codex side-panel for the given chapter.
 * UNIFIED UX: All conceptual explanations go through the Codex.
 */
export function ConceptWhisper({
  chapterId,
  children,
  className = "",
}: ConceptWhisperProps) {
  const [codexOpen, setCodexOpen] = useState(false);

  return (
    <span className={`inline-block align-baseline ${className}`}>
      <button
        type="button"
        onClick={() => setCodexOpen(true)}
        className="inline cursor-pointer rounded px-0.5 text-start font-medium text-primary outline-none ring-ring/50 focus-visible:ring-2"
      >
        <span className="relative inline-block border-b border-primary/60 border-dashed bg-primary/5 px-0.5 transition-colors hover:bg-primary/10">
          <span
            className="absolute inset-0 -z-10 rounded opacity-40"
            style={{
              boxShadow: "0 0 12px 2px rgba(52, 211, 153, 0.25)",
              animation: "concept-whisper-pulse 2.5s ease-in-out infinite",
            }}
          />
          {children}
        </span>
      </button>
      <CodexSheet
        open={codexOpen}
        onOpenChange={setCodexOpen}
        chapterId={chapterId}
      />
    </span>
  );
}
