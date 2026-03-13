"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { motion } from "framer-motion";
import { anvil } from "@/lib/wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { useLocale } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, ScanLine } from "lucide-react";

const MENTOR_LEVEL = 3;
const APPRENTICE_LEVEL = 0;
const REALM_MATERIAL = 0;
const GENESIS_CATEGORY = "Genesis";

function getTokenIdsArray(data: unknown): bigint[] {
  if (Array.isArray(data)) return data as bigint[];
  return [];
}

function parseLevel(record: unknown): number {
  if (record == null) return 0;
  const arr = Array.isArray(record) ? record : (record as { level?: unknown }).level;
  if (Array.isArray(arr) && arr.length > 1) return Number(arr[1] ?? 0);
  return Number((record as { level?: number }).level ?? 0);
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value?.trim());
}

export default function MentorScannerPage() {
  const { locale, t, tMentor, replace } = useLocale();
  const { address, isConnected } = useAccount();
  const [scannedAddress, setScannedAddress] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [grantSuccess, setGrantSuccess] = useState(false);

  const { data: tokenIdsRaw } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getTokenIdsOf",
    args: address ? [address] : undefined,
    chainId: anvil.id,
  });

  const tokenIds = useMemo(() => getTokenIdsArray(tokenIdsRaw), [tokenIdsRaw]);

  const contracts = useMemo(
    () =>
      tokenIds.map((id) => ({
        address: MANA_SKILLS_ADDRESS,
        abi: MANA_SKILLS_ABI,
        functionName: "getSkillRecord" as const,
        args: [id] as const,
      })),
    [tokenIds]
  );

  const { data: recordsData } = useReadContracts({
    contracts: contracts.length > 0 ? contracts : [],
    query: { enabled: contracts.length > 0 },
  });

  const isMentor = useMemo(() => {
    const results = recordsData as Array<{ status: string; result?: unknown }> | undefined;
    if (!results || !Array.isArray(results)) return false;
    return results.some((r) => r.status === "success" && parseLevel(r.result) === MENTOR_LEVEL);
  }, [recordsData]);

  const { writeContract, isPending: isMinting, error: mintError } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setGrantSuccess(true);
        setScannedAddress("");
        setPasteInput("");
      },
    },
  });

  const targetAddress = scannedAddress || (isValidAddress(pasteInput) ? pasteInput.trim() : null);

  const handleGrant = useCallback(() => {
    if (!targetAddress || isMinting) return;
    writeContract({
      address: MANA_SKILLS_ADDRESS,
      abi: MANA_SKILLS_ABI,
      functionName: "mintSkill",
      args: [
        targetAddress as `0x${string}`,
        GENESIS_CATEGORY,
        APPRENTICE_LEVEL,
        REALM_MATERIAL,
        BigInt(0),
      ],
    });
  }, [targetAddress, isMinting, writeContract]);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteInput.trim();
    if (isValidAddress(trimmed)) setScannedAddress(trimmed);
  }, [pasteInput]);

  if (!isConnected || !address) {
    return (
      <main className="min-h-screen p-6" dir={locale === "he" ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-lg space-y-6">
          <Link href="/profile" className="text-primary underline underline-offset-2">
            {t("navHome")}
          </Link>
          <Card className="border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {locale === "he"
                  ? "התחבר עם הארנק כדי לגשת לסורק הבראשית."
                  : "Connect your wallet to access the Genesis Scanner."}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!isMentor) {
    return (
      <main className="min-h-screen p-6" dir={locale === "he" ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-lg space-y-6">
          <Link href="/profile" className="text-primary underline underline-offset-2">
            {t("navHome")}
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] as const }}
          >
            <Card className="overflow-hidden border-primary/20 bg-card shadow-soft">
              <CardHeader className="border-b border-border/60 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Leaf className="size-5 text-primary" aria-hidden />
                  {tMentor("accessDeniedTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">{tMentor("accessDeniedMessage")}</p>
                <Link href="/profile" className="mt-4 inline-block">
                  <Button className="border border-border bg-transparent text-primary hover:bg-primary/10">
                    {t("navHome")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6" dir={locale === "he" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-lg space-y-6">
        <Link href="/profile" className="text-primary underline underline-offset-2">
          {t("navHome")}
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <ScanLine className="size-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold text-foreground">
            {locale === "he" ? "סורק הבראשית" : "Genesis Scanner"}
          </h1>
        </motion.header>

        {grantSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/30 bg-primary/10 p-4"
          >
            <p className="font-medium text-primary">{tMentor("grantedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tMentor("grantedMessage")}</p>
          </motion.div>
        )}

        <Card className="border-border bg-card shadow-soft">
          <CardContent className="p-4 space-y-4">
            <label htmlFor="mentor-paste-address" className="sr-only">
              {tMentor("scanOrPastePlaceholder")}
            </label>
            <div className="flex gap-2">
              <input
                id="mentor-paste-address"
                type="text"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasteSubmit()}
                placeholder={tMentor("scanOrPastePlaceholder")}
                className="flex-1 rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!isValidAddress(pasteInput)}
                className="border border-border bg-transparent text-primary hover:bg-primary/10"
              >
                {locale === "he" ? "הדבק" : "Paste"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {targetAddress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-primary/20 bg-card p-4 shadow-soft"
          >
            <p className="text-sm text-muted-foreground">
              {replace(tMentor("confirmGrantPrompt"), { address: truncateAddress(targetAddress) })}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleGrant}
                disabled={isMinting}
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {isMinting
                  ? (locale === "he" ? "מעניק…" : "Granting…")
                  : tMentor("grantGenesisResonance")}
              </Button>
              <Button
                onClick={() => {
                  setScannedAddress("");
                  setPasteInput("");
                }}
                disabled={isMinting}
                className="bg-transparent text-muted-foreground hover:bg-muted/50"
              >
                {locale === "he" ? "ביטול" : "Cancel"}
              </Button>
            </div>
            {mintError && (
              <p className="mt-2 text-xs text-red-500" role="alert">
                {mintError.message?.includes("Ownable")
                  ? (locale === "he"
                      ? "רק בעל החוזה יכול להנפיק. עדכן את ManaSkills כך שמנחים יוכלו להעניק עוגן הבראשית."
                      : "Only the contract owner can mint. Update ManaSkills to allow Mentors to grant Genesis Anchor.")
                  : mintError.message}
              </p>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
