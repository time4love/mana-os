"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProposalResourcePlan } from "@/lib/oracle/schema";
import type { ResonateProposalResult } from "@/app/actions/proposals";

interface ManaResourcePlanCardProps {
  plan: ProposalResourcePlan;
  resultTitle: string;
  naturalResourcesLabel: string;
  humanCapitalLabel: string;
  manaCyclesUnit?: string;
  /** When set, show the resonate CTA (title input + button) at the bottom. */
  showResonateCTA?: boolean;
  visionTitleLabel?: string;
  visionTitlePlaceholder?: string;
  resonateButtonLabel?: string;
  visionSproutingMessage?: string;
  initialDescription?: string;
  onResonate?: (
    plan: ProposalResourcePlan,
    title: string,
    description: string
  ) => Promise<ResonateProposalResult>;
}

export function ManaResourcePlanCard({
  plan,
  resultTitle,
  naturalResourcesLabel,
  humanCapitalLabel,
  manaCyclesUnit = "Mana Cycles",
  showResonateCTA = false,
  visionTitleLabel = "Vision Title",
  visionTitlePlaceholder = "A short title",
  resonateButtonLabel = "Resonate Vision to Community",
  visionSproutingMessage = "Vision is sprouting in the community…",
  initialDescription = "",
  onResonate,
}: ManaResourcePlanCardProps) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResonate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !onResonate || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onResonate(plan, trimmedTitle, (initialDescription ?? "").trim());
      if (!result.success) {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base font-medium text-foreground">
          {resultTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.naturalResources.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {naturalResourcesLabel}
            </h3>
            <ul className="list-none space-y-1 text-sm text-foreground">
              {plan.naturalResources.map((r, i) => (
                <li key={i}>
                  {r.resourceName}: {r.quantity} {r.unit}
                </li>
              ))}
            </ul>
          </section>
        )}
        {plan.humanCapital.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {humanCapitalLabel}
            </h3>
            <ul className="list-none space-y-1 text-sm text-foreground">
              {plan.humanCapital.map((h, i) => (
                <li key={i}>
                  {h.requiredSkillCategory} (Level {h.requiredLevel}):{" "}
                  {h.manaCycles} {manaCyclesUnit}
                </li>
              ))}
            </ul>
          </section>
        )}

        {showResonateCTA && onResonate && (
          <section className="border-border/50 border-t pt-4 space-y-3">
            {isSubmitting ? (
              <p className="text-sm text-primary font-medium">
                {visionSproutingMessage}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="vision-title"
                    className="text-sm font-medium text-foreground block"
                  >
                    {visionTitleLabel}
                  </label>
                  <input
                    id="vision-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={visionTitlePlaceholder}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label={visionTitleLabel}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleResonate}
                  disabled={!title.trim() || isSubmitting}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {resonateButtonLabel}
                </button>
              </>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
