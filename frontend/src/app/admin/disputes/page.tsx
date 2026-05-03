'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import Image from 'next/image';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '🕐 Awaiting Vendor', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30' },
  VENDOR_ACCEPTED: { label: '✅ Vendor Accepted', color: 'text-blue-400 bg-blue-900/30 border-blue-500/30' },
  VENDOR_DISPUTED: { label: '⚠️ Vendor Disputed', color: 'text-red-400 bg-red-900/30 border-red-500/30' },
  ADMIN_REVIEW: { label: '⚖️ Needs Decision', color: 'text-purple-400 bg-purple-900/30 border-purple-500/30' },
  REPLACEMENT_SHIPPED: { label: '📦 Replacement Shipped', color: 'text-indigo-300 bg-indigo-900/30 border-indigo-500/30' },
  RESOLVED_REPLACED: { label: '✅ Replaced', color: 'text-green-400 bg-green-900/30 border-green-500/30' },
  RESOLVED_REFUNDED: { label: '✅ Refunded', color: 'text-green-400 bg-green-900/30 border-green-500/30' },
  RESOLVED_REJECTED: { label: '❌ Rejected', color: 'text-gray-400 bg-gray-800 border-gray-700' },
};

const TYPE_LABELS: Record<string, string> = {
  WRONG_ORDER: '📦 Wrong Order',
  PARTIAL_DAMAGE: '🔧 Partial Damage',
  FULL_DAMAGE: '💔 Full Damage',
  FULL_RETURN: '↩️ Full Return',
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'needs_action' | 'resolved'>('needs_action');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('adminToken') || '' : '';

  const loadData = () => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      adminApi.disputes(token),
      adminApi.stats(token),
    ]).then(([d, s]) => {
      setDisputes(Array.isArray(d) ? d : []);
      setStats(s);
    }).catch(() => {});
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/admin'); return; }

    Promise.all([
      adminApi.disputes(token),
      adminApi.stats(token),
    ]).then(([d, s]) => {
      setDisputes(Array.isArray(d) ? d : []);
      setStats(s);
    }).catch(err => {
      if (err.message?.includes('Invalid') || err.message?.includes('expired')) {
        router.push('/admin');
      } else {
        setError('Failed to load disputes');
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getToken()) return;

    const s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('join:admin');
    });

    s.on('refund:disputed_to_admin', () => {
      toast('🚨 New Dispute Escalated to Admin Review!', {
        duration: 7000,
        style: { background: '#4c1d95', color: '#fca5a5', border: '1px solid #dc2626' },
      });
      loadData();
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleResolve = async (id: string, decision: 'REFUND_CUSTOMER' | 'RELEASE_TO_VENDOR') => {
    const token = getToken();
    setResolving(id);
    setError('');
    try {
      await adminApi.resolve(token, id, { decision, notes: adminNotes[id] || '' });
      setDisputes(prev => prev.map(d => d.id === id ? {
        ...d,
        status: decision === 'REFUND_CUSTOMER' ? 'RESOLVED_REFUNDED' : 'RESOLVED_REJECTED',
        adminNotes: adminNotes[id] || '',
      } : d));
      setSuccessMsg(`✅ Decision recorded: ${decision === 'REFUND_CUSTOMER' ? 'Customer will be refunded.' : 'Payment released to vendor.'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve');
    } finally {
      setResolving(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    router.push('/admin');
  };

  const filteredDisputes = disputes.filter(d => {
    if (filter === 'needs_action') return d.status === 'ADMIN_REVIEW';
    if (filter === 'resolved') return ['RESOLVED_REPLACED', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'].includes(d.status);
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="relative overflow-hidden glass rounded-3xl p-8 mb-8 flex items-center justify-between min-h-[160px]">
        <div className="relative z-10 w-2/3">
          <h1 className="text-3xl font-bold text-white mb-2">Dispute Resolution Centre</h1>
          <p className="text-slate-300 text-lg">Review and adjudicate escalated refund claims.</p>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10"></div>
          <Image src="/dashboard/dash_admin_hero.jfif" alt="Admin Dashboard" fill className="object-cover opacity-60" />
        </div>
      </div>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Orders', value: stats.totalOrders, color: 'from-violet-600/20' },
              { label: 'Total Revenue', value: `₹${stats.totalRevenue?.toLocaleString()}`, color: 'from-blue-600/20' },
              { label: 'Platform Earned', value: `₹${stats.totalPlatformFee?.toLocaleString()}`, color: 'from-emerald-600/20' },
              { label: 'Total Refunds', value: stats.totalRefunds, color: 'from-amber-600/20' },
              { label: 'Pending Disputes', value: stats.pendingDisputes, color: 'from-rose-600/20' },
            ].map(stat => (
              <div key={stat.label} className="relative group overflow-hidden rounded-2xl border border-white/5 p-5 bg-white/2 transition-all duration-300 hover:border-white/10">
                <Image src="/images/dashboard/stats.png" fill className="object-cover opacity-5 group-hover:opacity-10 transition-opacity" alt="stats-bg" />
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${stat.color} to-transparent opacity-50`} />
                <p className="relative z-10 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{stat.label}</p>
                <p className="relative z-10 text-white text-xl font-bold mt-1 tracking-tight">{stat.value ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alerts */}
        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
        {successMsg && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{successMsg}</div>}

        <div className="flex gap-2 p-1 w-fit rounded-2xl bg-white/5 border border-white/5">
          {([['needs_action', '⚖️ Needs Action'], ['all', 'All'], ['resolved', '✅ Resolved']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${filter === key ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Disputes List */}
        {filteredDisputes.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-slate-400">No cases in this category.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map(dispute => {
              const statusInfo = STATUS_LABELS[dispute.status] || { label: dispute.status, color: 'text-gray-400 bg-gray-800 border-gray-700' };
              const isExpanded = expanded === dispute.id;
              const needsDecision = dispute.status === 'ADMIN_REVIEW';

              return (
                <div key={dispute.id} className={`glass rounded-xl overflow-hidden ${needsDecision ? 'ring-1 ring-purple-500/40' : ''}`}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : dispute.id)}
                    className="w-full p-5 flex items-start justify-between text-left"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        {needsDecision && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 text-xs font-bold animate-pulse">
                            ACTION REQUIRED
                          </span>
                        )}
                        <span className="text-white font-semibold">{TYPE_LABELS[dispute.type] || dispute.type}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">👤 {dispute.customer?.name || 'Customer'}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-slate-400">🏭 {dispute.vendor?.companyName || 'Vendor'}</span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        Order #{dispute.orderId?.slice(-8)} · ₹{dispute.order?.finalAmount} · {new Date(dispute.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-slate-600 ml-4">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-5">
                      {/* Customer side */}
                      <div className="bg-black/20 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-blue-400">👤 Customer's Claim</h3>
                        <p className="text-slate-300 text-sm">{dispute.description || 'No description provided'}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {dispute.customerPhotoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Photo Proof</p>
                              <a href={dispute.customerPhotoUrl} target="_blank" rel="noreferrer" className="block relative h-32 w-full rounded-xl overflow-hidden border border-white/10 hover:border-blue-500 transition-colors">
                                <Image src={dispute.customerPhotoUrl} alt="Customer proof" fill className="object-cover" />
                              </a>
                            </div>
                          )}
                          {dispute.customerVideoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Unboxing Video</p>
                              <video src={dispute.customerVideoUrl} controls className="w-full h-32 rounded-xl border border-white/10" />
                            </div>
                          )}
                          {!dispute.customerPhotoUrl && !dispute.customerVideoUrl && (
                            <div className="col-span-2 p-3 rounded-xl bg-amber-900/20 border border-amber-500/20 text-amber-400 text-xs">
                              ⚠️ Customer filed without photo or video proof.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vendor side */}
                      <div className="bg-black/20 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-orange-400">🏭 Vendor's Response</h3>
                        {dispute.vendorResponseNotes ? (
                          <p className="text-slate-300 text-sm">{dispute.vendorResponseNotes}</p>
                        ) : (
                          <p className="text-slate-600 text-sm italic">No response from vendor yet.</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {dispute.vendorPackingVideoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">🎥 Packing Video</p>
                              <video src={dispute.vendorPackingVideoUrl} controls className="w-full h-32 rounded-xl border border-white/10 object-cover" />
                            </div>
                          )}
                          {dispute.vendorDisputePhotoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">📷 Box Photo</p>
                              <a href={dispute.vendorDisputePhotoUrl} target="_blank" rel="noreferrer" className="block relative h-32 w-full rounded-xl overflow-hidden border border-white/10 hover:border-orange-500 transition-colors">
                                <Image src={dispute.vendorDisputePhotoUrl} alt="Vendor proof" fill className="object-cover" />
                              </a>
                            </div>
                          )}
                          {!dispute.vendorPackingVideoUrl && !dispute.vendorDisputePhotoUrl && (
                            <div className="col-span-2 p-3 rounded-xl bg-orange-900/20 border border-orange-500/20 text-orange-400 text-xs">
                              ⚠️ Vendor provided no video or photo evidence.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Admin Decision */}
                      {needsDecision && (
                        <div className="relative overflow-hidden bg-violet-900/10 border border-violet-500/20 rounded-2xl p-6 space-y-4">
                          <Image src="/images/dashboard/stats.png" fill className="object-cover opacity-5" alt="decision-bg" />
                          <h3 className="relative z-10 text-violet-300 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                            Final Adjudication
                          </h3>
                          <textarea
                            value={adminNotes[dispute.id] || ''}
                            onChange={e => setAdminNotes(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                            rows={3}
                            placeholder="Explain your decision to both parties..."
                            className="relative z-10 w-full px-4 py-3 rounded-xl bg-[#050510] border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-violet-500 transition-colors"
                          />
                          <div className="relative z-10 grid grid-cols-2 gap-4">
                            <button
                              onClick={() => handleResolve(dispute.id, 'REFUND_CUSTOMER')}
                              disabled={resolving === dispute.id}
                              className="py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                            >
                              💸 Refund Customer
                            </button>
                            <button
                              onClick={() => handleResolve(dispute.id, 'RELEASE_TO_VENDOR')}
                              disabled={resolving === dispute.id}
                              className="py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/30 transition-all active:scale-95"
                            >
                              🏭 Release to Vendor
                            </button>
                          </div>
                          <p className="relative z-10 text-slate-500 text-[10px] font-medium text-center uppercase tracking-tighter">This action is irreversible and will update order status across all dashboards.</p>
                        </div>
                      )}

                      {/* Resolved/Admin Notes */}
                      {dispute.adminNotes && (
                        <div className="bg-black/20 rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-1">Admin Notes</p>
                          <p className="text-slate-400 text-sm">{dispute.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
