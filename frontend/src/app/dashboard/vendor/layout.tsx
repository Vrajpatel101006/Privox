'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/Navbar';
import { BarChart3, MessageSquare, Package, Store, Scale, DollarSign, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard/vendor', icon: <BarChart3 className="w-5 h-5" />, label: 'Overview', notifKey: null },
  { href: '/dashboard/vendor/quotes', icon: <MessageSquare className="w-5 h-5" />, label: 'Quote Requests', notifKey: 'quotes' },
  { href: '/dashboard/vendor/orders', icon: <Package className="w-5 h-5" />, label: 'Active Orders', notifKey: 'orders' },
  { href: '/dashboard/vendor/inventory', icon: <Store className="w-5 h-5" />, label: 'Inventory', notifKey: null },
  { href: '/dashboard/vendor/disputes', icon: <Scale className="w-5 h-5" />, label: 'Refunds & Disputes', notifKey: 'disputes' },
  { href: '/dashboard/vendor/earnings', icon: <DollarSign className="w-5 h-5" />, label: 'Earnings & Payouts', notifKey: null },
  { href: '/dashboard/vendor/profile', icon: <User className="w-5 h-5" />, label: 'Profile', notifKey: null },
  { href: '/marketplace', icon: <Store className="w-5 h-5" />, label: 'View Marketplace', notifKey: null },
];

export default function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { notifCounts, clearNotif } = useSocket();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'VENDOR')) {
      router.replace('/login');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      <div className="flex pt-16">
        <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0a0a0f]/80 backdrop-blur-xl border-r border-white/5 p-4 hidden md:flex flex-col gap-1 z-20">
          <div className="px-4 py-6 mb-6 rounded-3xl bg-gradient-to-br from-indigo-600/10 to-transparent border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-600/10 rounded-full blur-2xl group-hover:bg-indigo-600/20 transition-colors" />
            <div className="relative z-10">
              <div className="text-[10px] text-indigo-400 uppercase tracking-[0.3em] font-black">Vendor Portal</div>
              <div className="text-lg text-white font-black mt-1 truncate tracking-tight">{user?.name}</div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Store</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            {navItems.map((item) => {
              const count = item.notifKey ? (notifCounts as any)[item.notifKey] : 0;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (item.notifKey) clearNotif(item.notifKey as any);
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative ${
                    isActive
                      ? 'bg-violet-600/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 w-1 h-6 bg-violet-500 rounded-r-full shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                  )}
                  <span className={`transition-transform duration-300 ${isActive ? 'text-violet-400' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  <span className="font-medium flex-1 text-sm">{item.label}</span>
                  {count > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-violet-900/40">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto p-4 rounded-2xl bg-violet-900/10 border border-violet-500/10">
            <p className="text-[10px] text-violet-300/50 uppercase tracking-wider font-bold">Payouts</p>
            <p className="text-[11px] text-slate-400 mt-1">Earnings are settled every Friday at 12:00 PM IST.</p>
          </div>
        </aside>
        <main className="flex-1 md:ml-64 p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
