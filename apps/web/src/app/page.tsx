import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

// ── Stat card ────────────────────────────────────────────────
function StatCard({
  icon, iconBg, label, value, badge, badgeColor, highlight,
}: {
  icon: string; iconBg: string; label: string; value: string;
  badge: string; badgeColor: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 flex flex-col gap-2 shadow-sm border border-[#e2e8f0] ${highlight ? 'bg-[#131b2e] text-white' : 'bg-white text-[#131b2e]'}`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${highlight ? 'bg-white/10' : iconBg}`}>
          {icon}
        </div>
        <span className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-md ${highlight ? 'bg-white/10 text-white/80' : 'bg-gray-50 ' + badgeColor}`}>
          {badge}
        </span>
      </div>
      <p className={`text-[0.75rem] font-medium uppercase tracking-wider ${highlight ? 'text-white/60' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className="text-2xl font-bold m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

// ── Bar chart ────────────────────────────────────────────────
function WeeklyChart() {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const heights = [55, 72, 61, 68, 48, 100, 82];
  return (
    <div className="flex items-end gap-2 flex-1 pb-6 min-h-[160px]">
      {days.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end">
          <div
            className={`w-full rounded-t-lg min-h-[8px] transition-all ${
              i === 5 ? 'bg-[#131b2e]' : i === 6 ? 'bg-[#fbd5b5]' : 'bg-gray-200'
            }`}
            style={{ height: `${heights[i]}%` }}
          />
          <span className={`text-[0.6rem] font-semibold tracking-widest uppercase ${i === 6 ? 'text-[#e07b3c]' : 'text-gray-400'}`}>
            {d}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────
const STATUS: Record<string, { color: string; bg: string }> = {
  paid:      { color: '#16a34a', bg: '#dcfce7' },
  draft:     { color: '#6b7280', bg: '#f3f4f6' },
  confirmed: { color: '#2563eb', bg: '#dbeafe' },
  invoiced:  { color: '#d97706', bg: '#fef3c7' },
  cancelled: { color: '#dc2626', bg: '#fee2e2' },
};

const SAMPLE_ORDERS = [
  { id: '#ORD-0041', customer: 'Walk-in',        date: 'Mar 25, 2026', total: 'GH₵ 44.00',  status: 'paid'      },
  { id: '#ORD-0040', customer: 'Ama Mensah',      date: 'Mar 25, 2026', total: 'GH₵ 120.00', status: 'invoiced'  },
  { id: '#ORD-0039', customer: 'Walk-in',        date: 'Mar 25, 2026', total: 'GH₵ 22.50',  status: 'draft'     },
  { id: '#ORD-0038', customer: 'Kofi Agyei',     date: 'Mar 24, 2026', total: 'GH₵ 67.00',  status: 'confirmed' },
];

// ── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Header */}
          <div>
            <h1 className="text-[1.75rem] font-extrabold text-[#131b2e] leading-tight m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Executive Dashboard
            </h1>
            <p className="text-sm text-gray-400 italic mt-1">"Artisanal precision in every data point."</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon="🛒" iconBg="bg-orange-50"  label="Total Cash-ins" value="GH₵ 4,250" badge="+12.5%"  badgeColor="text-green-600" />
            <StatCard icon="✂"  iconBg="bg-blue-50"    label="Sales Volume"  value="142"       badge="+8 New"  badgeColor="text-blue-600"  />
            <StatCard icon="💳" iconBg="bg-red-50"     label="Expenses"      value="GH₵ 1,120" badge="-3%"    badgeColor="text-red-500"   />
            <StatCard icon="↗"  iconBg=""              label="Net Profit"    value="GH₵ 3,130" badge="Target Hit" badgeColor="" highlight />
          </div>

          {/* Middle row */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
            {/* Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#131b2e] m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>Sales Performance</h2>
                  <p className="text-[0.8125rem] text-gray-400 mt-0.5">Revenue trends for the current week</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="px-3 py-1 rounded-lg bg-[#131b2e] text-white text-[0.8125rem] font-semibold border-none cursor-pointer">Week</button>
                  <button className="px-3 py-1 rounded-lg border border-[#eef0f4] bg-white text-[0.8125rem] text-gray-500 cursor-pointer">Month</button>
                </div>
              </div>
              <WeeklyChart />
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4">
              {/* Inventory Alerts */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[0.9375rem] font-bold text-[#131b2e] m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>Inventory Alerts</h3>
                  <span className="text-[0.6875rem] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">2 Low</span>
                </div>
                {[
                  { emoji: '🌾', name: 'Organic Flour (T55)', pct: 12, color: '#dc2626' },
                  { emoji: '🧈', name: 'Cultured Butter',     pct: 35, color: '#d97706' },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 py-2 border-t border-[#f5f6fa]">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">{item.emoji}</div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-[0.8125rem] font-medium text-[#131b2e] truncate">{item.name}</span>
                      <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                      </div>
                    </div>
                    <span className="text-[0.75rem] font-bold flex-shrink-0" style={{ color: item.color }}>
                      {item.pct < 20 ? 'Critical' : 'Low'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Upcoming Event */}
              <div className="bg-[#131b2e] rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-[0.625rem] font-bold tracking-[0.1em] text-white/40 uppercase">Upcoming Event</span>
                <h3 className="text-[1.0625rem] font-extrabold text-white m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>Sunday Market Prep</h3>
                <p className="text-[0.8125rem] text-white/55 leading-relaxed m-0">
                  Special batch of 200 sourdough boules and 400 croissants needed by 05:00 AM.
                </p>
                <button className="mt-1 px-4 py-2 border border-white/25 rounded-[10px] bg-transparent text-white/85 text-[0.8125rem] font-semibold cursor-pointer hover:bg-white/10 transition-colors">
                  View Production Plan
                </button>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#131b2e] m-0" style={{ fontFamily: 'Manrope,sans-serif' }}>Recent Orders</h2>
              <a href="#" className="text-[0.8125rem] font-semibold text-[#e07b3c] no-underline">View All Records</a>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['ORDER ID', 'CUSTOMER', 'DATE', 'TOTAL', 'STATUS', 'ACTION'].map((h) => (
                    <th key={h} className="text-[0.6875rem] font-bold tracking-widest text-gray-400 uppercase text-left px-3 pb-2.5 border-b border-gray-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ORDERS.map((o) => {
                  const s = STATUS[o.status] ?? STATUS.draft;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="text-[0.8125rem] text-gray-700 px-3 py-3 border-b border-gray-50">{o.id}</td>
                      <td className="text-[0.8125rem] text-gray-700 px-3 py-3 border-b border-gray-50">{o.customer}</td>
                      <td className="text-[0.8125rem] text-gray-700 px-3 py-3 border-b border-gray-50">{o.date}</td>
                      <td className="text-[0.8125rem] text-gray-700 px-3 py-3 border-b border-gray-50">{o.total}</td>
                      <td className="px-3 py-3 border-b border-gray-50">
                        <span className="text-[0.75rem] font-semibold px-2.5 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                          {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 border-b border-gray-50">
                        <button className="text-gray-400 hover:bg-gray-100 rounded-md px-2 py-1 text-sm transition-colors bg-transparent border-none cursor-pointer">
                          •••
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
