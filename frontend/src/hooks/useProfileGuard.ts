"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { getProfileByWallet } from "@/app/actions/onboarding";

/**
 * When the user is connected but has no Supabase profile (or status is pending_genesis),
 * redirect to onboarding so they complete the Rite of Passage.
 * When not connected, no redirect (they see the landing/welcome state on home).
 */
export function useProfileGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || !address) {
      hasCheckedRef.current = false;
      return;
    }

    const validAddress: string = address;
    const isOnOnboarding = pathname?.startsWith("/onboarding");
    if (isOnOnboarding) return;

    let cancelled = false;

    async function checkAndRedirect() {
      const result = await getProfileByWallet(validAddress);
      if (cancelled) return;
      if (!result.success) return;
      const profile = result.profile;
      const needsOnboarding =
        !profile || profile.status === "pending_genesis";
      if (needsOnboarding) {
        router.push("/onboarding");
      }
    }

    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkAndRedirect();
    }

    return () => {
      cancelled = true;
    };
  }, [isConnected, address, pathname, router]);
}
