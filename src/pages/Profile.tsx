import React, { useEffect, useState } from 'react';
import { User, StoreItem } from '../types';
import { Shield, Layout, Zap, Star } from 'lucide-react';

const Profile = () => {
  const [profile, setProfile] = useState<User | null>(null);
  const [inventory, setInventory] = useState<StoreItem[]>([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/users/me');
      const data = await res.json();
      setProfile(data);
      // Mock inventory for now
      setInventory([
        { id: '1', name: 'Neon Frame', description: 'A glowing neon frame', price: 500, category: 'frame', type: 'cosmetic', created_at: new Date().toISOString(), is_owned: true, is_equipped: true },
        { id: '2', name: 'Cyber Sparkle', description: 'Sparkle effect for your avatar', price: 300, category: 'effect', type: 'cosmetic', created_at: new Date().toISOString(), is_owned: true, is_equipped: false }
      ]);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEquip = (itemId: string) => {
    // Implement equip logic
    console.log('Equip item:', itemId);
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING PROFILE DATA...</div>;
  if (!profile) return <div className="p-8 text-center text-white/40 font-mono">PROFILE NOT FOUND</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="glass-panel overflow-hidden mb-8 relative group">
        <div className="h-48 bg-gradient-to-r from-cyber-dark to-black relative">
          {profile.cover_url && <img src={profile.cover_url} className="w-full h-full object-cover opacity-60" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        </div>
        
        <div className="px-8 pb-8 relative -mt-16 flex items-end justify-between">
          <div className="flex items-end gap-6">
            <div className="w-32 h-32 rounded-2xl border-4 border-black bg-black overflow-hidden relative group-hover:border-cyber-neon transition-colors shadow-[0_0_20px_rgba(0,255,0,0.2)]">
              <img src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`} className="w-full h-full object-cover" />
            </div>
            <div className="mb-2">
              <h1 className="text-3xl font-bold text-white flex items-center gap-2 tracking-tight">
                {profile.username}
                {profile.is_verified && <Shield size={24} className="text-cyber-neon drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]" />}
              </h1>
              <p className="text-white/60 font-mono text-sm uppercase tracking-wider">{profile.role} • LVL {profile.level}</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-2">
            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2 rounded-xl font-mono text-xs uppercase tracking-wider transition-all">
              EDIT PROFILE
            </button>
            <button className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-6 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.3)] transition-all">
              SHARE
            </button>
          </div>
        </div>

        <div className="px-8 pb-8 grid grid-cols-4 gap-4 text-center border-t border-white/5 pt-6">
          <div>
            <div className="text-2xl font-bold text-white font-mono">{profile.xp}</div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">XP EARNED</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{profile.reputation}</div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">REPUTATION</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">12</div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">MISSIONS</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">85%</div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">WIN RATE</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'posts' ? 'border-cyber-neon text-cyber-neon font-bold' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          TRANSMISSIONS
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'vault' ? 'border-cyber-neon text-cyber-neon font-bold' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          DIGITAL VAULT
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'achievements' ? 'border-cyber-neon text-cyber-neon font-bold' : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          ACHIEVEMENTS
        </button>
      </div>

      {activeTab === 'vault' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inventory.map(item => (
            <div key={item.id} className="glass-panel p-4 flex flex-col items-center text-center group hover:border-cyber-neon/50 transition-all relative overflow-hidden">
              <div className="absolute inset-0 bg-cyber-neon/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 bg-black/40 rounded-xl mb-3 flex items-center justify-center border border-white/10 group-hover:border-cyber-neon/30 transition-colors">
                {item.category === 'frame' && <Layout className="text-cyber-neon" />}
                {item.category === 'effect' && <Zap className="text-cyber-blue" />}
                {item.category === 'theme' && <Star className="text-cyber-pink" />}
              </div>
              <h3 className="font-bold text-white text-sm mb-1 relative z-10">{item.name}</h3>
              <p className="text-[10px] text-white/40 font-mono uppercase mb-3 relative z-10">{item.category}</p>
              <button 
                onClick={() => handleEquip(item.id)}
                className={`w-full py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all relative z-10 ${
                  item.is_equipped 
                    ? 'bg-cyber-neon/20 text-cyber-neon border border-cyber-neon/30' 
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.is_equipped ? 'EQUIPPED' : 'EQUIP'}
              </button>
            </div>
          ))}
          {inventory.length === 0 && (
            <div className="col-span-full py-12 text-center text-white/20 font-mono uppercase tracking-widest border-2 border-dashed border-white/10 rounded-2xl">
              VAULT EMPTY
            </div>
          )}
        </div>
      )}

      {activeTab === 'posts' && (
        <div className="text-center py-12 text-white/20 font-mono uppercase tracking-widest">
          NO TRANSMISSIONS DETECTED
        </div>
      )}
    </div>
  );
};

export default Profile;
