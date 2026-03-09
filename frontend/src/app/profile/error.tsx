"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfileErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for /profile. Catches render errors and shows a fallback so the page is never blank.
 */
export default function ProfileError({ error, reset }: ProfileErrorProps) {
  useEffect(() => {
    console.error("[Mana Profile Error]", error);
  }, [error]);

  return (
    <main className="min-h-screen p-8" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <nav className="mb-4 text-sm">
          <Link href="/" className="text-emerald-400 underline underline-offset-2">
            ← ראשי
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-100 text-start">פרופיל המאנה שלי</h1>

        <Card className="border-red-500/50 bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-400">שגיאה בטעינת הפרופיל</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-300">
              משהו השתבש. נסה לרענן או לחזור לדף הראשי. אם הבעיה נמשכת, ודא שאתה ברשת הנכונה (Anvil, Chain ID 31337)
              וש-NEXT_PUBLIC_MANA_SKILLS_ADDRESS מצביע על חוזה ManaSkills תקף.
            </p>
            <p className="text-xs font-mono text-neutral-500 break-all">
              {error.message}
            </p>
            <div className="flex gap-2">
              <Button onClick={reset}>נסה שוב</Button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
              >
                לדף הראשי
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
