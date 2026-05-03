'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, ShoppingCart, LayoutDashboard, LogOut, Menu, X, Store } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const dashboardLink =
    user?.role === 'VENDOR' ? '/dashboard/vendor' : '/dashboard/customer';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40 group-hover:scale-110 transition-transform duration-300">
                <Printer className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0a0a0f]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white leading-none">PRINVOX</span>
              <span className="text-[10px] font-bold text-violet-400 tracking-[0.3em] leading-none mt-1">3D MARKET</span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2 group">
              <Store className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
              Marketplace
            </Link>
            {user?.role === 'CUSTOMER' && (
              <Link href="/cart" className="relative text-slate-400 hover:text-white transition-colors flex items-center gap-2 group">
                <ShoppingCart className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
                <span className="text-sm font-semibold">Cart</span>
              </Link>
            )}
            {user && (
              <Link href={dashboardLink} className="text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2 group">
                <LayoutDashboard className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-400">
                  <span className="text-white font-medium">{user.name}</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-violet-900/50 text-violet-400">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 py-4 px-4 flex flex-col gap-3">
          <Link href="/marketplace" className="text-sm text-slate-300">Marketplace</Link>
          {user?.role === 'CUSTOMER' && <Link href="/cart" className="text-sm text-slate-300">Shopping Cart</Link>}
          {user && <Link href={dashboardLink} className="text-sm text-slate-300">Dashboard</Link>}
          {user ? (
            <button onClick={handleLogout} className="text-sm text-left text-red-400">Logout</button>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-300">Login</Link>
              <Link href="/register" className="text-sm text-violet-400 font-medium">Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
