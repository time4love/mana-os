/**
 * Reads project-root documentation for a given locale and concatenates it into a single context string
 * for all Oracles (Architect, Initial Planner, Village Elder, Genesis). Philosophy is paramount:
 * PHILOSOPHY.[locale].md is always read first and is the canonical source for the 12 Pillars and core
 * laws (UBA, Attraction-Based Resonance, Dynamic Soul Contracts, Restorative Justice, etc.).
 * README and PROJECT_ROADMAP are then appended when present to give full system awareness.
 */

import fs from "node:fs";
import path from "node:path";

export type DocsLocale = "en" | "he";

const PHILOSOPHY_FILE: Record<DocsLocale, string> = {
  en: "PHILOSOPHY.en.md",
  he: "PHILOSOPHY.he.md",
};

const DOC_FILES: Record<DocsLocale, readonly [string, string, string]> = {
  en: ["README.en.md", "PROJECT_ROADMAP.en.md", "cursorrules.en.md"],
  he: ["README.he.md", "PROJECT_ROADMAP.he.md", "cursorrules.he.md"],
};

const SEPARATOR = "\n\n---\n\n";

/**
 * Resolves the project root (monorepo root where README*.md live).
 * Tries cwd (e.g. when running from repo root) then cwd/.. (when running from frontend/).
 */
function resolveProjectRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, "..")];
  for (const base of candidates) {
    const readmeEn = path.join(base, "README.en.md");
    try {
      if (fs.existsSync(readmeEn)) return base;
    } catch {
      // ignore
    }
  }
  return cwd;
}

/**
 * Synchronously reads PHILOSOPHY.[locale].md first (paramount), then README and PROJECT_ROADMAP
 * from the project root, and concatenates them into one string. Used to inject full system
 * philosophy into all Oracles so they filter advice through the Healing OS core laws.
 * @param locale - 'en' or 'he'
 * @returns Concatenated doc content (philosophy first), or a fallback message if files are missing
 */
export function getSystemDocsContext(locale: DocsLocale): string {
  const root = resolveProjectRoot();
  const philosophyFile = PHILOSOPHY_FILE[locale];
  const docFiles = DOC_FILES[locale];
  const parts: string[] = [];

  // Load PHILOSOPHY first so the Oracle has canonical paradigm context (Fractal Economy, Harmonic Time, etc.)
  const philosophyPath = path.join(root, philosophyFile);
  try {
    const philosophyContent = fs.readFileSync(philosophyPath, "utf-8");
    parts.push(`## ${philosophyFile}\n\n${philosophyContent}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    parts.push(`## ${philosophyFile}\n\n[Could not read: ${philosophyPath} — ${message}]`);
  }

  for (const file of docFiles) {
    const filePath = path.join(root, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      parts.push(`## ${file}\n\n${content}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parts.push(`## ${file}\n\n[Could not read: ${filePath} — ${message}]`);
    }
  }

  if (parts.length === 0) {
    return "[No system documentation could be loaded. Check that PHILOSOPHY.en.md, README.en.md, PROJECT_ROADMAP.en.md, and cursorrules.en.md exist at the project root.]";
  }

  return parts.join(SEPARATOR);
}
