'use client';

import { useState, useEffect } from 'react';
import { quoteApi, orderApi } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import Image from 'next/image';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-900/50 text-yellow-400',
  ACCEPTED: 'bg-green-900/50 text-green-400',
  REJECTED: 'bg-red-900/50 text-red-400',
};

export default function CustomerQuotesPage() {
  const { socket } = useSocket();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    quoteApi.customerQuotes()
      .then((data: any) => {
        setQuotes(data.quotes || []);
        setHasMoreHistory(data.hasMoreHistory || false);
      })
      .catch(() => setError('Failed to load quotes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleQuoteReceived = (newQuote: any) => {
      setQuotes((prev) => [newQuote, ...prev]);
    };
    
    socket.on('quote:received', handleQuoteReceived);
    
    return () => {
      socket.off('quote:received', handleQuoteReceived);
    };
  }, [socket]);

  const loadFullHistory = async () => {
    setLoadingHistory(true);
    try {
      const data: any = await quoteApi.customerQuotes(true);
      setQuotes(data.quotes || []);
      setHasMoreHistory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHideQuote = async (quoteId: string) => {
    if (!confirm('Remove this quote from your history?')) return;
    try {
      await quoteApi.hideQuote(quoteId);
      setQuotes(quotes.filter(q => q.id !== quoteId));
    } catch (err: any) {
      setError(err.message || 'Failed to hide quote');
    }
  };

  const handleAccept = async (quoteId: string) => {
    setActionId(quoteId + '_accept');
    setError('');
    try {
      const order: any = await orderApi.create({ quoteId });
      setOrderSuccess(`Order #${order.id.slice(-6).toUpperCase()} created! Track it in My Orders.`);
      setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: 'ACCEPTED' } : q));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (quoteId: string) => {
    setActionId(quoteId + '_reject');
    setError('');
    try {
      await quoteApi.reject(quoteId);
      setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, status: 'REJECTED' } : q));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Quotes</h1>
        <p className="text-slate-400 text-sm mt-1">Quotes received from vendors for your designs</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>
      )}
      {orderSuccess && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">{orderSuccess}</div>
      )}

      {quotes.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="relative w-48 h-48 mb-6 opacity-80">
            <Image src="/dashboard/empty_quotes.jfif" alt="No Quotes" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No quotes yet</h3>
          <p className="text-slate-400 text-sm">Upload a design and send quote requests to vendors to see them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map((quote: any) => (
            <div key={quote.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">
                    {quote.vendor?.user?.name || quote.vendor?.companyName || 'Vendor'}
                  </h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Design: {quote.request?.design?.fileName || '—'}
                  </p>
                  {quote.request?.material && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {quote.request.material} · {quote.request.infillDensity}% infill
                    </p>
                  )}
                </div>
                <span className={`status-pill ${statusColors[quote.status] || 'bg-gray-800 text-gray-400'}`}>
                  {quote.status}
                </span>
              </div>

              {/* Price Breakdown */}
              <div className="bg-white/[0.03] rounded-xl p-4 mb-4 space-y-1.5 text-sm">
                {[
                  { label: 'Material Cost', value: quote.materialCost },
                  { label: 'Machine Cost', value: quote.machineCost },
                  { label: 'Labor Cost', value: quote.laborCost },
                  { label: 'GST (18%)', value: quote.gst },
                  { label: 'Platform Fee (10%)', value: quote.platformFee },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-slate-400">
                    <span>{label}</span>
                    <span>₹{Number(value).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-white font-bold pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-violet-400 text-lg">₹{Number(quote.totalCost || quote.totalPrice).toFixed(2)}</span>
                </div>
              </div>

              {quote.notes && (
                <p className="text-sm text-slate-400 mb-4 italic">"{quote.notes}"</p>
              )}

              {quote.status === 'PENDING' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAccept(quote.id)}
                    disabled={actionId !== null}
                    className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
                  >
                    {actionId === quote.id + '_accept' ? 'Creating order...' : '✅ Accept & Order'}
                  </button>
                  <button
                    onClick={() => handleReject(quote.id)}
                    disabled={actionId !== null}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-red-900/30 border border-white/10 hover:border-red-900/50 text-slate-400 hover:text-red-400 font-medium text-sm transition-all disabled:opacity-50"
                  >
                    {actionId === quote.id + '_reject' ? '...' : 'Reject'}
                  </button>
                </div>
              )}

              {['ACCEPTED', 'REJECTED'].includes(quote.status) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleHideQuote(quote.id)}
                    className="w-full py-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 rounded-xl text-sm font-medium transition-colors"
                  >
                    🗑️ Remove from History
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMoreHistory && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={loadFullHistory}
            disabled={loadingHistory}
            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium transition-colors text-sm flex items-center gap-2"
          >
            {loadingHistory ? <div className="w-4 h-4 spinner" /> : '📚 Load Full Quote History'}
          </button>
        </div>
      )}
    </div>
  );
}
