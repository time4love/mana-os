import { notFound } from "next/navigation";
import { fetchTruthNodeWithRelations } from "@/app/actions/truthTraversal";
import { TruthNodeViewport } from "@/components/truth/TruthNodeViewport";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Endless Dive — focal node view. One node per URL; children are links to their own node pages.
 * ?theory=THEORY_A | THEORY_B shows Level 1 (Theory Dive) for macro-arenas.
 */
export default async function TruthNodePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const theoryParam = resolvedSearchParams?.theory;
  const currentTheory =
    typeof theoryParam === "string" && (theoryParam === "THEORY_A" || theoryParam === "THEORY_B")
      ? theoryParam
      : undefined;

  const result = await fetchTruthNodeWithRelations(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <TruthNodeViewport data={result.data} currentTheory={currentTheory} />;
}
