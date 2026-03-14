"use client";

import { SquareTerminal } from "lucide-react";
import { useArchitectMode } from "@/lib/context/ArchitectModeContext";
import { Button } from "@/components/ui/button";

/**
 * Discrete Developer God Mode toggle at the bottom edge of the layout.
 * When active, RAG telemetry and Swarm agent traces are visible in the UI.
 */
export function ArchitectModeToggle() {
  const { isArchitectMode, toggleArchitectMode } = useArchitectMode();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleArchitectMode}
      className="fixed bottom-4 end-4 z-50 h-9 w-9 rounded-lg border border-border/60 bg-card/90 text-muted-foreground shadow-soft hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:border-primary/30"
      aria-label={isArchitectMode ? "Disable Architect Mode (telemetry)" : "Enable Architect Mode (telemetry)"}
      title={isArchitectMode ? "Architect Mode: ON — Telemetry visible" : "Architect Mode: OFF — Click to show telemetry"}
      data-state={isArchitectMode ? "on" : "off"}
    >
      <SquareTerminal className="size-4" aria-hidden />
    </Button>
  );
}
