"use server";

import { revalidatePath } from "next/cache";
import { embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EdgeRelationship } from "@/types/truth";
import {
  isEdgeRelationship,
  type MatchTruthNodeResult,
  type EpistemicPrismResult,
} from "@/types/truth";

const MATCH_THRESHOLD = 0.85;
const MATCH_COUNT = 3;

const ProposeTruthNodeParamsSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  authorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  parentId: z.string().uuid().optional(),
  relationship: z
    .string()
    .refine((v) => isEdgeRelationship(v), "Invalid relationship")
    .optional(),
  forceBypass: z.boolean().optional().default(false),
});

export type ProposeTruthNodeResult =
  | { status: "resonance_found"; matches: MatchTruthNodeResult[] }
  | { status: "anchored"; nodeId: string }
  | { status: "error"; error: string };

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Proposes a truth node: generates embedding, runs semantic deduplication via
 * match_truth_nodes, and either returns existing matches or inserts the node (and optional edge).
 */
export async function proposeTruthNode(
  content: string,
  authorWallet: string,
  parentId?: string,
  relationship?: EdgeRelationship,
  forceBypass?: boolean
): Promise<ProposeTruthNodeResult> {
  try {
  const parsed = ProposeTruthNodeParamsSchema.safeParse({
    content: content?.trim(),
    authorWallet: authorWallet?.trim(),
    parentId: parentId?.trim() || undefined,
    relationship: relationship ?? undefined,
    forceBypass: forceBypass ?? false,
  });

  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ");
    return { status: "error", error: msg };
  }

  const { content: trimmedContent, authorWallet: wallet, parentId: parent, relationship: rel, forceBypass: bypass } = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "error", error: "OpenAI API key not configured" };
  }

  const openai = createOpenAI({ apiKey });
  const embeddingModel = openai.embeddingModel("text-embedding-3-small");

  let embedding: number[];
  try {
    const result = await embed({
      model: embeddingModel,
      value: trimmedContent,
    });
    embedding = Array.from(result.embedding);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed";
    return { status: "error", error: message };
  }

  const supabase = createServerSupabase();

  if (!bypass) {
    const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
    });

    if (!rpcError && Array.isArray(matches) && matches.length > 0) {
      const typed: MatchTruthNodeResult[] = matches.map((m: { id: string; content: string; similarity: number }) => ({
        id: m.id,
        content: m.content,
        similarity: Number(m.similarity),
      }));
      return { status: "resonance_found", matches: typed };
    }
  }

  const { data: newNode, error: insertNodeError } = await supabase
    .from("truth_nodes")
    .insert({
      author_wallet: wallet.toLowerCase(),
      content: trimmedContent,
      embedding,
      is_macro_root: !parent,
    })
    .select("id")
    .single();

  if (insertNodeError || !newNode?.id) {
    return {
      status: "error",
      error: insertNodeError?.message ?? "Failed to create truth node",
    };
  }

  if (parent && rel) {
    const { error: edgeError } = await supabase.from("truth_edges").insert({
      source_id: parent,
      target_id: newNode.id,
      relationship: rel,
    });
    if (edgeError) {
      return {
        status: "error",
        error: `Node created but edge failed: ${edgeError.message}`,
      };
    }
  }

  return { status: "anchored", nodeId: newNode.id };
  } catch (err) {
    return { status: "error", error: toErrorMessage(err) || "An error occurred" };
  }
}

/** Attach the current user's premise as an edge to an existing node (no new node). */
const AttachEdgeParamsSchema = z.object({
  sourceId: z.string().uuid(),
  targetContent: z.string().min(1).max(10000),
  authorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  relationship: z.string().refine((v) => isEdgeRelationship(v), "Invalid relationship"),
});

export type AttachTruthEdgeResult =
  | { success: true; edgeId: string }
  | { success: false; error: string };

/**
 * Creates a new node with the given content and links it as an edge to an existing node (source).
 * Used when the user chooses "Attach My Edge Here" on a resonance match.
 */
