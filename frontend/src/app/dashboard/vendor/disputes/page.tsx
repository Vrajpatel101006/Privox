'use client';

import { useState, useEffect } from 'react';
import { refundApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSocket } from '@/context/SocketContext';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Awaiting Vendor', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-500/30' },
  VENDOR_ACCEPTED: { label: 'Accepted by Vendor', color: 'bg-blue-900/40 text-blue-400 border-blue-500/30' },
  VENDOR_DISPUTED: { label: 'Disputed by Vendor', color: 'bg-red-900/40 text-red-400 border-red-500/30' },
  ADMIN_REVIEW: { label: 'Admin Review', color: 'bg-purple-900/40 text-purple-400 border-purple-500/30' },
  REPLACEMENT_SHIPPED: { label: 'Replacement Shipped', color: 'bg-indigo-900/40 text-indigo-300 border-indigo-500/30' },
  RESOLVED_REPLACED: { label: '✅ Resolved — Replaced', color: 'bg-green-900/40 text-green-400 border-green-500/30' },
  RESOLVED_REFUNDED: { label: '✅ Refunded', color: 'bg-green-900/40 text-green-400 border-green-500/30' },
  RESOLVED_REJECTED: { label: '❌ Claim Rejected', color: 'bg-gray-800 text-gray-400 border-gray-600/30' },
};

const TYPE_LABELS: Record<string, string> = {
  WRONG_ORDER: '📦 Wrong Order',
  PARTIAL_DAMAGE: '🔧 Partial Damage',
  FULL_DAMAGE: '💔 Full Damage',
  FULL_RETURN: '↩️ Full Return',
};

