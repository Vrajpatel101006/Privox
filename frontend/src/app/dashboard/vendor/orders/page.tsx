'use client';

import { useState, useEffect } from 'react';
import { orderApi } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import Image from 'next/image';

const ALL_STATUSES = ['NOT_STARTED','STARTED','IN_PROCESS','COMPLETED','OUT_FOR_DELIVERY'];

const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  STARTED: 'Started',
  IN_PROCESS: 'In Process',
  COMPLETED: 'Completed',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

const statusColors: Record<string, string> = {
  NOT_STARTED: 'bg-gray-800 text-gray-400',
  STARTED: 'bg-blue-900/50 text-blue-400',
  IN_PROCESS: 'bg-yellow-900/50 text-yellow-400',
  COMPLETED: 'bg-purple-900/50 text-purple-400',
  OUT_FOR_DELIVERY: 'bg-orange-900/50 text-orange-400',
  DELIVERED: 'bg-green-900/50 text-green-400',
};

export default function VendorOrdersPage() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orderApi.vendorOrders()
      .then((data: any) => {
        setOrders(data.orders || []);
        setHasMoreHistory(data.hasMoreHistory || false);
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewOrder = (newOrder: any) => {
      setOrders((prev) => [newOrder, ...prev]);
    };

    const handleStatusUpdate = (eventPayload: any) => {
      setOrders((prev) => prev.map(o => {
        if (o.id === eventPayload.orderId) {
          return { ...o, status: eventPayload.status };
        }
        return o;
      }));
    };
    
    socket.on('order:new', handleNewOrder);
    socket.on('order:status_updated', handleStatusUpdate);
    
    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:status_updated', handleStatusUpdate);
    };
  }, [socket]);

  const loadFullHistory = async () => {
    setLoadingHistory(true);
    try {
      const data: any = await orderApi.vendorOrders(true);
      setOrders(data.orders || []);
      setHasMoreHistory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      await orderApi.updateStatus({ orderId, status });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 spinner" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Active Orders</h1>
        <p className="text-slate-400 text-sm mt-1">Update manufacturing status for your orders</p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>}

      {orders.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="relative w-48 h-48 mb-6 opacity-80">
            <Image src="/dashboard/empty_orders.jfif" alt="No Orders" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No orders yet</h3>
          <p className="text-slate-400 text-sm">When customers accept your quotes, orders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Order ID</p>
                  <h3 className="font-mono text-sm text-white font-bold">#{order.id.slice(-8).toUpperCase()}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Customer: <span className="text-white">{order.customer?.name}</span>
                  </p>
                  {order.quote?.request?.design?.fileName && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Design: {order.quote.request.design.fileName}
                    </p>
                  )}
                  {/* Delivery Address — key info for shipping via courier */}
                  {(order.deliveryAddress || order.customer?.deliveryAddress) && (
                    <div className="mt-2 p-3 rounded-lg bg-violet-900/20 border border-violet-500/20">
                      <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-1">📦 Ship To</p>
                      <p className="text-xs text-white leading-relaxed font-medium">
                        {order.deliveryAddress || order.customer?.deliveryAddress}
                      </p>
                      {(order.city || order.state || order.pincode) && (
                        <p className="text-xs text-slate-300 mt-1">
                          {[order.city, order.state, order.pincode].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className={`status-pill ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                  <p className="text-xs text-violet-400 font-bold mt-2">₹{order.finalAmount}</p>
                </div>
              </div>

              {order.status !== 'DELIVERED' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const isMarketplace = !(order.quoteId || order.quote);
                      const orderStatuses = isMarketplace 
                        ? ['NOT_STARTED', 'OUT_FOR_DELIVERY']
                        : ALL_STATUSES;

                      return orderStatuses.map((s) => {
                        if (s === order.status) return null;
                        
                        const currentIndex = orderStatuses.indexOf(order.status);
                        const statusIndex = orderStatuses.indexOf(s);
                        const isPastStatus = statusIndex < currentIndex;
                        const isDisabled = updating === order.id || isPastStatus;

                        return (
                          <button
                            key={s}
                            onClick={() => handleUpdateStatus(order.id, s)}
                            disabled={isDisabled}
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                              isPastStatus
                                ? 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed'
                                : 'bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 text-slate-300 hover:text-violet-300 disabled:opacity-50'
                            }`}
                          >
                            {updating === order.id && !isPastStatus ? '...' : statusLabels[s]}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 mt-3">
                Ordered: {new Date(order.createdAt).toLocaleDateString()}
              </p>
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
            {loadingHistory ? <div className="w-4 h-4 spinner" /> : '📚 Load Full Order History'}
          </button>
        </div>
      )}
    </div>
  );
}
