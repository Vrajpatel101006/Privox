'use client';

import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Printer, ShieldCheck, Zap, Globe, Heart, Rocket } from 'lucide-react';
import Link from 'next/link';

const values = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-violet-400" />,
    title: "IP Protection",
    desc: "Your designs are encrypted and only accessible to the vendors you choose for quoting."
  },
  {
    icon: <Globe className="w-6 h-6 text-cyan-400" />,
    title: "Local Manufacturing",
    desc: "We prioritize local vendors to reduce shipping times and carbon footprint."
  },
  {
    icon: <Zap className="w-6 h-6 text-amber-400" />,
    title: "Instant Quotes",
    desc: "Get real-time feedback on your designs and competitive bids within hours."
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] selection:bg-violet-500/30">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-violet-600/5 blur-[120px] pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs font-black uppercase tracking-widest mb-8"
          >
            Our Mission
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8"
          >
            DEMOCRATIZING <br />
            <span className="gradient-text">PRODUCTION.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Prinvox is the bridge between digital imagination and physical reality. 
            We empower designers to manufacture locally and vendors to scale their craft.
          </motion.p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative aspect-square rounded-[40px] overflow-hidden border border-white/10"
          >
            <Image src="/landing/hero_main.jfif" alt="3D Printing Workshop" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-black text-white mb-8 tracking-tight">THE PRINVOX PHILOSOPHY</h2>
            <div className="space-y-6 text-slate-400 font-medium text-lg leading-relaxed">
              <p>
                Traditional manufacturing is slow, expensive, and exclusive. 3D printing changed the game, 
                but connecting designers with reliable production remained a challenge.
              </p>
              <p>
                Founded in 2024, Prinvox was built to solve this. We've created a secure, real-time 
                ecosystem where quality is verified, intellectual property is protected, and 
                manufacturing happens right in your neighborhood.
              </p>
              <div className="pt-8 grid sm:grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-black text-white mb-1">500+</div>
                  <div className="text-xs font-black text-violet-400 uppercase tracking-widest">Verified Vendors</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-white mb-1">12K+</div>
                  <div className="text-xs font-black text-cyan-400 uppercase tracking-widest">Success Prints</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-violet-500/30 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                  {v.icon}
                </div>
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">{v.title}</h3>
                <p className="text-slate-400 leading-relaxed font-medium">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass rounded-[48px] p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-cyan-600/20 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tighter uppercase">
                Ready to Join the <br />
                <span className="text-violet-500">Revolution?</span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/register"
                  className="px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-sm transition-all"
                >
                  Start Printing
                </Link>
                <Link
                  href="/register?role=VENDOR"
                  className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-sm transition-all"
                >
                  Join as Vendor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-6 grayscale opacity-50">
          <Printer className="text-white w-6 h-6" />
          <span className="text-xl font-black text-white tracking-tighter">PRINVOX</span>
        </div>
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
          © 2026 Prinvox — Future of Manufacturing
        </p>
      </footer>
    </div>
  );
}
