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
    const issues = "issues" in parsed.error ? parsed.error.issues : (parsed.error as { errors?: { message: string }[] }).errors ?? [];
    const msg = (issues as { message: string }[]).map((e) => e.message).join("; ");
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
    const rpcArgs = {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
    };
    const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", rpcArgs as never);
    const matchList = matches as { id: string; content: string; similarity: number }[] | null;

    if (!rpcError && Array.isArray(matchList) && matchList.length > 0) {
      const typed: MatchTruthNodeResult[] = matchList.map((m) => ({
        id: m.id,
        content: m.content,
        similarity: Number(m.similarity),
      }));
      return { status: "resonance_found", matches: typed };
    }
  }

  const nodePayload = {
    author_wallet: wallet.toLowerCase(),
    content: trimmedContent,
    embedding,
    is_macro_root: !parent,
  };
  const { data: newNodeData, error: insertNodeError } = await supabase
    .from("truth_nodes")
    .insert(nodePayload as never)
    .select("id")
    .single();

  const newNode = newNodeData as { id: string } | null;
  if (insertNodeError || !newNode?.id) {
    return {
      status: "error",
      error: insertNodeError?.message ?? "Failed to create truth node",
    };
  }

  if (parent && rel) {
    const { error: edgeError } = await supabase.from("truth_edges").insert({
      source_id: parent,
      target_id: newNode!.id,
      relationship: rel,
    } as never);
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
        error: (("issues" in parsed.error ? parsed.error.issues : []) as { message: string }[]).map((e) => e.message).join("; "),
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

    const nodePayload = {
      author_wallet: parsed.data.authorWallet.toLowerCase(),
      content: parsed.data.targetContent,
      embedding,
      is_macro_root: false,
    };
    const { data: newNodeData, error: insertNodeError } = await supabase
      .from("truth_nodes")
      .insert(nodePayload as never)
      .select("id")
      .single();

    const newNode = newNodeData as { id: string } | null;
    if (insertNodeError || !newNode?.id) {
      return {
        success: false,
        error: insertNodeError?.message ?? "Failed to create truth node",
      };
    }

    const edgePayload = {
      source_id: parsed.data.sourceId,
      target_id: newNode.id,
      relationship: parsed.data.relationship as EdgeRelationship,
    };
    const { data: newEdgeData, error: edgeError } = await supabase
      .from("truth_edges")
      .insert(edgePayload as never)
      .select("id")
      .single();

    const newEdge = newEdgeData as { id: string } | null;
    if (edgeError || !newEdge?.id) {
      return {
        success: false,
        error: edgeError?.message ?? "Failed to create edge",
      };
    }

    return { success: true, edgeId: newEdge!.id };
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
        error: (("issues" in parsed.error ? parsed.error.issues : []) as { message: string }[]).map((e) => e.message).join("; "),
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

    const thesisPayload = {
      author_wallet: wallet,
      content: parsed.data.documentThesis,
      embedding: thesisEmbedding,
      is_macro_root: true,
    };
    const { data: thesisRowData, error: thesisError } = await supabase
      .from("truth_nodes")
      .insert(thesisPayload as never)
      .select("id")
      .single();

    const thesisRow = thesisRowData as { id: string } | null;
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

        const claimPayload = {
          author_wallet: wallet,
          content: claimContent,
          embedding: claimEmbedding,
          is_macro_root: false,
        };
        const { data: claimRowData, error: claimError } = await supabase
          .from("truth_nodes")
          .insert(claimPayload as never)
          .select("id")
          .single();

        const claimRow = claimRowData as { id: string } | null;
        if (claimError || !claimRow?.id) continue;

        await supabase.from("truth_edges").insert({
          source_id: thesisId,
          target_id: claimRow.id,
          relationship: "ai_analysis",
        } as never);
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
        error: (("issues" in parsed.error ? parsed.error.issues : []) as { message: string }[]).map((e) => e.message).join("; "),
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

    const thesisPayload = {
      author_wallet: wallet,
      content: parsed.data.documentThesis,
      embedding: thesisEmbedding,
      is_macro_root: true,
    };
    const { data: thesisRowData, error: thesisError } = await supabase
      .from("truth_nodes")
      .insert(thesisPayload as never)
      .select("id")
      .single();

    const thesisRow = thesisRowData as { id: string } | null;
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

        const claimPayload = {
          author_wallet: wallet,
          content,
          embedding: claimEmbedding,
          is_macro_root: false,
        };
        const { data: claimRowData, error: claimError } = await supabase
          .from("truth_nodes")
          .insert(claimPayload as never)
          .select("id")
          .single();

        const claimRow = claimRowData as { id: string } | null;
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
      const { error: edgesError } = await supabase.from("truth_edges").insert(edges as never);
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

// ---------------------------------------------------------------------------
// Epistemic Forge — single draft anchor (from Socratic chat)
// ---------------------------------------------------------------------------

const ForgeDraftSchema = z.object({
  assertion: z.string().min(1),
  logicalCoherenceScore: z.number().min(0).max(100),
  reasoning: z.string(),
  hiddenAssumptions: z.array(z.string()),
  challengePrompt: z.string(),
});

export type AnchorForgeDraftResult =
  | { success: true; nodeId: string }
  | { success: false; code: "semantic_resonance"; duplicates: MatchTruthNodeResult[] }
  | { success: false; error: string };

const FORGE_MATCH_THRESHOLD = 0.88;
const FORGE_MATCH_COUNT = 3;

/**
 * Anchors a single Epistemic Forge draft to the graph: one node (formatted content),
 * optionally linked to a parent. Used when the user approves the draft from the Forge chat.
 * Runs semantic deduplication on draft.assertion; if near-duplicate nodes exist and
 * forceBypass is not true, returns semantic_resonance with duplicates instead of inserting.
 */
export async function anchorForgeDraft(
  draft: z.infer<typeof ForgeDraftSchema>,
  authorWallet: string,
  parentId?: string,
  relationship?: EdgeRelationship,
  forceBypass?: boolean
): Promise<AnchorForgeDraftResult> {
  try {
    const parsed = ForgeDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const issues = "issues" in parsed.error ? parsed.error.issues : [];
      return { success: false, error: (issues as { message: string }[]).map((e) => e.message).join("; ") };
    }

    const wallet = authorWallet?.trim().toLowerCase();
    if (!/^0x[a-fa-f0-9]{40}$/.test(wallet)) {
      return { success: false, error: "Invalid wallet address" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { success: false, error: "OpenAI API key not configured" };

    const openai = createOpenAI({ apiKey });
    const embeddingModel = openai.embeddingModel("text-embedding-3-small");
    const supabase = createServerSupabase();

    // 1. Embed the assertion text for semantic deduplication (canonical truth matching)
    const assertionEmbedResult = await embed({
      model: embeddingModel,
      value: parsed.data.assertion.trim().slice(0, 8000),
    });
    const assertionEmbedding = Array.from(assertionEmbedResult.embedding);

    if (!forceBypass) {
      const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
        query_embedding: assertionEmbedding,
        match_threshold: FORGE_MATCH_THRESHOLD,
        match_count: FORGE_MATCH_COUNT,
      } as never);
      const matchList = matches as { id: string; content: string; similarity: number }[] | null;

      if (!rpcError && Array.isArray(matchList) && matchList.length > 0) {
        const duplicates: MatchTruthNodeResult[] = matchList.map((m) => ({
          id: m.id,
          content: m.content,
          similarity: Number(m.similarity),
        }));
        return { success: false, code: "semantic_resonance", duplicates };
      }
    }

    // 2. No duplicate gate: build full content and storage embedding, then insert
    const content = formatClaimContent(parsed.data);
    const embedResult = await embed({
      model: embeddingModel,
      value: content.slice(0, 8000),
    });
    const embedding = Array.from(embedResult.embedding);

    const nodePayload = {
      author_wallet: wallet,
      content,
      embedding,
      is_macro_root: !parentId,
    };
    const { data: rowData, error: insertError } = await supabase
      .from("truth_nodes")
      .insert(nodePayload as never)
      .select("id")
      .single();

    const row = rowData as { id: string } | null;
    if (insertError || !row?.id) {
      return { success: false, error: insertError?.message ?? "Failed to create node" };
    }

    if (parentId && relationship) {
      const { error: edgeError } = await supabase.from("truth_edges").insert({
        source_id: parentId,
        target_id: row.id,
        relationship,
      } as never);
      if (edgeError) {
        return { success: false, error: `Node created but edge failed: ${edgeError.message}` };
      }
    }

    revalidatePath("/truth");
    return { success: true, nodeId: row.id };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "An error occurred" };
  }
}
