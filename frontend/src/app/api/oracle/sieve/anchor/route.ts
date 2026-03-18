/**
 * POST /api/oracle/sieve/anchor — anchors Sieve harvest to Arena (Rosetta V2 JSON in content).
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SieveSupportedTheory } from "@/types/truth";
import type { EdgeRelationship } from "@/types/truth";
import { RosettaBlockSchema } from "@/lib/truth/rosettaSchemas";
import {
  embeddingTextFromCanonical,
  truthNodeContentV2ToJson,
  fixRosettaV2BlockFlip,
} from "@/lib/utils/truthRosetta";

const AnchorBodySchema = z.object({
  arenaId: z.string().uuid(),
  claims: z
    .array(
      z.object({
        canonical_en: RosettaBlockSchema,
        source_locale: z.string(),
        local_translation: RosettaBlockSchema.optional(),
        logicalCoherenceScore: z.number().min(0).max(100),
        supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]),
        matchedExistingNodeId: z.string().nullable().optional(),
      })
    )
    .max(100),
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

type SieveAnchorClaim = z.infer<typeof AnchorBodySchema>["claims"][number];

function buildSieveClaimContent(claim: SieveAnchorClaim): string {
  const sl = claim.source_locale.trim().toLowerCase();
  return truthNodeContentV2ToJson({
    canonical_en: claim.canonical_en,
    source_locale: claim.source_locale,
    locales: claim.local_translation ? { [sl]: claim.local_translation } : {},
    pulse: claim.logicalCoherenceScore,
  });
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

  for (const raw of claimsToInsert) {
    try {
      const flipped = fixRosettaV2BlockFlip(raw.canonical_en, raw.local_translation);
      const claim = { ...raw, canonical_en: flipped.canonical_en, local_translation: flipped.local_translation };
      const content = buildSieveClaimContent(claim);
      const embedResult = await embed({
        model: embeddingModel,
        value: embeddingTextFromCanonical(claim.canonical_en).slice(0, 8000),
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
      /* skip */
    }
  }

  if (edges.length > 0) {
    const { error: edgeError } = await supabase.from("truth_edges").insert(edges as never);
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
