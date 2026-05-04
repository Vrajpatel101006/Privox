'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { orderApi, refundApi } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';

// Returns hours remaining in 48h refund window, or null if unknown
function getRefundHoursLeft(order: any): number | null {
  if (!order.deliveredAt) return null;
  const ms = new Date(order.deliveredAt).getTime() + 48 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, ms / (1000 * 60 * 60));
}

const statusSteps = [
  { key: 'NOT_STARTED', label: 'Not Started', icon: '⏳' },
  { key: 'STARTED', label: 'Started', icon: '🚀' },
  { key: 'IN_PROCESS', label: 'In Process', icon: '⚙️' },
  { key: 'COMPLETED', label: 'Completed', icon: '✅' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🚚' },
  { key: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

const marketplaceStatusSteps = [
  { key: 'NOT_STARTED', label: 'Order Placed', icon: '⏳' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🚚' },
  { key: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

export default function CustomerOrdersPage() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<Record<string, any>>({});
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      orderApi.customerOrders(),
      refundApi.customerRefunds().catch(() => []) // Fallback to empty if fails
    ]).then(([ordersData, refundsData]) => {
      setOrders((ordersData as any).orders || []);
      setHasMoreHistory((ordersData as any).hasMoreHistory || false);
      
      const refundMap: Record<string, any> = {};
      if (Array.isArray(refundsData)) {
        refundsData.forEach((r: any) => { refundMap[r.orderId] = r; });
      }
      setRefunds(refundMap);
    }).catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const loadRefunds = async () => {
    try {
      const refundsData = await refundApi.customerRefunds();
      const refundMap: Record<string, any> = {};
      if (Array.isArray(refundsData)) {
        refundsData.forEach((r: any) => { refundMap[r.orderId] = r; });
      }
      setRefunds(refundMap);
    } catch {
      // Background re-fetch failed silently
    }
  };

  useEffect(() => {
    if (!socket) return;
    
    // Listen for real-time status updates and adjust the matching order in state
    const handleStatusUpdate = (eventPayload: any) => {
      // payload usually contains { orderId, status, trackingEvent }
      setOrders((prev) => prev.map(o => {
        if (o.id === eventPayload.orderId) {
          const newTracking = eventPayload.trackingEvent 
            ? [eventPayload.trackingEvent, ...(o.trackingEvents || [])]
            : o.trackingEvents;
          return { ...o, status: eventPayload.status, trackingEvents: newTracking };
        }
        return o;
      }));
    };
    
    // Live update the refund panel when the vendor or admin changes its state
    const handleRefundUpdate = () => loadRefunds();

    socket.on('order:status_updated', handleStatusUpdate);
    socket.on('refund:vendor_response', handleRefundUpdate);
    socket.on('refund:replacement_shipped', handleRefundUpdate);
    socket.on('refund:resolved', handleRefundUpdate);
    
    return () => {
      socket.off('order:status_updated', handleStatusUpdate);
      socket.off('refund:vendor_response', handleRefundUpdate);
      socket.off('refund:replacement_shipped', handleRefundUpdate);
      socket.off('refund:resolved', handleRefundUpdate);
    };
  }, [socket]);

  const loadFullHistory = async () => {
    setLoadingHistory(true);
    try {
      const data: any = await orderApi.customerOrders(true);
      setOrders(data.orders || []);
      setHasMoreHistory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHideOrder = async (orderId: string) => {
    if (!confirm('Hide this delivered order from your dashboard?')) return;
    try {
      await orderApi.hideOrder(orderId);
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (err: any) {
      setError(err.message || 'Failed to hide order');
    }
  };

  const handleConfirmReceipt = async (orderId: string) => {
    try {
      await orderApi.confirmReceipt(orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'DELIVERED', deliveredAt: new Date().toISOString() } : o));
    } catch (err: any) {
      setError(err.message || 'Failed to confirm receipt');
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
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <p className="text-slate-400 text-sm mt-1">Track the manufacturing status of your prints</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="relative w-48 h-48 mb-6 opacity-80">
            <Image src="/dashboard/empty_orders.jfif" alt="No Orders" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No orders yet</h3>
          <p className="text-slate-400 text-sm">Accept a vendor quote to create your first order.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order: any) => {
            const isMarketplace = !(order.quoteId || order.quote);
            const activeStatusSteps = isMarketplace ? marketplaceStatusSteps : statusSteps;
            const currentStep = activeStatusSteps.findIndex(s => s.key === order.status);

            return (
              <div key={order.id} className="glass rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{isMarketplace ? 'Marketplace Order ID' : 'Order ID'}</p>
                    <h3 className="font-mono text-sm text-white font-bold">#{order.id.slice(-8).toUpperCase()}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Vendor: <span className="text-white">{order.vendor?.user?.name || order.vendor?.companyName}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-xl font-bold text-violet-400">₹{order.finalAmount}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="mt-4 mb-2">
                  <div className="flex items-center justify-between relative">
                    {/* Progress line */}
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10 z-0" />
                    <div
                      className="absolute top-4 left-0 h-0.5 bg-violet-600 z-0 transition-all duration-700"
                      style={{ width: `${(currentStep / (activeStatusSteps.length - 1)) * 100}%` }}
                    />

                    {activeStatusSteps.map((step, idx) => {
                      const done = idx <= currentStep;
                      const current = idx === currentStep;
                      return (
                        <div key={step.key} className="flex flex-col items-center z-10 relative" style={{ width: `${100 / activeStatusSteps.length}%` }}>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                              current
                                ? 'bg-violet-600 ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0a0a0f]'
                                : done
                                ? 'bg-violet-900'
                                : 'bg-white/5'
                            }`}
                          >
                            {step.icon}
                          </div>
                          <p className={`text-xs mt-2 text-center leading-tight ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shipping info */}
                {order.deliveryAddress && (
                  <div className="mt-6 mb-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 flex gap-3">
                    <span className="text-sm mt-0.5 opacity-80">📍</span>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Shipping Destination</p>
                      <p className="text-sm text-slate-300">
                        {order.deliveryAddress}
                        {(order.city || order.state || order.pincode) && (
                          <span className="block text-xs mt-1 text-slate-400">
                            {[order.city, order.state, order.pincode].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tracking log */}
                {order.trackingEvents?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-slate-500 mb-2">History</p>
                    <div className="space-y-1">
                      {[...order.trackingEvents].reverse().slice(0, 3).map((ev: any) => (
                        <div key={ev.id} className="flex items-center gap-2 text-xs text-slate-400">
                           <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                          <span>{ev.note || ev.status}</span>
                          <span className="ml-auto text-slate-600">
                            {new Date(ev.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refund Status & Info */}
                {refunds[order.id] && (
                  <div className="mt-4 p-3 rounded-xl bg-purple-900/10 border border-purple-500/20">
                    <p className="text-xs text-purple-400 font-semibold mb-1">
                      {refunds[order.id].type === 'FULL_RETURN' ? 'Return' : 'Refund'} Status: {refunds[order.id].status.replace('_', ' ')}
                    </p>
                    
                    {/* Financial Breakdown for Customer */}
                    <div className="mt-2 text-[10px] space-y-1 text-slate-400 border-t border-purple-500/10 pt-2">
                      <div className="flex justify-between">
                        <span>Original Order Total:</span>
                        <span className="text-white">₹{refunds[order.id].orderAmount}</span>
                      </div>
                      <div className="flex justify-between font-bold text-green-400">
                        <span>Your Refund (80%):</span>
                        <span>₹{refunds[order.id].customerRefund}</span>
                      </div>
                    </div>

                    {refunds[order.id].status === 'REPLACEMENT_SHIPPED' && (
                      <div className="mt-2">
                        <p className="text-sm text-slate-300">
                          📦 Replacement shipped! Tracking: <span className="text-white font-bold">{refunds[order.id].replacementTrackingId}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Please confirm below once you receive it.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/5 pt-4">
                  {/* Replacement Confirmation Button */}
                  {refunds[order.id]?.status === 'REPLACEMENT_SHIPPED' ? (
                    <>
                      <p className="text-xs text-slate-400 mr-auto">Confirm replacement receipt to resolve case.</p>
                      <button
                        onClick={async () => {
                          try {
                            await refundApi.customerConfirm(refunds[order.id].id);
                            setRefunds((prev: Record<string, any>) => ({...prev, [order.id]: {...prev[order.id], status: 'RESOLVED_REPLACED'}}));
                          } catch (err: any) { alert(err.message); }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        ✅ Confirm Replacement Received
                      </button>
                    </>
                  ) : order.status !== 'DELIVERED' ? (
                    <>
                      <p className="text-xs text-slate-400 mr-auto">
                        {order.status === 'OUT_FOR_DELIVERY' ? 'Click when arrived safely.' : 'Waiting for vendor to ship out...'}
                      </p>
                      <button
                        onClick={() => handleConfirmReceipt(order.id)}
                        disabled={order.status !== 'OUT_FOR_DELIVERY'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          order.status === 'OUT_FOR_DELIVERY'
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-green-900/40 border border-green-900/50 text-green-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        ✅ Confirm Package Received
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-green-900/40 border border-green-800 text-green-400 rounded-lg text-sm font-medium inline-block mr-auto">
                        🎉 Delivered
                      </div>

                      {/* 48h refund window */}
                      {(() => {
                        if (refunds[order.id]) return null; // Already filed
                        
                        const hours = getRefundHoursLeft(order);
                        if (hours === null || hours <= 0) return null;
                        
                        return (
                          <Link
                            href={`/dashboard/customer/refund/${order.id}`}
                            className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/40 text-amber-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                          >
                            🔄 Refund
                            <span className="text-xs opacity-75">({Math.floor(hours)}h left)</span>
                          </Link>
                        );
                      })()}

                      <button
                        onClick={() => handleHideOrder(order.id)}
                        className="px-4 py-2 bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/50 rounded-lg text-sm font-medium transition-colors"
                      >
                        🗑️ Remove from History
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {hasMoreHistory && (
        <div className="mt-6 flex justify-center">
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
