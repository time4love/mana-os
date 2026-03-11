"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { Sparkles } from "lucide-react";
import { anvil } from "@/lib/wagmi";
import { useLocale } from "@/lib/i18n/context";
import { useProfileGuard } from "@/hooks/useProfileGuard";
import { getProfileByWallet, type ProfileRow } from "@/app/actions/onboarding";
import { useReadContract } from "wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";

const transition = { duration: 0.4, ease: [0.32, 0.72, 0, 1] };

function getTokenIdsArray(data: unknown): bigint[] {
  if (Array.isArray(data)) return data as bigint[];
  return [];
}

function getSkillRecordManaCycles(record: unknown): number {
  if (record == null) return 0;
  const arr = Array.isArray(record) ? record : [record];
  const last = arr[3] ?? arr[arr.length - 1];
  return typeof last === "bigint" ? Number(last) : Number(last ?? 0);
}

const SEASON_KEYS: Record<string, "seasonWinter" | "seasonSpring" | "seasonSummer" | "seasonAutumn"> = {
  winter: "seasonWinter",
  spring: "seasonSpring",
  summer: "seasonSummer",
  autumn: "seasonAutumn",
};

function getSeasonDisplay(
  season: string,
  tOnboarding: (k: "seasonWinter" | "seasonSpring" | "seasonSummer" | "seasonAutumn") => string
): string {
  const key = SEASON_KEYS[season.toLowerCase()];
  return key ? tOnboarding(key) : season;
}

export default function HomePage() {
  const { locale, tHome, tOnboarding } = useLocale();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(undefined);

  useProfileGuard();

  const fetchProfile = useCallback(async (walletAddress: string) => {
    const result = await getProfileByWallet(walletAddress);
    if (result.success) setProfile(result.profile);
    else setProfile(null);
  }, []);

  useEffect(() => {
    if (!address) {
      setProfile(undefined);
      return;
    }
    fetchProfile(address);
  }, [address, fetchProfile]);

  const { data: tokenIdsRaw } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getTokenIdsOf",
    args: address ? [address] : undefined,
    chainId: anvil.id,
  });

  const tokenIds = getTokenIdsArray(tokenIdsRaw);
  const firstTokenId = tokenIds.length > 0 ? tokenIds[0] : undefined;

  const { data: skillRecord } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getSkillRecord",
    args: firstTokenId !== undefined ? [firstTokenId] : undefined,
    chainId: anvil.id,
  });

  const manaCycles = getSkillRecordManaCycles(skillRecord);
  const firstConnector = connectors[0];
  const isRtl = locale === "he";

  if (!isConnected) {
    return (
      <main
        className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-12"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="flex max-w-md flex-col items-center gap-8 text-center"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {tHome("welcomeTitle")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {tHome("welcomeSubtitle")}
          </p>
          <motion.button
            type="button"
            disabled={!firstConnector || isConnecting}
            onClick={async () => {
              if (!firstConnector) return;
              try {
                await connectAsync({
                  connector: firstConnector,
                  chainId: anvil.id,
                });
              } catch {
                // Connection cancelled or failed
              }
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, ...transition }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Sparkles className="size-5 shrink-0" aria-hidden />
            {isConnecting ? "…" : tHome("awakenButton")}
          </motion.button>
        </motion.div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 sm:py-10"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-2xl space-y-10">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="text-lg text-muted-foreground"
        >
          {tHome("welcomeBack")}
        </motion.p>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...transition }}
        >
          <Link
            href="/proposals/new"
            className="block rounded-2xl border border-primary/30 bg-card p-6 text-foreground shadow-soft transition hover:border-primary/50 hover:shadow-soft-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{
              boxShadow: "0 0 24px 2px rgba(52, 211, 153, 0.12)",
            }}
          >
            <h2 className="text-xl font-semibold text-primary tracking-tight sm:text-2xl">
              {tHome("oracleCardTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {tHome("oracleCardDescription")}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
              {tHome("consultOracle")}
              <span aria-hidden>→</span>
            </span>
          </Link>
        </motion.section>

        {(profile || manaCycles > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...transition }}
            className="rounded-xl border border-border/60 bg-card/60 px-4 py-4 shadow-soft"
          >
            <h3 className="text-sm font-medium text-muted-foreground">
              {tHome("seasonLabel")} · {tHome("manaCyclesLabel")}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground">
              {profile?.season && (
                <span className="font-medium">
                  {getSeasonDisplay(profile.season, tOnboarding)}
                </span>
              )}
              {manaCycles > 0 && (
                <span className="text-muted-foreground">
                  {manaCycles} {tHome("manaCyclesLabel")}
                </span>
              )}
              {(!profile?.season && manaCycles === 0) && (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
}
