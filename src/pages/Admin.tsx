import React, { useEffect, useState } from 'react';
import { ShieldAlert, Users, Activity, AlertTriangle, Database, MoreHorizontal } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  pendingReports: number;
}

interface VerificationRequest {
  id: string;
  username: string;
  avatar: string;
  requested_at: string;
}

const Admin = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockdown, setLockdown] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [pendingVerifications, setPendingVerifications] = useState<VerificationRequest[]>([]);
  const [newCode, setNewCode] = useState({ code: '', value: 0, max_uses: 1 });

  useEffect(() => {
    fetchStats();
    fetchVerifications();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifications = async () => {
    try {
      const res = await fetch('/api/admin/verifications');
      const data = await res.json();
      setPendingVerifications(data);
    } catch (error) {
      console.error('Error fetching verifications:', error);
    }
  };

  const handleVerification = async (userId: string, approve: boolean) => {
    try {
      await fetch(`/api/admin/verifications/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve })
      });
      fetchVerifications();
    } catch (error) {
      console.error('Error handling verification:', error);
    }
  };

  const handleCreateCode = async () => {
    try {
      await fetch('/api/admin/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCode)
      });
      setNewCode({ code: '', value: 0, max_uses: 1 });
      alert('Code generated successfully');
    } catch (error) {
      console.error('Error creating code:', error);
    }
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING ADMIN PROTOCOLS...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SYSTEM ADMINISTRATION</h1>
          <p className="text-white/60 font-mono text-xs">CONTROL PANEL & OVERSIGHT</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setLockdown(!lockdown)}
            className={`px-6 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
              lockdown 
                ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(255,0,0,0.5)] animate-pulse' 
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <ShieldAlert size={16} />
            {lockdown ? 'LOCKDOWN ACTIVE' : 'INITIATE LOCKDOWN'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={48} className="text-cyber-neon" />
          </div>
          <h3 className="text-white/60 font-mono text-xs uppercase tracking-wider mb-2">TOTAL USERS</h3>
          <p className="text-3xl font-bold text-white font-mono">{stats?.totalUsers}</p>
        </div>
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={48} className="text-cyber-blue" />
          </div>
          <h3 className="text-white/60 font-mono text-xs uppercase tracking-wider mb-2">ACTIVE SESSIONS</h3>
          <p className="text-3xl font-bold text-white font-mono">{stats?.activeUsers}</p>
        </div>
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle size={48} className="text-yellow-400" />
          </div>
          <h3 className="text-white/60 font-mono text-xs uppercase tracking-wider mb-2">PENDING REPORTS</h3>
          <p className="text-3xl font-bold text-white font-mono">{stats?.pendingReports}</p>
        </div>
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Database size={48} className="text-cyber-pink" />
          </div>
          <h3 className="text-white/60 font-mono text-xs uppercase tracking-wider mb-2">SYSTEM LOAD</h3>
          <p className="text-3xl font-bold text-white font-mono">12%</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="border-b border-white/10 flex">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-4 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'users' ? 'border-cyber-neon text-cyber-neon font-bold bg-white/5' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            USER DATABASE
          </button>
          <button
            onClick={() => setActiveTab('verifications')}
            className={`px-6 py-4 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'verifications' ? 'border-cyber-neon text-cyber-neon font-bold bg-white/5' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            VERIFICATIONS
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-4 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'reports' ? 'border-cyber-neon text-cyber-neon font-bold bg-white/5' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            REPORTS
          </button>
          <button
            onClick={() => setActiveTab('codes')}
            className={`px-6 py-4 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'codes' ? 'border-cyber-neon text-cyber-neon font-bold bg-white/5' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            REDEEM CODES
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-4 font-mono text-xs text-white/40 uppercase tracking-wider">USER</th>
                    <th className="pb-4 font-mono text-xs text-white/40 uppercase tracking-wider">ROLE</th>
                    <th className="pb-4 font-mono text-xs text-white/40 uppercase tracking-wider">STATUS</th>
                    <th className="pb-4 font-mono text-xs text-white/40 uppercase tracking-wider">JOINED</th>
                    <th className="pb-4 font-mono text-xs text-white/40 uppercase tracking-wider text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* Mock Data */}
                  <tr className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=Admin`} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-bold text-white text-sm">AdminUser</span>
                    </td>
                    <td className="py-4">
                      <span className="bg-cyber-neon/20 text-cyber-neon px-2 py-1 rounded text-[10px] font-mono font-bold uppercase">ADMIN</span>
                    </td>
                    <td className="py-4">
                      <span className="flex items-center gap-2 text-xs font-mono text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        ONLINE
                      </span>
                    </td>
                    <td className="py-4 font-mono text-xs text-white/40">2023-10-15</td>
                    <td className="py-4 text-right">
                      <button className="text-white/40 hover:text-white transition-colors"><MoreHorizontal size={16} /></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'verifications' && (
            <div className="space-y-4">
              {pendingVerifications.map(req => (
                <div key={req.id} className="bg-black/40 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-black border border-white/10 overflow-hidden">
                      <img src={req.avatar} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{req.username}</h4>
                      <p className="text-white/40 text-xs font-mono uppercase">REQUESTED: {new Date(req.requested_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleVerification(req.id, false)}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 font-mono text-xs font-bold uppercase transition-all"
                    >
                      DENY
                    </button>
                    <button 
                      onClick={() => handleVerification(req.id, true)}
                      className="px-4 py-2 rounded-lg bg-cyber-neon/20 text-cyber-neon border border-cyber-neon/30 hover:bg-cyber-neon/30 font-mono text-xs font-bold uppercase transition-all shadow-[0_0_10px_rgba(0,255,0,0.1)]"
                    >
                      APPROVE
                    </button>
                  </div>
                </div>
              ))}
              {pendingVerifications.length === 0 && (
                <div className="text-center py-12 text-white/20 font-mono uppercase tracking-widest border-2 border-dashed border-white/10 rounded-2xl">
                  NO PENDING VERIFICATIONS
                </div>
              )}
            </div>
          )}

          {activeTab === 'codes' && (
            <div className="space-y-6">
              <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-bold mb-4 font-mono uppercase tracking-wider text-sm">GENERATE NEW CODE</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <input 
                    type="text" 
                    placeholder="CODE (E.G. BONUS2024)" 
                    className="bg-black/60 border border-white/10 rounded-lg p-3 text-white text-sm font-mono outline-none focus:border-cyber-neon"
                    value={newCode.code}
                    onChange={e => setNewCode({...newCode, code: e.target.value})}
                  />
                  <input 
                    type="number" 
                    placeholder="VALUE (TOINS)" 
                    className="bg-black/60 border border-white/10 rounded-lg p-3 text-white text-sm font-mono outline-none focus:border-cyber-neon"
                    value={newCode.value}
                    onChange={e => setNewCode({...newCode, value: parseInt(e.target.value)})}
                  />
                  <input 
                    type="number" 
                    placeholder="MAX USES" 
                    className="bg-black/60 border border-white/10 rounded-lg p-3 text-white text-sm font-mono outline-none focus:border-cyber-neon"
                    value={newCode.max_uses}
                    onChange={e => setNewCode({...newCode, max_uses: parseInt(e.target.value)})}
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={handleCreateCode}
                    className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-6 py-2 rounded-lg font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all"
                  >
                    GENERATE CODE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
