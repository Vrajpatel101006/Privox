'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { vendorApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`text-2xl transition-all ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} ${
            star <= (hovered || value) ? 'text-yellow-400' : 'text-slate-600'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function VendorPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rateError, setRateError] = useState('');
  const [rateSuccess, setRateSuccess] = useState('');

  const load = () => {
    setLoading(true);
    vendorApi.getProfile(id)
      .then((data: any) => setVendor(data))
      .catch(() => setVendor(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setRateError('Please select a star rating.'); return; }
    setSubmitting(true);
    setRateError('');
    try {
      const result: any = await vendorApi.rate(id, { rating, comment });
      setRateSuccess(`Thanks! New average: ⭐ ${result.newAverage}`);
      setRating(0);
      setComment('');
      load(); // refresh ratings
    } catch (err: any) {
      setRateError(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><div className="w-10 h-10 spinner" /></div>;
  if (!vendor) return (
    <div className="max-w-2xl mx-auto pt-12 text-center">
      <p className="text-5xl mb-4">🤔</p>
      <h2 className="text-xl font-bold text-white">Vendor not found</h2>
    </div>
  );

  const fullStars = Math.round(vendor.rating);

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* Header Card */}
      <div className="glass rounded-2xl p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar / Logo */}
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shrink-0">
            {vendor.logoUrl ? (
              <Image src={vendor.logoUrl} alt={vendor.companyName} fill className="object-cover" />
            ) : (
              vendor.companyName?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{vendor.companyName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{vendor.user?.name}</p>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {vendor.location && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <span>📍</span> {vendor.location}
                  {vendor.pincode && <span className="text-slate-500">— {vendor.pincode}</span>}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm">
                <span className="text-yellow-400 text-base">⭐</span>
                <span className="text-white font-semibold">{vendor.rating || 'No ratings yet'}</span>
                {vendor.totalRatings > 0 && <span className="text-slate-500">({vendor.totalRatings} review{vendor.totalRatings !== 1 ? 's' : ''})</span>}
              </span>
            </div>

            {/* Capabilities badges */}
            {vendor.capabilities?.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {vendor.capabilities.map((c: string) => (
                  <span key={c} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-900/40 text-violet-300 border border-violet-500/20">
                    {c} Models
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {vendor.bio && (
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-slate-300 text-sm leading-relaxed">{vendor.bio}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Reviews */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Reviews</h2>
          {!vendor.recentRatings || vendor.recentRatings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-slate-500 text-sm">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {vendor.recentRatings.map((r: any) => (
                <div key={r.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-white">{r.customerName}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= r.rating ? 'text-yellow-400' : 'text-slate-600'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-slate-400 leading-relaxed">{r.comment}</p>}
                  <p className="text-[10px] text-slate-600 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rate This Vendor */}
        <div className="glass rounded-2xl p-6">
          {user?.role === 'CUSTOMER' ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Rate This Vendor</h2>
              <p className="text-xs text-slate-500 mb-5">Share your experience to help other customers.</p>

              {rateSuccess && <div className="mb-4 px-3 py-2.5 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">{rateSuccess}</div>}
              {rateError && <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{rateError}</div>}

              <form onSubmit={handleRate} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Your Rating</label>
                  <StarRating value={rating} onChange={setRating} />
                  {rating > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Comment (optional)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="How was the print quality, communication, delivery speed..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
                >
                  {submitting ? 'Submitting...' : '⭐ Submit Rating'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🔒</p>
              <p className="text-slate-400 text-sm">Log in as a customer to rate this vendor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
