"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { DiveColumn } from "./DiveColumn";
import type { EndlessDiveInitialData } from "@/app/actions/truthWeaver";

const LOBBY_LABEL = { he: "מרחב האמת", en: "Truth Weave" };
const CRUMB_SEGMENT_MAX = 120;

export interface BreadcrumbItem {
  id: string;
  label: string;
}

interface EndlessDiveSpaceProps {
  initialNodeId: string;
  initialNodeData?: EndlessDiveInitialData;
}

/**
 * Perceptually Responsive Endless Dive (Miller Columns).
 * Desktop: fixed-width columns side-by-side (Logical Panorama).
 * Mobile: sliding deck — 90vw columns with 10% peek for swipe affordance.
 * Stack holds id + label so mobile can show a full breadcrumb trail.
 */
function truncate(str: string, max: number): string {
  const t = str.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

export function EndlessDiveSpace({ initialNodeId, initialNodeData }: EndlessDiveSpaceProps) {
  const { locale } = useLocale();
  const [stack, setStack] = useState<BreadcrumbItem[]>([{ id: initialNodeId, label: "" }]);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(stack.length);

  const handleDive = (nodeId: string, columnIndex: number, label: string) => {
    setStack((prev) => {
      const next = prev.slice(0, columnIndex + 1);
      next.push({ id: nodeId, label });
      return next;
    });
  };

  const handleRegisterLabel = useCallback((id: string, label: string) => {
    setStack((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label } : item))
    );
  }, []);

  const handleBreadcrumbClick = useCallback((toIndex: number) => {
    setStack((prev) => prev.slice(0, toIndex + 1));
  }, []);

  // Auto-scroll to the active column whenever the target node changes (new depth or same-depth replacement)
  useEffect(() => {
    if (containerRef.current?.lastElementChild) {
      const timer = setTimeout(() => {
        containerRef.current?.lastElementChild?.scrollIntoView({
          behavior: "smooth",
          inline: "center",
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [stack.length, stack[stack.length - 1]?.id]);

  // When going back (stack shrinks), scroll so the new last column is in view
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    prevLengthRef.current = stack.length;
    if (stack.length < prevLen && containerRef.current && stack.length > 0) {
      const target = containerRef.current.children[stack.length - 1];
      if (target) {
        const t = setTimeout(() => {
          (target as HTMLElement).scrollIntoView({ behavior: "smooth", inline: "center" });
        }, 80);
        return () => clearTimeout(t);
      }
    }
  }, [stack.length]);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-5rem)]">
      {/* Global breadcrumb: lobby + full path; each segment is the stack controller */}
      <nav
        className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-background/95 backdrop-blur-md border-b border-border/50 z-20 shrink-0 overflow-x-auto custom-scrollbar min-h-[3rem]"
        aria-label={locale === "he" ? "ניווט מרחב האמת" : "Truth space navigation"}
      >
        <Link
          href="/truth"
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <Home className="size-4" aria-hidden />
          {locale === "he" ? LOBBY_LABEL.he : LOBBY_LABEL.en}
        </Link>
        {stack.map((item, index) => {
          const isLast = index === stack.length - 1;
          const title = item.label?.trim() ? truncate(item.label, CRUMB_SEGMENT_MAX) : "…";
          return (
            <span key={`${item.id}-${index}`} className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground/50 shrink-0" aria-hidden>
                /
              </span>
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(index)}
                className={`text-sm transition-colors truncate max-w-[120px] sm:max-w-[180px] md:max-w-[250px] text-start ${
                  isLast
                    ? "font-bold text-foreground cursor-default pointer-events-none"
                    : "font-medium text-muted-foreground hover:text-primary cursor-pointer"
                }`}
                title={item.label || undefined}
              >
                {title}
              </button>
            </span>
          );
        })}
      </nav>

      {/* Scrolling Miller columns */}
      <div
        ref={containerRef}
        className="flex flex-row overflow-x-auto overflow-y-hidden w-full flex-1 min-h-0 snap-x snap-mandatory custom-scrollbar gap-4 px-4 py-4 sm:py-6 items-start"
      >
        {stack.map((item, index) => (
          <DiveColumn
            key={`${item.id}-${index}`}
            nodeId={item.id}
            columnIndex={index}
            onDive={handleDive}
            isFirst={index === 0}
            initialData={index === 0 ? initialNodeData : undefined}
          activeChildId={stack[index + 1]?.id}
          onRegisterLabel={handleRegisterLabel}
          />
        ))}
      </div>
    </div>
  );
}
