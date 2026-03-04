import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Chat } from '../components/Chat';
import { MessageSquare, LogOut, User as UserIcon } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error("Auth check failed", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For demo purposes, we'll try to login. 
      // In a real app, you'd have a separate login page.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceHash: 'browser-device-hash' })
      });

      if (res.ok) {
        await checkAuth();
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Implement logout logic here (clear cookies, etc.)
    // For now, just reload the page which might clear state if no persistence
    window.location.reload();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
          <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">TGH Campus</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Don't have an account? Contact admin.</p>
            <p className="mt-2 text-xs">Try: driveserverhosting0944@gmail.com (if admin)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
            {user.display_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="font-bold">{user.display_name}</h1>
            <p className="text-xs text-gray-400">@{user.username}</p>
          </div>
        </div>
        
        <button onClick={handleLogout} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stats Card */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <UserIcon className="text-blue-400" /> Profile Stats
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Level</span>
                <span className="font-mono font-bold text-yellow-400">{user.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">XP</span>
                <span className="font-mono font-bold text-purple-400">{user.xp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Toins</span>
                <span className="font-mono font-bold text-green-400">{user.toins}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 md:col-span-2">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button 
                onClick={() => setShowChat(true)}
                className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <MessageSquare size={24} />
                </div>
                <span className="font-medium">Chat</span>
              </button>
              
              {/* Add more action buttons here */}
            </div>
          </div>
        </div>
      </main>

      {/* Chat Modal */}
      {showChat && (
        <Chat 
          user={user} 
          onClose={() => setShowChat(false)} 
          onViewProfile={(id) => console.log("View profile", id)} 
        />
      )}
    </div>
  );
}
