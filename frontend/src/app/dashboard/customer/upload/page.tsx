'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { designApi, quoteApi, authApi } from '@/lib/api';
import Image from 'next/image';

const ThreeViewer = dynamic(() => import('@/components/ThreeViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-black/30 rounded-xl flex items-center justify-center">
      <div className="w-6 h-6 spinner" />
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function UploadDesignPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [quoteForm, setQuoteForm] = useState({
    vendorId: '',
    material: 'PLA',
    infillDensity: 20,
    notes: '',
    deliveryAddress: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const [cityEditing, setCityEditing] = useState(false);

  useEffect(() => {
    // Load user profile to get saved city + delivery address
    authApi.me().then((user: any) => {
      if (user?.city) setCustomerCity(user.city);
      else setCityEditing(true);
      setQuoteForm(prev => ({
        ...prev,
        deliveryAddress: user?.deliveryAddress || '',
        city: user?.city || '',
        state: user?.state || '',
        pincode: user?.pincode || '',
      }));
    }).catch(() => {});

    designApi.myFiles().then((f: any) => setFiles(f)).catch(() => {});
  }, []);

  useEffect(() => {
    const cityParam = customerCity ? `?city=${encodeURIComponent(customerCity)}` : '';
    fetch(`${API_BASE}/vendors${cityParam}`)
      .then(r => r.json())
      .then(v => {
        if (Array.isArray(v)) setVendors(v);
        else {
          console.error('Vendors API error:', v);
          setVendors([]);
        }
      })
      .catch(err => { console.error('Vendors fetch failed:', err); setVendors([]); });
  }, [customerCity]);

  const handleSaveCity = async () => {
    if (!customerCity.trim()) return;
    setSavingCity(true);
    try {
      await authApi.updateProfile({ city: customerCity.trim() });
      setCityEditing(false);
      // Reload vendors with city
      const v = await fetch(`${API_BASE}/vendors?city=${encodeURIComponent(customerCity)}`).then(r => r.json());
      setVendors(Array.isArray(v) ? v : []);
    } catch {}
    finally { setSavingCity(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, []);

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(stl|obj)$/i)) {
      setError('Only .stl and .obj files are supported');
      return;
    }
    setError('');
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result: any = await designApi.upload(formData);
      setUploadedFile(result);
      setPreviewFile(result);
      setSuccess(`✅ "${result.fileName}" uploaded successfully!`);
      setFiles((prev) => [result, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuoteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;
    setQuoteLoading(true);
    setError('');
    try {
      await quoteApi.request({
        designId: uploadedFile.id,
        ...quoteForm,
        infillDensity: parseInt(String(quoteForm.infillDensity)),
      });
      setQuoteSuccess('Quote request sent! Vendors will respond soon.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleDeleteFile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await designApi.delete(id);
      setFiles(files.filter((f: any) => f.id !== id));
      if (uploadedFile?.id === id) {
        setUploadedFile(null);
        setPreviewFile(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    }
  };

  const materials = ['PLA', 'ABS', 'PETG', 'TPU', 'Resin', 'Nylon'];

  // Size-based capability filter
  const maxBoundingDim = uploadedFile?.boundingBoxCm
    ? Math.max(uploadedFile.boundingBoxCm.length || 0, uploadedFile.boundingBoxCm.width || 0, uploadedFile.boundingBoxCm.height || 0)
    : 0;
  const filteredCategory = maxBoundingDim > 20 ? 'Large' : maxBoundingDim > 10 ? 'Medium' : 'Small';

  const capabilityFilteredVendors = vendors.filter(v => {
    if (!uploadedFile) return true;
    if (!v.capabilities || v.capabilities.length === 0) return true;
    return v.capabilities.includes(filteredCategory);
  });

  // Search filter on top of capability filter
  const searchedVendors = capabilityFilteredVendors.filter(v => {
    if (!vendorSearch.trim()) return true;
    const q = vendorSearch.toLowerCase();
    return (
      v.companyName?.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q)
    );
  });

  const localVendors = searchedVendors.filter((v: any) => v.isLocal);
  const otherVendors = searchedVendors.filter((v: any) => !v.isLocal);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Upload Design</h1>
        <p className="text-slate-400 text-sm mt-1">Upload your STL or OBJ file and request quotes from vendors</p>
      </div>

      {/* City Banner */}
      <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-4">
        <span className="text-2xl">📍</span>
        <div className="flex-1">
          {cityEditing ? (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Enter your city to see local vendors first</p>
              <div className="flex gap-2">
                <input
                  value={customerCity}
                  onChange={e => setCustomerCity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCity()}
                  placeholder="e.g. Mumbai, Delhi, Bangalore..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                />
                <button
                  onClick={handleSaveCity}
                  disabled={savingCity || !customerCity.trim()}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {savingCity ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Your city</p>
                <p className="text-white font-medium">{customerCity}</p>
              </div>
              <button
                onClick={() => setCityEditing(true)}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          dragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-white/10 hover:border-violet-500/50 hover:bg-white/[0.02]'
        }`}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept=".stl,.obj"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 spinner" />
            <p className="text-slate-400">Uploading to cloud...</p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4">📁</div>
            <p className="text-white font-semibold text-lg">Drop your 3D model here</p>
            <p className="text-slate-400 text-sm mt-1">Supports STL and OBJ — up to 50MB</p>
            <div className="mt-4 px-6 py-2.5 inline-block rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium">
              Browse Files
            </div>
          </>
        )}
      </div>

      {error && <div className="mt-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-900/50 text-red-400 text-sm">{error}</div>}
      {success && <div className="mt-4 px-4 py-3 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">{success}</div>}

      {/* 3D Preview */}
      {previewFile && (
        <div className="mt-6 glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">3D Preview</h3>
            <span className="text-xs text-violet-400 uppercase font-medium">{previewFile.fileType}</span>
          </div>
          <ThreeViewer fileUrl={previewFile.fileUrl} fileType={previewFile.fileType} fileName={previewFile.fileName} />
        </div>
      )}

      {/* Request Quote Form */}
      {uploadedFile && (
        <div className="mt-6 glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Request Quote</h3>
          {quoteSuccess ? (
            <div className="px-4 py-3 rounded-lg bg-green-900/30 border border-green-900/50 text-green-400 text-sm">
              {quoteSuccess}
              <button className="ml-3 text-violet-400 hover:underline" onClick={() => setQuoteSuccess('')}>Send another</button>
            </div>
          ) : (
            <form onSubmit={handleQuoteRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Material</label>
                  <select
                    value={quoteForm.material}
                    onChange={(e) => setQuoteForm({ ...quoteForm, material: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500"
                  >
                    {materials.map((m) => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Infill Density: {quoteForm.infillDensity}%</label>
                  <input
                    type="range" min={5} max={100} step={5}
                    value={quoteForm.infillDensity}
                    onChange={(e) => setQuoteForm({ ...quoteForm, infillDensity: parseInt(e.target.value) })}
                    className="w-full mt-2 accent-violet-500"
                  />
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Delivery Setup</label>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      value={quoteForm.city} onChange={(e) => setQuoteForm({ ...quoteForm, city: e.target.value })}
                      placeholder="City" required className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                    />
                    <input
                      value={quoteForm.state} onChange={(e) => setQuoteForm({ ...quoteForm, state: e.target.value })}
                      placeholder="State" required className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                    />
                    <input
                      value={quoteForm.pincode} onChange={(e) => setQuoteForm({ ...quoteForm, pincode: e.target.value })}
                      placeholder="PIN Code" required maxLength={6} pattern="\d{6}" className="w-28 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                    />
                  </div>
                  <textarea
                    value={quoteForm.deliveryAddress}
                    onChange={(e) => setQuoteForm({ ...quoteForm, deliveryAddress: e.target.value })}
                    placeholder="Full delivery address: flat/house no, street, area..."
                    rows={2} required
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none text-sm"
                  />
                </div>
              </div>

              {/* Vendor Selection — Tiered */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">
                    Select Vendor
                    {uploadedFile && <span className="text-violet-400 ml-2">(Filtered for {filteredCategory} Models)</span>}
                    <span className="ml-2 text-slate-600">({vendors.length} available)</span>
                  </label>
                </div>

                {/* Vendor Search */}
                <input
                  value={vendorSearch}
                  onChange={e => setVendorSearch(e.target.value)}
                  placeholder="🔍 Search by vendor name or city..."
                  className="w-full px-3 py-2.5 mb-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                />

                {/* Tiered Vendor Cards */}
                {vendors.length === 0 ? (
                  <div className="text-center py-6 border border-white/5 rounded-xl bg-white/[0.02] flex flex-col items-center">
                    <div className="relative w-32 h-32 mb-3 opacity-80">
                      <Image src="/dashboard/empty_upload.jfif" alt="No Vendors" fill className="object-contain" />
                    </div>
                    <p className="text-slate-500 text-sm">No vendors available.</p>
                    <p className="text-slate-600 text-xs mt-1">Check your connection or try refreshing the page.</p>
                  </div>
                ) : searchedVendors.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No vendors match your search or model size.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {localVendors.length > 0 && (
                      <div>
                        <p className="text-xs text-green-400 font-semibold mb-1.5 flex items-center gap-1.5">
                          <span>🏠</span> Local Vendors — {customerCity}
                        </p>
                        <div className="space-y-2">
                          {localVendors.map((v: any) => (
                            <VendorCard key={v.id} vendor={v} selected={quoteForm.vendorId === v.id} onSelect={() => setQuoteForm({ ...quoteForm, vendorId: v.id })} />
                          ))}
                        </div>
                      </div>
                    )}

                    {otherVendors.length > 0 && (
                      <div>
                        {localVendors.length > 0 && (
                          <p className="text-xs text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
                            <span>🌍</span> Other Vendors
                          </p>
                        )}
                        <div className="space-y-2">
                          {otherVendors.map((v: any) => (
                            <VendorCard key={v.id} vendor={v} selected={quoteForm.vendorId === v.id} onSelect={() => setQuoteForm({ ...quoteForm, vendorId: v.id })} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden select for form validation */}
                <select required value={quoteForm.vendorId} onChange={() => {}} className="sr-only" aria-hidden>
                  <option value=""></option>
                  {searchedVendors.map((v: any) => <option key={v.id} value={v.id}>{v.companyName}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder="Any special requirements, finish preference..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={quoteLoading || !quoteForm.vendorId}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
              >
                {quoteLoading ? 'Sending...' : '📨 Send Quote Request'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* My Uploaded Files */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-400 mb-3">My Uploads</h3>
          <div className="space-y-2">
            {files.slice(0, 5).map((f: any) => (
              <div key={f.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{f.fileType === 'stl' ? '🖨️' : '📐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{f.fileName}</p>
                  <p className="text-xs text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setUploadedFile(f); setPreviewFile(f); setSuccess(''); setQuoteSuccess(''); }}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors bg-violet-900/30 px-3 py-1.5 rounded-lg"
                  >
                    Select
                  </button>
                  <button
                    onClick={(e) => handleDeleteFile(f.id, e)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Vendor Card component for the tiered display
function VendorCard({ vendor, selected, onSelect }: { vendor: any; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl p-3 border transition-all ${
        selected
          ? 'border-violet-500 bg-violet-500/10'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{vendor.companyName}</p>
            {vendor.isLocal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/50 text-green-400 font-semibold shrink-0">Local</span>
            )}
          </div>
          {vendor.location && (
            <p className="text-xs text-slate-500 mt-0.5">
              📍 {vendor.location}{vendor.pincode ? ` — ${vendor.pincode}` : ''}
            </p>
          )}
          {vendor.capabilities && vendor.capabilities.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {vendor.capabilities.map((c: string) => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400">{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="ml-2 flex flex-col items-end shrink-0 gap-1">
          {vendor.rating > 0 && <p className="text-xs text-yellow-400">⭐ {vendor.rating}</p>}
          {selected && <span className="text-[10px] text-violet-400 font-semibold">✓ Selected</span>}
          <a
            href={`/vendors/${vendor.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-violet-400 hover:text-violet-300 hover:underline"
          >
            View Profile
          </a>
        </div>
      </div>
    </div>
  );
}
