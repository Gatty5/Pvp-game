import React, { useState } from 'react';
import { cloudService } from '../services/cloudService';
import { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    // Simulate cloud latency
    setTimeout(() => {
      if (isLogin) {
        const result = cloudService.login(username, password);
        if (result.success && result.user) {
          onAuthenticated(result.user);
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        const result = cloudService.register(username, password);
        if (result.success && result.user) {
          onAuthenticated(result.user);
        } else {
          setError(result.error || 'Registration failed');
        }
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className="relative w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl animate-fade-in">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center text-4xl shadow-xl mb-6">
            ✨
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Chill World</h1>
          <p className="text-gray-400 text-sm">{isLogin ? 'Welcome back, Traveler.' : 'Create your digital soul.'}</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-2 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-gray-600"
              placeholder="Enter username..."
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-widest mb-2 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-gray-600"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing with Cloud...
              </span>
            ) : (
              isLogin ? 'Enter World' : 'Initialize Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-gray-400 hover:text-white text-xs font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-600 font-mono flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            CLOUD STORAGE ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
