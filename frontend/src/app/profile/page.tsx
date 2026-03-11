"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { anvil } from "@/lib/wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/lib/i18n/context";
import { CodexSheet } from "@/components/ui/CodexSheet";
import { getProfileByWallet, type ProfileRow } from "@/app/actions/onboarding";
import { Leaf } from "lucide-react";

const QRCode = dynamic(
  () =>
    import("react-qr-code")
      .then((m) => m?.default ?? (m as { QRCode?: unknown }).QRCode)
      .catch(() => null),
  { ssr: false }
);

/** Normalize contract return: getTokenIdsOf returns uint256[] (bigint[]). */
function getTokenIdsArray(data: unknown): bigint[] {
  if (Array.isArray(data)) return data as bigint[];
  return [];
}

/**
 * Safe read of skill record. Contract returns (string category, uint8 level, uint8 realm, uint256 manaCycles).
 * Wagmi/viem may return a tuple [category, level, realm, manaCycles] or object.
 */
function getSkillRecordFields(
  record: unknown
): { category: string; level: number; realm: number; manaCycles: number } {
  if (record == null) return { category: "", level: 0, realm: 0, manaCycles: 0 };
  const toNum = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  const toStr = (v: unknown): string => (v != null ? String(v).trim() : "");
  if (Array.isArray(record))
    return {
      category: toStr(record[0]),
      level: toNum(record[1]),
      realm: toNum(record[2]),
      manaCycles: toNum(record[3]),
    };
  const o = record as Record<string, unknown>;
  return {
    category: toStr(o.category ?? o[0]),
    level: toNum(o.level ?? o[1]),
    realm: toNum(o.realm ?? o[2]),
    manaCycles: toNum(o.manaCycles ?? o[3]),
  };
}

const SEASON_KEYS: Record<string, "seasonWinter" | "seasonSpring" | "seasonSummer" | "seasonAutumn"> = {
  winter: "seasonWinter",
  spring: "seasonSpring",
  summer: "seasonSummer",
  autumn: "seasonAutumn",
};
const REALM_PROFILE_KEYS: Record<string, "realmMaterial" | "realmEnergetic" | "realmKnowledge"> = {
  material: "realmMaterial",
  energetic: "realmEnergetic",
  knowledge: "realmKnowledge",
};

function getSeasonDisplay(
  season: string,
  tOnboarding: (k: "seasonWinter" | "seasonSpring" | "seasonSummer" | "seasonAutumn") => string
): string {
  const key = SEASON_KEYS[season.toLowerCase()];
  return key ? tOnboarding(key) : season;
}

