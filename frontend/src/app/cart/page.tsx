'use client';

import { useState, useEffect } from 'react';
import { cartApi, authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { usePincode } from '@/hooks/usePincode';
import { Trash2, Plus, Minus, MapPin, CheckCircle2, Loader2, Info } from 'lucide-react';

export default function CartPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ deliveryAddress: '', city: '', state: '', pincode: '' });
  const pincodeData = usePincode(form.pincode);

  // Auto-fill city/state when pincode is validated
  useEffect(() => {
    if (pincodeData.isValid) {
      setForm(prev => ({
        ...prev,
        city: pincodeData.city || prev.city,
        state: pincodeData.state || prev.state
      }));
    }
  }, [pincodeData.isValid, pincodeData.city, pincodeData.state]);

  const fetchCart = async () => {
    try {
      const data = await cartApi.get();
      setCart(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      fetchCart();
      // Auto-fill the saved delivery address from profile
      authApi.me().then((data: any) => {
        setForm(prev => ({
          ...prev,
          deliveryAddress: data?.deliveryAddress || '',
          city: data?.city || '',
          state: data?.state || '',
          pincode: data?.pincode || '',
        }));
      }).catch(() => {});
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleRemove = async (itemId: string) => {
    try {
      await cartApi.remove(itemId);
      fetchCart();
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      await cartApi.clear();
      fetchCart();
    } catch (err: any) {
      setError(err.message || 'Failed to clear cart');
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return handleRemove(itemId);
    try {
      // Find item in state to check stock limit instantly if possible
      const item = cart?.items?.find((i: any) => i.id === itemId);
      if (item && newQuantity > item.product.stock) {
        setError(`Only ${item.product.stock} items in stock`);
        return;
      }
      // Optimistic update
      setCart((prev: any) => ({
        ...prev,
        items: prev.items.map((i: any) => i.id === itemId ? { ...i, quantity: newQuantity } : i)
      }));
      await cartApi.updateQuantity(itemId, newQuantity);
      fetchCart();
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity');
      fetchCart(); // Revert on failure
    }
  };

  const handleCheckout = async () => {
    if (!form.deliveryAddress.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim() || !pincodeData.isValid) {
      setError('Please provide a valid PIN code and complete delivery details.');
      return;
    }
    setCheckingOut(true);
    setError('');
    try {
      await cartApi.checkout(form);
      router.push('/dashboard/customer/orders');
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
      setCheckingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto pt-32 px-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Please log in to view your cart</h1>
        <Link href="/login" className="px-6 py-2.5 bg-violet-600 text-white rounded-xl inline-block">Login</Link>
      </div>
    );
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="w-8 h-8 spinner" /></div>;

  return (
    <div className="max-w-5xl mx-auto pt-24 px-4 pb-12">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Shopping Cart</h1>
          <p className="text-slate-400">Review items you have added from the marketplace.</p>
        </div>
        {cart?.items?.length > 0 && (
          <button 
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Clear Cart
          </button>
        )}
      </div>
      
      {error && <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>}

      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h3 className="text-xl font-semibold text-white mb-2">Your cart is empty</h3>
          <p className="text-slate-400 text-sm mb-6">Browse the marketplace to find custom 3D printed items.</p>
          <Link href="/marketplace" className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium">
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            {cart.items.map((item: any) => (
              <div key={item.id} className="glass rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center relative group">
                <div className="relative w-24 h-24 bg-black/40 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/5">
                   {item.product?.imageUrl ? <Image src={item.product?.imageUrl} alt={item.product?.name || "Product"} fill className="object-cover" /> : <span className="text-3xl opacity-50">📦</span>}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-white truncate text-lg group-hover:text-violet-400 transition-colors">{item.product?.name || 'Unknown Product'}</h3>
                      <p className="text-sm text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> {item.product?.vendor?.companyName}</p>
                    </div>
                    <p className="font-bold text-violet-400 text-lg">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                      <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} className="px-3 py-1.5 hover:bg-white/10 text-slate-300 transition-colors"><Minus className="w-4 h-4" /></button>
                      <span className="px-3 py-1.5 text-sm font-semibold w-10 text-center border-x border-white/10">{item.quantity}</span>
                      <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} className="px-3 py-1.5 hover:bg-white/10 text-slate-300 transition-colors"><Plus className="w-4 h-4" /></button>
                    </div>
                    
                    <button onClick={() => handleRemove(item.id)} className="text-sm text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
            <div className="glass rounded-2xl p-6 h-fit sticky top-24 border border-white/5 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">Order Summary</h3>
            
            <div className="mb-6 space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Delivery Setup</label>
              
              <div className="relative">
                <input
                  value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })}
                  placeholder="6-Digit PIN Code" maxLength={6} 
                  className={`w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm transition-colors ${
                    pincodeData.isValid ? 'border-green-500/50' : pincodeData.error ? 'border-red-500/50' : 'border-white/10'
                  }`}
                />
                <div className="absolute right-3 top-3">
                  {pincodeData.loading && <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />}
                  {!pincodeData.loading && pincodeData.isValid && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </div>
                {pincodeData.error && <p className="text-[10px] text-red-400 mt-1 ml-1">{pincodeData.error}</p>}
              </div>

              <div className="flex gap-3">
                <input
                  value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  readOnly={pincodeData.isValid}
                  placeholder="City/District" 
                  className="flex-1 w-1/2 px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm disabled:opacity-50"
                />
                <input
                  value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                  readOnly={pincodeData.isValid}
                  placeholder="State" 
                  className="flex-1 w-1/2 px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm disabled:opacity-50"
                />
              </div>

              <textarea
                value={form.deliveryAddress}
                onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                placeholder="House/Flat No, Building, Street Area..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none text-sm"
              />
            </div>

            <div className="space-y-4 text-sm text-slate-300 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Subtotal ({cart.items.length} items)</span>
                <span className="font-medium">₹{(cart.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center group relative cursor-help">
                <span className="text-slate-400 flex items-center gap-1 border-b border-dashed border-slate-600">
                  Shipping Cost <Info className="w-3 h-3" />
                </span>
                <span className="font-medium text-amber-400">+ ₹{(cart.shipping || 0).toFixed(2)}</span>
                
                {/* Tooltip for shipping info */}
                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black text-[10px] text-slate-300 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Shipping is calculated at ₹50 per unique vendor. Items from the same vendor share shipping.
                </div>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="font-bold text-white text-base">Total to Pay</span>
                <span className="font-bold text-violet-400 text-2xl">₹{(cart.total || cart.subtotal || 0).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkingOut || !form.deliveryAddress.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim() || !pincodeData.isValid}
              className="w-full py-4 bg-violet-600 hover:bg-violet-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-900/30 uppercase tracking-widest text-sm"
            >
              {checkingOut ? 'Processing Order...' : 'Secure Checkout'}
            </button>
            {(!form.deliveryAddress.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim() || !pincodeData.isValid) && (
              <p className="text-[10px] text-amber-500/80 text-center mt-3 uppercase tracking-wider font-bold">Provide a valid PIN & complete delivery setup</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
