'use client';

import { useState, useEffect } from 'react';
import { quoteApi } from '@/lib/api';
import { calculateQuote } from '@/lib/quoteCalculator';
import dynamic from 'next/dynamic';
import { useSocket } from '@/context/SocketContext';
import Image from 'next/image';

const ThreeViewer = dynamic(() => import('@/components/ThreeViewer'), { 
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center bg-black/20 animate-pulse"><span className="text-sm text-slate-500">Loading 3D Viewer...</span></div>
});

export default function VendorQuotesPage() {
  const { socket } = useSocket();
  const [requests, setRequests] = useState<any[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [form, setForm] = useState({ materialCost: '', machineCost: '', laborCost: '', notes: '' });
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    quoteApi.vendorRequests()
      .then((data: any) => {
        setRequests(data.requests || []);
        setHasMoreHistory(data.hasMoreHistory || false);
      })
      .catch(() => setError('Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    // Listen for new quote requests from customers exactly when they are created
    const handleNewRequest = (newRequest: any) => {
      setRequests((prev) => [newRequest, ...prev]);
    };
    
    socket.on('quote:request_received', handleNewRequest);
    
    return () => {
      socket.off('quote:request_received', handleNewRequest);
    };
  }, [socket]);

  const loadFullHistory = async () => {
    setLoadingHistory(true);
    try {
      const data: any = await quoteApi.vendorRequests(true);
      setRequests(data.requests || []);
      setHasMoreHistory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const m = parseFloat(form.materialCost) || 0;
    const mac = parseFloat(form.machineCost) || 0;
    const l = parseFloat(form.laborCost) || 0;
    if (m || mac || l) {
      const rate = selectedRequest?.commissionRate || 0.10;
      setPreview(calculateQuote(m, mac, l, rate));
    } else {
      setPreview(null);
    }
  }, [form.materialCost, form.machineCost, form.laborCost, selectedRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);
    setError('');
    try {
      await quoteApi.submit({
        requestId: selectedRequest.id,
        materialCost: parseFloat(form.materialCost),
        machineCost: parseFloat(form.machineCost),
        laborCost: parseFloat(form.laborCost),
        notes: form.notes,
      });
      setSuccess('Quote submitted successfully!');
      setRequests((prev) => prev.map((r) => r.id === selectedRequest.id ? { ...r, quote: true } : r));
      setSelectedRequest(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 spinner" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Quote Requests</h1>
        <p className="text-slate-400 text-sm mt-1">Respond to customer quote requests</p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">{success}</div>}

      {requests.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="relative w-48 h-48 mb-6 opacity-80">
            <Image src="/dashboard/empty_quotes.jfif" alt="No Quotes" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No requests yet</h3>
          <p className="text-slate-400 text-sm">Customers who find your profile will send quote requests here.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Request List */}
          <div className="space-y-3">
            {requests.map((req: any) => (
              <div
                key={req.id}
                onClick={() => { if (!req.quote) setSelectedRequest(req); }}
                className={`glass rounded-xl p-4 cursor-pointer transition-all ${
                  selectedRequest?.id === req.id ? 'border border-violet-500' : 'border border-transparent hover:border-white/10'
                } ${req.quote ? 'opacity-60 cursor-default' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{req.customer?.name}</p>
                  {req.quote
                    ? <span className="status-pill bg-green-900/50 text-green-400">Quoted</span>
                    : <span className="status-pill bg-yellow-900/50 text-yellow-400">Pending</span>
                  }
                </div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-400 truncate pr-2">Design: {req.design?.fileName}</p>
                  {req.design?.fileUrl && (
                    <a 
                      href={req.design.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 bg-violet-600/30 text-violet-300 rounded hover:bg-violet-600/50 transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download
                    </a>
                  )}
                </div>

                
                <div className="bg-black/20 rounded-lg p-2 mt-2 mb-2 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Material</span>
                    <span className="text-white font-medium">{req.material} ({req.infillDensity}% infill)</span>
                  </div>
                  {req.estimatedWeightGrams && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Est. Weight</span>
                      <span className="text-white font-medium">{req.estimatedWeightGrams}g</span>
                    </div>
                  )}
                  {req.category && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Size Class</span>
                      <span className="text-white font-medium">{req.category} ({(req.commissionRate * 100).toFixed(0)}% fee)</span>
                    </div>
                  )}
                  {req.design?.boundingBoxCm && (
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                      <span className="text-slate-500">Bounding Box</span>
                      <span className="text-slate-400">
                        {Math.round(req.design.boundingBoxCm.length * 10)} × {Math.round(req.design.boundingBoxCm.width * 10)} × {Math.round(req.design.boundingBoxCm.height * 10)} mm
                      </span>
                    </div>
                  )}
                </div>

                {req.notes && <p className="text-xs text-slate-500 mt-1 mb-2 italic">"{req.notes}"</p>}

                {/* Shipping Details */}
                {req.deliveryAddress && (
                  <div className="mt-2 p-2 rounded-lg border border-white/5 bg-white/5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">📦 Destination</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {req.deliveryAddress}
                    </p>
                    {(req.city || req.state || req.pincode) && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {[req.city, req.state, req.pincode].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {hasMoreHistory && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={loadFullHistory}
                  disabled={loadingHistory}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {loadingHistory ? <div className="w-4 h-4 spinner" /> : '📚 Load Full Quote History'}
                </button>
              </div>
            )}
          </div>

          {/* Quote Form */}
          <div>
            {selectedRequest ? (
              <div className="glass rounded-xl p-5 sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <h3 className="text-sm font-medium text-slate-300 mb-4">
                  Submit Quote for <span className="text-white">{selectedRequest.customer?.name}</span>
                </h3>

                {selectedRequest.design?.fileUrl && (
                  <div className="mb-4 ring-1 ring-white/10 rounded-xl overflow-hidden">
                    <ThreeViewer 
                      fileUrl={selectedRequest.design.fileUrl} 
                      fileType={selectedRequest.design.fileType || 'stl'} 
                    />
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  {[
                    { key: 'materialCost', label: 'Material Cost (₹)' },
                    { key: 'machineCost', label: 'Machine Cost (₹)' },
                    { key: 'laborCost', label: 'Labor Cost (₹)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={(form as any)[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500 text-sm"
                      />
                    </div>
                  ))}

                  {preview && (
                    <div className="bg-black/20 rounded-xl p-3 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400"><span>GST (18%)</span><span>₹{preview.gst}</span></div>
                      <div className="flex justify-between text-slate-400">
                        <span>Platform Fee ({((selectedRequest?.commissionRate || 0.10) * 100).toFixed(0)}%)</span>
                        <span>₹{preview.platformFee}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold pt-1 border-t border-white/10">
                        <span>Total Customer Pays</span>
                        <span className="text-violet-400">₹{preview.totalPrice}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
                  >
                    {submitting ? 'Submitting...' : '📤 Submit Quote'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass rounded-xl p-8 text-center text-slate-500">
                <div className="text-3xl mb-2">👆</div>
                <p className="text-sm">Select a pending request to submit a quote</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
