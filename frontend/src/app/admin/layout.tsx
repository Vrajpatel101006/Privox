'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, Scale, BarChart3, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

const adminNavItems = [
  { href: '/admin/disputes', icon: <Scale className="w-5 h-5" />, label: 'Disputes' },
  // Future admin pages could be added here
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const email = localStorage.getItem('adminEmail');
    if (!token) {
      router.replace('/admin');
    } else {
      setAdminEmail(email || 'Admin');
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    router.push('/admin');
  };

  // Don't show layout on the login page itself
  if (pathname === '/admin') return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#050510]">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#050510]/80 backdrop-blur-xl border-b border-white/5 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            Prinvox Admin
          </span>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#050510]/80 backdrop-blur-xl border-r border-white/5 p-4 hidden md:flex flex-col gap-1 z-20">
          <div className="px-4 py-4 mb-4 rounded-2xl bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/10">
            <div className="text-[10px] text-violet-400 uppercase tracking-[0.2em] font-bold">Administrator</div>
            <div className="text-sm text-white font-bold mt-1 truncate">{adminEmail}</div>
          </div>
          
          <div className="space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
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
                </Link>
              );
            })}
          </div>

          <div className="mt-auto p-4 rounded-2xl bg-red-900/10 border border-red-500/10">
            <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold">Security</p>
            <p className="text-[11px] text-slate-400 mt-1">Session expires in 24 hours. Ensure you sign out after use.</p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 md:ml-64 p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
