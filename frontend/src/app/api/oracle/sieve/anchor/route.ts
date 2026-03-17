/**
 * POST /api/oracle/sieve/anchor
 *
 * Anchors the Sieve harvest to the Arena: creates truth_nodes for each claim
 * and truth_edges from the arena to each node (supports / challenges / ai_analysis).
 * THEORY_A → supports, THEORY_B → challenges, NEUTRAL → ai_analysis.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SieveProcessedClaim, SieveSupportedTheory } from "@/types/truth";
import type { EdgeRelationship } from "@/types/truth";

const AnchorBodySchema = z.object({
  arenaId: z.string().uuid(),
  claims: z.array(
    z.object({
      assertionEn: z.string(),
      assertionHe: z.string(),
      logicalCoherenceScore: z.number().min(0).max(100),
      supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]),
      reasoning: z.string(),
      matchedExistingNodeId: z.string().nullable().optional(),
    })
  ).max(100),
  authorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

function supportedTheoryToRelationship(t: SieveSupportedTheory): EdgeRelationship {
  switch (t) {
    case "THEORY_A":
      return "supports";
    case "THEORY_B":
      return "challenges";
    default:
      return "ai_analysis";
  }
}

/** Builds Rosetta content JSON for a Sieve claim (no Scout fields). */
function buildSieveClaimRosettaContent(claim: SieveProcessedClaim): string {
  const rosetta = {
    pulse: claim.logicalCoherenceScore,
    en: {
      assertion: claim.assertionEn.trim().slice(0, 8000),
      reasoning: claim.reasoning.trim().slice(0, 2000),
      hiddenAssumptions: [] as string[],
      challengePrompt: "",
    },
    he: {
      assertion: (claim.assertionHe || claim.assertionEn).trim().slice(0, 8000),
      reasoning: claim.reasoning.trim().slice(0, 2000),
      hiddenAssumptions: [] as string[],
      challengePrompt: "",
    },
  };
  return JSON.stringify(rosetta);
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnchorBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { arenaId, claims, authorWallet } = parsed.data;
  const wallet = authorWallet.trim().toLowerCase();

  // Only anchor claims that are not already in the weave (Scout deduplication)
  const claimsToInsert = claims.filter((c) => !c.matchedExistingNodeId);

  if (claimsToInsert.length === 0) {
    return NextResponse.json(
      { error: "No claims to anchor", anchoredCount: 0, nodeIds: [] },
      { status: 200 }
    );
  }

  const supabase = createServerSupabase();
  const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
  const createdIds: string[] = [];
  const edges: { source_id: string; target_id: string; relationship: EdgeRelationship }[] = [];

  for (const claim of claimsToInsert) {
    try {
      const content = buildSieveClaimRosettaContent(claim);
      const embedResult = await embed({
        model: embeddingModel,
        value: claim.assertionEn.trim().slice(0, 8000),
        providerOptions: { google: { outputDimensionality: 768 } },
      });
      const embedding = Array.from(embedResult.embedding);

      const { data: rowData, error: insertError } = await supabase
        .from("truth_nodes")
        .insert({
          author_wallet: wallet,
          content,
          embedding,
          is_macro_root: false,
        } as never)
        .select("id")
        .single();

      const row = rowData as { id: string } | null;
      if (insertError || !row?.id) continue;

      createdIds.push(row.id);
      edges.push({
        source_id: arenaId,
        target_id: row.id,
        relationship: supportedTheoryToRelationship(claim.supportedTheory),
      });
    } catch {
      // Skip this claim on failure
    }
  }

  if (edges.length > 0) {
    const { error: edgeError } = await supabase
      .from("truth_edges")
      .insert(edges as never);
    if (edgeError) {
      return NextResponse.json(
        { error: "Nodes created but edges failed", detail: edgeError.message },
        { status: 500 }
      );
    }
  }

  revalidatePath("/truth");
  revalidatePath(`/truth/node/${arenaId}`);

  return NextResponse.json({
    success: true,
    anchoredCount: createdIds.length,
    nodeIds: createdIds,
  });
}
