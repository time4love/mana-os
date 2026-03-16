"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { ArenaCard } from "@/components/truth/ArenaCard";
import type { MacroRootWithMeta } from "@/types/truth";

const INITIATE_NEW_ARENA = {
  he: "יזום זירת דיון חדשה",
  en: "Initiate New Arena",
};

const EXPLORE_THE_WEAVE = {
  he: "אין עדיין זירות. יזמו את הראשונה.",
  en: "No arenas yet. Initiate the first one.",
};

const TRANSITION = { duration: 0.4, ease: [0.32, 0.72, 0, 1] as const };

interface TruthArenaLobbyProps {
  arenas: MacroRootWithMeta[];
}

export function TruthArenaLobby({ arenas }: TruthArenaLobbyProps) {
  const { locale } = useLocale();

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={TRANSITION}
      className="space-y-8"
      aria-label="Epistemic Arenas"
    >
      {/* Initiate New Arena — glowing CTA */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
        <Link
          href="/truth/forge/new-arena"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-medium text-primary shadow-soft transition-all hover:scale-[1.02] hover:border-primary hover:bg-primary/20 hover:shadow-soft-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
          aria-label={locale === "he" ? INITIATE_NEW_ARENA.he : INITIATE_NEW_ARENA.en}
        >
          <Sparkles className="size-4 shrink-0" aria-hidden />
          {locale === "he" ? INITIATE_NEW_ARENA.he : INITIATE_NEW_ARENA.en}
        </Link>
      </div>

      {/* Responsive grid of Arena cards */}
      {arenas.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {arenas.map((arena, idx) => (
            <ArenaCard key={arena.node.id} arena={arena} index={idx} />
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground">
          {locale === "he" ? EXPLORE_THE_WEAVE.he : EXPLORE_THE_WEAVE.en}
        </p>
      )}
    </motion.section>
  );
}
