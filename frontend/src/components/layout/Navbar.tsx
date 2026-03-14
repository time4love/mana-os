"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Network, SquareTerminal } from "lucide-react";
import { useArchitectMode } from "@/lib/context/ArchitectModeContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetClose,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/context";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, tProposals, tCommunities, tOracle, tMap } = useLocale();
  const { isArchitectMode, toggleArchitectMode } = useArchitectMode();
  const isRtl = locale === "he";

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-border/40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
            aria-label="Mana OS — Home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="text-xl font-semibold text-primary tracking-tight">
              Mana OS
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={toggleArchitectMode}
              className={`inline-flex size-10 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
                isArchitectMode
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-label={isArchitectMode ? "Disable Architect Mode" : "Enable Architect Mode (telemetry)"}
              title={isArchitectMode ? "Architect Mode ON — Use Forge chat or upload PDF on Truth page to see telemetry" : "Architect Mode OFF — Click to show RAG & Swarm telemetry"}
            >
              <SquareTerminal className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-foreground/80 outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isRtl ? "תפריט" : "Menu"}
              aria-expanded={menuOpen}
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="start"
          className="flex flex-col gap-0"
        >
          <SheetHeader className="border-border/50 border-b pb-4">
            <SheetTitle className="text-lg font-semibold text-foreground">
              Mana OS
            </SheetTitle>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-1 pt-6">
            <SheetClose asChild>
              <Link
                href="/"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tProposals("navHome")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/profile"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tProposals("navProfile")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/oracle"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tOracle("navTent")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/feed"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tProposals("navFeed")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/communities/seeds"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tCommunities("navSeeds")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/map"
                className="block rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {tMap("navMap")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/truth"
                className="flex items-center gap-3 rounded-xl px-4 py-4 text-base font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <Network className="size-5 shrink-0 text-primary/80" aria-hidden />
                {tProposals("navTruth")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/onboarding"
                className="block rounded-xl px-4 py-4 text-base font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                {isRtl ? "הצטרף לקהילה" : "Join community"}
              </Link>
            </SheetClose>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
