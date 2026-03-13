import { fetchMacroRoots } from "@/app/actions/truthTraversal";
import { TruthHub } from "@/components/truth/TruthHub";

/**
 * Truth Engine hub: weaver input + portals to macro roots only (Gates of the Weave).
 * Sub-claims stay in the Dive; the main square shows only theses and standalone premises.
 */
export default async function TruthPage() {
  const macroRoots = await fetchMacroRoots();
  return <TruthHub macroRoots={macroRoots} />;
}
