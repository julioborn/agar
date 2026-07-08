function Sk({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-100 ${className}`} />;
}

export default function RiaLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sk className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Sk className="h-6 w-52" />
            <Sk className="h-3.5 w-36" />
          </div>
        </div>
        <Sk className="h-9 w-28 rounded-xl" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <Sk className="w-2.5 h-2.5 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Sk className="h-5 w-14" />
              <Sk className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Sk className="h-8 w-20 rounded-xl" />
          <Sk className="h-8 flex-1 rounded-xl" />
          <Sk className="h-8 w-24 rounded-xl" />
          <Sk className="h-8 w-24 rounded-xl" />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm divide-y divide-zinc-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-5 h-5 shrink-0">
              <Sk className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sk className="h-4 w-20" />
                <Sk className="h-5 w-20 rounded-full" />
              </div>
              <Sk className="h-3 w-40" />
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <Sk className="h-4 w-16" />
              <Sk className="h-4 w-20" />
              <Sk className="h-5 w-24" />
            </div>
            <Sk className="w-4 h-4 ml-2 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
