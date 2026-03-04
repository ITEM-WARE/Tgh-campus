import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Shield, Trophy, Medal } from 'lucide-react';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('toins');

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?type=${activeTab}`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING RANKINGS...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">ELITE RANKINGS</h1>
          <p className="text-white/60 font-mono text-xs">TOP PERFORMING OPERATIVES</p>
        </div>
        <div className="flex gap-4 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('toins')}
            className={`px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'toins' 
                ? 'bg-yellow-500 text-black font-bold shadow-[0_0_10px_rgba(255,215,0,0.3)]' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            WEALTH
          </button>
          <button
            onClick={() => setActiveTab('xp')}
            className={`px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'xp' 
                ? 'bg-cyber-neon text-cyber-dark font-bold shadow-[0_0_10px_rgba(0,255,0,0.3)]' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            EXPERIENCE
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="p-4 font-mono text-xs text-white/40 uppercase tracking-wider w-20 text-center">RANK</th>
              <th className="p-4 font-mono text-xs text-white/40 uppercase tracking-wider">OPERATIVE</th>
              <th className="p-4 font-mono text-xs text-white/40 uppercase tracking-wider text-right">
                {activeTab === 'toins' ? 'NET WORTH' : 'TOTAL XP'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leaderboard.map((user, index) => (
              <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                <td className="p-4 text-center">
                  {index === 0 && <span className="text-2xl">🥇</span>}
                  {index === 1 && <span className="text-2xl">🥈</span>}
                  {index === 2 && <span className="text-2xl">🥉</span>}
                  {index > 2 && <span className="font-mono text-white/40 font-bold">#{index + 1}</span>}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 ${
                      index === 0 ? 'border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.3)]' :
                      index === 1 ? 'border-gray-300' :
                      index === 2 ? 'border-amber-600' :
                      'border-white/10'
                    }`}>
                      <img src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {user.username}
                        {user.is_verified && <Shield size={14} className="text-cyber-neon" />}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">LVL {user.level}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className={`font-mono font-bold text-lg ${
                    activeTab === 'toins' ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(255,215,0,0.3)]' : 'text-cyber-neon drop-shadow-[0_0_5px_rgba(0,255,0,0.3)]'
                  }`}>
                    {activeTab === 'toins' ? user.toins.toLocaleString() : user.xp.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboard.length === 0 && (
          <div className="text-center py-12 text-white/20 font-mono uppercase tracking-widest">
            NO DATA AVAILABLE
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
