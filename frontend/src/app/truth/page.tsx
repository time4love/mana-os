import { fetchMacroRoots } from "@/app/actions/truthTraversal";
import { TruthArenaLobby } from "@/components/truth/TruthArenaLobby";
import { TruthPageHeader } from "@/components/truth/TruthPageHeader";

/**
 * Truth Engine — Lobby of Epistemic Arenas (Phase 10 Step 2).
 * Server Component: fetches Root Nodes (macro roots / arenas) from the DB.
 * When empty, the lobby shows "No arenas yet. Initiate the first one."
 */
export default async function TruthPage() {
  const arenas = await fetchMacroRoots();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-4 py-12 sm:px-8 sm:py-16 md:px-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <TruthPageHeader />
        <TruthArenaLobby arenas={arenas} />
      </div>
    </main>
  );
}
