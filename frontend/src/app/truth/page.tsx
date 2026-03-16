import { fetchMacroRoots } from "@/app/actions/truthTraversal";
import { TruthArenaLobby } from "@/components/truth/TruthArenaLobby";

const HEADING = "מרחב האמת";
const SUBTITLE =
  "זירת הגיון טהורה — ללא פנייה לסמכות, ללא צנזורה. בחרו זירת דיון והעמיקו במבנה הטענות.";

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
        <header className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] leading-tight">
            {HEADING}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {SUBTITLE}
          </p>
        </header>

        <TruthArenaLobby arenas={arenas} />
      </div>
    </main>
  );
}
