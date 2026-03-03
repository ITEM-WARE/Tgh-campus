import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  User as UserIcon, 
  MessageSquare, 
  BookOpen, 
  LayoutGrid, 
  ShoppingBag, 
  ShieldCheck, 
  Zap, 
  Coins, 
  Send, 
  Image as ImageIcon, 
  Volume2, 
  Settings,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Sparkles,
  Mic,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Fingerprint,
  Shield,
  Smartphone,
  Globe,
  LogOut,
  Key,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Clock,
  Filter,
  TrendingUp,
  Tag,
  PlusCircle,
  Camera,
  Eye,
  UserPlus,
  UserCheck,
  CreditCard,
  Palette,
  Layout,
  Type as TypeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Message, AuditLog, IPCluster, SecurityEvent, Session, DeviceSession, Story, Conversation, Listing, Notification, Friendship, Transaction, AcademicMaterial, DiscussionQuery } from './types';
import { getStudyBuddyResponse, analyzeImage, generateSpeech } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Shared Components ---

const Badge = ({ children, variant = 'neon' }: { children: React.ReactNode, variant?: 'neon' | 'pink' | 'blue' | 'gold' }) => {
  const variants = {
    neon: "bg-cyber-neon/10 text-cyber-neon border-cyber-neon/30",
    pink: "bg-cyber-pink/10 text-cyber-pink border-cyber-pink/30",
    blue: "bg-cyber-blue/10 text-cyber-blue border-cyber-blue/30",
    gold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider", variants[variant])}>
      {children}
    </span>
  );
};

const Avatar = ({ src, seed, size = 'md', online }: { src?: string | null, seed: string, size?: 'sm' | 'md' | 'lg' | 'xl', online?: boolean }) => {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-24 h-24"
  };
  return (
    <div className={cn("relative rounded-xl overflow-hidden border border-white/10 bg-cyber-dark", sizes[size])}>
      <img 
        src={src || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
        alt="Avatar" 
        className="w-full h-full object-cover"
      />
      {online && (
        <div className="absolute bottom-1 right-1 w-2 h-2 bg-cyber-neon rounded-full border border-cyber-dark shadow-[0_0_8px_rgba(0,255,159,0.8)]" />
      )}
    </div>
  );
};

const GlassCard = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn("glass-panel p-4 transition-all duration-300 hover:border-white/20", className)}
  >
    {children}
  </div>
);

