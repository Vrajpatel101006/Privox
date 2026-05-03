'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { vendorApi, authApi } from '@/lib/api';
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
  Building2,
  Info,
  Maximize2,
  Settings2,
  Briefcase,
  X
} from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

const SIZES = [
  { id: 'Small', label: 'Small Models', desc: 'Up to 250g | 10×10×10 cm', emoji: '📦' },
  { id: 'Medium', label: 'Medium Models', desc: 'Up to 1kg | 20×20×20 cm', emoji: '📦' },
  { id: 'Large', label: 'Large Models', desc: 'Up to 5kg | 40×40×40 cm', emoji: '📦' },
];

export default function VendorProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ companyName: '', city: '', state: '', pincode: '', bio: '' });
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage({ type: '', text: '' });
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await vendorApi.uploadLogo(fd);
      setLogoUrl(res.logoUrl);
      setMessage({ type: 'success', text: 'Company logo updated!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Logo upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const toggleSize = (id: string) => {
    setCapabilities(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  useEffect(() => {
    authApi.me().then((data: any) => {
      const v = data?.vendor;
      setForm({
        companyName: v?.companyName || data?.name || '',
        city: v?.location || '',
        state: v?.state || '',
        pincode: v?.pincode || '',
        bio: v?.bio || '',
      });
      setLogoUrl(v?.logoUrl || '');
      if (v?.capabilities?.length) setCapabilities(v.capabilities);
      else setCapabilities(['Small', 'Medium', 'Large']);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pincode.trim()) { setMessage({ type: 'error', text: 'Pincode is required.' }); return; }
    if (!/^\d{6}$/.test(form.pincode.trim())) { setMessage({ type: 'error', text: 'Pincode must be exactly 6 digits.' }); return; }
    if (!pincodeData.isValid && form.pincode.length === 6) { setMessage({ type: 'error', text: 'Please enter a valid Indian PIN code.' }); return; }
    if (capabilities.length === 0) { setMessage({ type: 'error', text: 'Select at least one supported print size.' }); return; }
    
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await vendorApi.updateProfile({ capabilities, city: form.city, state: form.state, pincode: form.pincode, bio: form.bio, companyName: form.companyName });
      setMessage({ type: 'success', text: 'Vendor profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.companyName || user?.name || '?')[0].toUpperCase();

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Loading vendor details...</p>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto pb-12"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Vendor Control Center</h1>
        <p className="text-slate-400 mt-2 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-violet-400" />
          Configure your digital storefront, print capabilities, and logistics.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Identity & Account */}
          <div className="space-y-6">
            {/* Logo Section */}
            <div className="glass rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative mb-6">
                <div className="w-36 h-36 rounded-3xl overflow-hidden border-4 border-white/10 bg-[#12121a] flex items-center justify-center shadow-2xl relative group/logo">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Company Logo" fill className="object-cover transition-transform group-hover/logo:scale-110 duration-500" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-12 h-12 text-violet-500 opacity-20" />
                      <span className="text-4xl font-black text-white/20">{initials}</span>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover/logo:opacity-100 flex flex-col items-center justify-center transition-all duration-300"
                  >
                    <Camera className="w-8 h-8 text-white mb-1" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Update Logo</span>
                  </button>
                </div>
                
                {uploading && (
                  <div className="absolute inset-0 rounded-3xl bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-1 line-clamp-1">{form.companyName || 'Store Name'}</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 justify-center">
                Verified Vendor
              </p>
              
              <div className="mt-6 w-full pt-6 border-t border-white/5 flex flex-col gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl bg-violet-600/10 hover:bg-violet-600 border border-violet-500/20 hover:border-violet-500 text-violet-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95"
                >
                  Change Branding
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => { setLogoUrl(''); vendorApi.updateProfile({ logoUrl: '' }); }}
                    className="w-full py-3 rounded-2xl bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="glass rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Login Email</p>
                  <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ownership</p>
                  <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Detailed Configuration */}
          <div className="lg:col-span-2 space-y-8">
            {/* Business Profile Section */}
            <section className="glass rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Building2 className="w-24 h-24 text-white" />
              </div>

              <h3 className="text-sm font-black text-violet-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <div className="w-6 h-1 bg-violet-500 rounded-full" />
                Storefront Identity
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Company / Business Name</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input 
                      value={form.companyName} 
                      onChange={e => setForm({ ...form, companyName: e.target.value })}
                      placeholder="e.g. PrintMasters India"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/10 text-sm transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Business Bio / Capabilities</label>
                  <div className="relative group">
                    <Info className="absolute left-4 top-5 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <textarea 
                      value={form.bio} 
                      onChange={e => setForm({ ...form, bio: e.target.value })}
                      placeholder="Describe your equipment, materials, and specialties..." 
                      rows={4}
                      className="w-full pl-12 pr-4 py-4 rounded-3xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:bg-white/10 text-sm resize-none transition-all" 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Print Logistics Section */}
            <section className="glass rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Navigation className="w-24 h-24 text-white" />
              </div>

              <h3 className="text-sm font-black text-violet-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <div className="w-6 h-1 bg-violet-500 rounded-full" />
                Shipping Logistics
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PIN Code */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Operational PIN Code</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={form.pincode}
                      onChange={e => {
                        const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setForm(f => ({ ...f, pincode: pin }));
                      }}
                      placeholder="6-digit PIN code" maxLength={6} required inputMode="numeric"
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
                <div className="space-y-2 col-span-2 md:col-span-1">
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

                {/* State */}
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">State / Province</label>
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
              </div>
            </section>

            {/* Capabilities Section */}
            <section className="glass rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Maximize2 className="w-24 h-24 text-white" />
              </div>

              <h3 className="text-sm font-black text-violet-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <div className="w-6 h-1 bg-violet-500 rounded-full" />
                Supported Print Volumes
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SIZES.map((size) => {
                  const active = capabilities.includes(size.id);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => toggleSize(size.id)}
                      className={`relative flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all duration-300 ${
                        active 
                          ? 'bg-violet-600/20 border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.15)] ring-1 ring-violet-500' 
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`text-4xl transition-transform duration-500 ${active ? 'scale-110 rotate-3' : 'grayscale'}`}>
                        {size.emoji}
                      </div>
                      <div className="text-center">
                        <h4 className={`text-sm font-black uppercase tracking-tight ${active ? 'text-white' : 'text-slate-400'}`}>
                          {size.id}
                        </h4>
                        <p className={`text-[10px] mt-1 leading-tight ${active ? 'text-violet-300' : 'text-slate-600'}`}>
                          {size.desc.split('|')[0]}<br/>{size.desc.split('|')[1]}
                        </p>
                      </div>
                      {active && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="w-4 h-4 text-violet-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Notification/Message Area */}
            {message.text && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {message.type === 'error' ? <X className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                <p className="text-sm font-bold tracking-wide">{message.text}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={saving}
                className="group relative px-12 py-5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-violet-900/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Store...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Synchronize Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
