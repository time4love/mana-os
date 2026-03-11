"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { BookOpen, Leaf } from "lucide-react";
import { anvil } from "@/lib/wagmi";
import { useLocale } from "@/lib/i18n/context";
import { ConceptWhisper } from "@/components/ui/ConceptWhisper";
import { CodexSheet } from "@/components/ui/CodexSheet";
import type { CodexChapterId } from "@/lib/codex";
import { anchorSoulContract } from "@/app/actions/onboarding";

type Season = "winter" | "spring" | "summer";
type RealmChoice = "material" | "energetic" | "knowledge";

const STEP_BREATH = 1;
const STEP_SEASON = 2;
const STEP_REALM = 3;
const STEP_GENESIS = 4;

const transition = { duration: 0.35, ease: "easeInOut" };

export function OnboardingFlow() {
  const router = useRouter();
  const { locale, t, tOnboarding } = useLocale();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const [step, setStep] = useState(STEP_BREATH);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [selectedRealm, setSelectedRealm] = useState<RealmChoice | null>(null);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [codexChapterId, setCodexChapterId] = useState<CodexChapterId | null>(null);
  const hasTriggeredAnchorRef = useRef(false);

  const isRtl = locale === "he";
  const showRealmStep = step === STEP_REALM;
  const showGenesisStep = step === STEP_GENESIS;

  const firstConnector = connectors[0];
  const isGenesisLoading = isConnecting || isAnchoring;

  const anchorInProgressRef = useRef(false);
  const runAnchor = useCallback(() => {
    if (!isConnected || !address || anchorInProgressRef.current) return;
    anchorInProgressRef.current = true;
    const season = selectedSeason ?? "winter";
    const realms = selectedRealm ? [selectedRealm] : [];
    setAnchorError(null);
    setIsAnchoring(true);
    anchorSoulContract(address, season, realms)
      .then((result) => {
        if (result.success) router.push("/profile");
        else setAnchorError(result.error ?? "An error occurred");
      })
      .catch((err: unknown) => {
        setAnchorError(err instanceof Error ? err.message : "An error occurred");
      })
      .finally(() => {
        setIsAnchoring(false);
        anchorInProgressRef.current = false;
      });
  }, [isConnected, address, selectedSeason, selectedRealm, router]);

  // After wallet connects on Genesis step, auto-run anchor once and redirect
  useEffect(() => {
    if (
      !showGenesisStep ||
      !isConnected ||
      !address ||
      hasTriggeredAnchorRef.current
    )
      return;
    hasTriggeredAnchorRef.current = true;
    runAnchor();
  }, [showGenesisStep, isConnected, address, runAnchor]);

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

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <nav className="absolute start-0 end-0 top-0 z-10 flex justify-between p-4">
        <Link
          href="/"
          className="text-sm text-primary underline-offset-2 hover:underline"
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
              <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                {tOnboarding("welcomeHome")}
              </p>
              <button
                type="button"
                onClick={goNext}
                className="focus-visible:ring-2 focus-visible:ring-ring rounded-full outline-none"
                aria-label={tOnboarding("tapToContinue")}
              >
                <motion.span
                  className="block h-32 w-32 rounded-full border-2 border-primary/50 bg-primary/25 shadow-soft"
                  animate={{
                    scale: [1, 1.08, 1],
                    opacity: [0.85, 1, 0.85],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
              </button>
              <p className="text-sm text-muted-foreground">
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
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
<p className="text-lg leading-relaxed text-foreground">
                {tOnboarding("seasonQuestion")}
                </p>
                <button
                  type="button"
                  onClick={() => setCodexChapterId("soul-contract-seasons")}
                  className="inline-flex shrink-0 rounded p-1 text-primary/70 outline-none transition hover:text-primary hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={tOnboarding("codexSoulContractTriggerLabel")}
                >
                  <span
                    className="relative inline-flex rounded opacity-90 transition-opacity"
                    style={{
                      boxShadow: "0 0 10px 2px rgba(52, 211, 153, 0.2)",
                      animation: "concept-whisper-pulse 2.5s ease-in-out infinite",
                    }}
                  >
                    <Leaf className="h-5 w-5" aria-hidden />
                  </span>
                </button>
              </div>
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
                    className="rounded-xl border border-border bg-card px-6 py-4 text-start text-foreground shadow-soft transition-colors hover:border-primary/40 hover:bg-accent"
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
              <p className="text-center text-lg leading-relaxed text-foreground">
                {tOnboarding("realmQuestionPrefix")}
                <ConceptWhisper chapterId="what-is-mana">
                  {tOnboarding("manaTerm")}
                </ConceptWhisper>
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
                    className="rounded-xl border border-border bg-card px-6 py-4 text-start text-foreground shadow-soft transition-colors hover:border-primary/40 hover:bg-accent"
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
              className="flex flex-col items-center gap-12 text-center"
            >
              <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                {tOnboarding("genesisText")}
              </p>
              <button
                type="button"
                onClick={() => setCodexChapterId("genesis-resonance")}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary outline-none transition hover:border-primary/60 hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={tOnboarding("codexTriggerLabel")}
              >
                <span
                  className="relative inline-flex shrink-0 rounded p-0.5"
                  style={{
                    boxShadow: "0 0 14px 3px rgba(52, 211, 153, 0.3)",
                    animation: "concept-whisper-pulse 2.5s ease-in-out infinite",
                  }}
                >
                  <BookOpen className="h-5 w-5" aria-hidden />
                </span>
                <span className="hidden sm:inline">
                  {tOnboarding("codexTriggerLabel")}
                </span>
              </button>
              <div className="flex flex-col items-center gap-4">
                {connectError && (
                  <p className="text-sm text-red-500" role="alert">
                    {connectError.message}
                  </p>
                )}
                <motion.button
                  type="button"
                  disabled={isGenesisLoading || (!isConnected && !firstConnector)}
                  onClick={async () => {
                    if (isConnected) {
                      runAnchor();
                      return;
                    }
                    if (!firstConnector) return;
                    setAnchorError(null);
                    try {
                      await connectAsync({
                        connector: firstConnector,
                        chainId: anvil.id,
                      });
                    } catch (err) {
                      const msg =
                        err instanceof Error ? err.message : "Connection failed";
                      const isProviderNotFound =
                        typeof msg === "string" &&
                        msg.includes("Provider not found");
                      setAnchorError(
                        isProviderNotFound
                          ? tOnboarding("noWalletError")
                          : msg
                      );
                    }
                  }}
                  whileHover={!isGenesisLoading ? { scale: 1.02 } : undefined}
                  whileTap={!isGenesisLoading ? { scale: 0.98 } : undefined}
                  className="rounded-xl bg-primary px-8 py-4 font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isGenesisLoading
                    ? tOnboarding("genesisAnchoring")
                    : tOnboarding("genesisAnchorButton")}
                </motion.button>
                {anchorError && (
                  <p className="text-sm text-red-500" role="alert">
                    {anchorError}
                  </p>
                )}
                {!isConnected && !firstConnector && (
                  <p className="text-sm text-muted-foreground max-w-xs text-center">
                    {tOnboarding("noWalletHint")}
                  </p>
                )}
              </div>
              <Link
                href="/"
                className="text-primary underline-offset-2 hover:underline text-sm"
              >
                {t("navHome")}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <CodexSheet
          open={codexChapterId !== null}
          onOpenChange={(open) => !open && setCodexChapterId(null)}
          chapterId={codexChapterId ?? "genesis-resonance"}
        />
      </main>
    </div>
  );
}
