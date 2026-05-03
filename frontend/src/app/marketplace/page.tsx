'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { productApi, cartApi } from '@/lib/api';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const { Plus, Minus, Search, X, Loader2, ShoppingCart } = Icons;

function MarketplaceContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(searchParams.get('category') || '');
  const [cartNotif, setCartNotif] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(12);

  const fetchProducts = useCallback(async (q?: string, cat?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q) params.search = q;
      if (cat) params.category = cat;
      const data: any = await productApi.list(Object.keys(params).length ? params : undefined);
      setProducts(data.products || []);
      
      // Fetch user's cart to sync quantities
      if (user) {
        const cartData: any = await cartApi.get();
        const itemsMap: Record<string, number> = {};
        cartData?.items?.forEach((i: any) => {
          itemsMap[i.productId] = i.quantity;
        });
        setCartItems(itemsMap);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { 
    const cat = searchParams.get('category');
    if (cat) {
      setActiveCategory(cat);
      fetchProducts(search, cat);
    } else {
      fetchProducts(); 
    }
  }, [fetchProducts, searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(search, activeCategory);
  };

  const handleCategory = (cat: string) => {
    const next = activeCategory === cat ? '' : cat;
    setActiveCategory(next);
    fetchProducts(search, next);
  };

  const clearAll = () => {
    setSearch('');
    setActiveCategory('');
    setVisibleCount(12);
    fetchProducts();
  };

  const handleAddToCart = async (productId: string) => {
    if (!user) { window.location.href = '/login'; return; }
    setAddingId(productId);
    try {
      await cartApi.add({ productId, quantity: 1 });
      setCartItems(prev => ({ ...prev, [productId]: 1 }));
      setCartNotif('Added to cart! ✅');
      setTimeout(() => setCartNotif(''), 2000);
    } catch (err: any) {
      setCartNotif(err.message);
    } finally {
      setAddingId(null);
    }
  };

  const handleUpdateQuantity = async (productId: string, cartItemId: string | undefined, newQuantity: number) => {
    if (!user) return;
    try {
      if (newQuantity < 1) {
        // Find cart item id to remove
        const cartData: any = await cartApi.get();
        const item = cartData?.items?.find((i: any) => i.productId === productId);
        if (item) await cartApi.remove(item.id);
        setCartItems(prev => { const next = {...prev}; delete next[productId]; return next; });
      } else {
        // Check stock instantly
        const prod = products.find(p => p.id === productId);
        if (prod && newQuantity > prod.stock) {
          setCartNotif(`Only ${prod.stock} items in stock`);
          setTimeout(() => setCartNotif(''), 3000);
          return;
        }
        
        // Optimistic UI
        setCartItems(prev => ({ ...prev, [productId]: newQuantity }));
        
        // Find cart item to update
        const cartData: any = await cartApi.get();
        const item = cartData?.items?.find((i: any) => i.productId === productId);
        if (item) {
          await cartApi.updateQuantity(item.id, newQuantity);
        } else {
          await cartApi.add({ productId, quantity: newQuantity });
        }
      }
    } catch (err: any) {
      setCartNotif(err.message);
    }
  };

  const activeCat = PRODUCT_CATEGORIES.find(c => c.id === activeCategory);
  
  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      
      {/* Hero Search Section */}
      <div className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6"
            >
              PRINVOX <span className="text-violet-500">MARKET</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-400 text-lg max-w-2xl mx-auto"
            >
              Discover extraordinary 3D printed creations from India's most talented vendors. 
              Ready-made, verified, and delivered to your doorstep.
            </motion.p>
          </div>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSearch} 
            className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 p-2 rounded-[28px] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl"
          >
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, categories, or artists..."
                className="w-full pl-14 pr-4 py-5 rounded-2xl bg-transparent text-white placeholder-slate-500 focus:outline-none transition-all text-lg"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-10 py-5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-violet-900/40 hover:scale-[1.02] active:scale-95"
            >
              Discover
            </button>
          </motion.form>
        </div>
      </div>

      <div className="pb-16 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Browse by Category Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-violet-600 rounded-full" />
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Browse by Category</h2>
              </div>
              <button 
                onClick={() => { setActiveCategory(''); fetchProducts(search, ''); }}
                className="text-xs font-bold text-slate-500 hover:text-violet-400 uppercase tracking-widest transition-colors"
              >
                Clear Filters
              </button>
            </div>
            
            <div className="relative group/scroll">
              <div className="flex overflow-x-auto pb-6 scrollbar-hide gap-4 snap-x">
                {PRODUCT_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  const IconComponent = (Icons as any)[cat.icon] || Icons.Box;
                  
                  return (
                    <motion.button
                      key={cat.id}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCategory(cat.id)}
                      className={`flex-shrink-0 w-40 h-48 rounded-3xl p-5 flex flex-col items-center justify-between transition-all duration-300 snap-start border relative overflow-hidden ${
                        isActive 
                          ? 'bg-violet-600 border-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-2 ring-violet-500/50' 
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Category Background Theme */}
                      {!isActive && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-40 group-hover:opacity-60 transition-opacity z-0`} />
                      )}
                      
                      {/* Faded Background Image */}
                      {(cat as any).image && (
                        <div className="absolute inset-0 z-0">
                          <Image 
                            src={(cat as any).image} 
                            alt="" 
                            fill 
                            className={`object-cover opacity-20 grayscale mix-blend-overlay transition-transform duration-700 group-hover:scale-125 ${isActive ? 'opacity-40' : 'opacity-10'}`} 
                          />
                          <div className="absolute inset-0 bg-black/40" />
                        </div>
                      )}
                      
                      <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        isActive ? 'bg-white/20 rotate-12 scale-110' : 'bg-white/5'
                      }`}>
                        <IconComponent className={`w-8 h-8 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      
                      <div className="relative z-10 text-center">
                        <span className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isActive ? 'text-violet-200' : 'text-slate-500'}`}>
                          {cat.emoji} Collection
                        </span>
                        <span className={`block text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                          {cat.id}
                        </span>
                      </div>

                      {isActive && (
                        <motion.div 
                          layoutId="active-indicator"
                          className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_#fff]"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
              
              {/* Scroll hints */}
              <div className="absolute left-0 top-0 bottom-6 w-12 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
              <div className="absolute right-0 top-0 bottom-6 w-12 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Active filter pill */}
          {(activeCategory || search) && (
            <div className="flex items-center gap-2 mb-5 text-sm text-slate-400">
              <span>Showing:</span>
              {activeCat && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-900/40 border border-violet-500/30 text-violet-300">
                  {activeCat.emoji} {activeCat.id}
                </span>
              )}
              {search && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  🔍 "{search}"
                </span>
              )}
              <span className="text-slate-600">({products.length} result{products.length !== 1 ? 's' : ''})</span>
            </div>
          )}

          {/* Cart notification */}
          <AnimatePresence>
            {cartNotif && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-green-500/90 backdrop-blur-md text-white font-bold text-sm shadow-2xl shadow-green-900/50"
              >
                {cartNotif}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 spinner" />
            </div>
          ) : products.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center">
              <div className="text-5xl mb-4">{activeCat?.emoji || '🏪'}</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {activeCategory ? `No ${activeCategory} products yet` : 'No products found'}
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                {activeCategory
                  ? 'Vendors haven\'t listed in this category yet. Try another or browse all.'
                  : 'Try a different search term or browse by category.'}
              </p>
              <button onClick={clearAll} className="text-violet-400 hover:text-violet-300 text-sm underline">
                Browse all products
              </button>
            </div>
          ) : (
            <>
              <motion.div 
                layout
                className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {visibleProducts.map((product: any) => {
                    const catMeta = PRODUCT_CATEGORIES.find(c => c.id === product.category);
                    const qtyInCart = cartItems[product.id] || 0;
                    
                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        key={product.id} 
                        className="glass rounded-2xl overflow-hidden hover-lift group flex flex-col border border-white/5 hover:border-violet-500/30 shadow-xl"
                      >
                        {/* Product image */}
                        <div className="h-56 bg-[#12121a] flex items-center justify-center overflow-hidden relative">
                          {product.imageUrl ? (
                            <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                          ) : (
                            <div className="text-6xl opacity-20">{catMeta?.emoji || '🖨️'}</div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          {/* Category badge overlay */}
                          {catMeta && (
                            <span className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-[10px] uppercase tracking-wider text-white font-bold border border-white/10">
                              {catMeta.emoji} {catMeta.id}
                            </span>
                          )}
                        </div>

                        <div className="p-5 flex flex-col flex-1 bg-gradient-to-b from-white/5 to-transparent">
                          <p className="text-[11px] text-slate-400 mb-2 truncate uppercase tracking-wider font-semibold">
                            📍 {product.vendor?.companyName}{product.vendor?.location ? ` · ${product.vendor.location}` : ''}
                          </p>
                          <h3 className="text-base font-bold text-white mb-2 group-hover:text-violet-300 transition-colors line-clamp-2 leading-snug flex-1">
                            {product.name}
                          </h3>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 mb-4">
                            <div>
                              <span className="text-xl font-black text-white">₹{Number(product.price).toFixed(2)}</span>
                              {product.vendor?.rating > 0 && (
                                <p className="text-[10px] text-yellow-400 font-bold tracking-widest mt-0.5">⭐ {product.vendor.rating}</p>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${product.stock > 5 ? 'bg-green-500/10 text-green-400' : product.stock > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                              {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                            </span>
                          </div>

                          {/* Dynamic Cart Action Area */}
                          <div className="h-12 flex items-center justify-center">
                            {qtyInCart > 0 ? (
                              <div className="w-full h-full flex items-center justify-between bg-violet-600/20 border border-violet-500/50 rounded-xl overflow-hidden">
                                <button 
                                  onClick={() => handleUpdateQuantity(product.id, undefined, qtyInCart - 1)}
                                  className="h-full px-4 text-violet-300 hover:bg-violet-600/40 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-white font-bold">{qtyInCart}</span>
                                  <span className="text-[8px] text-violet-300 uppercase tracking-widest">In Cart</span>
                                </div>
                                <button 
                                  onClick={() => handleUpdateQuantity(product.id, undefined, qtyInCart + 1)}
                                  className="h-full px-4 text-violet-300 hover:bg-violet-600/40 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(product.id)}
                                disabled={addingId === product.id || product.stock === 0}
                                className="w-full h-full rounded-xl bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 text-slate-300 hover:text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {addingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : product.stock === 0 ? 'Out of Stock' : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              {/* Load More Pagination */}
              {hasMore && (
                <div className="mt-12 flex justify-center">
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-8 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                  >
                    Load More Products
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
