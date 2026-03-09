"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { anvil } from "@/lib/wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Normalize contract return: getTokenIdsOf returns uint256[] (bigint[]). */
function getTokenIdsArray(data: unknown): bigint[] {
  if (Array.isArray(data)) return data as bigint[];
  return [];
}

/**
 * Safe read of skill record. Contract returns (string category, uint8 level, uint256 hoursContributed).
 * Wagmi/viem may return a tuple [category, level, hours] or object { category, level, hoursContributed }.
 * Level can be number or bigint (enum decoded as uint8).
 */
function getSkillRecordFields(
  record: unknown
): { category: string; level: number; hours: number } {
  if (record == null) return { category: "", level: 0, hours: 0 };
  const toNum = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  const toStr = (v: unknown): string => (v != null ? String(v).trim() : "");
  if (Array.isArray(record))
    return {
      category: toStr(record[0]),
      level: toNum(record[1]),
      hours: toNum(record[2]),
    };
  const o = record as Record<string, unknown>;
  return {
    category: toStr(o.category ?? o[0]),
    level: toNum(o.level ?? o[1]),
    hours: toNum(o.hoursContributed ?? o[2]),
  };
}

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const { locale, t, getLevelDisplay, replace } = useLocale();
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => setMounted(true), []);

  const {
    data: tokenIdsRaw,
    isLoading: isLoadingTokens,
    isError: isErrorTokens,
    isFetched: isFetchedTokens,
  } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getTokenIdsOf",
    args: address ? [address] : undefined,
    chainId: anvil.id,
  });

  const tokenIds = getTokenIdsArray(tokenIdsRaw);
  const firstTokenId = tokenIds.length > 0 ? tokenIds[0] : undefined;

  const {
    data: skillRecord,
    isLoading: isLoadingRecord,
    isError: isErrorRecord,
  } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getSkillRecord",
    args: firstTokenId !== undefined ? [firstTokenId] : undefined,
    chainId: anvil.id,
  });

  const tokensReady = !isLoadingTokens && isFetchedTokens;
  const hasTokenIds = tokenIds.length > 0;
  const showWelcome =
    isConnected && tokensReady && !hasTokenIds && !isErrorTokens;
  const showSkillsError =
    isConnected && (isErrorTokens || (hasTokenIds && isErrorRecord));
  const showSkills =
    isConnected &&
    tokensReady &&
    hasTokenIds &&
    !isErrorTokens &&
    !isErrorRecord;
  const showSkillsLoading = isConnected && isLoadingTokens;
  const showSkillRecordLoading = isConnected && hasTokenIds && isLoadingRecord;

  const isWrongChain =
    isConnected &&
    connectedChainId !== undefined &&
    connectedChainId !== anvil.id;
  const showConnectedFallback =
    isConnected &&
    !showSkillsLoading &&
    !showSkillsError &&
    !showWelcome &&
    !showSkills &&
    !showSkillRecordLoading;

  const skillFields = getSkillRecordFields(skillRecord);

  if (!mounted) {
    return (
      <main
        className="min-h-screen p-8"
        dir={locale === "he" ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-2xl space-y-6">
          <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link
              href="/"
              className="text-emerald-400 underline underline-offset-2"
            >
              {t("navHome")}
            </Link>
            <LanguageSwitcher />
          </nav>
          <h1 className="text-2xl font-bold text-neutral-100 text-start">
            {t("title")}
          </h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">{t("loadingSkills")}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-8"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link
            href="/"
            className="text-emerald-400 underline underline-offset-2"
          >
            {t("navHome")}
          </Link>
          <LanguageSwitcher />
        </nav>
        <h1 className="text-2xl font-bold text-neutral-100 text-start">
          {t("title")}
        </h1>

        {isConnected && (
          <p className="text-sm text-neutral-500 font-mono">
            {address}
            <button
              type="button"
              onClick={() => disconnect()}
              className="ms-2 text-emerald-400 hover:underline"
            >
              {t("disconnect")}
            </button>
          </p>
        )}

        {!isConnected && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-neutral-400">{t("connectPrompt")}</p>
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() => connect({ connector, chainId: anvil.id })}
                >
                  {isPending ? t("connecting") : `${t("connectWith")} ${connector.name}`}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {showSkillsLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">{t("loadingSkills")}</p>
            </CardContent>
          </Card>
        )}

        {showSkillsError && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">{t("errorLoadSkills")}</p>
            </CardContent>
          </Card>
        )}

        {showWelcome && (
          <Card>
            <CardHeader>
              <CardTitle>{t("welcomeTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-300">{t("welcomeBody")}</p>
              <Button size="lg" className="w-full sm:w-auto">
                {t("startJourney")}
              </Button>
              <p className="text-sm text-neutral-500">{t("startJourneyHint")}</p>
            </CardContent>
          </Card>
        )}

        {showSkills && skillRecord != null && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("skillLevel")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {skillFields.category ? (
                    <Badge variant="secondary">{skillFields.category}</Badge>
                  ) : null}
                  <Badge>{getLevelDisplay(skillFields.level)}</Badge>
                </div>
                <p className="text-sm text-neutral-400">
                  {t("proficiencyLabel")}:{" "}
                  <span className="font-medium text-neutral-200">
                    {getLevelDisplay(skillFields.level)}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("contributionHours")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold text-emerald-400">
                  {skillFields.hours}
                </p>
                <Progress
                  value={Math.min(skillFields.hours, 100)}
                  max={100}
                />
              </CardContent>
            </Card>
          </>
        )}

        {showSkillRecordLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">{t("loadingRecord")}</p>
            </CardContent>
          </Card>
        )}

        {isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-300">
                {replace(t("wrongChain"), { chainId: String(anvil.id) })}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {t("wrongChainRpc")}
              </p>
            </CardContent>
          </Card>
        )}

        {showConnectedFallback && !isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">{t("loadingSkills")}</p>
              <p className="mt-2 text-sm text-neutral-500">
                {t("fallbackHint")}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-neutral-600 bg-neutral-900/80">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-400">
              {t("debugTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 font-mono text-xs text-neutral-500">
            <p>
              {t("debugConnected")}: {isConnected ? t("yes") : t("no")}
            </p>
            <p>
              {t("debugAddress")}: {address ?? "—"}
            </p>
            <p>
              {t("debugNetwork")}: {connectedChainId ?? "—"} | Anvil: {anvil.id}
            </p>
            <p>
              {t("debugTokens")}: {tokenIds.length} | {t("loadingSkills")}:{" "}
              {isLoadingTokens ? t("yes") : t("no")} | Error:{" "}
              {isErrorTokens ? t("yes") : t("no")}
            </p>
            <p>
              {t("debugShowing")}:{" "}
              {showSkillsLoading && "loading "}
              {showSkillsError && "error "}
              {showWelcome && "welcome "}
              {showSkills && "skills "}
              {showConnectedFallback && "fallback"}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
