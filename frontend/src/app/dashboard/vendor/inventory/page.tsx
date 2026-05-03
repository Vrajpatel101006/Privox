'use client';

import { useState, useEffect } from 'react';
import { productApi } from '@/lib/api';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import Image from 'next/image';

export default function VendorInventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category: '', imageUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError('');
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await productApi.uploadImage(formData);
      setForm(prev => ({ ...prev, imageUrl: res.imageUrl }));
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    refreshProducts();
  }, []);

  const refreshProducts = () => {
    productApi.vendorInventory()
      .then((data: any) => setProducts(data))
      .catch(() => setError('Failed to load inventory'))
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await productApi.update(editingId, { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) });
      } else {
        await productApi.create({ ...form, price: parseFloat(form.price), stock: parseInt(form.stock) });
      }
      setForm({ name: '', description: '', price: '', stock: '', category: '', imageUrl: '' });
      setShowForm(false);
      setEditingId(null);
      refreshProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async (productId: string) => {
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) { setError('Enter a valid quantity to restock.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res: any = await productApi.restock(productId, qty);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: res.newStock } : p));
      setRestockingId(null);
      setRestockQty('');
    } catch (err: any) {
      setError(err.message || 'Restock failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.vendorPrice ?? product.price), // edit uses vendor's price, not marked-up price
      stock: String(product.stock),
      category: product.category || '',
      imageUrl: product.imageUrl || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 spinner" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your store's product listings</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', description: '', price: '', stock: '', category: '', imageUrl: '' }); }}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>}

      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Product' : 'New Product'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Product Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Geometric Phone Stand" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Your Price (₹)</label>
                <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="299.00" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm" />
                {form.price && !isNaN(parseFloat(form.price)) && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5 flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Your earnings</span>
                    <span className="text-[11px] text-green-400 font-semibold">₹{parseFloat(form.price).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-600">+10% fee</span>
                    <span className="text-[11px] text-violet-400 font-semibold">Customer pays ₹{(parseFloat(form.price) * 1.10).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Stock</label>
                <input type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="10" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500 text-sm appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#0f0f1a] text-slate-400">Select a category...</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-[#0f0f1a] text-white">
                      {cat.emoji} {cat.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Product Image</label>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer text-sm font-medium transition-colors flex-1 text-center text-slate-300">
                    {uploadingImage ? 'Uploading...' : form.imageUrl ? 'Change Image' : 'Upload Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                  {form.imageUrl && (
                    <div 
                      className="relative group cursor-pointer h-[42px] w-[42px] rounded-lg overflow-hidden border border-white/10 shrink-0"
                      onClick={() => setForm({ ...form, imageUrl: '' })}
                      title="Click to remove image"
                    >
                      <Image src={form.imageUrl} alt="preview" fill className="object-cover transition-all duration-300 group-hover:blur-[2px] group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300">
                        <span className="text-red-400 text-sm leading-none drop-shadow-md">✕</span>
                        <span className="text-[7px] text-red-200 mt-0.5 font-bold uppercase tracking-wider drop-shadow-md">Delete</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="Brief product description..." className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition-colors">
              {submitting ? 'Saving...' : editingId ? '💾 Save Changes' : '✅ List Product'}
            </button>
          </form>
        </div>
      )}

      {products.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h3 className="text-xl font-semibold text-white mb-2">No products yet</h3>
          <p className="text-slate-400 text-sm">Add your first product to start selling in the marketplace.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: any) => (
            <div key={p.id} className="glass rounded-xl p-4">
              {/* Main row */}
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                  {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover rounded-lg" /> : '🖨️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category || 'Uncategorized'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">Your price</p>
                  <p className="text-sm font-bold text-green-400">₹{Number(p.vendorPrice ?? p.price).toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Customer pays</p>
                  <p className="text-xs font-semibold text-violet-400">₹{Number(p.price).toFixed(2)}</p>
                  <p className={`text-xs mt-0.5 ${p.stock > 5 ? 'text-green-400' : p.stock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleEdit(p)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setRestockingId(restockingId === p.id ? null : p.id); setRestockQty(''); }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/20 text-xs text-emerald-400 transition-colors"
                  >
                    📦 Restock
                  </button>
                </div>
              </div>

              {/* Inline Restock Panel */}
              {restockingId === p.id && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">Add stock:</span>
                  <input
                    type="number"
                    min="1"
                    value={restockQty}
                    onChange={e => setRestockQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRestock(p.id)}
                    placeholder="e.g. 50"
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  <span className="text-xs text-slate-500 shrink-0">
                    {p.stock} + {parseInt(restockQty) > 0 ? parseInt(restockQty) : '?'} = <span className="text-white font-semibold">{parseInt(restockQty) > 0 ? p.stock + parseInt(restockQty) : '?'}</span>
                  </span>
                  <button
                    onClick={() => handleRestock(p.id)}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs text-white font-medium transition-colors shrink-0"
                  >
                    {submitting ? '...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => { setRestockingId(null); setRestockQty(''); }}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