export default function VendorDisputesPage() {
  const { socket } = useSocket();
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [packingVideo, setPackingVideo] = useState<File | null>(null);
  const [packagePhoto, setPackagePhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const loadRefunds = () => {
    refundApi.vendorRefunds()
      .then((data: any) => setRefunds(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load refund requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRefunds();
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    // Listen for new disputes globally or admin resolutions
    const handleRefundUpdate = () => loadRefunds();
    
    socket.on('refund:request', handleRefundUpdate);
    socket.on('refund:resolved', handleRefundUpdate);

    return () => {
      socket.off('refund:request', handleRefundUpdate);
      socket.off('refund:resolved', handleRefundUpdate);
    };
  }, [socket]);

  const handleRespond = async (refundId: string, action: 'ACCEPT' | 'DISPUTE') => {
    setRespondingId(refundId);
    setError('');
    setActionMsg('');
    try {
      // 1. Upload evidence first if attached
      let evidenceUploaded = false;
      if (action === 'DISPUTE' && (packingVideo || packagePhoto)) {
        setUploading(true);
        const fd = new FormData();
        if (packingVideo) fd.append('video', packingVideo);
        if (packagePhoto) fd.append('photo', packagePhoto);
        await refundApi.uploadVendorProof(refundId, fd);
        evidenceUploaded = true;
      }

      // 2. Submit the response notes and action
      await refundApi.vendorRespond(refundId, { action, notes });
      
      setRefunds(prev => prev.map(r => r.id === refundId ? {
        ...r,
        status: action === 'ACCEPT' ? 'VENDOR_ACCEPTED' : 'ADMIN_REVIEW',
        vendorResponseNotes: notes,
        vendorPackingVideoUploaded: evidenceUploaded || r.vendorPackingVideoUploaded
      } : r));
      
      setActionMsg(action === 'ACCEPT' ? '✅ You accepted the claim. Please ship the replacement.' : '✅ Dispute filed. Your response and evidence (if provided) have been sent to the Admin.');
      setNotes('');
      setPackingVideo(null);
      setPackagePhoto(null);
    } catch (err: any) {
      setError(err.message || 'Failed to respond');
    } finally {
      setRespondingId(null);
      setUploading(false);
    }
  };

  const handleShipReplacement = async (refundId: string) => {
    setError('');
    if (!trackingId.trim()) { setError('Please enter a tracking ID'); return; }
    setRespondingId(refundId);
    try {
      await refundApi.vendorShipReplacement(refundId, trackingId);
      setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: 'REPLACEMENT_SHIPPED', replacementTrackingId: trackingId } : r));
      setActionMsg('✅ Replacement marked as shipped. Awaiting customer confirmation.');
      setTrackingId('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 spinner" /></div>;

  const activeRefunds = refunds.filter(r => !['RESOLVED_REPLACED', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'].includes(r.status));
  const resolvedRefunds = refunds.filter(r => ['RESOLVED_REPLACED', 'RESOLVED_REFUNDED', 'RESOLVED_REJECTED'].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden glass rounded-3xl p-8 mb-8 flex items-center justify-between min-h-[160px]">
        <div className="relative z-10 w-2/3">
          <h1 className="text-3xl font-bold text-white mb-2">Refund & Dispute Centre</h1>
          <p className="text-slate-300 text-lg">Manage customer refund claims for your orders.</p>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 md:w-1/3">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10"></div>
          <Image src="/dashboard/dispute_hero.jfif" alt="Disputes Dashboard" fill className="object-cover opacity-60" />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
      {actionMsg && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{actionMsg}</div>}

      {refunds.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-slate-400">No refund requests yet. Keep up the great work!</p>
        </div>
      ) : (
        <>
          {activeRefunds.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Active ({activeRefunds.length})</h2>
              {activeRefunds.map(refund => {
                const statusInfo = STATUS_LABELS[refund.status] || { label: refund.status, color: 'bg-gray-800 text-gray-400 border-gray-700' };
                const isExpanded = expanded === refund.id;
                return (
                  <div key={refund.id} className="glass rounded-xl overflow-hidden">
                    <button onClick={() => setExpanded(isExpanded ? null : refund.id)} className="w-full p-5 flex items-start justify-between text-left">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-semibold">{TYPE_LABELS[refund.type] || refund.type}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>{statusInfo.label}</span>
                        </div>
                        <p className="text-slate-400 text-sm">{refund.customer?.name || 'Customer'} · Order #{refund.orderId?.slice(-8)}</p>
                        <p className="text-slate-600 text-xs">{new Date(refund.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="text-slate-600">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                        {/* Customer Description */}
                        <div className="bg-black/20 rounded-xl p-4">
                          <p className="text-xs text-slate-500 font-semibold mb-1">Customer Description</p>
                          <p className="text-slate-300 text-sm">{refund.description}</p>
                        </div>

                        {/* Proof */}
                        <div className="grid grid-cols-2 gap-3">
                          {refund.customerPhotoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">📷 Photo Proof</p>
                              <a href={refund.customerPhotoUrl} target="_blank" rel="noreferrer"
                                className="block relative h-32 rounded-xl overflow-hidden border border-white/10 hover:border-violet-500 transition-colors">
                                <Image src={refund.customerPhotoUrl} alt="Proof" fill className="object-cover" />
                              </a>
                            </div>
                          )}
                          {refund.customerVideoUrl && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">🎥 Unboxing Video</p>
                              <video src={refund.customerVideoUrl} controls className="w-full h-32 rounded-xl border border-white/10 object-cover" />
                            </div>
                          )}
                          {!refund.customerPhotoUrl && !refund.customerVideoUrl && (
                            <div className="col-span-2 p-3 rounded-xl bg-amber-900/20 border border-amber-500/20 text-amber-400 text-xs">
                              ⚠️ Customer filed without photo/video proof. This weakens their claim.
                            </div>
                          )}
                        </div>

                        {/* FULL_RETURN breakdown */}
                        {refund.type === 'FULL_RETURN' && (
                          <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-3 text-xs space-y-1">
                            <p className="text-purple-300 font-semibold">↩️ Full Return Breakdown</p>
                            <p className="text-slate-400">Order Total: <span className="text-white">₹{refund.orderAmount}</span></p>
                            <p className="text-slate-400">Customer Refund (85%): <span className="text-white">₹{refund.refundAmount}</span></p>
                            <p className="text-slate-400">Your Share (10% return fee): <span className="text-green-400">₹{refund.vendorReturnFee}</span></p>
                            <p className="text-slate-400">Platform Share (5%): <span className="text-slate-300">₹{refund.platformFeeOnReturn}</span></p>
                          </div>
                        )}

                        {/* Action Area */}
                        {refund.status === 'PENDING' && (
                          <div className="space-y-3">
                            <textarea
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              rows={2}
                              placeholder="Add notes (optional) explaining your response..."
                              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-violet-500"
                            />
                            <div className="flex gap-3">
                              <button onClick={() => handleRespond(refund.id, 'ACCEPT')} disabled={respondingId === refund.id}
                                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                                ✅ Accept & Offer Replacement
                              </button>
                              <button onClick={() => handleRespond(refund.id, 'DISPUTE')} disabled={respondingId === refund.id}
                                className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                                ⚖️ Dispute Claim
                              </button>
                            </div>

                            {/* Upload packing video when disputing */}
                            <div className="border-t border-white/5 pt-3 space-y-3">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">🎥 Packing Video (Counter-proof)</p>
                                <input type="file" accept="video/*" onChange={e => setPackingVideo(e.target.files?.[0] || null)}
                                  className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-white/10 file:text-white" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">📷 Package Box Photo (Counter-proof)</p>
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPackagePhoto(e.target.files?.[0] || null)}
                                  className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-white/10 file:text-white" />
                              </div>
                              {uploading && <p className="text-xs tracking-wider text-violet-400 mt-2 font-semibold">⏳ Uploading evidence before submitting dispute...</p>}
                            </div>
                          </div>
                        )}

                        {refund.status === 'VENDOR_ACCEPTED' && (
                          <div className="space-y-3 border-t border-white/5 pt-3">
                            <p className="text-sm text-slate-300 font-medium">Ship the replacement and enter tracking ID:</p>
                            <div className="flex gap-3">
                              <input
                                value={trackingId}
                                onChange={e => setTrackingId(e.target.value)}
                                placeholder="Tracking ID / AWB"
                                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                              <button onClick={() => handleShipReplacement(refund.id)} disabled={respondingId === refund.id}
                                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm">
                                Mark Shipped
                              </button>
                            </div>
                          </div>
                        )}

                        {refund.status === 'REPLACEMENT_SHIPPED' && (
                          <div className="p-3 rounded-xl bg-indigo-900/20 border border-indigo-500/20 text-indigo-300 text-sm">
                            📦 Replacement shipped. Tracking ID: <span className="font-bold text-white">{refund.replacementTrackingId}</span>
                            <p className="text-xs text-slate-400 mt-1">Awaiting customer to confirm receipt.</p>
                          </div>
                        )}

                        {refund.status === 'ADMIN_REVIEW' && (
                          <div className="p-3 rounded-xl bg-purple-900/20 border border-purple-500/20 text-purple-300 text-sm text-center">
                            ⚖️ This case is under platform review. An admin will make the final decision.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resolvedRefunds.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Resolved ({resolvedRefunds.length})</h2>
              {resolvedRefunds.map(refund => {
                const statusInfo = STATUS_LABELS[refund.status] || { label: refund.status, color: 'bg-gray-800 text-gray-400 border-gray-700' };
                return (
                  <div key={refund.id} className="glass rounded-xl p-4 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-slate-400 text-sm">{TYPE_LABELS[refund.type]} · Order #{refund.orderId?.slice(-8)}</p>
                      <p className="text-slate-600 text-xs">{new Date(refund.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