const NeonButton = ({ children, onClick, variant = 'neon', className, disabled, type = 'button' }: { children: React.ReactNode, onClick?: () => void, variant?: 'neon' | 'pink' | 'blue' | 'ghost' | 'danger', className?: string, disabled?: boolean, type?: 'button' | 'submit' }) => {
  const variants = {
    neon: "bg-cyber-neon/10 text-cyber-neon border-cyber-neon/30 hover:bg-cyber-neon/20",
    pink: "bg-cyber-pink/10 text-cyber-pink border-cyber-pink/30 hover:bg-cyber-pink/20",
    blue: "bg-cyber-blue/10 text-cyber-blue border-cyber-blue/30 hover:bg-cyber-blue/20",
    ghost: "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
    danger: "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
  };

  return (
    <button 
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl border transition-all duration-300 flex items-center justify-center gap-2 font-medium disabled:opacity-50",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const GatedFeature = ({ status, children, fallback }: { status: string, children: React.ReactNode, fallback?: React.ReactNode }) => {
  if (status === 'approved') return <>{children}</>;
  return fallback || (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-60">
      <Lock className="w-12 h-12 text-white/20" />
      <div>
        <h4 className="font-bold text-white/80">ACCESS RESTRICTED</h4>
        <p className="text-xs text-white/40">This feature is only available to verified students.</p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'auth' | 'onboarding' | 'app' | 'admin'>('auth');
  const [activeTab, setActiveTab] = useState<'hub' | 'chat' | 'study' | 'market' | 'profile' | 'security' | 'custom'>('hub');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          if (data.role === 'admin') setView('admin');
          else if (data.verification_status === 'approved' && !data.username_locked) setView('app');
          else setView('onboarding');
        } else {
          setView('auth');
        }
      } catch (e) { 
        console.error(e);
        setView('auth');
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if ((view === 'app' || view === 'admin') && user) {
      socketRef.current = io();
      const socket = socketRef.current;

      socket.emit("authenticate", user.id);

      socket.on("user-presence", ({ userId, status }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (status === 'online') next.add(userId);
          else next.delete(userId);
          return next;
        });
      });

      socket.on("notification", (note: Notification) => {
        setNotifications(prev => [note, ...prev]);
      });

      return () => { socket.disconnect(); };
    }
  }, [view, user?.id]);

  useEffect(() => {
    if (user) {
      fetch('/api/notifications').then(r => r.json()).then(setNotifications);
    }
  }, [user?.id]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-cyber-dark">
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-cyber-neon font-mono text-xl tracking-widest"
      >
        SYNCING GRID...
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cyber-dark text-white selection:bg-cyber-neon/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyber-neon/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyber-pink/5 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {view === 'auth' && <AuthView key="auth" onAuth={(u) => { setUser(u); setView(u.verification_status === 'approved' ? 'app' : 'onboarding'); }} />}
        {view === 'onboarding' && <OnboardingView key="onboarding" user={user!} onComplete={(u) => { setUser(u); setView('app'); }} />}
        {view === 'admin' && <AdminDashboard key="admin" user={user!} onExit={() => setView('app')} />}
        {view === 'app' && (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10">
            <Header user={user!} setActiveTab={setActiveTab} activeTab={activeTab} onAdmin={() => setView('admin')} notifications={notifications} />
            <main className="pt-20 pb-24 px-4 max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'hub' && <HubView key="hub" user={user!} />}
                {activeTab === 'study' && <StudyView key="study" user={user!} />}
                {activeTab === 'chat' && <ChatView key="chat" user={user!} socket={socketRef.current!} />}
                {activeTab === 'market' && <MarketView key="market" user={user!} />}
                {activeTab === 'custom' && <CustomizationView key="custom" user={user!} />}
                {activeTab === 'profile' && <ProfileView key="profile" user={user!} setUser={setUser} onSecurity={() => setActiveTab('security')} onThemes={() => setActiveTab('custom')} />}
                {activeTab === 'security' && <SecurityView key="security" user={user!} />}
              </AnimatePresence>
            </main>
            <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---

function Header({ user, setActiveTab, activeTab, onAdmin, notifications }: { user: User, setActiveTab: (t: any) => void, activeTab: string, onAdmin: () => void, notifications: Notification[] }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel !rounded-none border-x-0 border-t-0 bg-cyber-dark/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-neon to-cyber-blue p-[1px]">
            <div className="w-full h-full rounded-xl bg-cyber-dark flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyber-neon" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tighter neon-text text-white hidden sm:block">TGH CAMPUS</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
            <button onClick={() => setActiveTab('hub')} className={cn("hover:text-white transition-colors", activeTab === 'hub' && "text-cyber-neon")}>GRID</button>
            <button onClick={() => setActiveTab('study')} className={cn("hover:text-white transition-colors", activeTab === 'study' && "text-cyber-neon")}>ACADEMICS</button>
            <button onClick={() => setActiveTab('market')} className={cn("hover:text-white transition-colors", activeTab === 'market' && "text-cyber-neon")}>VAULT</button>
            <button onClick={() => setActiveTab('custom')} className={cn("hover:text-white transition-colors", activeTab === 'custom' && "text-cyber-neon")}>THEMES</button>
            {user.role === 'admin' && <button onClick={onAdmin} className="text-cyber-pink hover:text-white transition-colors">ADMIN</button>}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="relative p-2 text-white/40 hover:text-white transition-colors">
                <Bell size={20} />
                {notifications.some(n => !n.is_read) && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyber-pink rounded-full border border-cyber-dark" />
                )}
              </button>
              
              <div className="absolute top-full right-0 mt-2 w-80 glass-panel p-0 overflow-hidden opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-[60]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-widest">Notifications</h4>
                  <button className="text-[10px] text-cyber-neon font-bold uppercase hover:underline">Mark all read</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {Array.isArray(notifications) && notifications.length > 0 ? notifications.map(note => (
                    <div key={note.id} className={cn("p-4 border-b border-white/5 hover:bg-white/5 transition-colors", !note.is_read && "bg-cyber-neon/5")}>
                      <p className="text-xs text-white/80">{note.content}</p>
                      <p className="text-[10px] text-white/20 mt-1">{formatDistanceToNow(new Date(note.timestamp))} ago</p>
                    </div>
                  )) : (
                    <div className="p-8 text-center opacity-40">
                      <Bell className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px] font-mono">NO NEW TRANSMISSIONS</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Coins className="w-4 h-4 text-cyber-neon" />
              <span className="text-sm font-mono font-bold">{user.toins}</span>
            </div>
            <button 
              onClick={() => setActiveTab('profile')}
              className="w-8 h-8 rounded-full border border-white/20 overflow-hidden"
            >
              <Avatar seed={user.username} src={user.avatar} size="sm" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNav({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel !rounded-none border-x-0 border-b-0 bg-cyber-dark/80 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        <NavButton active={activeTab === 'hub'} onClick={() => setActiveTab('hub')} icon={<LayoutGrid />} label="Grid" />
        <NavButton active={activeTab === 'study'} onClick={() => setActiveTab('study')} icon={<BookOpen />} label="Academics" />
        <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare />} label="Chat" />
        <NavButton active={activeTab === 'market'} onClick={() => setActiveTab('market')} icon={<ShoppingBag />} label="Vault" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon />} label="Me" />
      </div>
    </nav>
  );
}

function AuthView({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ email: '', password: '', fullName: '', grade: 'Grade 10', section: 'A', house: '', q1: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDeviceHash = () => {
    let hash = localStorage.getItem('campus_device_hash');
    if (!hash) {
      hash = Math.random().toString(36).substr(2, 15);
      localStorage.setItem('campus_device_hash', hash);
    }
    return hash;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const deviceHash = getDeviceHash();
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, answers: { q1: form.q1 } })
        });
        const data = await res.json().catch(() => ({ error: "Grid response malformed." }));
        if (res.ok) {
          setMode('login');
          setError("Account created. Please login.");
        } else {
          setError(data.error || "Access denied.");
        }
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password, deviceHash })
        });
        const data = await res.json().catch(() => ({ error: "Grid response malformed." }));
        if (res.ok) {
          onAuth(data);
        } else {
          setError(data.error || "Access denied.");
        }
      }
    } catch (e) { 
      console.error(e);
      setError("Grid connection failed. Check your network.");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-cyber-neon/10 rounded-3xl flex items-center justify-center mx-auto border border-cyber-neon/20">
            <ShieldCheck className="w-8 h-8 text-cyber-neon" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter">TGH CAMPUS HUB</h2>
          <p className="text-white/40 text-sm font-mono uppercase tracking-widest">Closed Sector Access Protocol</p>
        </div>

        <GlassCard className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Full Name</label>
                  <input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Grade</label>
                    <select value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none">
                      <option>Grade 8</option><option>Grade 9</option><option>Grade 10</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Section</label>
                    <input required value={form.section} onChange={e => setForm({...form, section: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">House Name</label>
                  <input required value={form.house} onChange={e => setForm({...form, house: e.target.value})} placeholder="e.g. Gryffindor, Red House" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
                </div>
                <div className="p-4 bg-cyber-neon/5 border border-cyber-neon/20 rounded-2xl space-y-3">
                  <p className="text-[10px] font-bold uppercase text-cyber-neon flex items-center gap-2"><Lock size={12} /> Campus Verification</p>
                  <div className="space-y-2">
                    <input required placeholder="What is your favorite subject?" value={form.q1} onChange={e => setForm({...form, q1: e.target.value})} className="w-full bg-cyber-dark/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Email Address</label>
              <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Password</label>
              <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
            </div>
            <NeonButton type="submit" disabled={loading} className="w-full py-3 mt-4">
              {loading ? 'Processing...' : mode === 'login' ? 'Enter Grid' : 'Request Access'}
            </NeonButton>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-xs text-white/40 hover:text-cyber-neon transition-colors">
              {mode === 'login' ? "Don't have access? Request Signup" : "Already have an account? Login"}
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function OnboardingView({ user, onComplete }: { user: User, onComplete: (u: User) => void }) {
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (!newUsername.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}/username`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername })
      });
      if (res.ok) {
        const updated = await fetch(`/api/users/${user.id}`).then(r => r.json());
        onComplete(updated);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to initialize profile.");
      }
    } catch (e) { 
      console.error(e);
      setError("Grid connection failed.");
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <GlassCard className="p-8 text-center space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {user.verification_status === 'pending' ? (
            <>
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 animate-pulse">
                <Lock className="w-10 h-10 text-white/20" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tighter">ACCESS PENDING</h2>
                <p className="text-white/60 text-sm">Your account is currently under manual review by the Campus Admin. You will be notified once verified.</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                <p className="text-[10px] font-bold uppercase text-white/40 mb-2">Temporary Identity</p>
                <p className="font-mono text-cyber-neon">{user.username}</p>
              </div>
              <NeonButton variant="ghost" onClick={() => window.location.reload()} className="w-full">Check Status</NeonButton>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-cyber-neon/20 rounded-full flex items-center justify-center mx-auto border border-cyber-neon/30">
                <Unlock className="w-10 h-10 text-cyber-neon" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tighter">GRID UNLOCKED</h2>
                <p className="text-white/60 text-sm">Welcome, Student. Set your permanent campus username to initialize your profile.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Permanent Username</label>
                  <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. cyber_ninja" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-cyber-neon/50 outline-none" />
                  <p className="text-[10px] text-cyber-pink mt-1 ml-1 font-bold">⚠️ THIS ACTION IS IMMUTABLE</p>
                </div>
                <NeonButton onClick={handleUnlock} disabled={loading || !newUsername.trim()} className="w-full py-3">Initialize Profile</NeonButton>
              </div>
            </>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ user, onExit }: { user: User, onExit: () => void }) {
  const [activeAdminTab, setActiveAdminTab] = useState<'stats' | 'queue' | 'audit' | 'ips' | 'security' | 'academics'>('stats');
  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [clusters, setClusters] = useState<IPCluster[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [lockdown, setLockdown] = useState(false);
  const [academicForm, setAcademicForm] = useState({ type: 'homework', title: '', content: '', grade: '', section: '', subject: '', due_date: '' });

  useEffect(() => {
    const fetchData = async () => {
      const [sRes, qRes, lRes, iRes, seRes] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/verification-queue').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json()),
        fetch('/api/admin/ip-clusters').then(r => r.json()),
        fetch('/api/admin/security/events').then(r => r.json())
      ]);
      setStats(sRes);
      setQueue(qRes);
      setLogs(lRes);
      setClusters(iRes);
      setSecurityEvents(seRes);
      setLockdown(sRes.lockdown);
    };
    fetchData();
  }, [activeAdminTab]);

  const handleAcademicUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/academic/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(academicForm)
    });
    if (res.ok) {
      alert("Material uploaded successfully!");
      setAcademicForm({ type: 'homework', title: '', content: '', grade: '', section: '', subject: '', due_date: '' });
    }
  };

  const toggleLockdown = async () => {
    const res = await fetch('/api/admin/security/lockdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !lockdown })
    });
    if (res.ok) {
      const data = await res.json();
      setLockdown(data.lockdown);
    }
  };

  const handleVerify = async (userId: string, status: string) => {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status, adminId: user.id })
    });
    if (res.ok) {
      setQueue(prev => prev.filter(u => u.id !== userId));
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4 max-w-7xl mx-auto space-y-8 relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-cyber-pink">ADMIN COMMAND CENTER</h2>
          <p className="text-sm text-white/40 font-mono">AUTHORITY LEVEL: SUPER_ADMIN // SECTOR: OVERSEER</p>
        </div>
        <NeonButton variant="ghost" onClick={onExit}>Exit Console</NeonButton>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <AdminTab active={activeAdminTab === 'stats'} onClick={() => setActiveAdminTab('stats')} icon={<BarChart3 />} label="Stats" />
        <AdminTab active={activeAdminTab === 'queue'} onClick={() => setActiveAdminTab('queue')} icon={<Users />} label="Queue" count={queue.length} />
        <AdminTab active={activeAdminTab === 'audit'} onClick={() => setActiveAdminTab('audit')} icon={<History />} label="Audit" />
        <AdminTab active={activeAdminTab === 'ips'} onClick={() => setActiveAdminTab('ips')} icon={<Fingerprint />} label="IP Clusters" count={clusters.length} />
        <AdminTab active={activeAdminTab === 'security'} onClick={() => setActiveAdminTab('security')} icon={<Shield />} label="Security" />
        <AdminTab active={activeAdminTab === 'academics'} onClick={() => setActiveAdminTab('academics')} icon={<BookOpen />} label="Academics" />
      </div>

      <AnimatePresence mode="wait">
        {activeAdminTab === 'academics' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard className="p-6">
              <h3 className="text-xl font-black tracking-tighter mb-6">UPLOAD ACADEMIC MATERIAL</h3>
              <form onSubmit={handleAcademicUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Material Type</label>
                    <select 
                      value={academicForm.type} 
                      onChange={e => setAcademicForm({...academicForm, type: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      <option value="homework">Homework</option>
                      <option value="classwork">Classwork</option>
                      <option value="note">Note</option>
                      <option value="schedule">Schedule</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Title</label>
                    <input 
                      value={academicForm.title}
                      onChange={e => setAcademicForm({...academicForm, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                      placeholder="e.g. Calculus Assignment 1"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Grade</label>
                      <input 
                        value={academicForm.grade}
                        onChange={e => setAcademicForm({...academicForm, grade: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                        placeholder="e.g. 12"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Section</label>
                      <input 
                        value={academicForm.section}
                        onChange={e => setAcademicForm({...academicForm, section: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                        placeholder="e.g. A"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Subject</label>
                    <input 
                      value={academicForm.subject}
                      onChange={e => setAcademicForm({...academicForm, subject: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                      placeholder="e.g. Mathematics"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Due Date (Optional)</label>
                    <input 
                      type="datetime-local"
                      value={academicForm.due_date}
                      onChange={e => setAcademicForm({...academicForm, due_date: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Content / Description</label>
                    <textarea 
                      value={academicForm.content}
                      onChange={e => setAcademicForm({...academicForm, content: e.target.value})}
                      className="w-full h-[280px] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none resize-none" 
                      placeholder="Enter detailed instructions or content..."
                      required
                    />
                  </div>
                  <NeonButton type="submit" className="w-full py-4">UPLOAD TRANSMISSION</NeonButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
        {activeAdminTab === 'security' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard className={cn("border-2 transition-all", lockdown ? "border-red-500 bg-red-500/10" : "border-white/10")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", lockdown ? "bg-red-500 text-white" : "bg-white/5 text-white/40")}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tighter">EMERGENCY LOCKDOWN MODE</h3>
                    <p className="text-sm opacity-60">Disables registrations, confessions, and increases rate limits.</p>
                  </div>
                </div>
                <NeonButton 
                  variant={lockdown ? 'danger' : 'ghost'} 
                  onClick={toggleLockdown}
                  className="px-8"
                >
                  {lockdown ? 'DEACTIVATE LOCKDOWN' : 'ACTIVATE LOCKDOWN'}
                </NeonButton>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Shield size={18} className="text-cyber-neon" /> Recent Security Events</h3>
                <div className="space-y-3">
                  {securityEvents.map(event => (
                    <div key={event.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", event.risk_score > 30 ? "bg-red-500/20 text-red-500" : "bg-cyber-blue/20 text-cyber-blue")}>
                          <Fingerprint size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{event.event_type}</p>
                          <p className="text-[10px] text-white/40">{event.ip_address} • {event.details}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[10px] font-bold", event.risk_score > 30 ? "text-red-500" : "text-cyber-neon")}>RISK: {event.risk_score}</p>
                        <p className="text-[10px] text-white/20">{format(new Date(event.timestamp), 'HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Lock size={18} className="text-cyber-pink" /> Locked Accounts</h3>
                <div className="space-y-3">
                  {stats?.lockedAccounts?.length > 0 ? stats.lockedAccounts.map((u: any) => (
                    <div key={u.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center"><UserIcon size={16} /></div>
                        <div>
                          <p className="text-xs font-bold">{u.display_name}</p>
                          <p className="text-[10px] text-white/40">Locked until {format(new Date(u.account_locked_until), 'HH:mm')}</p>
                        </div>
                      </div>
                      <NeonButton variant="ghost" className="text-[10px] px-2 py-1">Unlock</NeonButton>
                    </div>
                  )) : (
                    <p className="text-xs text-white/20 text-center py-8">No accounts currently locked.</p>
                  )}
                </div>
              </GlassCard>
            </div>
          </motion.div>
        )}
        {activeAdminTab === 'stats' && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="text-cyber-blue" />} />
            <StatCard label="Pending" value={stats.pendingVerifications} icon={<Lock className="text-cyber-pink" />} />
            <StatCard label="Active Today" value={stats.activeToday} icon={<Zap className="text-cyber-neon" />} />
            <StatCard label="Flagged" value={stats.flaggedAccounts} icon={<AlertTriangle className="text-red-500" />} />
          </motion.div>
        )}

        {activeAdminTab === 'queue' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {queue.length === 0 ? (
              <GlassCard className="text-center py-12 opacity-40">No pending verifications.</GlassCard>
            ) : (
              queue.map(u => (
                <GlassCard key={u.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} alt="Avatar" />
                    </div>
                    <div>
                      <h4 className="font-bold">{u.display_name} <span className="text-xs text-white/40 font-mono">@{u.username}</span></h4>
                      <p className="text-xs text-white/60">{u.email} • {u.grade} {u.section}</p>
                    </div>
                  </div>
                  <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Verification Answers</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <p><span className="text-white/40">Teacher:</span> {u.question_1}</p>
                      <p><span className="text-white/40">House:</span> {u.question_2}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <NeonButton onClick={() => handleVerify(u.id, 'approved')} className="bg-cyber-neon/20 text-cyber-neon border-cyber-neon/40"><CheckCircle2 size={16} /> Approve</NeonButton>
                    <NeonButton onClick={() => handleVerify(u.id, 'rejected')} variant="danger"><XCircle size={16} /> Reject</NeonButton>
                  </div>
                </GlassCard>
              ))
            )}
          </motion.div>
        )}

        {activeAdminTab === 'audit' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-0 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] uppercase font-bold text-white/40">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-[10px] text-white/40">{format(new Date(log.timestamp), 'MM/dd HH:mm')}</td>
                      <td className="px-4 py-3 font-bold text-cyber-blue">{log.user_id}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold uppercase">{log.action_type}</span></td>
                      <td className="px-4 py-3 text-white/60">{log.details}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-white/40">{log.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          </motion.div>
        )}

        {activeAdminTab === 'ips' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clusters.map((c, i) => (
              <GlassCard key={i} className="space-y-4 border-red-500/20 bg-red-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle size={18} />
                    <h4 className="font-bold font-mono">{c.ip_address}</h4>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">{c.user_count} ACCOUNTS</span>
                </div>
                <div className="p-3 bg-cyber-dark/50 rounded-xl border border-white/10">
                  <p className="text-[10px] font-bold uppercase text-white/40 mb-2">Linked User IDs</p>
                  <div className="flex flex-wrap gap-2">
                    {c.user_ids.split(',').map(id => (
                      <span key={id} className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/10">{id}</span>
                    ))}
                  </div>
                </div>
                <NeonButton variant="danger" className="w-full text-xs">Ban IP Range</NeonButton>
              </GlassCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminTab({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shrink-0",
        active ? "bg-cyber-pink/10 text-cyber-pink border-cyber-pink/30" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
      <span className="text-sm font-bold">{label}</span>
      {count !== undefined && count > 0 && <span className="bg-cyber-pink text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function StatCard({ label, value, icon }: { label: string, value: any, icon: React.ReactNode }) {
  return (
    <GlassCard className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-white/40">{label}</p>
        <p className="text-2xl font-black font-mono">{value}</p>
      </div>
    </GlassCard>
  );
}

// --- Advanced Components ---

const StoriesBar = ({ user, onStoryClick, onAddStory }: { user: User, onStoryClick: (story: Story) => void, onAddStory: () => void }) => {
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    fetch('/api/stories').then(r => r.json()).then(setStories);
  }, []);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
      <button 
        onClick={onAddStory}
        className="flex flex-col items-center gap-2 shrink-0"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center hover:border-cyber-neon/50 transition-colors">
          <Plus className="text-white/40" />
        </div>
        <span className="text-[10px] font-bold uppercase text-white/40">Add Story</span>
      </button>

      {stories.map(story => (
        <button 
          key={story.id}
          onClick={() => onStoryClick(story)}
          className="flex flex-col items-center gap-2 shrink-0"
        >
          <div className="w-16 h-16 rounded-2xl p-[2px] bg-gradient-to-tr from-cyber-neon via-cyber-blue to-cyber-pink shadow-[0_0_15px_rgba(0,255,159,0.3)]">
            <div className="w-full h-full rounded-[14px] bg-cyber-dark overflow-hidden border-2 border-cyber-dark">
              <img src={story.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user?.username}`} className="w-full h-full object-cover" alt="Story" />
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase text-white/60 truncate w-16 text-center">{story.user?.username}</span>
        </button>
      ))}
    </div>
  );
};