function getRealmLabel(
  realm: string,
  t: (k: "realmMaterial" | "realmEnergetic" | "realmKnowledge") => string
): string {
  const key = REALM_PROFILE_KEYS[realm.toLowerCase()];
  return key ? t(key) : realm;
}

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [soulContract, setSoulContract] = useState<ProfileRow | null | undefined>(undefined);
  const [codexOpen, setCodexOpen] = useState(false);
  const { locale, t, tOnboarding, tProposals, getLevelDisplay, getRealmDisplay, replace } =
    useLocale();
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => setMounted(true), []);

  const fetchSoulContract = useCallback(async (walletAddress: string) => {
    const result = await getProfileByWallet(walletAddress);
    if (result.success) setSoulContract(result.profile);
    else setSoulContract(null);
  }, []);

  useEffect(() => {
    if (!address) {
      setSoulContract(undefined);
      return;
    }
    fetchSoulContract(address);
  }, [address, fetchSoulContract]);

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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="text-primary underline underline-offset-2"
              >
                {t("navHome")}
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link
                href="/proposals/new"
                className="text-primary underline underline-offset-2"
              >
                {tProposals("navNewProposal")}
              </Link>
            </div>
          </nav>
          <h1 className="text-2xl font-bold text-foreground text-start">
            {t("title")}
          </h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">{t("loadingSkills")}</p>
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
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="text-primary underline underline-offset-2"
            >
              {t("navHome")}
            </Link>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/proposals/new"
              className="text-primary underline underline-offset-2"
            >
              {tProposals("navNewProposal")}
            </Link>
          </div>
        </nav>
        <h1 className="text-2xl font-bold text-foreground text-start">
          {t("title")}
        </h1>

        {isConnected && soulContract && (
          <Card className="border-primary/20 bg-primary/5 shadow-soft">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-primary">
                  {t("soulContractTitle")}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setCodexOpen(true)}
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
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-foreground">
                <span className="text-muted-foreground">{t("currentSeasonLabel")}: </span>
                <span className="font-medium text-primary">
                  {getSeasonDisplay(soulContract.season, tOnboarding)}
                </span>
              </p>
              {soulContract.realms.length > 0 && (
                <p className="text-foreground">
                  <span className="text-muted-foreground">{t("resonatingRealmsLabel")}: </span>
                  <span className="font-medium text-primary">
                    {soulContract.realms
                      .map((r) => getRealmLabel(r, t))
                      .join(" · ")}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isConnected && (
          <p className="text-sm text-muted-foreground font-mono">
            {address}
            <button
              type="button"
              onClick={() => disconnect()}
              className="ms-2 text-primary hover:underline"
            >
              {t("disconnect")}
            </button>
          </p>
        )}

        {!isConnected && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-muted-foreground">{t("connectPrompt")}</p>
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
              <p className="text-muted-foreground">{t("loadingSkills")}</p>
            </CardContent>
          </Card>
        )}

        {showSkillsError && (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">{t("errorLoadSkills")}</p>
            </CardContent>
          </Card>
        )}

        {showWelcome && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("welcomeTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{t("welcomeBody")}</p>
                <Button size="lg" className="w-full sm:w-auto">
                  {t("startJourney")}
                </Button>
                <p className="text-sm text-muted-foreground">{t("startJourneyHint")}</p>
              </CardContent>
            </Card>
            {address && (
              <Card className="border-primary/20 bg-primary/5 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-primary">
                    {locale === "he" ? "עוגן הבראשית" : "Genesis Anchor"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="rounded-xl border border-border/60 bg-background p-4 shadow-soft flex items-center justify-center min-h-[220px]">
                    {QRCode ? (
                      <QRCode
                        value={address}
                        size={220}
                        level="M"
                        className="size-[220px]"
                      />
                    ) : (
                      <p className="font-mono text-xs text-muted-foreground break-all px-2 text-center" dir="ltr">{address}</p>
                    )}
                  </div>
                  <p className="text-center text-sm text-muted-foreground max-w-md">
                    {t("genesisQrDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
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
                  <Badge variant="outline">
                    {t("realmLabel")}: {getRealmDisplay(skillFields.realm)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("proficiencyLabel")}:{" "}
                  <span className="font-medium text-foreground">
                    {getLevelDisplay(skillFields.level)}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("manaCycles")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold text-primary">
                  {skillFields.manaCycles}
                </p>
                <Progress
                  value={Math.min(skillFields.manaCycles, 100)}
                  max={100}
                />
              </CardContent>
            </Card>
          </>
        )}

        {showSkillRecordLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">{t("loadingRecord")}</p>
            </CardContent>
          </Card>
        )}

        {isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-foreground">
                {replace(t("wrongChain"), { chainId: String(anvil.id) })}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("wrongChainRpc")}
              </p>
            </CardContent>
          </Card>
        )}

        {showConnectedFallback && !isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">{t("loadingSkills")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("fallbackHint")}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("debugTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 font-mono text-xs text-muted-foreground">
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

        <CodexSheet
          open={codexOpen}
          onOpenChange={setCodexOpen}
          chapterId="soul-contract-seasons"
        />
      </div>
    </main>
  );
}
