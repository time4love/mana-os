"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface ProfileErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for /profile. Catches render errors and shows a fallback so the page is never blank.
 */
export default function ProfileError({ error, reset }: ProfileErrorProps) {
  const { locale, t, tError } = useLocale();

  useEffect(() => {
    console.error("[Mana Profile Error]", error);
  }, [error]);

  return (
    <main
      className="min-h-screen p-8"
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link
            href="/"
            className="text-primary underline underline-offset-2"
          >
            {t("navHome")}
          </Link>
          <LanguageSwitcher />
        </nav>
        <h1 className="text-2xl font-bold text-foreground text-start">
          {t("title")}
        </h1>

        <Card className="border-red-500/50 bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-400">{tError("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">{tError("message")}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
            <div className="flex gap-2">
              <Button onClick={reset}>{tError("tryAgain")}</Button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {tError("goHome")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
