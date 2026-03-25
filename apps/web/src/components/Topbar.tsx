'use client';

export function Topbar() {
  return (
    <header className="flex items-center gap-4 px-6 h-[60px] bg-white border-b border-[#eef0f4] flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-[480px] bg-[#f5f6fa] rounded-[10px] px-3.5 h-[38px]">
        <span className="text-gray-400 text-lg leading-none">⌕</span>
        <input
          type="text"
          placeholder="Search orders, products..."
          readOnly
          className="border-none bg-transparent outline-none text-sm text-gray-700 w-full placeholder-gray-400 font-[Inter,sans-serif]"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2.5 ml-auto">
        <button className="w-9 h-9 rounded-full border border-[#eef0f4] bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors">
          🔔
        </button>
        <button className="w-9 h-9 rounded-full border border-[#eef0f4] bg-white flex items-center justify-center text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
          ?
        </button>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[0.8125rem] font-semibold text-[#131b2e] leading-tight">Admin User</span>
            <span className="text-[0.6875rem] text-gray-400 leading-tight">Master Baker</span>
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#eef0f4] bg-[#e07b3c]/20 flex items-center justify-center text-[#e07b3c] font-bold text-sm flex-shrink-0">
            AU
          </div>
        </div>

        <button className="px-4 py-1.5 bg-[#131b2e] text-white rounded-lg text-[0.8125rem] font-semibold hover:bg-[#1e2d4a] transition-colors">
          Logout
        </button>
      </div>
    </header>
  );
}
