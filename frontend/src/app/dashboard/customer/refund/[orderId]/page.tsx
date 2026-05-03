'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderApi, refundApi } from '@/lib/api';

const REFUND_TYPES = [
  {
    key: 'WRONG_ORDER',
    label: '📦 Wrong Order',
    desc: 'I received a different item than what I ordered.',
    resolution: 'Vendor will ship the correct item.',
    color: 'from-blue-600/20 to-blue-800/10 border-blue-500/30',
  },
  {
    key: 'PARTIAL_DAMAGE',
    label: '🔧 Partially Damaged',
    desc: 'Part of the model is broken or has print defects.',
    resolution: 'Vendor will repair or reprint the item.',
    color: 'from-yellow-600/20 to-yellow-800/10 border-yellow-500/30',
  },
  {
    key: 'FULL_DAMAGE',
    label: '💔 Fully Damaged',
    desc: 'The entire model arrived broken or unusable.',
    resolution: 'Vendor will reprint and send a new item.',
    color: 'from-red-600/20 to-red-800/10 border-red-500/30',
  },
  {
    key: 'FULL_RETURN',
    label: '↩️ Full Return',
    desc: 'I want to return the item and get a refund.',
    resolution: 'You send the item back. Receive 85% of the order amount. (5% platform handling + 10% vendor return fee deducted.)',
    color: 'from-purple-600/20 to-purple-800/10 border-purple-500/30',
  },
];

export default function RefundRequestPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'details' | 'upload' | 'done'>('select');
  const [refundId, setRefundId] = useState('');

  useEffect(() => {
    orderApi.getStatus(orderId)
      .then((data: any) => setOrder(data))
      .catch(() => setError('Could not load order details.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const hoursRemaining = () => {
    if (!order?.deliveredAt) return null;
    const delivered = new Date(order.deliveredAt);
    const deadline = new Date(delivered.getTime() + 48 * 60 * 60 * 1000);
    const remaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    return Math.max(0, remaining);
  };

  const timeLeft = hoursRemaining();
  const windowExpired = timeLeft !== null && timeLeft <= 0;

  const handleSubmitRequest = async () => {
    if (!selectedType || !description.trim()) {
      setError('Please select a refund type and provide a description.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result: any = await refundApi.request({ orderId, type: selectedType, description });
      setRefundId(result.id);
      setStep('upload');
    } catch (err: any) {
      setError(err.message || 'Failed to submit refund request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProof = async () => {
    if (!photoFile && !videoFile) {
      setStep('done'); // Allow skipping upload if no files
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      if (photoFile) formData.append('photo', photoFile);
      if (videoFile) formData.append('video', videoFile);
      await refundApi.uploadProof(refundId, formData);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to upload proof. Your request was filed, but evidence failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 spinner" />
      </div>
    );
  }

  if (windowExpired) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <div className="glass rounded-2xl p-10">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-white mb-3">Refund Window Closed</h1>
          <p className="text-slate-400">The 48-hour refund window for this order has expired. Refunds can only be requested within 48 hours of confirming delivery.</p>
          <button onClick={() => router.push('/dashboard/customer/orders')} className="mt-6 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <div className="glass rounded-2xl p-10">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-3">Refund Request Filed!</h1>
          <p className="text-slate-400 mb-2">Your request has been sent to the vendor. They have <strong className="text-white">72 hours</strong> to respond.</p>
          <p className="text-slate-500 text-sm">Payment is frozen and will not be released to the vendor until this is resolved.</p>
          <button onClick={() => router.push('/dashboard/customer/orders')} className="mt-6 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-300 text-sm mb-4 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Request a Refund</h1>
        {timeLeft !== null && (
          <p className="text-sm text-amber-400 mt-1">
            ⏳ Refund window closes in <strong>{Math.floor(timeLeft)}h {Math.round((timeLeft % 1) * 60)}m</strong>
          </p>
        )}
        {order && (
          <p className="text-slate-500 text-sm mt-1">Order #{orderId.slice(-8)} · ₹{order.finalAmount}</p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Step 1: Select refund type */}
      {(step === 'select' || step === 'details') && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">What is the issue?</h2>
          {REFUND_TYPES.map(type => (
            <button
              key={type.key}
              onClick={() => { setSelectedType(type.key); setStep('details'); }}
              className={`w-full text-left p-4 rounded-xl bg-gradient-to-br border transition-all ${type.color} ${selectedType === type.key ? 'ring-2 ring-violet-500' : 'hover:border-white/20'}`}
            >
              <p className="text-white font-semibold text-sm">{type.label}</p>
              <p className="text-slate-400 text-xs mt-1">{type.desc}</p>
              <p className="text-violet-400 text-xs mt-1.5 font-medium">Resolution: {type.resolution}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Description */}
      {step === 'details' && selectedType && (
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Describe the issue</h2>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Please describe the problem in detail. What did you receive? What was wrong with it?"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 text-sm resize-none"
          />
          <p className="text-slate-500 text-xs">💡 You'll be able to upload photo and video evidence in the next step.</p>
          <button
            onClick={handleSubmitRequest}
            disabled={submitting || !description.trim()}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {submitting ? 'Filing Request...' : 'File Refund Request →'}
          </button>
        </div>
      )}

      {/* Step 3: Upload proof */}
      {step === 'upload' && (
        <div className="glass rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-white font-semibold mb-1">Upload Proof (Recommended)</h2>
            <p className="text-slate-400 text-xs">Strong proof significantly improves your chances of a successful refund. Upload a photo AND an unboxing video if possible.</p>
          </div>

          {/* Photo upload */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-semibold">📷 Damage Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-white/10 file:text-white hover:file:bg-white/20"
            />
            {photoFile && <p className="text-xs text-green-400 mt-1">✓ {photoFile.name}</p>}
          </div>

          {/* Video upload */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-semibold">🎥 Unboxing Video <span className="text-violet-400">(Strongest proof)</span></label>
            <p className="text-[11px] text-slate-600 mb-2">Record yourself opening the package for the first time. This proves the damage existed at delivery. Max 200MB.</p>
            <input
              type="file"
              accept="video/*"
              onChange={e => setVideoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-white/10 file:text-white hover:file:bg-white/20"
            />
            {videoFile && <p className="text-xs text-green-400 mt-1">✓ {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)}MB)</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('done')}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm transition-colors"
            >
              Skip — File Without Proof
            </button>
            <button
              onClick={handleUploadProof}
              disabled={submitting || (!photoFile && !videoFile)}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {submitting ? 'Uploading...' : 'Submit with Proof'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
