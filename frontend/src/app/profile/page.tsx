"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { anvil } from "@/lib/wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const PROFICIENCY_LABELS: Record<number, string> = {
  0: "שוליה",
  1: "בסיסי",
  2: "מתקדם",
  3: "מנחה",
};

function getProficiencyLabel(level: number): string {
  return PROFICIENCY_LABELS[level] ?? "—";
}

/** Normalize contract return: getTokenIdsOf returns uint256[] (bigint[]). */
function getTokenIdsArray(data: unknown): bigint[] {
  if (Array.isArray(data)) return data as bigint[];
  return [];
}

/** Safe read of skill record (tuple [category, level, hours] or object { category, level, hoursContributed }). */
function getSkillRecordFields(
  record: unknown
): { category: string; level: number; hours: number } {
  if (record == null) return { category: "", level: 0, hours: 0 };
  if (Array.isArray(record))
    return {
      category: String(record[0] ?? ""),
      level: Number(record[1] ?? 0),
      hours: Number(record[2] ?? 0),
    };
  const o = record as Record<string, unknown>;
  return {
    category: String(o.category ?? o[0] ?? ""),
    level: Number(o.level ?? o[1] ?? 0),
    hours: Number(o.hoursContributed ?? o[2] ?? 0),
  };
}

export default function ProfilePage() {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

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
    isConnected && tokensReady && hasTokenIds && !isErrorTokens && !isErrorRecord;
  const showSkillsLoading = isConnected && isLoadingTokens;
  const showSkillRecordLoading = isConnected && hasTokenIds && isLoadingRecord;

  const isWrongChain = isConnected && connectedChainId !== undefined && connectedChainId !== anvil.id;
  const showConnectedFallback =
    isConnected &&
    !showSkillsLoading &&
    !showSkillsError &&
    !showWelcome &&
    !showSkills &&
    !showSkillRecordLoading;

  const skillFields = getSkillRecordFields(skillRecord);

  return (
    <main className="min-h-screen p-8" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <nav className="mb-4 text-sm">
          <Link href="/" className="text-emerald-400 underline underline-offset-2">
            ← ראשי
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-100 text-start">פרופיל המאנה שלי</h1>

        {isConnected && (
          <p className="text-sm text-neutral-500 font-mono">
            {address}
            <button
              type="button"
              onClick={() => disconnect()}
              className="ms-2 text-emerald-400 hover:underline"
            >
              התנתק
            </button>
          </p>
        )}

        {!isConnected && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-neutral-400">
                התחבר עם הארנק שלך (Anvil) כדי לראות את כישורי המאנה שלך.
              </p>
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() => connect({ connector, chainId: anvil.id })}
                >
                  {isPending ? "מתחבר…" : `התחבר עם ${connector.name}`}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {showSkillsLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">טוען כישורים…</p>
            </CardContent>
          </Card>
        )}

        {showSkillsError && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">
                לא ניתן לטעון כישורים. ודא שאתה ברשת Anvil (Chain ID 31337) ושהוגדר חוזה ManaSkills ב-NEXT_PUBLIC_MANA_SKILLS_ADDRESS.
              </p>
            </CardContent>
          </Card>
        )}

        {showWelcome && (
          <Card>
            <CardHeader>
              <CardTitle>ברוך הבא</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-neutral-300">
                עדיין אין לך כישורי מאנה רשומים. התחל את המסע שלך על ידי השגת אסימון שוליה (Apprentice)
                — תוכל לצבור שעות ולעלות רמה דרך תרומה לקהילה.
              </p>
              <Button size="lg" className="w-full sm:w-auto">
                התחל את מסע המאנה שלך
              </Button>
              <p className="text-sm text-neutral-500">
                כרגע: הרץ את סקריפט ה-CLI כדי להנפיק אסימון בדיקה (למשל Agriculture, בסיסי). בהמשך
                אפשר לחבר כפתור זה לפעולת mint מתוך הממשק.
              </p>
            </CardContent>
          </Card>
        )}

        {showSkills && skillRecord != null && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>רמת מיומנות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {skillFields.category ? (
                    <Badge variant="secondary">{skillFields.category}</Badge>
                  ) : null}
                  <Badge>{getProficiencyLabel(skillFields.level)}</Badge>
                </div>
                <p className="text-sm text-neutral-400">
                  רמת מיומנות:{" "}
                  <span className="font-medium text-neutral-200">
                    {getProficiencyLabel(skillFields.level)}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>שעות תרומה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold text-emerald-400">
                  {skillFields.hours}
                </p>
                <Progress value={Math.min(skillFields.hours, 100)} max={100} />
              </CardContent>
            </Card>
          </>
        )}

        {showSkillRecordLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">טוען רשומת מיומנות…</p>
            </CardContent>
          </Card>
        )}

        {isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-300">
                הארנק מחובר לרשת אחרת. עבור לרשת Anvil (Chain ID {anvil.id}) כדי לראות את כישורי המאנה שלך.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                ברשת הנכונה: RPC http://127.0.0.1:8545 (או הערך ב-NEXT_PUBLIC_RPC_URL)
              </p>
            </CardContent>
          </Card>
        )}

        {showConnectedFallback && !isWrongChain && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">טוען כישורים…</p>
              <p className="mt-2 text-sm text-neutral-500">
                אם הדף נשאר ריק, ודא ש-NEXT_PUBLIC_MANA_SKILLS_ADDRESS מצביע על החוזה הנכון ושהאסימון הונפק לכתובת הארנק שלך (סקריפט ה-mint מנגיש ל-0xf39Fd…).
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-neutral-600 bg-neutral-900/80">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-400">לוג דיבוג (בקונסול: [Mana Profile])</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-neutral-500 font-mono space-y-1">
            <p>מחובר: {isConnected ? "כן" : "לא"}</p>
            <p>כתובת: {address ?? "—"}</p>
            <p>רשת ארנק: {connectedChainId ?? "—"} | אנוויל: {anvil.id}</p>
            <p>טוקנים: {tokenIds.length} | טוען: {isLoadingTokens ? "כן" : "לא"} | שגיאה: {isErrorTokens ? "כן" : "לא"}</p>
            <p>מציג: {showSkillsLoading && "טוען "} {showSkillsError && "שגיאה "} {showWelcome && "ברוך הבא "} {showSkills && "כישורים "} {showConnectedFallback && "fallback"}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
