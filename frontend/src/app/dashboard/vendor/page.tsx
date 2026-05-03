// Vendor dashboard overview page
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { FileText, Package, LayoutGrid, Settings } from 'lucide-react';

const quickLinks = [
  { href: '/dashboard/vendor/quotes', icon: <FileText className="w-8 h-8" />, label: 'Quote Requests', desc: 'Review and respond to customer requests', bg: '/images/dashboard/quotes.png' },
  { href: '/dashboard/vendor/orders', icon: <Package className="w-8 h-8" />, label: 'Active Orders', desc: 'Update manufacturing status', bg: '/images/dashboard/orders.png' },
  { href: '/dashboard/vendor/inventory', icon: <LayoutGrid className="w-8 h-8" />, label: 'Inventory', desc: 'Manage your product listings', bg: '/images/dashboard/marketplace.png' },
  { href: '/dashboard/vendor/profile', icon: <Settings className="w-8 h-8" />, label: 'Vendor Settings', desc: 'Configure your print sizes and bio', bg: '/images/dashboard/settings.png' },
];

export default function VendorDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 relative overflow-hidden glass rounded-3xl p-8 flex items-center justify-between min-h-[180px]">
        <div className="relative z-10 w-2/3">
          <h1 className="text-3xl font-bold text-white">
            Welcome, <span className="gradient-text">{user?.name?.split(' ')[0]}</span> 🏭
          </h1>
          <p className="text-slate-300 mt-2 text-lg">Your vendor dashboard</p>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10"></div>
          <Image src="/dashboard/dash_vendor_hero.jfif" alt="Vendor Dashboard" fill className="object-cover opacity-60" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="relative group overflow-hidden rounded-2xl aspect-square flex flex-col justify-end border border-white/5 hover:border-violet-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-900/20"
          >
            {/* Background Image Container */}
            <div className="absolute inset-0 z-0">
              <Image 
                src={link.bg} 
                alt={link.label} 
                fill 
                className="object-cover opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700 ease-out" 
              />
              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 space-y-2">
              <div className="text-violet-400 transform group-hover:scale-110 group-hover:text-violet-300 transition-all duration-300 origin-left">
                {link.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-violet-200 transition-colors">
                  {link.label}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
                  {link.desc}
                </p>
              </div>
            </div>

            {/* Subtle light effect on top */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </Link>
        ))}
      </div>
    </div>
  );
}
