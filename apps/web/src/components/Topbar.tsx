'use client';

export function Topbar() {
  return (
    <header className="flex items-center gap-4 px-6 h-[64px] bg-white border-b border-slate-200 flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2.5 flex-1 max-w-[400px] bg-slate-50 border border-slate-200 rounded-lg px-3 h-[36px] group focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-50/50 transition-all">
        <span className="text-slate-400 text-base">🔍</span>
        <input
          type="text"
          placeholder="Search for orders, products, customers..."
          className="border-none bg-transparent outline-none text-[0.85rem] text-slate-700 w-full placeholder-slate-400 font-medium"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">System Live</span>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button className="relative w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all">
          🔔
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        </button>

        <div className="flex items-center gap-3 pl-2 border-l border-slate-100">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-900 leading-tight">Admin User</span>
            <span className="text-[0.65rem] font-medium text-slate-500 uppercase tracking-tighter">Main Branch</span>
          </div>
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner">
            👤
          </div>
        </div>
      </div>
    </header>
  );
}
