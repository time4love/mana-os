"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProposalResourcePlan } from "@/lib/oracle/schema";

interface ManaResourcePlanCardProps {
  plan: ProposalResourcePlan;
  resultTitle: string;
  naturalResourcesLabel: string;
  humanCapitalLabel: string;
}

export function ManaResourcePlanCard({
  plan,
  resultTitle,
  naturalResourcesLabel,
  humanCapitalLabel,
}: ManaResourcePlanCardProps) {
  return (
    <Card className="border-emerald-800/50 bg-neutral-900/80">
      <CardHeader>
        <CardTitle className="text-base font-medium text-neutral-200">
          {resultTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.naturalResources.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-neutral-400 mb-2">
              {naturalResourcesLabel}
            </h3>
            <ul className="list-none space-y-1 text-sm text-neutral-300">
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
            <h3 className="text-sm font-medium text-neutral-400 mb-2">
              {humanCapitalLabel}
            </h3>
            <ul className="list-none space-y-1 text-sm text-neutral-300">
              {plan.humanCapital.map((h, i) => (
                <li key={i}>
                  {h.requiredSkillCategory} (Level {h.requiredLevel}):{" "}
                  {h.estimatedHours}h
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