export async function attachTruthEdge(
  sourceId: string,
  targetContent: string,
  authorWallet: string,
  relationship: EdgeRelationship
): Promise<AttachTruthEdgeResult> {
  try {
    const parsed = AttachEdgeParamsSchema.safeParse({
      sourceId,
      targetContent: targetContent?.trim(),
      authorWallet: authorWallet?.trim(),
      relationship,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OpenAI API key not configured" };
    }

    const openai = createOpenAI({ apiKey });
    const embeddingModel = openai.embeddingModel("text-embedding-3-small");

    let embedding: number[];
    const result = await embed({
      model: embeddingModel,
      value: parsed.data.targetContent,
    });
    embedding = Array.from(result.embedding);

    const supabase = createServerSupabase();

    const { data: newNode, error: insertNodeError } = await supabase
      .from("truth_nodes")
      .insert({
        author_wallet: parsed.data.authorWallet.toLowerCase(),
        content: parsed.data.targetContent,
        embedding,
        is_macro_root: false,
      })
      .select("id")
      .single();

    if (insertNodeError || !newNode?.id) {
      return {
        success: false,
        error: insertNodeError?.message ?? "Failed to create truth node",
      };
    }

    const { data: newEdge, error: edgeError } = await supabase
      .from("truth_edges")
      .insert({
        source_id: parsed.data.sourceId,
        target_id: newNode.id,
        relationship: parsed.data.relationship as EdgeRelationship,
      })
      .select("id")
      .single();

    if (edgeError || !newEdge?.id) {
      return {
        success: false,
        error: edgeError?.message ?? "Failed to create edge",
      };
    }

    return { success: true, edgeId: newEdge.id };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "An error occurred" };
  }
}

// ---------------------------------------------------------------------------
// Epistemic Prism → Graph anchoring
// ---------------------------------------------------------------------------

const AnchorPrismParamsSchema = z.object({
  authorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  documentThesis: z.string().min(1).max(50000),
  extractedClaims: z.array(
    z.object({
      assertion: z.string(),
      logicalCoherenceScore: z.number(),
      reasoning: z.string(),
      hiddenAssumptions: z.array(z.string()),
      challengePrompt: z.string(),
    })
  ).max(50),
});

export type AnchorPrismResult =
  | { success: true; thesisNodeId: string; claimsAnchored: number }
  | { success: false; error: string };

/**
 * Anchors an Epistemic Prism result to the Truth DAG: one parent node (thesis)
 * and one child node per extracted claim, with ai_analysis edges.
 */
