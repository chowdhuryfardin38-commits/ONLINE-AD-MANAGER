import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Lock, User as UserIcon, Building2, Phone, Sparkles, Shield, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'advertiser' | 'admin'>('advertiser');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyObj = isLogin 
      ? { email, password, role, adminCode } 
      : { email, password, name, companyName: role === 'admin' ? '' : companyName, phone, role, adminCode };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonErr) {
        if (response.status === 404) {
          throw new Error('Authentication portal endpoint could not be found. Please wait a moment and try again.');
        } else if (response.status === 500) {
          throw new Error('The backend server encountered an internal error while processing your request. Please check the server logs or try again shortly.');
        } else if (response.status === 403) {
          throw new Error('Security Access Denied: Please check your administrative privileges or enter a valid admin security code.');
        } else {
          throw new Error(`The validation server returned an unrecognized response layout (Server Status ${response.status}). Please reach out to system support.`);
        }
      }

      if (!response.ok) {
        throw new Error(data.error || 'Server authorization failed. Please check your credentials.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('network') || err.message.includes('NetworkError'))) {
        setError('Connection to server failed. Please check that your network is connected and the dev server is fully active.');
      } else {
        setError(err.message || 'An unexpected check-in exception occurred. Please verify your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 font-sans">

      {/* Form Area */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:p-16 lg:p-24 bg-white relative">
        <div className="max-w-md w-full mx-auto">

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 mb-2">
              {isLogin 
                ? role === 'admin' ? '🛡️ Platform Admin Sign-In' : '💼 Advertiser Sign-In'
                : role === 'admin' ? '🛡️ Register Platform Admin' : '💼 Create Advertiser Account'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin 
                ? role === 'admin' 
                  ? 'Access the master moderation, audit logs, and platform settings.' 
                  : 'Enter your credentials to launch dynamic ad campaigns.'
                : role === 'admin' 
                  ? 'Enter your administrative credentials to create a platform moderator account.'
                  : 'Sign up to build ad drafts, manage budgets, and read AI optimization tips.'}
            </p>
          </div>

          {/* Persistent Portal/Access Level Selector */}
          <div className="mb-6 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">Select Access Level</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 border border-slate-200/50 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('advertiser')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  role === 'advertiser' 
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-150 font-semibold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Advertiser Portal
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  role === 'admin' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🛡️ Platform Admin
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg mb-6 shadow-xs font-mono">
              {error}
            </div>
          )}

          {/* Actual Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                    />
                  </div>
                </div>

                {role === 'advertiser' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Company Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="EcoGoods Ltd"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                        <input
                          type="tel"
                          placeholder="555-1234"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="555-1234"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {role === 'admin' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-600 mb-1.5">
                  Admin Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-amber-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="pl-10 pr-4 py-2.5 w-full bg-amber-50/40 text-slate-900 placeholder-slate-400 border border-amber-200 focus:border-amber-500 focus:bg-white rounded-xl text-sm font-semibold transition outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm transition outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100 disabled:bg-slate-500"
            >
              {loading ? 'Authenticating...' : isLogin ? 'Sign-in Account' : 'Register & Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Screen Option */}
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">{isLogin ? "Don't have an account?" : "Already registered?"}</span>{' '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer underline hover:no-underline"
            >
              {isLogin ? 'Register here' : 'Sign in here'}
            </button>
          </div>



        </div>
      </div>
    </div>
  );
}
