"use client";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

/**
 * Onboarding as a Rite of Passage (Phase 7).
 * Fluid, state-based steps with biomimicry animations.
 * No traditional forms; Concept Whispers for unfamiliar terms.
 * RTL-aware via useLocale and dir on container.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