const StoryViewer = ({ story, onClose }: { story: Story, onClose: () => void }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          onClose();
          return 100;
        }
        return prev + 1;
      });
    }, 50); // 5 seconds total
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-10">
        <div className="h-full bg-cyber-neon transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Avatar seed={story.user?.username || ''} src={story.user?.avatar} size="sm" />
          <div>
            <p className="text-sm font-bold">{story.user?.username}</p>
            <p className="text-[10px] text-white/40">{formatDistanceToNow(new Date(story.created_at))} ago</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <X size={20} />
        </button>
      </div>

      <img src={story.media_url} className="max-w-full max-h-full object-contain" alt="Story Content" />
      
      {story.text_overlay && (
        <div className="absolute bottom-20 left-0 right-0 text-center px-10">
          <p className="text-xl font-black tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{story.text_overlay}</p>
        </div>
      )}
    </motion.div>
  );
};

// --- App Views (Gated) ---

const PostCard = ({ post, onLike }: { post: any, onLike: () => void }) => (
  <GlassCard className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar seed={post.username} src={post.avatar} size="sm" />
        <div>
          <p className="text-sm font-bold">{post.display_name}</p>
          <p className="text-[10px] text-white/40 font-mono">@{post.username} • {formatDistanceToNow(new Date(post.timestamp))} ago</p>
        </div>
      </div>
      <button className="p-2 text-white/20 hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
    </div>
    
    <div className="space-y-3">
      <p className="text-sm text-white/80 leading-relaxed">{post.content}</p>
      {post.media_url && (
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <img src={post.media_url} className="w-full h-auto" alt="Post media" />
        </div>
      )}
    </div>

    <div className="flex items-center gap-6 pt-2">
      <button onClick={onLike} className="flex items-center gap-2 text-white/40 hover:text-cyber-pink transition-colors group">
        <Heart size={18} className="group-hover:fill-cyber-pink" />
        <span className="text-xs font-bold">{Math.floor(post.engagement_score * 10)}</span>
      </button>
      <button className="flex items-center gap-2 text-white/40 hover:text-cyber-blue transition-colors">
        <MessageCircle size={18} />
        <span className="text-xs font-bold">Reply</span>
      </button>
      <button className="flex items-center gap-2 text-white/40 hover:text-cyber-neon transition-colors ml-auto">
        <Share2 size={18} />
      </button>
    </div>
  </GlassCard>
);

