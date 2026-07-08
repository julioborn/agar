function Sk({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-100 ${className}`} />;
}

export default function CultivosLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sk className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Sk className="h-6 w-24" />
            <Sk className="h-3.5 w-40" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <Sk className="w-2.5 h-2.5 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Sk className="h-5 w-8" />
              <Sk className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Botón nuevo cultivo */}
      <Sk className="h-16 w-full rounded-2xl" />

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Sk className="h-8 w-20 rounded-xl" />
          <Sk className="h-8 flex-1 rounded-xl" />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-zinc-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sk className="h-4 w-32" />
                <Sk className="h-5 w-18 rounded-full" />
              </div>
              <Sk className="h-3 w-48" />
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Sk className="h-4 w-20" />
              <Sk className="h-4 w-16" />
            </div>
            <Sk className="w-4 h-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
