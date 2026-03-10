"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ConceptWhisperProps {
  /** The term to show (e.g. "Mana"). */
  term: string;
  /** Short definition revealed on click/tap. */
  definition: string;
  /** Optional class for the wrapper. */
  className?: string;
}

/**
 * Inline "Concept Whisper": wraps a term with a subtle pulsing glow.
 * On click/tap, smoothly expands to reveal the definition below without modals.
 * Healing UX: non-intrusive learning, no breaking flow.
 */
export function ConceptWhisper({ term, definition, className = "" }: ConceptWhisperProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span className={`inline-block align-baseline ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline cursor-pointer rounded px-0.5 text-start font-medium text-emerald-400 outline-none ring-emerald-500/50 focus-visible:ring-2"
        aria-expanded={expanded}
        aria-label={expanded ? definition : undefined}
      >
        <span className="relative inline-block border-b border-emerald-400/60 border-dashed bg-emerald-500/5 px-0.5 transition-colors hover:bg-emerald-500/10">
          {/* Soft pulsing glow */}
          <span
            className="absolute inset-0 -z-10 rounded opacity-40"
            style={{
              boxShadow: "0 0 12px 2px rgba(52, 211, 153, 0.25)",
              animation: "concept-whisper-pulse 2.5s ease-in-out infinite",
            }}
          />
          {term}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="block overflow-hidden"
          >
            <span className="mt-1.5 block ps-1 text-sm leading-relaxed text-neutral-400">
              {definition}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
