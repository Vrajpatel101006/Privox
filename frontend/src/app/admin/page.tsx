'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.login({ email, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminEmail', data.email);
      }
      router.push('/admin/disputes');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050510] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-white">Prinvox Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Platform administration panel</p>
        </div>

        <form onSubmit={handleLogin} className="glass rounded-2xl p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@prinvox.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
          </button>
        </form>

        <p className="text-center text-slate-700 text-xs mt-6">
          This panel is restricted to Prinvox platform administrators only.
        </p>
      </div>
    </div>
  );
}
