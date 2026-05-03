'use client';

import { useState, useEffect } from 'react';
import { paymentApi } from '@/lib/api';
import Image from 'next/image';

interface EarningRecord {
  id: string;
  orderId: string;
  amount: number;
  vendorAmount: number;
  platformFee: number;
  gst: number;
  commissionRate: number;
  status: string;
  escrowReleasesAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  vendorSettlementAmount?: number;
  platformSettlementAmount?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ESCROWED:           { label: '⏳ In Escrow',     color: 'text-amber-400',  bg: 'bg-amber-900/30 border-amber-500/30' },
  RELEASED:           { label: '✅ Paid Out',       color: 'text-green-400',  bg: 'bg-green-900/30 border-green-500/30' },
  FROZEN:             { label: '🔒 Frozen',         color: 'text-red-400',    bg: 'bg-red-900/30 border-red-500/30' },
  REFUNDED:           { label: '↩️ Refunded',       color: 'text-purple-400', bg: 'bg-purple-900/30 border-purple-500/30' },
  PARTIALLY_REFUNDED: { label: '⚠️ Part Refunded',  color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-500/30' },
  PENDING:            { label: '🕐 Pending',        color: 'text-slate-400',  bg: 'bg-slate-800 border-slate-700' },
};

function EscrowCountdown({ releasesAt }: { releasesAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const ms = new Date(releasesAt).getTime() - Date.now();
      if (ms <= 0) { setTimeLeft('Releasing soon...'); return; }
      const h = Math.floor(ms / (1000 * 60 * 60));
      const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${h}h ${m}m remaining`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [releasesAt]);

  return <span className="text-amber-400 text-xs">{timeLeft}</span>;
}

export default function VendorEarningsPage() {
  const [payments, setPayments] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch all payments for this vendor via orders
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/payments/vendor-earnings`, {
      headers: {
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
      },
    })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load earnings');
        setPayments(Array.isArray(d) ? d : []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Calculate KPIs safely
  const totalEarned    = payments.filter(p => p.status === 'RELEASED').reduce((s, p) => s + (p.vendorAmount || 0), 0) 
                       + payments.filter(p => p.status === 'REFUNDED').reduce((s, p) => s + (p.vendorSettlementAmount || 0), 0);
  const inEscrow       = payments.filter(p => p.status === 'ESCROWED').reduce((s, p) => s + (p.vendorAmount || 0), 0);
  const frozen         = payments.filter(p => ['FROZEN', 'REFUND_PENDING'].includes(p.status)).reduce((s, p) => s + (p.vendorAmount || 0), 0);
  const totalFees      = payments.filter(p => p.status === 'RELEASED').reduce((s, p) => s + (p.platformFee || 0), 0)
                       + payments.filter(p => p.status === 'REFUNDED').reduce((s, p) => s + (p.platformSettlementAmount || 0), 0);
  const totalRevenue   = payments.filter(p => ['RELEASED', 'ESCROWED', 'FROZEN', 'REFUND_PENDING', 'REFUNDED'].includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 spinner" /></div>;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden glass rounded-3xl p-8 flex items-center justify-between min-h-[160px]">
        <div className="relative z-10 w-2/3">
          <h1 className="text-3xl font-bold text-white mb-2">Earnings & Payouts</h1>
          <p className="text-slate-300 text-lg">Track your earnings after platform commission and escrow status</p>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10"></div>
          <Image src="/dashboard/earnings_graphic.jfif" alt="Earnings Graphic" fill className="object-cover opacity-60" />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Total Revenue (Gross)</p>
          <p className="text-2xl font-bold text-white">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-600 mt-1">What customers paid</p>
        </div>
        <div className="bg-gradient-to-br from-green-900/30 to-green-950/20 border border-green-500/20 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">✅ Total Paid Out</p>
          <p className="text-2xl font-bold text-green-400">₹{totalEarned.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-600 mt-1">Released to your account</p>
        </div>
        <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/20 border border-amber-500/20 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">⏳ In Escrow</p>
          <p className="text-2xl font-bold text-amber-400">₹{inEscrow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-600 mt-1">Releasing after 48h</p>
        </div>
        <div className="bg-gradient-to-br from-red-900/30 to-red-950/20 border border-red-500/20 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">🔒 Frozen (Disputes)</p>
          <p className="text-2xl font-bold text-red-400">₹{frozen.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-600 mt-1">Held pending resolution</p>
        </div>
      </div>

      {/* Commission Summary */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4">Commission Summary</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-xs text-slate-500 mb-1">Your Net Earnings</p>
            <p className="text-xl font-bold text-violet-400">₹{totalEarned.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Platform Commission</p>
            <p className="text-xl font-bold text-slate-400">₹{totalFees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Avg. Commission Rate</p>
            <p className="text-xl font-bold text-slate-400">
              {payments.filter(p => p.commissionRate).length > 0
                ? `${(payments.filter(p => p.commissionRate).reduce((s, p) => s + p.commissionRate, 0) / payments.filter(p => p.commissionRate).length * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Transaction History</h2>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">💰</div>
            <p className="text-slate-400 text-sm">No payment records yet. Your earnings will appear here after your first order is delivered.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {payments.map(payment => {
              const cfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.PENDING;
              const vendorShare = payment.status === 'REFUNDED' || payment.status === 'REFUND_PENDING' 
                ? (payment as any).vendorSettlementAmount 
                : payment.vendorAmount;
              const feeShare = payment.status === 'REFUNDED' || payment.status === 'REFUND_PENDING'
                ? (payment as any).platformSettlementAmount
                : payment.platformFee;

              return (
                <div key={payment.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {payment.status === 'ESCROWED' && payment.escrowReleasesAt && (
                        <EscrowCountdown releasesAt={payment.escrowReleasesAt} />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">Order #{payment.orderId?.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-slate-600">{new Date(payment.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="text-right space-y-1 ml-4 flex-shrink-0">
                    <p className="text-white font-bold">₹{(vendorShare || 0).toFixed(2)}</p>
                    <p className="text-xs text-slate-600">
                      Gross ₹{(payment.amount || 0).toFixed(2)} · Fee ₹{(feeShare || 0).toFixed(2)}
                    </p>
                    {payment.commissionRate && payment.status !== 'REFUNDED' && payment.status !== 'REFUND_PENDING' && (
                      <p className="text-xs text-slate-700">{(payment.commissionRate * 100).toFixed(0)}% commission</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="glass rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">How Payouts Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="flex gap-2">
            <span className="text-violet-400">1.</span>
            <p>Customer pays → Money is held in <strong className="text-white">Escrow</strong> by Prinvox</p>
          </div>
          <div className="flex gap-2">
            <span className="text-violet-400">2.</span>
            <p>Customer confirms delivery → <strong className="text-white">48-hour</strong> refund window starts</p>
          </div>
          <div className="flex gap-2">
            <span className="text-violet-400">3.</span>
            <p>No refund in 48h → Your share is <strong className="text-white">automatically released</strong> to your bank</p>
          </div>
        </div>
      </div>
    </div>
  );
}
