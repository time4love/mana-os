import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createServerSupabase } from "@/lib/supabase/server";
import { OracleSynthesisOutputSchema } from "@/lib/oracle/schema";

const SYNTHESIS_SYSTEM = `You are the Oracle of Mana OS synthesizing community wisdom. You act as the Village Elder.

You will receive:
1. The original proposal (title, description, and its current resource plan with naturalResources and humanCapital).
2. A list of merged Upgrade Seeds — improvements the community has resonated with and that are now part of the vision.

Your task:
1. Output an UPDATED ProposalResourcePlan (JSON) that recalculates the Mana Cycles and Natural Resources needed to include these community upgrades. Integrate the merged seeds into the plan; do not duplicate items. Use the same structure: naturalResources (resourceName, quantity, unit) and humanCapital (requiredSkillCategory, requiredLevel, manaCycles). Level 0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor.
2. Provide a short "Socratic Insight" (תבוננות) in 1–3 sentences reflecting on the beauty of how the community organically evolved the idea. Write in the same language as the proposal (Hebrew or English). No matrix vocabulary (no hours, budget, cost, task, deadline). Speak to resonance and collective wisdom.`;

function getModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const modelId = process.env.OPENAI_ORACLE_MODEL ?? "gpt-4o-mini";
  return createOpenAI({ apiKey: key })(modelId);
}

export type RunSynthesisResult =
  | { success: true; socraticInsight: string }
  | { success: false; error: string };

/**
 * Runs the Oracle synthesis: fetches proposal + merged upgrades, generates updated plan and insight, updates DB.
 * Triggered automatically when an upgrade seed reaches merge threshold in resonateWithUpgrade.
 */
export async function runOracleSynthesis(
  proposalId: string
): Promise<RunSynthesisResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: "OPENAI_API_KEY is not configured" };
  }

  const model = getModel();
  if (!model) {
    return { success: false, error: "OpenAI model not available" };
  }

  const supabase = createServerSupabase();

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id, title, description, resource_plan")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return { success: false, error: "Proposal not found" };
  }

  const { data: upgrades, error: upgradesError } = await supabase
    .from("proposal_upgrades")
    .select("id, suggested_upgrade, status")
    .eq("proposal_id", proposalId)
    .eq("status", "merged")
    .order("created_at", { ascending: true });

  if (upgradesError) {
    return { success: false, error: "Failed to load upgrade seeds" };
  }

  const mergedSeeds = (upgrades ?? []).map((u) => u.suggested_upgrade);
  if (mergedSeeds.length === 0) {
    return { success: false, error: "No merged upgrade seeds to synthesize" };
  }

  const prompt = `Original proposal:
Title: ${proposal.title}
Description: ${proposal.description}
Current resource plan: ${JSON.stringify(proposal.resource_plan ?? {}, null, 2)}

Merged community upgrade seeds (integrate these into the updated plan):
${mergedSeeds.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Output the updated ProposalResourcePlan and your short Socratic Insight (תבוננות).`;

  try {
    const { object } = await generateObject({
      model,
      schema: OracleSynthesisOutputSchema,
      schemaName: "OracleSynthesisOutput",
      schemaDescription: "Updated resource plan and Socratic insight after weaving community wisdom",
      prompt,
      system: SYNTHESIS_SYSTEM,
    });

    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        resource_plan: object.updatedPlan as unknown as Record<string, unknown>,
        oracle_insight: object.socraticInsight,
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("[Oracle Synthesis] update proposal", updateError);
      return { success: false, error: "Failed to save synthesis" };
    }

    return { success: true, socraticInsight: object.socraticInsight };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Oracle Synthesis]", err);
    return { success: false, error: message };
  }
}