function HubView({ user }: { user: User }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState('');

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(setPosts);
  }, []);

  const handleLike = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, engagement_score: p.engagement_score + 0.1 } : p));
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: postContent, type: 'public' })
    });
    if (res.ok) {
      const data = await res.json();
      setPostContent('');
      setIsPosting(false);
      // Refresh feed
      fetch('/api/posts').then(r => r.json()).then(setPosts);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <AnimatePresence>
        {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />}
      </AnimatePresence>

      <StoriesBar 
        user={user} 
        onStoryClick={setActiveStory} 
        onAddStory={() => {}} 
      />

      <section className="relative overflow-hidden rounded-3xl h-48 sm:h-64 flex items-end p-6 sm:p-10">
        <img src="https://picsum.photos/seed/cyber/1200/600" className="absolute inset-0 w-full h-full object-cover opacity-40" alt="Banner" />
        <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-cyber-dark/20 to-transparent" />
        <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">WELCOME BACK, <span className="text-cyber-neon">{user.display_name.toUpperCase()}</span></h2>
            <p className="text-white/60 font-mono text-sm">SECTOR: {user.grade.toUpperCase()} // STATUS: {user.verification_status.toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Level</p>
              <p className="text-xl font-black font-mono">{user.level}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Rank</p>
              <p className="text-xl font-black font-mono text-cyber-blue">{user.role.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GatedFeature status={user.verification_status}>
            <GlassCard className="space-y-4">
              <div className="flex gap-4">
                <Avatar seed={user.username} src={user.avatar} size="md" />
                <textarea 
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's happening in the grid?"
                  className="flex-1 bg-transparent border-none outline-none resize-none text-sm py-2"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex gap-2">
                  <button className="p-2 text-white/40 hover:text-cyber-neon transition-colors"><ImageIcon size={20} /></button>
                  <button className="p-2 text-white/40 hover:text-cyber-neon transition-colors"><Mic size={20} /></button>
                </div>
                <NeonButton onClick={handleCreatePost} disabled={!postContent.trim()} className="text-xs py-1.5 px-4">Broadcast</NeonButton>
              </div>
            </GlassCard>
          </GatedFeature>

          <div className="space-y-6">
            {Array.isArray(posts) && posts.map(post => (
              <PostCard key={post.id} post={post} onLike={() => handleLike(post.id)} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <GlassCard className="bg-cyber-neon/5 border-cyber-neon/20">
            <h3 className="text-sm font-bold uppercase tracking-widest text-cyber-neon mb-4">Daily Bounty</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Study for 30 mins</span>
                <span className="text-cyber-neon font-mono">+50XP</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="w-[60%] h-full bg-cyber-neon shadow-[0_0_10px_#00FF00]" />
              </div>
              <p className="text-[10px] text-white/40 text-right">60% Complete</p>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Trending Sectors</h3>
            <div className="space-y-4">
              {['#CyberSecurity', '#ToinMining', '#GridArena', '#AcademicVault'].map((tag, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm font-bold group-hover:text-cyber-neon transition-colors">{tag}</span>
                  <TrendingUp size={14} className="text-white/20 group-hover:text-cyber-neon" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

function StudyView({ user }: { user: User }) {
  const [studyTab, setStudyTab] = useState<'ai' | 'materials' | 'discussion' | 'tools'>('ai');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [materials, setMaterials] = useState<AcademicMaterial[]>([]);
  const [queries, setQueries] = useState<DiscussionQuery[]>([]);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch materials and queries initially for AI context
    fetch(`/api/academic/materials?grade=${user.grade}&section=${user.section}`).then(r => r.json()).then(setMaterials);
    fetch('/api/academic/queries').then(r => r.json()).then(setQueries);
  }, [user.grade, user.section]);

  useEffect(() => {
    if (studyTab === 'materials') {
      fetch(`/api/academic/materials?grade=${user.grade}&section=${user.section}`).then(r => r.json()).then(setMaterials);
    } else if (studyTab === 'discussion') {
      fetch('/api/academic/queries').then(r => r.json()).then(setQueries);
    }
  }, [studyTab, user.grade, user.section]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      const response = await getStudyBuddyResponse(userMsg, history, { materials, queries });
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (e) { 
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', content: "ERROR: GRID CONNECTION UNSTABLE. PLEASE TRY AGAIN." }]); 
    }
    setIsTyping(false);
  };

  const handleCreateQuery = async (q: string, s: string) => {
    const res = await fetch('/api/academic/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: s, query: q })
    });
    if (res.ok) fetch('/api/academic/queries').then(r => r.json()).then(setQueries);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-[calc(100vh-12rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2"><Sparkles className="text-cyber-neon" /> ACADEMICS</h2>
          <div className="flex gap-2">
            {['ai', 'materials', 'discussion', 'tools'].map((t: any) => (
              <button 
                key={t}
                onClick={() => setStudyTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                  studyTab === t ? "bg-cyber-neon text-cyber-dark" : "bg-white/5 text-white/40 hover:bg-white/10"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {studyTab === 'ai' && (
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn("max-w-[85%] p-4 rounded-2xl", msg.role === 'user' ? "bg-cyber-neon/10 border border-cyber-neon/20" : "bg-white/5 border border-white/10")}>
                      <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    </div>
                  </div>
                ))}
                {isTyping && <div className="flex gap-1 p-4"><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse delay-75" /><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse delay-150" /></div>}
              </div>
              <GatedFeature status={user.verification_status}>
                <div className="p-4 border-t border-white/10 bg-white/5">
                  <div className="flex items-center gap-2">
                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask StudyBuddy AI..." className="flex-1 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" />
                    <button onClick={handleSend} className="p-3 bg-cyber-neon text-cyber-dark rounded-xl"><Send size={20} /></button>
                  </div>
                </div>
              </GatedFeature>
            </motion.div>
          )}

          {studyTab === 'materials' && (
            <motion.div key="materials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materials.length > 0 ? materials.map(m => (
                  <GlassCard key={m.id} className="p-4 space-y-3 border-white/5 hover:border-cyber-blue/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <Badge variant={m.type === 'homework' ? 'pink' : m.type === 'classwork' ? 'blue' : 'neon'}>{m.type}</Badge>
                      <span className="text-[10px] text-white/20 font-mono">{format(new Date(m.created_at), 'MMM dd')}</span>
                    </div>
                    <h3 className="font-bold text-lg">{m.title}</h3>
                    <p className="text-xs text-white/60 line-clamp-2">{m.content}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] text-cyber-blue font-bold uppercase">{m.subject}</span>
                      {m.due_date && <span className="text-[10px] text-red-400 font-bold uppercase">Due: {format(new Date(m.due_date), 'MMM dd')}</span>}
                    </div>
                  </GlassCard>
                )) : (
                  <div className="col-span-full py-20 text-center opacity-40">
                    <BookOpen className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-mono uppercase">No academic transmissions found for your sector.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {studyTab === 'discussion' && (
            <motion.div key="discussion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {queries.map(q => (
                  <GlassCard key={q.id} className="p-4 space-y-2 border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar seed={q.user_id} size="sm" />
                      <div>
                        <p className="text-xs font-bold">{q.user?.display_name || 'Anonymous'}</p>
                        <p className="text-[10px] text-white/20">{formatDistanceToNow(new Date(q.created_at))} ago</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-cyber-neon font-bold uppercase tracking-widest">{q.subject}</p>
                    <p className="text-sm text-white/80">{q.query}</p>
                  </GlassCard>
                ))}
              </div>
              <div className="p-4 border-t border-white/10 bg-white/5">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as any;
                  handleCreateQuery(form.query.value, form.subject.value);
                  form.reset();
                }} className="space-y-3">
                  <div className="flex gap-2">
                    <input name="subject" placeholder="Subject (e.g. Physics)" className="w-1/3 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none" required />
                    <input name="query" placeholder="Ask a question to the campus..." className="flex-1 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none" required />
                    <button type="submit" className="px-4 bg-cyber-blue text-white rounded-xl text-xs font-bold uppercase">Post</button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {studyTab === 'tools' && (
            <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-8">
                <div className="relative">
                  <div className="text-8xl font-black tracking-tighter font-mono text-cyber-neon drop-shadow-[0_0_20px_rgba(0,255,159,0.4)]">
                    {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                  </div>
                  <p className="text-xs text-white/20 font-mono mt-2 uppercase tracking-[0.5em]">Focus Chronometer</p>
                </div>
                <div className="flex gap-4 justify-center">
                  {[25, 45, 60].map(mins => (
                    <button key={mins} onClick={() => { setTimer(mins * 60); setIsTimerRunning(false); }} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">{mins}m</button>
                  ))}
                </div>
                <div className="flex gap-4 justify-center">
                  <NeonButton onClick={() => setIsTimerRunning(!isTimerRunning)} variant={isTimerRunning ? 'danger' : 'ghost'} className="px-12 py-4 text-lg">
                    {isTimerRunning ? 'PAUSE' : 'START'}
                  </NeonButton>
                  <NeonButton onClick={() => { setTimer(0); setIsTimerRunning(false); }} variant="ghost" className="px-8 py-4 text-lg">RESET</NeonButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

function ChatView({ user, socket }: { user: User, socket: Socket }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/conversations').then(r => r.json()).then(setConversations);
  }, []);

  useEffect(() => {
    if (activeConv) {
      fetch(`/api/conversations/${activeConv.id}/messages`).then(r => r.json()).then(setMessages);
      socket.emit("join-conversation", activeConv.id);
    }
  }, [activeConv, socket]);

  useEffect(() => {
    const handleNewMessage = (msg: Message) => {
      if (activeConv && msg.conversation_id === activeConv.id) {
        setMessages(prev => [...prev, msg]);
      }
      setConversations(prev => prev.map(c => 
        c.id === msg.conversation_id ? { ...c, last_message: msg.content, last_message_at: msg.created_at } : c
      ));
    };

    const handleTyping = ({ userId, isTyping }: any) => {
      if (isTyping) setTypingUser(userId);
      else setTypingUser(null);
    };

    socket.on("new-message", handleNewMessage);
    socket.on("user-typing", handleTyping);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("user-typing", handleTyping);
    };
  }, [activeConv, socket]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typingUser]);

  const handleSend = () => {
    if (!input.trim() || !activeConv) return;
    socket.emit("send-message", { 
      conversationId: activeConv.id, 
      content: input,
      contentType: 'text'
    });
    setInput('');
    socket.emit("typing", { conversationId: activeConv.id, isTyping: false });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-12rem)] flex bg-cyber-dark/40 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl">
      {/* Sidebar - WhatsApp/Insta Style */}
      <div className="w-80 flex flex-col border-r border-white/10 bg-white/5">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tighter">CHATS</h3>
          <button className="p-2 bg-cyber-neon/10 text-cyber-neon rounded-full hover:bg-cyber-neon/20 transition-all"><Plus size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button 
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              className={cn(
                "w-full p-4 flex gap-4 hover:bg-white/5 transition-all text-left border-b border-white/5",
                activeConv?.id === conv.id && "bg-white/10"
              )}
            >
              <div className="relative">
                <Avatar seed={conv.name || conv.id} size="md" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-cyber-neon rounded-full border-2 border-cyber-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold truncate">{conv.name || "Private Frequency"}</p>
                  <span className="text-[10px] text-white/20">
                    {conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}
                  </span>
                </div>
                <p className="text-xs text-white/40 truncate">{(conv as any).last_message || "No transmissions yet..."}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeConv ? (
          <>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <Avatar seed={activeConv.name || activeConv.id} size="sm" />
                <div>
                  <h3 className="font-bold text-sm">{activeConv.name || "Private Frequency"}</h3>
                  <p className="text-[10px] text-cyber-neon font-mono uppercase tracking-widest animate-pulse">Online</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button className="text-white/40 hover:text-white transition-colors"><Search size={20} /></button>
                <button className="text-white/40 hover:text-white transition-colors"><MoreHorizontal size={20} /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[75%] p-3 px-4 rounded-2xl text-sm shadow-lg",
                      isMe ? "bg-cyber-neon text-cyber-dark rounded-tr-none" : "bg-white/10 border border-white/10 text-white rounded-tl-none"
                    )}>
                      {msg.content}
                      <p className={cn("text-[9px] mt-1 text-right", isMe ? "text-cyber-dark/60" : "text-white/40")}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
              {typingUser && (
                <div className="flex items-center gap-2 text-[10px] text-cyber-neon font-mono">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-cyber-neon rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-cyber-neon rounded-full animate-bounce delay-75" />
                    <div className="w-1 h-1 bg-cyber-neon rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10">
              <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-2 border border-white/10">
                <button className="text-white/40 hover:text-cyber-neon transition-colors"><PlusCircle size={22} /></button>
                <input 
                  value={input} 
                  onChange={(e) => {
                    setInput(e.target.value);
                    socket.emit("typing", { conversationId: activeConv.id, isTyping: e.target.value.length > 0 });
                  }} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                  placeholder="Message..." 
                  className="flex-1 bg-transparent border-none py-2 text-sm outline-none" 
                />
                <button onClick={handleSend} className={cn("p-2 rounded-full transition-all", input.trim() ? "text-cyber-neon scale-110" : "text-white/20")}>
                  <Send size={22} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-cyber-neon/10 flex items-center justify-center border border-cyber-neon/20">
              <MessageCircle size={48} className="text-cyber-neon" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter">YOUR MESSAGES</h3>
              <p className="text-sm text-white/40 max-w-xs mx-auto">Send encrypted transmissions to other campus residents.</p>
            </div>
            <NeonButton className="px-8">Send Message</NeonButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MarketView({ user }: { user: User }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newListing, setNewListing] = useState({ title: '', description: '', price: 0, category: 'academic' });

  useEffect(() => {
    fetch('/api/marketplace/listings').then(r => r.json()).then(setListings);
  }, []);

  const handleCreateListing = async () => {
    const res = await fetch('/api/marketplace/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newListing)
    });
    if (res.ok) {
      setIsCreating(false);
      fetch('/api/marketplace/listings').then(r => r.json()).then(setListings);
    }
  };

  const filtered = category === 'all' ? listings : listings.filter(l => l.category === category);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">THE CAMPUS VAULT</h2>
          <p className="text-sm text-white/40 font-mono uppercase tracking-widest">Peer-to-Peer Grid Exchange</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-cyber-neon/10 border border-cyber-neon/20 px-6 py-3 rounded-2xl flex items-center gap-3">
            <Coins className="w-6 h-6 text-cyber-neon" />
            <div>
              <p className="text-[10px] uppercase font-bold text-cyber-neon">Balance</p>
              <p className="text-xl font-black font-mono">{user.toins} TOINS</p>
            </div>
          </div>
          <NeonButton onClick={() => setIsCreating(true)}><Plus size={18} /> List Item</NeonButton>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'academic', 'electronics', 'services', 'other'].map(cat => (
          <button 
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all shrink-0",
              category === cat ? "bg-cyber-neon text-cyber-dark border-cyber-neon" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map(item => (
          <GlassCard key={item.id} className="flex flex-col gap-4 group hover:border-cyber-neon/30 transition-all">
            <div className="aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative">
              <img src={`https://picsum.photos/seed/${item.id}/400/400`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={item.title} />
              <div className="absolute top-3 right-3">
                <Badge variant={item.category === 'academic' ? 'blue' : 'neon'}>{item.category}</Badge>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg truncate">{item.title}</h3>
              <p className="text-xs text-white/40 mt-1 line-clamp-2">{item.description}</p>
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
              <div className="flex items-center gap-1">
                <Coins size={14} className="text-cyber-neon" />
                <span className="text-sm font-mono font-bold">{item.price}</span>
              </div>
              <NeonButton variant="ghost" className="text-xs py-1.5 px-3">Contact Seller</NeonButton>
            </div>
          </GlassCard>
        ))}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 bg-cyber-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
            <GlassCard className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tighter">NEW LISTING</h3>
                <button onClick={() => setIsCreating(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Title</label>
                  <input value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyber-neon/50" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Description</label>
                  <textarea value={newListing.description} onChange={e => setNewListing({...newListing, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyber-neon/50" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Price (Toins)</label>
                    <input type="number" value={newListing.price} onChange={e => setNewListing({...newListing, price: parseInt(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyber-neon/50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Category</label>
                    <select value={newListing.category} onChange={e => setNewListing({...newListing, category: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyber-neon/50">
                      <option value="academic">Academic</option>
                      <option value="electronics">Electronics</option>
                      <option value="services">Services</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <NeonButton onClick={handleCreateListing} className="w-full py-3">Initialize Listing</NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ProfileView({ user, setUser, onSecurity, onThemes }: { user: User, setUser: (u: User) => void, onSecurity: () => void, onThemes: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'bio' | 'friends' | 'wallet'>('bio');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (activeSubTab === 'friends') {
      fetch('/api/friendships').then(r => r.json()).then(setFriends);
    } else if (activeSubTab === 'wallet') {
      fetch('/api/economy/transactions').then(r => r.json()).then(setTransactions);
    }
  }, [activeSubTab]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto space-y-8">
      <div className="relative">
        <div className="h-48 rounded-3xl overflow-hidden border border-white/10">
          <img src={user.cover || "https://picsum.photos/seed/profile/1200/400"} className="w-full h-full object-cover opacity-50" alt="Cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark to-transparent" />
        </div>
        <div className="absolute -bottom-12 left-8 flex items-end gap-6">
          <div className="w-32 h-32 rounded-3xl border-4 border-cyber-dark overflow-hidden bg-cyber-dark">
            <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full" alt="Avatar" />
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tighter">{user.display_name}</h2>
              {user.verification_status === 'approved' && <ShieldCheck className="text-cyber-neon w-5 h-5" />}
            </div>
            <p className="text-cyber-neon font-mono text-sm">@{user.username}</p>
          </div>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <NeonButton variant="ghost" onClick={onThemes}><Palette size={18} /> Themes</NeonButton>
          <NeonButton variant="ghost" onClick={onSecurity}><Shield size={18} /> Security</NeonButton>
          <NeonButton variant="ghost" onClick={() => setIsEditing(!isEditing)}><Settings size={18} /> Edit Profile</NeonButton>
        </div>
      </div>

      <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="flex gap-4 border-b border-white/5 pb-2">
            {['bio', 'friends', 'wallet'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveSubTab(tab as any)}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all relative",
                  activeSubTab === tab ? "text-cyber-neon" : "text-white/40 hover:text-white"
                )}
              >
                {tab}
                {activeSubTab === tab && <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyber-neon" />}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeSubTab === 'bio' && (
              <motion.div key="bio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <GlassCard>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Biometrics</h3>
                  <div className="space-y-4">
                    <p className="text-white/80 leading-relaxed">Identity Sector: {user.grade} {user.section}. House: {user.house || 'Sector Unknown'}. Verified on {user.verified_at ? format(new Date(user.verified_at), 'MMMM dd, yyyy') : 'N/A'}.</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="blue">#{user.grade.replace(' ', '')}</Badge>
                      {user.house && <Badge variant="neon">#{user.house.replace(' ', '')}</Badge>}
                      <Badge variant="pink">#{user.verification_status.toUpperCase()}</Badge>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {activeSubTab === 'friends' && (
              <motion.div key="friends" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {friends.length > 0 ? friends.map(f => (
                  <GlassCard key={f.id} className="flex items-center gap-4">
                    <Avatar seed={f.friend_id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{f.friend_id}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">{f.status}</p>
                    </div>
                    <NeonButton variant="ghost" className="p-2"><MessageCircle size={14} /></NeonButton>
                  </GlassCard>
                )) : (
                  <div className="col-span-full py-12 text-center opacity-40">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-mono">NO SOCIAL CONNECTIONS DETECTED</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeSubTab === 'wallet' && (
              <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard className="bg-cyber-neon/5 border-cyber-neon/20">
                    <p className="text-[10px] uppercase font-bold text-cyber-neon mb-1">Current Balance</p>
                    <p className="text-3xl font-black font-mono">{user.toins}</p>
                  </GlassCard>
                  <GlassCard>
                    <p className="text-[10px] uppercase font-bold text-white/40 mb-1">Total Earned</p>
                    <p className="text-3xl font-black font-mono text-cyber-blue">12,450</p>
                  </GlassCard>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase text-white/40 tracking-widest">Transaction History</h4>
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", t.amount > 0 ? "bg-cyber-neon/10 text-cyber-neon" : "bg-cyber-pink/10 text-cyber-pink")}>
                          {t.amount > 0 ? <TrendingUp size={16} /> : <CreditCard size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{t.type.toUpperCase()}</p>
                          <p className="text-[10px] text-white/40">{format(new Date(t.created_at), 'MMM dd, HH:mm')}</p>
                        </div>
                      </div>
                      <p className={cn("font-mono font-bold", t.amount > 0 ? "text-cyber-neon" : "text-cyber-pink")}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <GlassCard className="text-center">
            <p className="text-[10px] uppercase font-bold text-white/40 mb-1">Grid Rank</p>
            <p className="text-3xl font-black text-cyber-blue tracking-tighter">{user.role.toUpperCase()}</p>
          </GlassCard>
          
          <GlassCard className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase text-white/40 tracking-widest">Grid Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Posts</span>
                <span className="font-mono font-bold">124</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Followers</span>
                <span className="font-mono font-bold">892</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Reputation</span>
                <span className="font-mono font-bold text-cyber-neon">98%</span>
              </div>
            </div>
          </GlassCard>

          <NeonButton variant="danger" className="w-full" onClick={handleLogout}><LogOut size={18} /> Disconnect Frequency</NeonButton>
        </div>
      </div>
    </motion.div>
  );
}

function CustomizationView({ user }: { user: User }) {
  const [themes, setThemes] = useState<any[]>([]);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customization/themes').then(r => r.json()).then(setThemes);
  }, []);

  const handleApplyTheme = async (themeId: string) => {
    const res = await fetch('/api/customization/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId })
    });
    if (res.ok) setActiveTheme(themeId);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-black tracking-tighter">GRID CUSTOMIZATION</h2>
        <p className="text-sm text-white/40 font-mono uppercase tracking-widest">Personalize your frequency signature</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2"><Palette className="text-cyber-neon" /> PROFILE THEMES</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'neon_pulse', name: 'Neon Pulse', color: '#00FF9F', price: 0 },
              { id: 'cyber_pink', name: 'Cyber Pink', color: '#FF007A', price: 1000 },
              { id: 'deep_blue', name: 'Deep Blue', color: '#00F0FF', price: 1000 },
              { id: 'gold_elite', name: 'Gold Elite', color: '#FFD700', price: 5000 }
            ].map(theme => (
              <GlassCard 
                key={theme.id} 
                onClick={() => handleApplyTheme(theme.id)}
                className={cn(
                  "cursor-pointer border-2 transition-all",
                  activeTheme === theme.id ? "border-cyber-neon" : "border-white/5"
                )}
              >
                <div className="w-full h-20 rounded-xl mb-3" style={{ backgroundColor: `${theme.color}20`, border: `1px solid ${theme.color}40` }} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{theme.name}</span>
                  {theme.price > 0 && <span className="text-[10px] font-mono text-cyber-neon">{theme.price} T</span>}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2"><Layout className="text-cyber-blue" /> CHAT ENHANCEMENTS</h3>
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyber-pink/10 text-cyber-pink rounded-lg"><TypeIcon size={18} /></div>
                <div>
                  <p className="text-sm font-bold">Custom Chat Font</p>
                  <p className="text-[10px] text-white/40">Unlock JetBrains Mono for all chats</p>
                </div>
              </div>
              <NeonButton variant="ghost" className="text-xs">500 T</NeonButton>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyber-neon/10 text-cyber-neon rounded-lg"><ImageIcon size={18} /></div>
                <div>
                  <p className="text-sm font-bold">Animated Avatars</p>
                  <p className="text-[10px] text-white/40">Support for GIF profile pictures</p>
                </div>
              </div>
              <NeonButton variant="ghost" className="text-xs">2000 T</NeonButton>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

function SecurityView({ user }: { user: User }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/sessions').then(r => r.json()).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  const revokeSession = async (sessionId: string) => {
    const res = await fetch('/api/user/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    if (res.ok) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyber-neon/10 flex items-center justify-center border border-cyber-neon/20">
          <Shield size={24} className="text-cyber-neon" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tighter">SECURITY PROTOCOLS</h2>
          <p className="text-xs text-white/40 font-mono">ENCRYPTION: AES-256-GCM // STATUS: SECURE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <GlassCard className="space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Smartphone size={18} className="text-cyber-blue" /> Active Sessions</h3>
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <Globe size={20} className="text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{session.ip_address}</p>
                    <p className="text-[10px] text-white/60 truncate max-w-[200px]">{session.user_agent}</p>
                    <p className="text-[10px] text-white/40">Last active: {format(new Date(session.last_activity_at), 'MMM dd, HH:mm')}</p>
                  </div>
                </div>
                <NeonButton variant="ghost" className="text-xs px-3 py-1.5" onClick={() => revokeSession(session.id)}>Revoke</NeonButton>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Key size={18} className="text-cyber-pink" /> Password Management</h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Current Password</label>
              <input type="password" placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-white/40 ml-1">New Password</label>
              <input type="password" placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none" />
            </div>
            <NeonButton className="w-full py-3">Update Access Key</NeonButton>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center gap-1 transition-all", active ? "text-cyber-neon" : "text-white/40")}>
      <div className={cn("p-1 rounded-lg", active && "bg-cyber-neon/10")}>{React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
