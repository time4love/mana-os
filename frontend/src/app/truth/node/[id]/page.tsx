import { notFound } from "next/navigation";
import { fetchTruthNodeWithRelations } from "@/app/actions/truthTraversal";
import { TruthNodeViewport } from "@/components/truth/TruthNodeViewport";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Endless Dive — focal node view. One node per URL; children are links to their own node pages.
 */
export default async function TruthNodePage({ params }: PageProps) {
  const { id } = await params;
  const result = await fetchTruthNodeWithRelations(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <TruthNodeViewport data={result.data} />;
}
