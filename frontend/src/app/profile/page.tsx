"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
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

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  const { data: tokenIds, isLoading: isLoadingTokens } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getTokenIdsOf",
    args: address ? [address] : undefined,
    chainId: anvil.id,
  });

  const firstTokenId = tokenIds?.[0] ?? undefined;

  const { data: skillRecord, isLoading: isLoadingRecord } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getSkillRecord",
    args: firstTokenId !== undefined ? [firstTokenId] : undefined,
    chainId: anvil.id,
  });

  const isLoading = isLoadingTokens || (firstTokenId !== undefined && isLoadingRecord);
  const hasNoSkills = isConnected && tokenIds !== undefined && tokenIds.length === 0;
  const hasSkills = isConnected && skillRecord !== undefined && tokenIds && tokenIds.length > 0;

  if (isLoading) {
    return (
      <main className="min-h-screen p-8" dir="rtl">
        <div className="mx-auto max-w-2xl space-y-6">
          <nav className="mb-4 text-sm">
            <Link href="/" className="text-emerald-400 underline underline-offset-2">
              ← ראשי
            </Link>
          </nav>
          <h1 className="text-2xl font-bold text-neutral-100 text-start">פרופיל המאנה שלי</h1>
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">טוען...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <nav className="mb-4 text-sm">
          <Link href="/" className="text-emerald-400 underline underline-offset-2">
            ← ראשי
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-100 text-start">פרופיל המאנה שלי</h1>

        {!isConnected && (
          <Card>
            <CardContent className="p-6">
              <p className="text-neutral-400">
                התחבר עם הארנק שלך (Anvil) כדי לראות את כישורי המאנה שלך.
              </p>
            </CardContent>
          </Card>
        )}

        {isConnected && hasNoSkills && (
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

        {hasSkills && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>רמת מיומנות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {skillRecord?.[0] ? (
                    <Badge variant="secondary">{skillRecord[0]}</Badge>
                  ) : null}
                  <Badge>{getProficiencyLabel(Number(skillRecord?.[1] ?? 0))}</Badge>
                </div>
                <p className="text-sm text-neutral-400">
                  רמת מיומנות:{" "}
                  <span className="font-medium text-neutral-200">
                    {getProficiencyLabel(Number(skillRecord?.[1] ?? 0))}
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
                  {Number(skillRecord?.[2] ?? 0)}
                </p>
                <Progress value={Math.min(Number(skillRecord?.[2] ?? 0), 100)} max={100} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
