"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import {
  getSeedsForNursery,
  joinCommunity,
  type SeedWithMemberCount,
} from "@/app/actions/communities";
import { Droplets, Leaf } from "lucide-react";

const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

export default function SeedsPage() {
  const { locale, tCommunities, tProposals } = useLocale();
  const { address } = useAccount();
  const [seeds, setSeeds] = useState<SeedWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSeeds = useCallback(() => {
    getSeedsForNursery(address ?? undefined).then((result) => {
      if (result.success) setSeeds(result.seeds);
      else setError(result.error ?? null);
    });
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    getSeedsForNursery(address ?? undefined).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) setSeeds(result.seeds);
      else setError(result.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <main
      className="min-h-screen flex flex-col px-4 py-8 sm:px-6 sm:py-10"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="text-primary underline underline-offset-2"
            >
              {tProposals("navHome")}
            </Link>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/communities/genesis"
              className="text-primary underline underline-offset-2"
            >
              {tCommunities("navGenesis")}
            </Link>
          </div>
        </nav>

        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl flex items-center justify-center gap-2">
            <Leaf className="size-7 text-primary" aria-hidden />
            {tCommunities("nurseryTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {tCommunities("nurserySubtitle")}
          </p>
        </motion.header>

        {loading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground"
          >
            …
          </motion.p>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-red-500 text-sm"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {!loading && !error && seeds.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="rounded-2xl border border-border/60 bg-card/60 px-6 py-12 text-center shadow-soft"
          >
            <p className="text-muted-foreground mb-4">
              {tCommunities("nurseryEmpty")}
            </p>
            <Link
              href="/communities/genesis"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
            >
              {tCommunities("navGenesis")}
            </Link>
          </motion.div>
        )}

        {!loading && !error && seeds.length > 0 && (
          <ul className="space-y-4">
            {seeds.map((seed, index) => (
              <motion.div
                key={seed.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, ...transition }}
              >
                <SeedCard
                  seed={seed}
                  onJoined={loadSeeds}
                  walletAddress={address ?? undefined}
                  locale={locale}
                  tCommunities={tCommunities}
                />
              </motion.div>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SeedCard({
  seed,
  onJoined,
  walletAddress,
  locale,
  tCommunities,
}: {
  seed: SeedWithMemberCount;
  onJoined: () => void;
  walletAddress: string | undefined;
  locale: string;
  tCommunities: (key: string) => string;
}) {
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const progress = Math.min(
    1,
    seed.member_count / Math.max(1, seed.required_critical_mass)
  );

  async function handleWaterSeed() {
    if (!walletAddress || seed.has_joined || isJoining) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      const result = await joinCommunity(seed.id, walletAddress);
      if (result.success) onJoined();
      else setJoinError(result.error ?? null);
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/30 hover:shadow-soft-md">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">{seed.name}</h2>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {seed.vision}
        </p>

        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              {tCommunities("criticalMass")}: {seed.member_count} /{" "}
              {seed.required_critical_mass}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={seed.member_count}
            aria-valuemin={0}
            aria-valuemax={seed.required_critical_mass}
            aria-label={`${seed.member_count} of ${seed.required_critical_mass} members`}
          >
            <motion.div
              className="h-full rounded-full bg-primary/80 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>
        </div>

        {seed.has_joined ? (
          <p className="text-sm text-muted-foreground italic flex items-center gap-2">
            <Droplets className="size-4 text-primary" aria-hidden />
            {tCommunities("alreadyJoined")}
          </p>
        ) : walletAddress ? (
          <>
            <button
              type="button"
              onClick={handleWaterSeed}
              disabled={isJoining}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Droplets className="size-4" aria-hidden />
              {isJoining
                ? (locale === "he" ? "מצטרף…" : "Joining…")
                : tCommunities("waterTheSeed")}
            </button>
            {joinError && (
              <p className="text-xs text-red-500" role="alert">
                {joinError}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {locale === "he"
              ? "חבר ארנק כדי להשקות את הזרע."
              : "Connect wallet to water the seed."}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {new Date(seed.created_at).toLocaleDateString(
            locale === "he" ? "he-IL" : "en-US",
            { dateStyle: "medium" }
          )}
        </p>
      </div>
    </li>
  );
}
