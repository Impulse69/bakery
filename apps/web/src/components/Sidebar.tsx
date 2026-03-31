'use client';

const NAV_ITEMS = [
  { label: 'Dashboard',    icon: '▦', active: true  },
  { label: 'POS / New Sale', icon: '⊟', active: false },
  { label: 'Sales Orders', icon: '▤', active: false },
  { label: 'Products',     icon: '◫', active: false },
  { label: 'Inventory',    icon: '▣', active: false },
  { label: 'Production',   icon: '⚙', active: false },
  { label: 'Suppliers',    icon: '◎', active: false },
  { label: 'Expenses',     icon: '◉', active: false },
  { label: 'Customers',    icon: '◌', active: false },
  { label: 'Reports',      icon: '◑', active: false },
  { label: 'Settings',     icon: '⊕', active: false },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-[#131b2e] flex flex-col flex-shrink-0 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-lg bg-[#e07b3c]/20 flex items-center justify-center text-[#e07b3c] font-bold text-sm flex-shrink-0">
          BF
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[0.8125rem] font-bold text-white leading-tight truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Bread Faculty
          </span>
          <span className="text-[0.625rem] font-semibold tracking-widest text-white/35 uppercase mt-px">
            Premium Bakery Management
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-px px-2.5 py-2.5 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href="#"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.8125rem] font-medium transition-colors ${
              item.active
                ? 'bg-white/[0.12] text-white font-semibold'
                : 'text-white/60 hover:bg-white/[0.07] hover:text-white/90'
            }`}
          >
            <span className="w-5 text-center text-base opacity-80">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* User card */}
      <div className="flex items-center gap-2.5 p-4 border-t border-white/[0.06] bg-white/[0.03]">
        <div className="w-9 h-9 rounded-full bg-[#e07b3c]/30 flex items-center justify-center text-[#e07b3c] font-bold text-sm flex-shrink-0">
          OW
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[0.8125rem] font-semibold text-white truncate">Owner</span>
          <span className="text-[0.6875rem] text-white/50">Premium Plan</span>
          <span className="text-[0.625rem] text-white/35">Status: Active Member</span>
        </div>
      </div>
    </aside>
  );
}
