'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import { 
  ArrowRight, 
  ChevronRight, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Layers,
  Printer,
  Package,
  CheckCircle2,
  Users
} from 'lucide-react';

const workflowSteps = [
  {
    title: "Secure Design Upload",
    desc: "Your intellectual property is safe. Upload STL/OBJ files with instant 3D validation.",
    image: "/landing/step_design.jpg",
    icon: <Printer className="w-6 h-6 text-violet-400" />
  },
  {
    title: "Competitive Bidding",
    desc: "Send your design to a network of verified local vendors. Compare price and quality.",
    image: "/landing/step_bid.jpg",
    icon: <Layers className="w-6 h-6 text-cyan-400" />
  },
  {
    title: "Live Production Tracking",
    desc: "Monitor your print's progress in real-time with live status updates from the workshop.",
    image: "/landing/step_build.jpg",
    icon: <Cpu className="w-6 h-6 text-emerald-400" />
  },
  {
    title: "Verified Delivery",
    desc: "Receive your custom parts, quality checked and delivered to your doorstep.",
    image: "/landing/step_delivery.jpg",
    icon: <Package className="w-6 h-6 text-amber-400" />
  }
];

const statItems = [
  { value: '500+', label: 'Active Vendors', icon: <Users className="w-5 h-5 text-violet-500" /> },
  { value: '12K+', label: 'Prints Delivered', icon: <Printer className="w-5 h-5 text-cyan-500" /> },
  { value: '98%', label: 'Satisfaction', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
  { value: '24h', label: 'Response Time', icon: <Zap className="w-5 h-5 text-amber-500" /> },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] selection:bg-violet-500/30">
      <Navbar />

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 w-full grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-violet-400 text-xs font-black uppercase tracking-widest mb-8">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              The Future of Manufacturing is Here
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-[1.1] mb-8">
              PRINT YOUR <br />
              <span className="gradient-text uppercase">IMAGINATION.</span>
            </h1>
            
            <p className="text-xl text-slate-400 max-w-lg mb-10 leading-relaxed font-medium">
              India's premier 3D printing ecosystem. Connect with expert vendors, 
              track live production, and bring your designs to life with industrial precision.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5">
              <Link
                href="/register"
                className="group relative px-8 py-5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-sm transition-all overflow-hidden shadow-2xl shadow-violet-900/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2">
                  Get Started Now <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <Link
                href="/marketplace"
                className="px-8 py-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-sm transition-all backdrop-blur-xl flex items-center gap-2"
              >
                Marketplace <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative aspect-video lg:aspect-square rounded-[40px] overflow-hidden border border-white/10 shadow-2xl group">
              <Image 
                src="/landing/hero_main.jpg" 
                alt="3D Printing Hero" 
                fill 
                className="object-cover group-hover:scale-105 transition-transform duration-1000"
                priority
                unoptimized={true}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0a0f]/60 via-transparent to-transparent" />
              
              {/* Overlay Card */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-8 left-8 p-6 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 max-w-xs"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center">
                    <Printer className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] text-violet-400 font-black uppercase tracking-widest">Active Print</div>
                    <div className="text-white font-black tracking-tight">Vase_Project_01</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                    <span>Progress</span>
                    <span>84%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "84%" }}
                      className="h-full bg-violet-500"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- STATS SECTION --- */}
      <section className="py-20 relative border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-12">
          {statItems.map((item, i) => (
            <motion.div 
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="flex justify-center mb-3">{item.icon}</div>
              <div className="text-4xl font-black text-white mb-1">{item.value}</div>
              <div className="text-xs text-slate-500 font-black uppercase tracking-[0.2em]">{item.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --- WORKFLOW SECTION --- */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 uppercase">
              HOW <span className="text-violet-500">PRINVOX</span> WORKS
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
              From a digital file to a physical masterpiece. We've streamlined the entire 3D manufacturing lifecycle.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative"
              >
                <div className="relative aspect-square rounded-[32px] overflow-hidden mb-8 border border-white/10 group-hover:border-violet-500/50 transition-colors">
                  <Image src={step.image} alt={step.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized={true} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4">
                      {step.icon}
                    </div>
                    <div className="text-sm font-black text-white uppercase tracking-wider">Step {i + 1}</div>
                  </div>
                </div>
                <h3 className="text-xl font-black text-white mb-3 group-hover:text-violet-400 transition-colors uppercase tracking-tight">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- MARKETPLACE PREVIEW SECTION --- */}
      <section className="py-24 md:py-32 bg-violet-600/5 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 md:mb-16 gap-6">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4 md:mb-6 uppercase">
                EXPLORE THE <span className="text-violet-500">MARKET</span>
              </h2>
              <p className="text-slate-400 text-base md:text-lg font-medium">
                Browse thousands of ready-to-ship models from our top-rated vendor collections.
              </p>
            </div>
            <Link 
              href="/marketplace" 
              className="w-full md:w-auto text-center px-6 py-3 rounded-xl bg-white/5 hover:bg-violet-600 border border-white/10 text-white text-xs font-black uppercase tracking-[0.2em] transition-all"
            >
              View All Categories
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {PRODUCT_CATEGORIES.slice(0, 6).map((cat, i) => (
              <motion.div
                key={cat.id}
                whileHover={{ y: -10 }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link 
                  href={`/marketplace?category=${encodeURIComponent(cat.id)}`}
                  className="relative block aspect-[3/4] rounded-3xl overflow-hidden group border border-white/5 hover:border-violet-500/30 transition-all"
                >
                  <Image 
                    src={cat.image || '/categories/decor.png'} 
                    alt={cat.id} 
                    fill 
                    className="object-cover opacity-40 group-hover:opacity-70 transition-all duration-700 group-hover:scale-110" 
                    unoptimized={true}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} mix-blend-overlay`} />
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black via-black/50 to-transparent">
                    <div className="text-[10px] text-violet-400 font-black uppercase tracking-widest mb-1">{cat.emoji}</div>
                    <div className="text-[10px] md:text-xs font-black text-white leading-tight uppercase tracking-tighter">{cat.id}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- VENDOR CTA SECTION --- */}
      <section className="py-24 md:py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[32px] md:rounded-[48px] overflow-hidden border border-white/10 bg-[#12121a] group">
            <div className="absolute inset-0 opacity-40 group-hover:opacity-50 transition-opacity">
              <Image src="/landing/vendor_hero2.jpg" alt="Vendor Dashboard" fill className="object-cover" unoptimized={true} />
              <div className="absolute inset-0 bg-gradient-to-r from-[#12121a] via-[#12121a]/80 to-transparent" />
            </div>
            
            <div className="relative z-10 grid lg:grid-cols-2 p-8 md:p-20 items-center gap-12">
              <div>
                <h2 className="text-3xl md:text-6xl font-black text-white tracking-tighter mb-6 md:mb-8 uppercase leading-[0.9]">
                  OWN A <span className="text-cyan-400">3D PRINTER?</span> <br />
                  <span className="text-slate-500">START EARNING.</span>
                </h2>
                <p className="text-base md:text-lg text-slate-300 mb-8 md:mb-10 max-w-md font-medium leading-relaxed">
                  Join India's fastest growing additive manufacturing network. Get access to global orders, 
                  live dashboard management, and secure payments.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register?role=VENDOR"
                    className="px-10 py-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-cyan-900/40 text-center"
                  >
                    Apply as Vendor
                  </Link>
                  <div className="flex items-center justify-center gap-2 px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" /> Verified Network
                  </div>
                </div>
              </div>

              {/* Mini Stats Card */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {[
                  { label: "Commission", val: "Only 10%", color: "border-violet-500/30 bg-violet-500/10" },
                  { label: "Payouts", val: "Instantly", color: "border-emerald-500/30 bg-emerald-500/10" },
                  { label: "Orders", val: "Global", color: "border-cyan-500/30 bg-cyan-600/10" },
                  { label: "Support", val: "24/7 Priority", color: "border-amber-500/30 bg-amber-600/10" }
                ].map((item) => (
                  <div key={item.label} className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border backdrop-blur-md ${item.color}`}>
                    <div className="text-[9px] md:text-[10px] text-white/50 font-black uppercase tracking-widest mb-1 md:mb-2">{item.label}</div>
                    <div className="text-base md:text-xl font-black text-white">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-16 md:py-20 px-4 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-16 md:mb-20 text-center md:text-left">
          <div className="col-span-2">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Printer className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black text-white tracking-tighter">PRINVOX</span>
            </div>
            <p className="text-slate-500 max-w-sm mx-auto md:mx-0 leading-relaxed mb-8 font-medium">
              Revolutionizing custom manufacturing through decentralized 3D printing. 
              The bridge between complex digital designs and physical reality.
            </p>
          </div>
          <div>
            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Marketplace</h4>
            <ul className="space-y-4 text-sm text-slate-400 font-medium">
              <li><Link href="/marketplace" className="hover:text-violet-400 transition-colors">Browse Products</Link></li>
              <li><Link href="/marketplace" className="hover:text-violet-400 transition-colors">Collections</Link></li>
              <li><Link href="/vendors" className="hover:text-violet-400 transition-colors">Verified Vendors</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Platform</h4>
            <ul className="space-y-4 text-sm text-slate-400 font-medium">
              <li><Link href="/about" className="hover:text-violet-400 transition-colors">How it Works</Link></li>
              <li><Link href="/register?role=VENDOR" className="hover:text-violet-400 transition-colors">Become a Vendor</Link></li>
              <li><Link href="/terms" className="hover:text-violet-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] text-center">
            © 2026 Prinvox Ecosystem. All Rights Reserved.
          </p>
          <div className="flex gap-8 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all">
            {/* Social Icons Placeholder */}
          </div>
        </div>
      </footer>
    </div>
  );
}

