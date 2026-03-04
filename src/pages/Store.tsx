import React, { useEffect, useState } from 'react';
import { StoreItem, UserInventory } from '../types';
import { ShoppingBag, Star, Zap, MessageCircle, Layout, Shield, Gift } from 'lucide-react';

const Store = () => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [redeemCode, setRedeemCode] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, invRes, balanceRes] = await Promise.all([
        fetch('/api/store/items'),
        fetch('/api/store/inventory'),
        fetch('/api/economy/balance')
      ]);
      
      const itemsData = await itemsRes.json();
      const invData = await invRes.json();
      const balanceData = await balanceRes.json();

      setItems(itemsData);
      setInventory(invData);
      setBalance(balanceData.balance);
    } catch (error) {
      console.error('Error fetching store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: string) => {
    try {
      const res = await fetch('/api/store/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      
      if (res.ok) {
        alert('Purchase successful!');
        fetchData(); // Refresh data
      } else {
        const err = await res.json();
        alert(err.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Redeemed: ${data.reward_value} ${data.reward_type}`);
        setRedeemCode('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Invalid code');
      }
    } catch (error) {
      console.error('Redeem error:', error);
    }
  };

  const isOwned = (itemId: string) => inventory.some(i => i.item_id === itemId);

  const filteredItems = activeTab === 'all' 
    ? items 
    : items.filter(item => item.category === activeTab);

  const categories = [
    { id: 'all', label: 'All Items', icon: ShoppingBag },
    { id: 'frame', label: 'Frames', icon: Layout },
    { id: 'effect', label: 'Effects', icon: Zap },
    { id: 'theme', label: 'Themes', icon: Star },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'badge', label: 'Badges', icon: Shield },
  ];

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING STORE DATA...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">PROFILE STORE</h1>
          <p className="text-white/60 font-mono text-xs">CUSTOMIZE YOUR DIGITAL IDENTITY</p>
        </div>
        <div className="glass-panel px-6 py-3 flex items-center gap-3 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
          <span className="text-yellow-400 font-mono text-2xl font-bold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]">{balance.toLocaleString()}</span>
          <span className="text-yellow-100/60 text-xs font-mono tracking-widest">TOINS</span>
        </div>
      </div>

      {/* Redeem Code Section */}
      <div className="glass-panel p-6 mb-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-pink/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Gift size={20} className="text-cyber-pink" />
          <span className="tracking-tight">REDEEM CODE</span>
        </h3>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="ENTER CODE (E.G. WELCOME2026)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-pink outline-none font-mono uppercase tracking-widest placeholder:text-white/20"
            value={redeemCode}
            onChange={e => setRedeemCode(e.target.value)}
          />
          <button
            onClick={handleRedeem}
            className="bg-cyber-pink/20 hover:bg-cyber-pink/30 text-cyber-pink border border-cyber-pink/50 px-8 py-2 rounded-xl font-bold transition-all hover:shadow-[0_0_15px_rgba(255,0,255,0.3)] font-mono uppercase"
          >
            CLAIM
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-4 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all whitespace-nowrap font-mono text-xs uppercase tracking-wider ${
              activeTab === cat.id 
                ? 'bg-cyber-neon text-cyber-dark font-bold shadow-[0_0_10px_rgba(0,255,0,0.3)]' 
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => (
          <div key={item.id} className="glass-panel p-6 hover:border-cyber-neon/50 transition-all group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyber-neon/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${
                item.category === 'frame' ? 'bg-purple-500/20 text-purple-400' :
                item.category === 'effect' ? 'bg-blue-500/20 text-blue-400' :
                item.category === 'theme' ? 'bg-pink-500/20 text-pink-400' :
                'bg-white/10 text-white/60'
              }`}>
                {item.category === 'frame' && <Layout size={24} />}
                {item.category === 'effect' && <Zap size={24} />}
                {item.category === 'theme' && <Star size={24} />}
                {item.category === 'chat' && <MessageCircle size={24} />}
                {item.category === 'badge' && <Shield size={24} />}
              </div>
              {isOwned(item.id) && (
                <span className="bg-cyber-neon/20 text-cyber-neon border border-cyber-neon/30 text-[10px] px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
                  OWNED
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-white mb-2 relative z-10">{item.name}</h3>
            <p className="text-white/60 text-sm mb-6 h-10 line-clamp-2 relative z-10 leading-relaxed">{item.description}</p>

            <div className="flex items-center justify-between mt-auto relative z-10">
              <span className="text-yellow-400 font-mono font-bold text-lg drop-shadow-[0_0_5px_rgba(255,215,0,0.3)]">
                {item.price} <span className="text-[10px] text-white/40">TOINS</span>
              </span>
              
              <button
                onClick={() => handlePurchase(item.id)}
                disabled={isOwned(item.id) || balance < item.price}
                className={`px-6 py-2 rounded-xl font-bold text-xs font-mono uppercase tracking-wider transition-all ${
                  isOwned(item.id)
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : balance >= item.price
                    ? 'bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/80 hover:shadow-[0_0_10px_rgba(0,255,0,0.3)]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {isOwned(item.id) ? 'ACQUIRED' : 'PURCHASE'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-20 text-white/20 font-mono uppercase tracking-widest">
          No items found in this sector.
        </div>
      )}
    </div>
  );
};

export default Store;
