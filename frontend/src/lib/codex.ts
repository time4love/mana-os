/**
 * Living Codex — chapter IDs and content types.
 * Use these IDs when opening the Codex sheet from functional UI.
 */

export type CodexChapterId =
  | "genesis-resonance"
  | "soul-contract-seasons"
  | "what-is-mana";

export interface CodexChapter {
  title: string;
  body: string;
}

export type CodexContent = Record<CodexChapterId, CodexChapter>;
