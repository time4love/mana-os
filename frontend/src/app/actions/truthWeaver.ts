"use server";

/**
 * All embeddings use Google gemini-embedding-001 with outputDimensionality: 768.
 * DB: run migration 014_google_embedding_768.sql so truth_nodes.embedding and match_truth_nodes use vector(768).
 */
import { revalidatePath } from "next/cache";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EdgeRelationship } from "@/types/truth";
import {
  isEdgeRelationship,
  type MatchTruthNodeResult,
  type EpistemicPrismResult,
} from "@/types/truth";
import { syncConstellationMap } from "@/lib/agents/TheCartographer";
import {
  parseForgeDraftForAnchor,
  type AnchorableForgeDraft,
} from "@/lib/truth/rosettaSchemas";
import {
  embeddingTextFromCanonical,
  truthNodeContentV2ToJson,
  fixDraftRosettaV2Flip,
} from "@/lib/utils/truthRosetta";
import type { CompetingTheoryV2 } from "@/types/truth";

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

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return { status: "error", error: "Google API key not configured" };
  }

  const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

  let embedding: number[];
  try {
    const result = await embed({
      model: embeddingModel,
      value: trimmedContent,
      providerOptions: { google: { outputDimensionality: 768 } },
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

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");

    let embedding: number[];
    const result = await embed({
      model: embeddingModel,
      value: parsed.data.targetContent,
      providerOptions: { google: { outputDimensionality: 768 } },
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

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
    const supabase = createServerSupabase();
    const wallet = parsed.data.authorWallet.toLowerCase();

    let thesisId: string;

    const thesisEmbedResult = await embed({
      model: embeddingModel,
      value: parsed.data.documentThesis,
      providerOptions: { google: { outputDimensionality: 768 } },
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
          providerOptions: { google: { outputDimensionality: 768 } },
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

function metadataFromForgeDraft(draft: AnchorableForgeDraft): { competingTheories?: CompetingTheoryV2[] } {
  if (!draft.competingTheories || draft.competingTheories.length !== 2) return {};
  const sl = draft.source_locale.trim().toLowerCase();
  return {
    competingTheories: draft.competingTheories.map((ct) => ({
      canonical_en: ct.canonical_en,
      source_locale: draft.source_locale,
      locales: ct.local_translation ? { [sl]: ct.local_translation } : {},
    })),
  };
}

/** Legacy Prism claim blob (single locale; no EN translation layer). */
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

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
    const supabase = createServerSupabase();
    const wallet = parsed.data.authorWallet.toLowerCase();

    // Step A: Insert thesis node with embedding
    let thesisEmbedding: number[];
    try {
      const thesisEmbedResult = await embed({
        model: embeddingModel,
        value: parsed.data.documentThesis,
        providerOptions: { google: { outputDimensionality: 768 } },
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

    const childIds: string[] = [];
    for (const claim of parsed.data.extractedClaims) {
      try {
        const content = formatClaimContent(claim);
        const claimEmbedResult = await embed({
          model: embeddingModel,
          value: content.slice(0, 8000),
          providerOptions: { google: { outputDimensionality: 768 } },
        });
        const claimEmbedding = Array.from(claimEmbedResult.embedding);
        const { data: claimRowData, error: claimError } = await supabase
          .from("truth_nodes")
          .insert({
            author_wallet: wallet,
            content,
            embedding: claimEmbedding,
            is_macro_root: false,
          } as never)
          .select("id")
          .single();
        const claimRow = claimRowData as { id: string } | null;
        if (!claimError && claimRow?.id) childIds.push(claimRow.id);
      } catch {
        /* skip failed claim */
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

export type AnchorForgeDraftResult =
  | { success: true; nodeId: string; writeTelemetry?: string[] }
  | { success: false; code: "semantic_resonance"; duplicates: MatchTruthNodeResult[]; writeTelemetry?: string[] }
  | { success: false; error: string; writeTelemetry?: string[] };

/** pgvector similarity threshold: > 0.85 triggers semantic_resonance (avoid duplicate canonical truths). */
const FORGE_MATCH_THRESHOLD = 0.85;
const FORGE_MATCH_COUNT = 3;

/**
 * Anchors a single Epistemic Forge draft to the graph: one node (formatted content),
 * optionally linked to a parent. Used when the user approves the draft from the Forge chat.
 * Runs semantic deduplication on canonical_en (Universal English embedding).
 */
export async function anchorForgeDraft(
  draft: AnchorableForgeDraft | Record<string, unknown>,
  authorWallet: string,
  parentId?: string,
  relationship?: EdgeRelationship,
  forceBypass?: boolean
): Promise<AnchorForgeDraftResult> {
  const writeTelemetry: string[] = [];

  try {
    const parsed = parseForgeDraftForAnchor(draft);
    if (!parsed.success) {
      const issues = "issues" in parsed.error ? parsed.error.issues : [];
      return { success: false, error: (issues as { message: string }[]).map((e) => e.message).join("; "), writeTelemetry };
    }

    const data = fixDraftRosettaV2Flip(parsed.data as AnchorableForgeDraft);

    const wallet = authorWallet?.trim().toLowerCase();
    if (!/^0x[a-fa-f0-9]{40}$/.test(wallet)) {
      return { success: false, error: "Invalid wallet address", writeTelemetry };
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      writeTelemetry.push("[CRITICAL] Google API key not configured.");
      return { success: false, error: "Google API key not configured", writeTelemetry };
    }

    const supabase = createServerSupabase();
    const embedSource = embeddingTextFromCanonical(data.canonical_en).slice(0, 8000);

    writeTelemetry.push(
      "[1] Started anchoring (canonical_en): " + embedSource.slice(0, 80) + (embedSource.length > 80 ? "…" : "")
    );
    writeTelemetry.push("[2] Requesting Google Vector Embedding (gemini-embedding-001, 768 dims)...");

    let embedding: number[];
    try {
      const embeddingModel = google.textEmbeddingModel("gemini-embedding-001");
      const assertionEmbedResult = await embed({
        model: embeddingModel,
        value: embedSource,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
      embedding = Array.from(assertionEmbedResult.embedding);
      writeTelemetry.push("[3] Embedding generated successfully (Dimensions: " + embedding.length + ")");
    } catch (embedErr) {
      const errMsg = embedErr instanceof Error ? embedErr.message : String(embedErr);
      writeTelemetry.push("[CRITICAL] Embedding Failed: " + errMsg);
      return { success: false, error: "Embedding failed: " + errMsg, writeTelemetry };
    }

    if (!forceBypass) {
      writeTelemetry.push("[4] Querying DB for semantic duplicates...");
      const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
        query_embedding: embedding,
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
        writeTelemetry.push("[4] Semantic resonance: " + matchList.length + " duplicate(s) found; anchoring halted.");
        return { success: false, code: "semantic_resonance", duplicates, writeTelemetry };
      }
    }

    const sl = data.source_locale.trim().toLowerCase();
    const content = truthNodeContentV2ToJson({
      canonical_en: data.canonical_en,
      source_locale: data.source_locale,
      locales: data.local_translation ? { [sl]: data.local_translation } : {},
      pulse: data.logicalCoherenceScore,
    });
    writeTelemetry.push("[4b] Rosetta Protocol V2 JSON stored (Rosetta failsafe applied).");
    const thematicTags = Array.isArray(data.thematicTags)
      ? data.thematicTags.slice(0, 10).filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    writeTelemetry.push("[5] Executing Supabase Insert...");
    const metadata = metadataFromForgeDraft(data);
    const nodePayload = {
      author_wallet: wallet,
      content,
      embedding,
      is_macro_root: !parentId,
      thematic_tags: thematicTags.length > 0 ? thematicTags : undefined,
      metadata,
    };
    const { data: rowData, error: insertError } = await supabase
      .from("truth_nodes")
      .insert(nodePayload as never)
      .select("id")
      .single();

    const row = rowData as { id: string } | null;
    if (insertError || !row?.id) {
      writeTelemetry.push("[5] Insert failed: " + (insertError?.message ?? "Unknown"));
      return { success: false, error: insertError?.message ?? "Failed to create node", writeTelemetry };
    }

    if (parentId && relationship) {
      const { error: edgeError } = await supabase.from("truth_edges").insert({
        source_id: parentId,
        target_id: row.id,
        relationship,
      } as never);
      if (edgeError) {
        return { success: false, error: `Node created but edge failed: ${edgeError.message}`, writeTelemetry };
      }
    }

    revalidatePath("/truth");

    if (thematicTags.length > 0) {
      for (const tag of thematicTags) {
        void syncConstellationMap(tag, content);
      }
    }

    writeTelemetry.push("[5] Insert succeeded. Node ID: " + row.id);
    return { success: true, nodeId: row.id, writeTelemetry };
  } catch (err) {
    writeTelemetry.push("[CRITICAL] " + toErrorMessage(err));
    return { success: false, error: toErrorMessage(err) || "An error occurred", writeTelemetry };
  }
}

/** Result of Epistemic Resonance toggle (Phase 10 Step 11). One wallet = one resonance per node. */
export type ToggleNodeResonanceResult =
  | { success: true; resonating: boolean }
  | { success: false; error: string };

/**
 * Toggles Epistemic Resonance for a truth node: add or remove this wallet's vote.
 * Uses truth_resonances junction table; one wallet can resonate at most once per node (Sybil resistance).
 * TODO: WEB3 VALIDATION — Verify userWallet holds ManaSkills SBT before allowing (Phase 10 Step 8).
 */
export async function toggleNodeResonance(
  nodeId: string,
  userWallet: string
): Promise<ToggleNodeResonanceResult> {
  try {
    if (!userWallet?.trim()) return { success: false, error: "No wallet connected" };
    const supabase = createServerSupabase();
    const address = userWallet.trim().toLowerCase();

    const { data: existing } = await supabase
      .from("truth_resonances")
      .select("node_id")
      .eq("node_id", nodeId)
      .eq("wallet_address", address)
      .maybeSingle();

    const { data: nodeRow } = await supabase
      .from("truth_nodes")
      .select("resonance_count")
      .eq("id", nodeId)
      .single();

    const nr = nodeRow as { resonance_count?: number } | null;
    const currentCount = typeof nr?.resonance_count === "number" ? nr.resonance_count : 0;

    if (existing) {
      const { error: delError } = await supabase
        .from("truth_resonances")
        .delete()
        .eq("node_id", nodeId)
        .eq("wallet_address", address);
      if (delError) return { success: false, error: delError.message };

      const { error: updateError } = await supabase
        .from("truth_nodes")
        .update({ resonance_count: Math.max(0, currentCount - 1) } as never)
        .eq("id", nodeId);
      if (updateError) return { success: false, error: updateError.message };
      revalidatePath("/truth");
      revalidatePath(`/truth/node/${nodeId}`);
      return { success: true, resonating: false };
    } else {
      const { error: insertError } = await supabase
        .from("truth_resonances")
        .insert({ node_id: nodeId, wallet_address: address } as never);
      if (insertError) return { success: false, error: insertError.message };

      const { error: updateError } = await supabase
        .from("truth_nodes")
        .update({ resonance_count: currentCount + 1 } as never)
        .eq("id", nodeId);
      if (updateError) return { success: false, error: updateError.message };
      revalidatePath("/truth");
      revalidatePath(`/truth/node/${nodeId}`);
      return { success: true, resonating: true };
    }
  } catch (err) {
    return { success: false, error: toErrorMessage(err) };
  }
}

/**
 * Returns whether the given wallet has resonated on the given node (for UI active state).
 */
export async function checkUserResonance(
  nodeId: string,
  userWallet: string
): Promise<boolean> {
  if (!userWallet?.trim()) return false;
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("truth_resonances")
    .select("node_id")
    .eq("node_id", nodeId)
    .eq("wallet_address", userWallet.trim().toLowerCase())
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// Endless Dive — dynamic column fetch (node + edges with embedded nodes)
// ---------------------------------------------------------------------------

export type TruthNodeWithEdgesResult =
  | { success: true; node: TruthNodeRow; edges: TruthEdgeWithNodes[] }
  | { success: false; error: string };

/** truth_nodes row shape for Endless Dive (no embedding in response). */
export interface TruthNodeRow {
  id: string;
  author_wallet: string | null;
  content: string;
  created_at: string;
  is_macro_root?: boolean;
  thematic_tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  resonance_count?: number | null;
}

/** truth_edges row with embedded source/target node rows for column rendering. */
export interface TruthEdgeWithNodes {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  source_node?: TruthNodeRow | null;
  target_node?: TruthNodeRow | null;
}

/** Payload for Endless Dive initial column (node + edges). */
export type EndlessDiveInitialData = {
  node: TruthNodeRow;
  edges: TruthEdgeWithNodes[];
};

/**
 * Fetches a single truth node and all edges touching it, with embedded source/target nodes.
 * Used by Endless Dive columns: children = edges where source_id === nodeId (target_node = child).
 */
export async function getTruthNodeWithEdges(nodeId: string): Promise<TruthNodeWithEdgesResult> {
  try {
    const supabase = createServerSupabase();

    const { data: node, error: nodeError } = await supabase
      .from("truth_nodes")
      .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags, metadata, resonance_count")
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      return { success: false, error: nodeError?.message ?? "Node not found" };
    }

    const { data: edgesRaw, error: edgesError } = await supabase
      .from("truth_edges")
      .select("id, source_id, target_id, relationship")
      .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`);

    if (edgesError) {
      return { success: true, node: node as TruthNodeRow, edges: [] };
    }

    const edgeList = (edgesRaw ?? []) as { id: string; source_id: string; target_id: string; relationship: string }[];
    const allNodeIds = new Set<string>();
    edgeList.forEach((e) => {
      allNodeIds.add(e.source_id);
      allNodeIds.add(e.target_id);
    });

    if (allNodeIds.size === 0) {
      return {
        success: true,
        node: node as TruthNodeRow,
        edges: edgeList.map((e) => ({ ...e, source_node: null, target_node: null })),
      };
    }

    const { data: nodeRows } = await supabase
      .from("truth_nodes")
      .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags, metadata, resonance_count")
      .in("id", Array.from(allNodeIds));

    const nodeMap = new Map<string, TruthNodeRow>();
    (nodeRows ?? []).forEach((row) => nodeMap.set((row as { id: string }).id, row as TruthNodeRow));

    const edges: TruthEdgeWithNodes[] = edgeList.map((e) => ({
      ...e,
      source_node: nodeMap.get(e.source_id) ?? null,
      target_node: nodeMap.get(e.target_id) ?? null,
    }));

    return { success: true, node: node as TruthNodeRow, edges };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "Failed to fetch node" };
  }
}
