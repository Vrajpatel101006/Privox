'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';

// Notification counts per section so sidebars can show badges
interface NotifCounts {
  quotes: number;  // new quotes (received or requested)
  orders: number;  // new orders or status changes
  disputes: number; // new refund requests
}

interface SocketContextType {
  socket: Socket | null;
  notifCounts: NotifCounts;
  clearNotif: (key: keyof NotifCounts) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  notifCounts: { quotes: 0, orders: 0, disputes: 0 },
  clearNotif: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifCounts, setNotifCounts] = useState<NotifCounts>({ quotes: 0, orders: 0, disputes: 0 });

  const bumpNotif = (key: keyof NotifCounts) =>
    setNotifCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));

  const clearNotif = (key: keyof NotifCounts) =>
    setNotifCounts((prev) => ({ ...prev, [key]: 0 }));

  useEffect(() => {
    // Create socket only once
    if (!socketRef.current) {
      const s = io(BASE_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });
      socketRef.current = s;
      setSocket(s);
    }

    return () => {
      // Only disconnect when the entire app unmounts (not on every re-render)
    };
  }, []);

  // Whenever the authenticated user changes (login/logout), re-join rooms
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !user?.id) return;

    const joinRooms = () => {
      s.emit('join:user', user.id);
      if (user.role === 'VENDOR' && user.vendorId) {
        s.emit('join:vendor', user.vendorId);
      }
    };

    // If socket is already connected, join immediately
    if (s.connected) {
      joinRooms();
    }
    // Also join on every reconnect
    s.on('connect', joinRooms);

    return () => {
      s.off('connect', joinRooms);
    };
  }, [user?.id, user?.vendorId, user?.role]);

  // Bind notification event listeners once (on socket creation)
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    // ── VENDOR: new quote request from a customer ──
    const onQuoteRequest = (_data: any) => {
      bumpNotif('quotes');
      toast('📨 New Quote Request from a customer!', {
        duration: 5000,
        style: { background: '#1e1b4b', color: '#c4b5fd', border: '1px solid #7c3aed' },
      });
    };

    // ── CUSTOMER: vendor sent back a priced quote ──
    const onQuoteReceived = (data: any) => {
      bumpNotif('quotes');
      toast(`💰 New quote received — ₹${Number(data?.totalCost || 0).toFixed(0)}`, {
        duration: 5000,
        style: { background: '#052e16', color: '#86efac', border: '1px solid #16a34a' },
      });
    };

    // ── VENDOR: customer accepted a quote → new order ──
    const onOrderNew = (data: any) => {
      bumpNotif('orders');
      toast(`🎉 New Order! #${(data?.id || '').slice(-8).toUpperCase()}`, {
        duration: 6000,
        style: { background: '#0c1929', color: '#93c5fd', border: '1px solid #2563eb' },
      });
    };

    // ── CUSTOMER or VENDOR: order manufacturing stage changed ──
    const onOrderStatus = (data: any) => {
      bumpNotif('orders');
      const label = (data?.status || '').replace(/_/g, ' ');
      toast(`🚚 Order status: ${label}`, {
        duration: 5000,
        style: { background: '#1c1404', color: '#fcd34d', border: '1px solid #d97706' },
      });
    };

    // ── VENDOR: customer filed a refund request ──
    const onRefundRequest = (data: any) => {
      bumpNotif('disputes');
      toast(`⚖️ New Dispute: Customer filed a refund for order #${(data?.orderId || '').slice(-8).toUpperCase()}`, {
        duration: 7000,
        style: { background: '#3b0764', color: '#e9d5ff', border: '1px solid #9333ea' },
      });
    };

    // ── CUSTOMER: vendor accepted or disputed the claim ──
    const onVendorResponse = (data: any) => {
      if (data?.action === 'ACCEPT') {
        toast(`✅ Vendor accepted your refund claim. They will ship a replacement soon.`, {
          duration: 7000,
          style: { background: '#064e3b', color: '#6ee7b7', border: '1px solid #059669' },
        });
      } else if (data?.action === 'DISPUTE') {
        toast(`⚖️ Vendor disputed your claim. The Admin team is now reviewing your case.`, {
          duration: 7000,
          style: { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626' },
        });
      }
    };

    // ── CUSTOMER: vendor shipped the replacement ──
    const onReplacementShipped = (data: any) => {
      toast(`📦 Your replacement has been shipped! Tracking: ${data?.trackingId}`, {
        duration: 7000,
        style: { background: '#1e3a8a', color: '#bfdbfe', border: '1px solid #2563eb' },
      });
    };

    // ── CUSTOMER / VENDOR: admin made final decision ──
    const onAdminResolved = (data: any) => {
      const isRefund = data?.decision === 'REFUND_CUSTOMER';
      toast(`⚖️ Admin Decision: ${isRefund ? 'Customer Refunded' : 'Claim Rejected, Vendor Paid'}`, {
        duration: 8000,
        style: { background: '#4c1d95', color: '#ddd6fe', border: '1px solid #7c3aed' },
      });
    };

    s.on('quote:request_received', onQuoteRequest);
    s.on('quote:received', onQuoteReceived);
    s.on('order:new', onOrderNew);
    s.on('order:status_updated', onOrderStatus);
    s.on('refund:request', onRefundRequest);
    s.on('refund:vendor_response', onVendorResponse);
    s.on('refund:replacement_shipped', onReplacementShipped);
    s.on('refund:resolved', onAdminResolved);

    return () => {
      s.off('quote:request_received', onQuoteRequest);
      s.off('quote:received', onQuoteReceived);
      s.off('order:new', onOrderNew);
      s.off('order:status_updated', onOrderStatus);
      s.off('refund:request', onRefundRequest);
      s.off('refund:vendor_response', onVendorResponse);
      s.off('refund:replacement_shipped', onReplacementShipped);
      s.off('refund:resolved', onAdminResolved);
    };
  }, []); // intentionally empty — bind once to the stable ref

  return (
    <SocketContext.Provider value={{ socket, notifCounts, clearNotif }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