export async function anchorPrismToGraph(
  authorWallet: string,
  documentThesis: string,
  extractedClaims: Array<{
    assertion: string;
    logicalCoherenceScore: number;
    reasoning: string;
    hiddenAssumptions: string[];
    challengePrompt: string;
  }>
): Promise<AnchorPrismResult> {
  try {
    const parsed = AnchorPrismParamsSchema.safeParse({
      authorWallet: authorWallet?.trim(),
      documentThesis: documentThesis?.trim(),
      extractedClaims: extractedClaims ?? [],
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OpenAI API key not configured" };
    }

    const openai = createOpenAI({ apiKey });
    const embeddingModel = openai.embeddingModel("text-embedding-3-small");
    const supabase = createServerSupabase();
    const wallet = parsed.data.authorWallet.toLowerCase();

    let thesisId: string;

    const thesisEmbedResult = await embed({
      model: embeddingModel,
      value: parsed.data.documentThesis,
    });
    const thesisEmbedding = Array.from(thesisEmbedResult.embedding);

    const { data: thesisRow, error: thesisError } = await supabase
      .from("truth_nodes")
      .insert({
        author_wallet: wallet,
        content: parsed.data.documentThesis,
        embedding: thesisEmbedding,
        is_macro_root: true,
      })
      .select("id")
      .single();

    if (thesisError || !thesisRow?.id) {
      return {
        success: false,
        error: thesisError?.message ?? "Failed to create thesis node",
      };
    }
    thesisId = thesisRow.id;

    let claimsAnchored = 0;
    for (const claim of parsed.data.extractedClaims) {
      const claimContent = `${claim.assertion}\n[Score: ${claim.logicalCoherenceScore}] ${claim.reasoning}`;
      try {
        const claimEmbedResult = await embed({
          model: embeddingModel,
          value: claimContent.slice(0, 8000),
        });
        const claimEmbedding = Array.from(claimEmbedResult.embedding);

        const { data: claimRow, error: claimError } = await supabase
          .from("truth_nodes")
          .insert({
            author_wallet: wallet,
            content: claimContent,
            embedding: claimEmbedding,
            is_macro_root: false,
          })
          .select("id")
          .single();

        if (claimError || !claimRow?.id) continue;

        await supabase.from("truth_edges").insert({
          source_id: thesisId,
          target_id: claimRow.id,
          relationship: "ai_analysis",
        });
        claimsAnchored += 1;
      } catch {
        // Skip this claim on embed/insert failure
      }
    }

    return {
      success: true,
      thesisNodeId: thesisId,
      claimsAnchored,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "An error occurred" };
  }
}

// ---------------------------------------------------------------------------
// Bulk DAG injector — Prism draft → thesis node + claim nodes + supports edges
// ---------------------------------------------------------------------------

const AnchorPrismDraftSchema = z.object({
  authorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  documentThesis: z.string().min(1).max(50000),
  extractedClaims: z.array(
    z.object({
      assertion: z.string(),
      logicalCoherenceScore: z.number(),
      reasoning: z.string(),
      hiddenAssumptions: z.array(z.string()),
      challengePrompt: z.string(),
    })
  ).max(50),
});

/** Formats a single claim for storage in truth_nodes (Logician + Scout). */
function formatClaimContent(claim: {
  assertion: string;
  logicalCoherenceScore: number;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
}): string {
  const assumptions = claim.hiddenAssumptions?.length
    ? claim.hiddenAssumptions.join(", ")
    : "—";
  return `Content: ${claim.assertion}\n\n[Logician's Pulse: ${claim.logicalCoherenceScore}/100]\nRationale: ${claim.reasoning}\n\n[The Scout's Edge] Hidden Assumptions: ${assumptions}\nFalsification Prompt: ${claim.challengePrompt}`;
}

/**
 * Saves a full Epistemic Prism draft to the DAG: thesis as root node, each claim
 * as a child node, and bulk edges with relationship "supports".
 */
export async function anchorPrismDraft(
  prismResult: EpistemicPrismResult,
  authorWallet: string
): Promise<AnchorPrismResult> {
  try {
    const parsed = AnchorPrismDraftSchema.safeParse({
      authorWallet: authorWallet?.trim(),
      documentThesis: prismResult?.documentThesis?.trim() ?? "",
      extractedClaims: prismResult?.extractedClaims ?? [],
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join("; "),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OpenAI API key not configured" };
    }

    const openai = createOpenAI({ apiKey });
    const embeddingModel = openai.embeddingModel("text-embedding-3-small");
    const supabase = createServerSupabase();
    const wallet = parsed.data.authorWallet.toLowerCase();

    // Step A: Insert thesis node with embedding
    let thesisEmbedding: number[];
    try {
      const thesisEmbedResult = await embed({
        model: embeddingModel,
        value: parsed.data.documentThesis,
      });
      thesisEmbedding = Array.from(thesisEmbedResult.embedding);
    } catch (err) {
      return { success: false, error: toErrorMessage(err) || "Thesis embedding failed" };
    }

    const { data: thesisRow, error: thesisError } = await supabase
      .from("truth_nodes")
      .insert({
        author_wallet: wallet,
        content: parsed.data.documentThesis,
        embedding: thesisEmbedding,
        is_macro_root: true,
      })
      .select("id")
      .single();

    if (thesisError || !thesisRow?.id) {
      return {
        success: false,
        error: thesisError?.message ?? "Failed to create thesis node",
      };
    }
    const thesisNodeId = thesisRow.id;

    // Step B & C: Format each claim, embed, insert as child nodes, collect IDs
    const childIds: string[] = [];
    for (const claim of parsed.data.extractedClaims) {
      try {
        const content = formatClaimContent(claim);
        const claimEmbedResult = await embed({
          model: embeddingModel,
          value: content.slice(0, 8000),
        });
        const claimEmbedding = Array.from(claimEmbedResult.embedding);

        const { data: claimRow, error: claimError } = await supabase
          .from("truth_nodes")
          .insert({
            author_wallet: wallet,
            content,
            embedding: claimEmbedding,
            is_macro_root: false,
          })
          .select("id")
          .single();

        if (claimError || !claimRow?.id) continue;
        childIds.push(claimRow.id);
      } catch {
        // Skip this claim on embed/insert failure; continue with others
      }
    }

    // Step D: Bulk insert edges (thesis → each claim, relationship: supports)
    if (childIds.length > 0) {
      const edges = childIds.map((target_id) => ({
        source_id: thesisNodeId,
        target_id,
        relationship: "supports" as const,
      }));
      const { error: edgesError } = await supabase.from("truth_edges").insert(edges);
      if (edgesError) {
        return {
          success: false,
          error: `Nodes created but edges failed: ${edgesError.message}`,
        };
      }
    }

    revalidatePath("/truth");

    return {
      success: true,
      thesisNodeId,
      claimsAnchored: childIds.length,
    };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "An error occurred" };
  }
}
