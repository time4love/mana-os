/**
 * Reads project-root documentation (README, Roadmap, Cursorrules) for a given locale
 * and concatenates them into a single context string for the Architect Oracle.
 * Used to give the AI full system philosophy and roadmap awareness.
 */

import fs from "node:fs";
import path from "node:path";

export type DocsLocale = "en" | "he";

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
 * Synchronously reads the content of the locale-specific .md docs from the project root
 * and concatenates them into one string. Used to inject full system context into the Architect Oracle.
 * @param locale - 'en' or 'he'
 * @returns Concatenated doc content, or a fallback message if files are missing
 */
export function getSystemDocsContext(locale: DocsLocale): string {
  const root = resolveProjectRoot();
  const files = DOC_FILES[locale];
  const parts: string[] = [];

  for (const file of files) {
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
    return "[No system documentation could be loaded. Check that README.en.md, PROJECT_ROADMAP.en.md, and cursorrules.en.md exist at the project root.]";
  }

  return parts.join(SEPARATOR);
}
