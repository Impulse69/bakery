'use client';

const NAV_ITEMS = [
  { label: 'Dashboard',    icon: '📊', active: true  },
  { label: 'POS / New Sale', icon: '🛒', active: false },
  { label: 'Daily Targets', icon: '🎯', active: false },
  { label: 'Sales Orders', icon: '📋', active: false },
  { label: 'Products',     icon: '📦', active: false },
  { label: 'Inventory',    icon: '🏢', active: false },
  { label: 'Production',   icon: '🏭', active: false },
  { label: 'Suppliers',    icon: '🤝', active: false },
  { label: 'Expenses',     icon: '💸', active: false },
  { label: 'Customers',    icon: '👤', active: false },
  { label: 'Reports',      icon: '📈', active: false },
  { label: 'Settings',     icon: '⚙️', active: false },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-[#131b2e] flex flex-col flex-shrink-0 overflow-hidden text-slate-300">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-[#e07b3c] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-950/20">
          B
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[0.8125rem] font-bold text-white leading-tight truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Bread Faculty
          </span>
          <span className="text-[0.6rem] font-bold tracking-[0.1em] text-white/30 uppercase mt-0.5">
            Enterprise ERP
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href="#"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.85rem] font-medium transition-all group ${
              item.active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`text-lg transition-transform group-hover:scale-110 ${item.active ? 'opacity-100' : 'opacity-60'}`}>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* User card */}
      <div className="flex items-center gap-3 p-5 border-t border-white/5 bg-black/10">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
          AD
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-white truncate">Administrator</span>
          <span className="text-[0.65rem] text-slate-500 font-medium">Bakery Master</span>
        </div>
        <button className="ml-auto text-slate-500 hover:text-white transition-colors">
          🚪
        </button>
      </div>
    </aside>
  );
}
