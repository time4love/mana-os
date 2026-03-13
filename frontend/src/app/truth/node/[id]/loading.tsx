export default function TruthNodeLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 md:px-8 flex items-center justify-center">
      <div className="rounded-xl border border-border bg-card/80 shadow-soft w-full max-w-2xl p-8">
        <div className="flex flex-col gap-4">
          <div className="h-4 max-w-[75%] rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
          <div className="h-4 max-w-[83%] rounded-full bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
