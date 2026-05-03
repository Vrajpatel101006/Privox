'use client';

import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] selection:bg-violet-500/30">
      <Navbar />

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase mb-4">
              Terms of <span className="text-violet-500">Service</span>
            </h1>
            <p className="text-slate-400 font-medium">Last Updated: May 3, 2026</p>
          </motion.div>

          <div className="space-y-12 text-slate-300 font-medium leading-relaxed">
            <section>
              <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Prinvox, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
                If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">2. Intellectual Property</h2>
              <p>
                Designs uploaded to Prinvox remain the sole property of the original creator. Prinvox and its vendors are granted a 
                limited license to view and manufacture the design only as requested by the user. Vendors are strictly prohibited 
                from storing, sharing, or re-manufacturing designs without explicit permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">3. User Responsibilities</h2>
              <p>
                Users are responsible for ensuring that their designs do not infringe upon any third-party copyrights or trademarks. 
                Prinvox reserves the right to terminate accounts that violate intellectual property rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">4. Vendor Obligations</h2>
              <p>
                Vendors must provide accurate quotes and adhere to the material specifications requested by the customer. 
                Quality control is the responsibility of the vendor, subject to the Prinvox dispute resolution process.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">5. Payments and Refunds</h2>
              <p>
                Payments are held in escrow by Prinvox and released to vendors only upon successful delivery and customer confirmation. 
                Refund requests are subject to the outcome of our official dispute resolution workflow.
              </p>
            </section>

            <section className="p-8 rounded-3xl bg-violet-600/10 border border-violet-500/30">
              <h2 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Contact Us</h2>
              <p className="text-sm">
                For questions regarding these terms, please contact legal@prinvox.com
              </p>
            </section>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 text-center text-slate-600 text-xs font-black uppercase tracking-widest">
        © 2026 Prinvox Ecosystem.
      </footer>
    </div>
  );
}
