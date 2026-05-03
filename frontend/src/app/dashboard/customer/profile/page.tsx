'use client';

import { useState, useEffect, useRef } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePincode } from '@/hooks/usePincode';
import { 
  Loader2, 
  CheckCircle2, 
  User, 
  MapPin, 
  Mail, 
  ShieldCheck, 
  Camera, 
  Trash2, 
  Save,
  Globe,
  Navigation,
  X
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ city: '', state: '', pincode: '', deliveryAddress: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const pincodeData = usePincode(form.pincode);

  useEffect(() => {
    if (pincodeData.isValid) {
      setForm(prev => ({
        ...prev,
        city: pincodeData.city || prev.city,
        state: pincodeData.state || prev.state
      }));
    }
  }, [pincodeData.isValid, pincodeData.city, pincodeData.state]);

  useEffect(() => {
    authApi.me().then((data: any) => {
      setForm({ city: data.city || '', state: data.state || '', pincode: data.pincode || '', deliveryAddress: data.deliveryAddress || '' });
      setAvatarUrl(data.avatarUrl || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const res = await authApi.uploadAvatar(fd);
      setAvatarUrl(res.avatarUrl);
      setSuccess('Profile photo updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pincode.trim()) { setError('PIN code is required.'); return; }
    if (!/^\d{6}$/.test(form.pincode.trim())) { setError('PIN code must be exactly 6 digits.'); return; }
    if (!pincodeData.isValid && form.pincode.length === 6) { setError('Please enter a valid Indian PIN code.'); return; }
    
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await authApi.updateProfile(form);
      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Loading profile...</p>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto pb-12"
    >
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Profile Settings</h1>
          <p className="text-slate-400 mt-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Manage your personal identity and delivery preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Photo & Account Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Photo */}
          <div className="glass rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl relative group/avatar">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Profile" fill className="object-cover transition-transform group-hover/avatar:scale-110 duration-500" />
                ) : (
                  <span className="text-4xl font-black text-white">{initials}</span>
                )}
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center transition-all duration-300"
                >
                  <Camera className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Change</span>
                </button>
              </div>
              
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-white mb-1">{user?.name}</h3>
            <p className="text-slate-500 text-sm flex items-center gap-1 justify-center">
              <Mail className="w-3 h-3" /> {user?.email}
            </p>
            
            <div className="mt-6 w-full pt-6 border-t border-white/5 flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95"
              >
                Upload New Photo
              </button>
              {avatarUrl && (
                <button
                  onClick={() => { setAvatarUrl(''); authApi.updateProfile({ avatarUrl: '' }); }}
                  className="w-full py-3 rounded-2xl bg-red-500/5 hover:bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3 h-3" /> Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Role Badge */}
          <div className="glass rounded-3xl p-6 border-l-4 border-violet-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-600/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Account Type</p>
                <p className="text-lg font-black text-white uppercase">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info Form */}
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSave} className="space-y-8">
            {/* Account Information Section */}
            <section className="glass rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <User className="w-24 h-24 text-white" />
              </div>
              
              <h3 className="text-sm font-black text-violet-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <div className="w-6 h-1 bg-violet-500 rounded-full" />
                Account Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input 
                      value={user?.name} 
                      disabled 
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-500 text-sm focus:outline-none cursor-not-allowed opacity-60" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input 
                      value={user?.email} 
                      disabled 
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-500 text-sm focus:outline-none cursor-not-allowed opacity-60" 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Delivery Details Section */}
            <section className="glass rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Navigation className="w-24 h-24 text-white" />
              </div>

              <h3 className="text-sm font-black text-violet-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <div className="w-6 h-1 bg-violet-500 rounded-full" />
                Delivery Logistics
              </h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PIN Code */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex justify-between">
                      PIN Code <span className="text-red-500/50">* Required</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        value={form.pincode}
                        onChange={e => {
                          const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setForm(f => ({ ...f, pincode: pin }));
                        }}
                        placeholder="6-digit PIN" maxLength={6} inputMode="numeric" required
                        className={`w-full pl-12 pr-12 py-4 rounded-2xl bg-white/5 border text-white placeholder-slate-600 focus:outline-none text-sm transition-all ${
                          pincodeData.isValid ? 'border-emerald-500/50 bg-emerald-500/5' : pincodeData.error ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-violet-500 focus:bg-white/10'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {pincodeData.loading && <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />}
                        {!pincodeData.loading && pincodeData.isValid && <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-in zoom-in duration-300" />}
                      </div>
                    </div>
                    {pincodeData.error && <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mt-1 px-1">⚠️ {pincodeData.error}</p>}
                  </div>

                  {/* City */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">City / District</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                      <input 
                        value={form.city} 
                        onChange={e => setForm({ ...form, city: e.target.value })}
                        readOnly={pincodeData.isValid}
                        placeholder="e.g. Mumbai"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/10 text-sm transition-all read-only:opacity-60" 
                      />
                    </div>
                  </div>
                </div>

                {/* State */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">State</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors flex items-center justify-center text-[10px] font-black border border-slate-700 rounded">IN</div>
                    <input 
                      value={form.state} 
                      onChange={e => setForm({ ...form, state: e.target.value })}
                      readOnly={pincodeData.isValid}
                      placeholder="e.g. Maharashtra"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/10 text-sm transition-all read-only:opacity-60" 
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Delivery Address</label>
                  <textarea 
                    value={form.deliveryAddress} 
                    onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                    placeholder="Flat/House No., Building, Street, Area, Landmarks..."
                    rows={4} 
                    className="w-full px-5 py-4 rounded-3xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/10 text-sm resize-none transition-all" 
                  />
                </div>
              </div>
            </section>

            {/* Notification/Message Area */}
            {(error || success) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {error ? <X className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                <p className="text-sm font-bold tracking-wide">{error || success}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={saving}
                className="group relative px-10 py-5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-900/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
