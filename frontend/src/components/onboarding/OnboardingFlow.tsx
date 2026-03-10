"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { ConceptWhisper } from "@/components/ui/ConceptWhisper";

type Season = "winter" | "spring" | "summer";
type RealmChoice = "material" | "energetic" | "knowledge";

const STEP_BREATH = 1;
const STEP_SEASON = 2;
const STEP_REALM = 3;
const STEP_GENESIS = 4;

const transition = { duration: 0.35, ease: "easeInOut" };

export function OnboardingFlow() {
  const { locale, t, tOnboarding } = useLocale();
  const [step, setStep] = useState(STEP_BREATH);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [selectedRealm, setSelectedRealm] = useState<RealmChoice | null>(null);

  const isRtl = locale === "he";

  const goNext = useCallback(() => {
    if (step === STEP_BREATH) {
      setStep(STEP_SEASON);
      return;
    }
    if (step === STEP_SEASON && selectedSeason) {
      if (selectedSeason === "winter") setStep(STEP_GENESIS);
      else setStep(STEP_REALM);
      return;
    }
    if (step === STEP_REALM && selectedRealm) {
      setStep(STEP_GENESIS);
      return;
    }
  }, [step, selectedSeason, selectedRealm]);

  const showRealmStep = step === STEP_REALM;
  const showGenesisStep = step === STEP_GENESIS;

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <nav className="absolute start-0 end-0 top-0 z-10 flex justify-between p-4">
        <Link
          href="/"
          className="text-sm text-emerald-400/80 underline-offset-2 hover:underline"
        >
          {tOnboarding("navHome")}
        </Link>
      </nav>

      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20">
        <AnimatePresence mode="wait">
          {/* Step 1: The Breath */}
          {step === STEP_BREATH && (
            <motion.div
              key="breath"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="flex flex-col items-center gap-12 text-center"
            >
              <p className="max-w-md text-lg leading-relaxed text-neutral-300">
                {tOnboarding("welcomeHome")}
              </p>
              <button
                type="button"
                onClick={goNext}
                className="focus-visible:ring-2 focus-visible:ring-emerald-400/50 rounded-full outline-none"
                aria-label={tOnboarding("tapToContinue")}
              >
                <motion.span
                  className="block h-32 w-32 rounded-full bg-emerald-500/30"
                  animate={{
                    scale: [1, 1.08, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
              </button>
              <p className="text-sm text-neutral-500">
                {tOnboarding("tapToContinue")}
              </p>
            </motion.div>
          )}

          {/* Step 2: The Soul Contract (Seasons) */}
          {step === STEP_SEASON && (
            <motion.div
              key="season"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transition}
              className="flex w-full max-w-lg flex-col items-center gap-10"
            >
              <p className="text-center text-lg leading-relaxed text-neutral-200">
                {tOnboarding("seasonQuestion")}
              </p>
              <div className="flex w-full flex-col gap-4">
                {(
                  [
                    ["winter", tOnboarding("seasonWinter")],
                    ["spring", tOnboarding("seasonSpring")],
                    ["summer", tOnboarding("seasonSummer")],
                  ] as const
                ).map(([value, label]) => (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedSeason(value);
                      if (value === "winter") setStep(STEP_GENESIS);
                      else setStep(STEP_REALM);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl border border-neutral-600/80 bg-neutral-800/60 px-6 py-4 text-start text-neutral-100 shadow-lg transition-colors hover:border-emerald-500/40 hover:bg-neutral-800"
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: The Realm (only if Spring/Summer) */}
          {showRealmStep && (
            <motion.div
              key="realm"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transition}
              className="flex w-full max-w-lg flex-col items-center gap-10"
            >
              <p className="text-center text-lg leading-relaxed text-neutral-200">
                {tOnboarding("realmQuestionPrefix")}
                <ConceptWhisper
                  term={tOnboarding("manaTerm")}
                  definition={tOnboarding("manaWhisperDefinition")}
                />
                {tOnboarding("realmQuestionSuffix")}
              </p>
              <div className="flex w-full flex-col gap-4">
                {(
                  [
                    ["material", tOnboarding("realmMaterialLabel")],
                    ["energetic", tOnboarding("realmEnergeticLabel")],
                    ["knowledge", tOnboarding("realmKnowledgeLabel")],
                  ] as const
                ).map(([value, label]) => (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => {
                      setSelectedRealm(value);
                      setStep(STEP_GENESIS);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl border border-neutral-600/80 bg-neutral-800/60 px-6 py-4 text-start text-neutral-100 shadow-lg transition-colors hover:border-emerald-500/40 hover:bg-neutral-800"
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: The Genesis Anchor */}
          {showGenesisStep && (
            <motion.div
              key="genesis"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="flex flex-col items-center gap-10 text-center"
            >
              <p className="max-w-md text-lg leading-relaxed text-neutral-300">
                {tOnboarding("genesisText")}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...transition }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-6"
              >
                <span className="text-xl font-medium text-emerald-400">
                  {tOnboarding("readyLabel")}
                </span>
              </motion.div>
              <Link
                href="/"
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                {t("navHome")}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
