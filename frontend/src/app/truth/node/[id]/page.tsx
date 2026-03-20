import { notFound } from "next/navigation";
import { getTruthNodeWithEdges } from "@/app/actions/truthWeaver";
import { EndlessDiveSpace } from "@/components/truth/EndlessDiveSpace";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Endless Dive — Perceptually Responsive Miller Columns.
 * Desktop: Logical Panorama (fixed ~450px columns). Mobile: Sliding Deck (90vw + 10% peek).
 * Initial column is server-fed; deeper columns load via getTruthNodeWithEdges.
 */
export default async function TruthNodePage({ params }: PageProps) {
  const { id } = await params;

  const result = await getTruthNodeWithEdges(id);

  if (!result.success) {
    notFound();
  }

  const initialData = {
    node: result.node,
    edges: result.edges,
    lineage: result.lineage,
    hasNewerVersion: result.hasNewerVersion,
  };

  return <EndlessDiveSpace initialNodeId={id} initialNodeData={initialData} />;
}
