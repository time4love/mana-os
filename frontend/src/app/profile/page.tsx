"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { anvil } from "@/lib/wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const MOCK_TOKEN_ID = 0n;

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
  const { data: skillRecord, isLoading, isError } = useReadContract({
    address: MANA_SKILLS_ADDRESS,
    abi: MANA_SKILLS_ABI,
    functionName: "getSkillRecord",
    args: [MOCK_TOKEN_ID],
    chainId: anvil.id,
  });

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

  const [category, level, hoursContributed] = skillRecord ?? ["", 0, 0n];
  const hoursNumber = Number(hoursContributed ?? 0);
  const levelLabel = getProficiencyLabel(Number(level ?? 0));

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
          <CardHeader>
            <CardTitle>רמת מיומנות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isError || !skillRecord ? (
              <p className="text-neutral-400">
                אין רשומת מיומנות זמינה. התחבר ל-Anvil או בדוק את כתובת החוזה.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {category ? (
                    <Badge variant="secondary">{category}</Badge>
                  ) : null}
                  <Badge>{levelLabel}</Badge>
                </div>
                <p className="text-sm text-neutral-400">
                  רמת מיומנות: <span className="font-medium text-neutral-200">{levelLabel}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>שעות תרומה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isError || !skillRecord ? (
              <p className="text-neutral-400">—</p>
            ) : (
              <>
                <p className="text-3xl font-semibold text-emerald-400">{hoursNumber}</p>
                <Progress value={Math.min(hoursNumber, 100)} max={100} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
