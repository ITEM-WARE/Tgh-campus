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
  Type as TypeIcon,
  Check,
  CheckCheck,
  Trophy,
  ClipboardList,
  Ticket as TicketIcon,
  Store,
  Gift,
  MousePointer2,
  ZapOff,
  Flag,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Message, AuditLog, IPCluster, SecurityEvent, Session, DeviceSession, Story, Conversation, Listing, Notification, Friendship, Transaction, AcademicMaterial, DiscussionQuery, StoreItem, UserInventory, Task, TaskSubmission, Challenge, Ticket, AIHistory } from './types';
import { getStudyBuddyResponse, analyzeImage, generateSpeech } from './geminiService';

import { Chat } from './components/Chat';
import { VoiceRecorder } from './components/VoiceRecorder';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

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
  <motion.div 
    whileHover={{ y: -2 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    onClick={onClick}
    className={cn("glass-panel p-4 transition-all duration-300 hover:border-white/20", className)}
  >
    {children}
  </motion.div>
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
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
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
    </motion.button>
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
  const [activeTab, setActiveTab] = useState<'hub' | 'chat' | 'study' | 'store' | 'profile' | 'security' | 'custom' | 'tasks' | 'leaderboard' | 'tickets' | 'market'>('hub');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const res = await fetch('/api/users/me', { signal: controller.signal, credentials: 'include' });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setUser(data);
          if (data.role === 'admin') setView('admin');
          else if (data.verification_status === 'approved' && !data.username_locked) setView('app');
          else setView('onboarding');
        } else {
          setView('auth');
        }
      } catch (e: any) { 
        console.error("Auth check failed:", e);
        setView('auth');
      } finally {
        setLoading(false);
      }
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
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyber-neon/10 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyber-pink/10 blur-[120px] rounded-full" 
        />
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
                {activeTab === 'hub' && <HubView key="hub" user={user!} onViewProfile={setSelectedProfileId} />}
                {activeTab === 'study' && <StudyView key="study" user={user!} />}
                {activeTab === 'chat' && <ChatView key="chat" user={user!} socket={socketRef.current!} onViewProfile={setSelectedProfileId} />}
                {activeTab === 'store' && <StoreView key="store" user={user!} setUser={setUser} />}
                {activeTab === 'tasks' && <TasksView key="tasks" user={user!} />}
                {activeTab === 'leaderboard' && <LeaderboardView key="leaderboard" user={user!} onViewProfile={setSelectedProfileId} />}
                {activeTab === 'tickets' && <TicketsView key="tickets" user={user!} />}
                {activeTab === 'custom' && <CustomizationView key="custom" user={user!} />}
                {activeTab === 'profile' && <ProfileView key="profile" user={user!} setUser={setUser} onSecurity={() => setActiveTab('security')} onThemes={() => setActiveTab('custom')} onStore={() => setActiveTab('store')} onTickets={() => setActiveTab('tickets')} />}
                {activeTab === 'security' && <SecurityView key="security" user={user!} />}
                {activeTab === 'market' && <MarketView key="market" user={user!} onViewProfile={setSelectedProfileId} />}
              </AnimatePresence>
            </main>
            <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </motion.div>
        )}
      </AnimatePresence>

      {selectedProfileId && (
        <PublicProfileModal 
          userId={selectedProfileId} 
          onClose={() => setSelectedProfileId(null)} 
          currentUser={user!} 
        />
      )}
    </div>
  );
}

// --- Sub-Views ---

function Header({ user, setActiveTab, activeTab, onAdmin, notifications }: { user: User, setActiveTab: (t: any) => void, activeTab: string, onAdmin: () => void, notifications: Notification[] }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel !rounded-none border-x-0 border-t-0 bg-cyber-dark/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 text-white/60 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu size={24} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-neon to-cyber-blue p-[1px]">
            <div className="w-full h-full rounded-xl bg-cyber-dark flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyber-neon" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tighter neon-text text-white hidden sm:block">TGH CAMPUS</h1>
        </div>
        
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-cyber-dark border-b border-white/10 p-4 flex flex-col gap-4 md:hidden z-50">
            <button onClick={() => {setActiveTab('hub'); setIsMobileMenuOpen(false)}} className={cn("hover:text-white transition-colors", activeTab === 'hub' && "text-cyber-neon")}>GRID</button>
            <button onClick={() => {setActiveTab('study'); setIsMobileMenuOpen(false)}} className={cn("hover:text-white transition-colors", activeTab === 'study' && "text-cyber-neon")}>ACADEMICS</button>
            <button onClick={() => {setActiveTab('tasks'); setIsMobileMenuOpen(false)}} className={cn("hover:text-white transition-colors", activeTab === 'tasks' && "text-cyber-neon")}>TASKS</button>
            <button onClick={() => {setActiveTab('leaderboard'); setIsMobileMenuOpen(false)}} className={cn("hover:text-white transition-colors", activeTab === 'leaderboard' && "text-cyber-neon")}>RANK</button>
            <button onClick={() => {setActiveTab('store'); setIsMobileMenuOpen(false)}} className={cn("hover:text-white transition-colors", activeTab === 'store' && "text-cyber-neon")}>STORE</button>
            {user.role === 'admin' && <button onClick={() => {onAdmin(); setIsMobileMenuOpen(false)}} className="text-cyber-pink hover:text-white transition-colors">ADMIN</button>}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
            <button onClick={() => setActiveTab('hub')} className={cn("hover:text-white transition-colors", activeTab === 'hub' && "text-cyber-neon")}>GRID</button>
            <button onClick={() => setActiveTab('study')} className={cn("hover:text-white transition-colors", activeTab === 'study' && "text-cyber-neon")}>ACADEMICS</button>
            <button onClick={() => setActiveTab('tasks')} className={cn("hover:text-white transition-colors", activeTab === 'tasks' && "text-cyber-neon")}>TASKS</button>
            <button onClick={() => setActiveTab('leaderboard')} className={cn("hover:text-white transition-colors", activeTab === 'leaderboard' && "text-cyber-neon")}>RANK</button>
            <button onClick={() => setActiveTab('store')} className={cn("hover:text-white transition-colors", activeTab === 'store' && "text-cyber-neon")}>STORE</button>
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
        <NavButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<ClipboardList />} label="Tasks" />
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
  const [activeAdminTab, setActiveAdminTab] = useState<'stats' | 'queue' | 'audit' | 'ips' | 'security' | 'academics' | 'tickets' | 'tasks' | 'redeem' | 'store' | 'reports'>('stats');
  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [clusters, setClusters] = useState<IPCluster[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([]);
  const [taskSubs, setTaskSubs] = useState<TaskSubmission[]>([]);
  const [lockdown, setLockdown] = useState(false);
  const [academicForm, setAcademicForm] = useState({ type: 'homework', title: '', content: '', grade: '', section: '', subject: '', due_date: '' });
  const [redeemForm, setRedeemForm] = useState({ code: '', reward_type: 'toins', reward_value: '', max_uses: 100, hint: '', is_treasure_hunt: false });
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [adminReports, setAdminReports] = useState<any[]>([]);

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

      if (activeAdminTab === 'tickets') {
        fetch('/api/admin/tickets').then(r => r.json()).then(setAdminTickets);
      } else if (activeAdminTab === 'tasks') {
        fetch('/api/admin/tasks/submissions').then(r => r.json()).then(setTaskSubs);
      } else if (activeAdminTab === 'store') {
        fetch('/api/admin/store').then(r => r.json()).then(setStoreItems);
      } else if (activeAdminTab === 'reports') {
        fetch('/api/admin/reports').then(r => r.json()).then(setAdminReports);
      }
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
        <AdminTab active={activeAdminTab === 'tickets'} onClick={() => setActiveAdminTab('tickets')} icon={<TicketIcon />} label="Tickets" count={adminTickets.length} />
        <AdminTab active={activeAdminTab === 'tasks'} onClick={() => setActiveAdminTab('tasks')} icon={<ClipboardList />} label="Tasks" count={taskSubs.length} />
        <AdminTab active={activeAdminTab === 'redeem'} onClick={() => setActiveAdminTab('redeem')} icon={<Gift />} label="Codes" />
        <AdminTab active={activeAdminTab === 'store'} onClick={() => setActiveAdminTab('store')} icon={<ShoppingBag />} label="Store" />
        <AdminTab active={activeAdminTab === 'reports'} onClick={() => setActiveAdminTab('reports')} icon={<Flag />} label="Reports" count={adminReports.filter(r => r.status === 'pending').length} />
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

        {activeAdminTab === 'tickets' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {adminTickets.map(ticket => (
              <GlassCard key={ticket.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar seed={ticket.username || ''} size="sm" />
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider">{ticket.category.replace('_', ' ')}</p>
                    <p className="text-[10px] text-white/40">From: {ticket.display_name} (@{ticket.username}) • ID: {ticket.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <NeonButton variant="ghost" className="text-xs px-3 py-1">View Thread</NeonButton>
                  <NeonButton variant="blue" className="text-xs px-3 py-1">Resolve</NeonButton>
                </div>
              </GlassCard>
            ))}
            {adminTickets.length === 0 && <GlassCard className="text-center py-12 opacity-40">No active tickets.</GlassCard>}
          </motion.div>
        )}

        {activeAdminTab === 'tasks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {taskSubs.map(sub => (
              <GlassCard key={sub.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar seed={sub.username || ''} size="sm" />
                    <div>
                      <p className="text-sm font-bold">{sub.display_name} submitted for "{sub.task_title}"</p>
                      <p className="text-[10px] text-white/40">Submitted: {format(new Date(sub.submitted_at), 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                  <Badge variant="blue">PENDING VERIFICATION</Badge>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm">
                  <p className="text-white/80">{sub.proof_text}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <NeonButton 
                    onClick={async () => {
                      await fetch('/api/admin/tasks/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ submissionId: sub.id, status: 'approved', feedback: 'Great job!' })
                      });
                      fetch('/api/admin/tasks/submissions').then(r => r.json()).then(setTaskSubs);
                    }}
                    className="bg-cyber-neon/20 text-cyber-neon border-cyber-neon/40 text-xs px-4 py-1.5"
                  >
                    Approve & Pay
                  </NeonButton>
                  <NeonButton 
                    variant="danger" 
                    className="text-xs px-4 py-1.5"
                    onClick={async () => {
                      await fetch('/api/admin/tasks/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ submissionId: sub.id, status: 'rejected', feedback: 'Insufficient proof.' })
                      });
                      fetch('/api/admin/tasks/submissions').then(r => r.json()).then(setTaskSubs);
                    }}
                  >
                    Reject
                  </NeonButton>
                </div>
              </GlassCard>
            ))}
            {taskSubs.length === 0 && <GlassCard className="text-center py-12 opacity-40">No pending task submissions.</GlassCard>}
          </motion.div>
        )}

        {activeAdminTab === 'redeem' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard className="p-6">
              <h3 className="text-xl font-black tracking-tighter mb-6">CREATE REDEEM CODE</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Code String</label>
                    <input 
                      value={redeemForm.code}
                      onChange={e => setRedeemForm({...redeemForm, code: e.target.value.toUpperCase()})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm outline-none" 
                      placeholder="e.g. WELCOME_2024"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Reward Type</label>
                      <select 
                        value={redeemForm.reward_type}
                        onChange={e => setRedeemForm({...redeemForm, reward_type: e.target.value as any})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                      >
                        <option value="toins">Toins</option>
                        <option value="item">Item ID</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Value</label>
                      <input 
                        value={redeemForm.reward_value}
                        onChange={e => setRedeemForm({...redeemForm, reward_value: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Max Uses</label>
                    <input 
                      type="number"
                      value={redeemForm.max_uses}
                      onChange={e => setRedeemForm({...redeemForm, max_uses: parseInt(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none" 
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={redeemForm.is_treasure_hunt}
                        onChange={e => setRedeemForm({...redeemForm, is_treasure_hunt: e.target.checked})}
                        className="w-4 h-4 rounded bg-white/5 border-white/10 text-cyber-neon"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider">Treasure Hunt Mode</span>
                    </label>
                  </div>
                  <NeonButton 
                    className="w-full py-3 mt-2"
                    onClick={async () => {
                      const res = await fetch('/api/admin/redeem', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(redeemForm)
                      });
                      if (res.ok) {
                        alert("Redeem code created!");
                        setRedeemForm({ code: '', reward_type: 'toins', reward_value: '', max_uses: 100, hint: '', is_treasure_hunt: false });
                      }
                    }}
                  >
                    GENERATE CODE
                  </NeonButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeAdminTab === 'store' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <GlassCard className="p-6">
              <h3 className="text-xl font-black tracking-tighter mb-6">STORE MANAGEMENT</h3>
              <div className="space-y-4">
                {storeItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-xs text-white/40">{item.description} - {item.price} Toins</p>
                    </div>
                    <button 
                      onClick={async () => {
                        const res = await fetch(`/api/admin/store/${item.id}`, { method: 'DELETE' });
                        if (res.ok) setStoreItems(prev => prev.filter(i => i.id !== item.id));
                      }}
                      className="text-cyber-pink hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <h4 className="font-bold mb-4">Add New Item</h4>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="ID" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-id" />
                  <input placeholder="Name" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-name" />
                  <input placeholder="Description" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-desc" />
                  <input placeholder="Category" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-cat" />
                  <input placeholder="Price" type="number" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-price" />
                  <select className="bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="new-item-type">
                    <option value="digital">Digital</option>
                  </select>
                </div>
                <NeonButton 
                  className="w-full mt-4"
                  onClick={async () => {
                    const newItem = {
                      id: (document.getElementById('new-item-id') as HTMLInputElement).value,
                      name: (document.getElementById('new-item-name') as HTMLInputElement).value,
                      description: (document.getElementById('new-item-desc') as HTMLInputElement).value,
                      category: (document.getElementById('new-item-cat') as HTMLInputElement).value,
                      price: parseInt((document.getElementById('new-item-price') as HTMLInputElement).value),
                      type: (document.getElementById('new-item-type') as HTMLInputElement).value,
                    };
                    const res = await fetch('/api/admin/store', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(newItem)
                    });
                    if (res.ok) {
                      alert("Item added!");
                      setStoreItems([...storeItems, newItem]);
                    }
                  }}
                >
                  ADD ITEM
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeAdminTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h3 className="text-xl font-black tracking-tighter">INCIDENT REPORTS</h3>
            <div className="grid grid-cols-1 gap-4">
              {adminReports.map(report => (
                <GlassCard key={report.id} className={cn("p-6", report.status === 'pending' ? "border-red-500/30" : "opacity-60")}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                        <Flag size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Reported by @{report.reporter_username}</p>
                        <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">{report.target_type} ID: {report.target_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                        report.status === 'pending' ? "bg-red-500 text-white" : "bg-white/10 text-white/40"
                      )}>
                        {report.status}
                      </span>
                      <span className="text-[10px] text-white/20 font-mono">
                        {format(new Date(report.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                    <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Reason</p>
                    <p className="text-sm">{report.reason}</p>
                  </div>

                  {report.target_type === 'post' && report.post_content && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                      <p className="text-[10px] font-bold text-white/40 uppercase mb-2">Post Content</p>
                      <p className="text-sm italic text-white/70">"{report.post_content}"</p>
                    </div>
                  )}

                  {report.status === 'pending' && (
                    <div className="flex gap-3">
                      <NeonButton 
                        onClick={async () => {
                          const res = await fetch(`/api/admin/reports/${report.id}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'resolved' })
                          });
                          if (res.ok) fetch('/api/admin/reports').then(r => r.json()).then(setAdminReports);
                        }}
                        className="flex-1 text-xs py-2"
                      >
                        RESOLVE
                      </NeonButton>
                      <NeonButton 
                        variant="ghost"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/reports/${report.id}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'dismissed' })
                          });
                          if (res.ok) fetch('/api/admin/reports').then(r => r.json()).then(setAdminReports);
                        }}
                        className="flex-1 text-xs py-2"
                      >
                        DISMISS
                      </NeonButton>
                    </div>
                  )}
                </GlassCard>
              ))}
              {adminReports.length === 0 && (
                <GlassCard className="text-center py-12 opacity-40">No incident reports found.</GlassCard>
              )}
            </div>
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
    <div className="flex gap-4 overflow-x-auto no-scrollbar">
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

const StoryViewer = ({ story, onClose, onViewProfile }: { story: Story, onClose: () => void, onViewProfile: (id: string) => void }) => {
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
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => story.user?.id && onViewProfile(story.user.id)}>
          <Avatar seed={story.user?.username || ''} src={story.user?.avatar} size="sm" />
          <div>
            <p className="text-sm font-bold group-hover:text-cyber-neon transition-colors">{story.user?.username}</p>
            <p className="text-[10px] text-white/40">{formatDistanceToNow(new Date(story.created_at))} ago</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <X size={20} />
        </button>
      </div>

      <img src={story.media_url} className="max-w-full max-h-full object-contain" alt="Story Content" />
      
      <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black via-black/60 to-transparent">
        {story.title && (
          <h2 className="text-2xl font-black tracking-tight mb-2 text-cyber-neon drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{story.title}</h2>
        )}
        {story.text_overlay && (
          <p className="text-xl font-bold tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-4">{story.text_overlay}</p>
        )}
        {story.tags && (
          <div className="flex flex-wrap gap-2">
            {story.tags.split(',').map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-xs font-mono text-white/80 border border-white/10">#{tag.trim()}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StoryUploader = ({ onClose, onUpload }: { onClose: () => void, onUpload: (data: { media_url: string, text_overlay: string, title?: string, tags?: string }) => Promise<void> }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      const base64 = await fileToBase64(f);
      setPreview(base64);
    }
  };

  const handleUpload = async () => {
    if (!preview) return;
    setLoading(true);
    await onUpload({ media_url: preview, text_overlay: text, title, tags });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-cyber-dark border border-white/10 rounded-3xl overflow-hidden relative flex flex-col h-[85vh]">
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-black/50 rounded-full text-white"><X size={20} /></button>
        
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          {preview ? (
            <>
              <img src={preview} className="w-full h-full object-contain" alt="Preview" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent space-y-3">
                <input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Story Title (Optional)"
                  className="w-full bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 outline-none text-sm font-bold placeholder:text-white/40"
                />
                <input 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 outline-none text-sm placeholder:text-white/40"
                />
                <input 
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  className="w-full bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 outline-none text-xs font-mono placeholder:text-white/40"
                />
              </div>
            </>
          ) : (
            <div className="text-center space-y-6 p-8">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto animate-pulse">
                <ImageIcon className="text-white/40" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Create Story</h3>
                <p className="text-white/40 text-sm mb-6">Share moments with your sector.</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-cyber-neon text-cyber-dark font-bold rounded-xl cursor-pointer hover:bg-cyber-neon/80 transition-colors">
                  <Camera size={20} />
                  <span>Choose Media</span>
                  <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {preview && (
          <div className="p-4 border-t border-white/10 bg-cyber-dark">
            <NeonButton onClick={handleUpload} disabled={loading} className="w-full py-4 text-lg">
              {loading ? 'Uploading...' : 'Share to Story'}
            </NeonButton>
          </div>
        )}
      </div>
    </div>
  );
};

// --- App Views (Gated) ---

const PostCard = ({ post, onLike, onViewProfile, currentUser }: { post: any, onLike: () => void, onViewProfile: (id: string) => void, currentUser: User }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [reportReason, setReportReason] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const isOwner = post.user_id === currentUser.id;

  const fetchComments = async () => {
    const res = await fetch(`/api/posts/${post.id}/comments`);
    if (res.ok) {
      setComments(await res.json());
    }
  };

  const fetchHistory = async () => {
    const res = await fetch(`/api/posts/${post.id}/history`);
    if (res.ok) {
      setHistory(await res.json());
      setShowHistoryModal(true);
    }
  };

  const handleEdit = async () => {
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent })
    });
    if (res.ok) {
      setShowEditModal(false);
      window.location.reload();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this broadcast? It will be removed from the grid forever.")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      window.location.reload();
    }
  };

  const handleReport = async () => {
    const res = await fetch(`/api/posts/${post.id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reportReason })
    });
    if (res.ok) {
      setShowReportModal(false);
      alert("Report submitted. Campus security will review this broadcast.");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment })
    });
    if (res.ok) {
      setNewComment('');
      fetchComments();
    }
  };

  useEffect(() => {
    if (showComments) fetchComments();
  }, [showComments]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onViewProfile(post.author_id || post.user_id)}>
            <Avatar seed={post.author_username || post.username || 'anon'} src={post.author_avatar || post.avatar} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold group-hover:text-cyber-neon transition-colors">{post.author || post.display_name || 'Unknown'}</p>
                {post.is_edited && <span className="text-[9px] text-white/20 font-mono uppercase tracking-widest">(Edited)</span>}
              </div>
              <p className="text-[10px] text-white/40 font-mono">@{post.author_username || post.username} • {formatDistanceToNow(new Date(post.timestamp))} ago</p>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-white/20 hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-cyber-dark border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    {isOwner ? (
                      <>
                        <button onClick={() => { setShowEditModal(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-cyber-neon transition-colors">
                          <Edit2 size={16} /> Edit Broadcast
                        </button>
                        <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={16} /> Delete Broadcast
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { setShowReportModal(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-red-500 transition-colors">
                        <Flag size={16} /> Report Broadcast
                      </button>
                    )}
                    {post.is_edited && (
                      <button onClick={() => { fetchHistory(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-cyber-blue transition-colors border-t border-white/5">
                        <History size={16} /> View Edit History
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="space-y-3">
          {post.title && <h3 className="text-lg font-bold tracking-tight">{post.title}</h3>}
          
          <div className="text-sm text-white/80 leading-relaxed markdown-body">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
          
          {post.media_url && (
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <img src={post.media_url} className="w-full h-auto" alt="Post media" />
            </div>
          )}

          {post.voice_url && (
            <div className="mt-2 bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyber-neon/20 flex items-center justify-center text-cyber-neon">
                <Mic size={20} />
              </div>
              <audio controls src={post.voice_url} className="w-full h-8" />
            </div>
          )}

          {post.tags && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.split(',').map((tag: string, i: number) => (
                <span key={i} className="text-xs text-cyber-blue hover:underline cursor-pointer">#{tag.trim()}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 pt-2">
          <button onClick={onLike} className="flex items-center gap-2 text-white/40 hover:text-cyber-pink transition-colors group">
            <Heart size={18} className="group-hover:fill-cyber-pink" />
            <span className="text-xs font-bold">{Math.floor(post.engagement_score * 10)}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-white/40 hover:text-cyber-blue transition-colors">
            <MessageCircle size={18} />
            <span className="text-xs font-bold">Reply</span>
          </button>
          <button className="flex items-center gap-2 text-white/40 hover:text-cyber-neon transition-colors ml-auto">
            <Share2 size={18} />
          </button>
        </div>

        {showComments && (
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 text-xs cursor-pointer group" onClick={() => onViewProfile(c.user_id)}>
                  <Avatar seed={c.username} src={c.avatar} size="sm" />
                  <div className="bg-white/5 p-2 rounded-xl flex-1 group-hover:bg-white/10 transition-colors">
                    <p className="font-bold group-hover:text-cyber-neon transition-colors">{c.username}</p>
                    <p>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
              />
              <NeonButton onClick={handleAddComment} className="text-xs px-4">Post</NeonButton>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Modals */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
              <GlassCard className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">EDIT BROADCAST</h3>
                  <button onClick={() => setShowEditModal(false)}><X size={20} /></button>
                </div>
                <textarea 
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-cyber-neon/50"
                  placeholder="Update your broadcast..."
                />
                <div className="flex gap-4">
                  <NeonButton variant="ghost" onClick={() => setShowEditModal(false)} className="flex-1">CANCEL</NeonButton>
                  <NeonButton onClick={handleEdit} className="flex-1">SAVE CHANGES</NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {showReportModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
              <GlassCard className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">REPORT BROADCAST</h3>
                  <button onClick={() => setShowReportModal(false)}><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-white/60">Why are you reporting this broadcast?</p>
                  {['Spam', 'Harassment', 'Inappropriate Content', 'Misinformation', 'Other'].map(reason => (
                    <button 
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",
                        reportReason === reason ? "bg-red-500/10 border-red-500/50 text-red-500" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <NeonButton variant="ghost" onClick={handleReport} disabled={!reportReason} className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10">
                  SUBMIT REPORT
                </NeonButton>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {showHistoryModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
              <GlassCard className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">EDIT HISTORY</h3>
                  <button onClick={() => setShowHistoryModal(false)}><X size={20} /></button>
                </div>
                <div className="space-y-6">
                  {history.map((h, i) => (
                    <div key={h.id} className="space-y-2 pb-6 border-b border-white/5 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                          {i === 0 ? 'Original Version' : `Edit #${history.length - i}`}
                        </span>
                        <span className="text-[10px] font-mono text-white/20">
                          {format(new Date(h.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <div className="text-sm text-white/60 bg-white/5 p-4 rounded-xl italic">
                        <ReactMarkdown>{h.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function HubView({ user, onViewProfile }: { user: User, onViewProfile: (id: string) => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postMedia, setPostMedia] = useState<string | null>(null);
  const [showStoryUploader, setShowStoryUploader] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [postVoice, setPostVoice] = useState<Blob | null>(null);
  const [dailyBounty, setDailyBounty] = useState<any>(null);

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(setPosts);
    fetch('/api/bounties/daily').then(r => r.json()).then(setDailyBounty);
  }, []);

  const handleClaimBounty = async () => {
    if (!dailyBounty || !dailyBounty.completed_at || dailyBounty.claimed) return;
    const res = await fetch('/api/bounties/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounty_id: dailyBounty.id })
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Bounty claimed! +${data.reward_xp}XP and +${data.reward_toins} Toins added to your account.`);
      fetch('/api/bounties/daily').then(r => r.json()).then(setDailyBounty);
    }
  };

  const handleLike = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, engagement_score: p.engagement_score + 0.1 } : p));
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postMedia && !postVoice) return;
    setIsPosting(true);
    
    // Upload voice if exists
    let voiceUrl = null;
    if (postVoice) {
      const formData = new FormData();
      formData.append('file', postVoice, 'voice_post.webm');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (uploadRes.ok) {
        const { url } = await uploadRes.json();
        voiceUrl = url;
      }
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: postContent, 
        type: 'public', 
        media_url: postMedia,
        voice_url: voiceUrl
      })
    });

    if (res.ok) {
      setPostContent('');
      setPostMedia(null);
      setPostVoice(null);
      setShowVoiceRecorder(false);
      setIsPosting(false);
      fetch('/api/posts').then(r => r.json()).then(setPosts);
    }
  };

  const handleStoryUpload = async (data: { media_url: string, text_overlay: string, title?: string, tags?: string }) => {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      setShowStoryUploader(false);
      // Ideally refresh stories here, but StoriesBar fetches on mount. 
      // For now, user can refresh or we can lift state.
      window.location.reload(); // Simple refresh to show new story
    }
  };

  const handlePostMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setPostMedia(base64);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <AnimatePresence>
        {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} onViewProfile={onViewProfile} />}
        {showStoryUploader && <StoryUploader onClose={() => setShowStoryUploader(false)} onUpload={handleStoryUpload} />}
        {showChat && (
          <Chat 
            user={user} 
            onClose={() => setShowChat(false)} 
            onViewProfile={(userId) => {
              setShowChat(false);
              onViewProfile(userId);
            }}
          />
        )}
      </AnimatePresence>

      <motion.section 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl flex flex-col p-6 sm:p-10"
      >
        <img src="https://picsum.photos/seed/cyber/1200/600" className="absolute inset-0 w-full h-full object-cover opacity-40" alt="Banner" />
        <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-cyber-dark/60 to-transparent" />
        
        <div className="relative z-10 w-full mb-8 sm:mb-16 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            <StoriesBar 
              user={user} 
              onStoryClick={setActiveStory} 
              onAddStory={() => setShowStoryUploader(true)} 
            />
          </div>
          <button 
            onClick={() => setShowChat(true)}
            className="hidden sm:flex p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 transition-colors relative group shrink-0"
          >
            <MessageCircle size={24} className="text-cyber-neon" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="absolute top-full right-0 mt-2 px-2 py-1 bg-black/80 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Messages
            </span>
          </button>
        </div>

        <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tighter leading-tight mb-1">WELCOME BACK,<br className="sm:hidden" /> <span className="text-cyber-neon">{user.display_name?.toUpperCase() || 'STUDENT'}</span></h2>
            <p className="text-white/60 font-mono text-xs sm:text-sm">SECTOR: {user.grade?.toUpperCase() || 'N/A'} // STATUS: {user.verification_status?.toUpperCase() || 'N/A'}</p>
          </motion.div>
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="flex gap-2 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Level</p>
              <p className="text-xl font-black font-mono">{user.level}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Rank</p>
              <p className="text-xl font-black font-mono text-cyber-blue">{user.role?.toUpperCase() || 'USER'}</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GatedFeature status={user.verification_status}>
            <GlassCard className="space-y-4">
              <div className="flex gap-4">
                <Avatar seed={user.username} src={user.avatar} size="md" />
                <div className="flex-1 space-y-2">
                  <textarea 
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="What's happening in the grid?"
                    className="w-full bg-transparent border-none outline-none resize-none text-sm py-2"
                    rows={2}
                  />
                  {postMedia && (
                    <div className="relative rounded-xl overflow-hidden border border-white/10">
                      <img src={postMedia} className="w-full h-48 object-cover" alt="Selected" />
                      <button onClick={() => setPostMedia(null)} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"><X size={16} /></button>
                    </div>
                  )}
                  {showVoiceRecorder && (
                    <div className="mt-2">
                      <VoiceRecorder onRecordingComplete={setPostVoice} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex gap-2">
                  <label className="p-2 text-white/40 hover:text-cyber-neon transition-colors cursor-pointer">
                    <ImageIcon size={20} />
                    <input type="file" accept="image/*" onChange={handlePostMediaSelect} className="hidden" />
                  </label>
                  <button 
                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                    className={`p-2 transition-colors ${showVoiceRecorder ? 'text-cyber-neon bg-cyber-neon/10 rounded-lg' : 'text-white/40 hover:text-cyber-neon'}`}
                  >
                    <Mic size={20} />
                  </button>
                </div>
                <NeonButton onClick={handleCreatePost} disabled={!postContent.trim() && !postMedia && !postVoice} className="text-xs py-1.5 px-4">Broadcast</NeonButton>
              </div>
            </GlassCard>
          </GatedFeature>

          <div className="space-y-6">
            {Array.isArray(posts) && posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={() => handleLike(post.id)} 
                onViewProfile={onViewProfile} 
                currentUser={user}
              />
            ))}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <GlassCard className={cn("border-cyber-neon/20", dailyBounty?.completed_at && !dailyBounty?.claimed ? "bg-cyber-neon/10 animate-pulse" : "bg-cyber-neon/5")}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-cyber-neon">Daily Bounty</h3>
              {dailyBounty?.claimed ? (
                <span className="text-[10px] bg-cyber-neon/20 text-cyber-neon px-2 py-0.5 rounded-full font-bold">CLAIMED</span>
              ) : dailyBounty?.completed_at ? (
                <span className="text-[10px] bg-cyber-neon text-black px-2 py-0.5 rounded-full font-bold">READY</span>
              ) : (
                <span className="text-[10px] bg-white/10 text-white/40 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
              )}
            </div>
            
            {dailyBounty ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{dailyBounty.title}</span>
                  <span className="text-cyber-neon font-mono">+{dailyBounty.reward_xp}XP</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (dailyBounty.progress / dailyBounty.target_value) * 100)}%` }}
                    transition={{ duration: 1 }}
                    className={cn("h-full shadow-[0_0_10px]", dailyBounty.completed_at ? "bg-cyber-neon shadow-cyber-neon" : "bg-cyber-blue shadow-cyber-blue")} 
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-white/40 font-mono">{dailyBounty.progress} / {dailyBounty.target_value}</p>
                  {dailyBounty.completed_at && !dailyBounty.claimed && (
                    <button 
                      onClick={handleClaimBounty}
                      className="text-[10px] font-bold text-cyber-neon hover:underline"
                    >
                      CLAIM REWARD
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 italic">No active bounties today.</p>
            )}
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
        </motion.div>
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
  const [siteStats, setSiteStats] = useState<any>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch materials and queries initially for AI context
    fetch(`/api/academic/materials?grade=${user.grade}&section=${user.section}`).then(r => r.json()).then(setMaterials);
    fetch('/api/academic/queries').then(r => r.json()).then(setQueries);
    fetch('/api/site/context').then(r => r.json()).then(setSiteStats);
    fetch('/api/ai/history').then(r => r.json()).then(data => {
      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
      }
    });
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
    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: userMsg })
    });
    setIsTyping(true);
    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      const response = await getStudyBuddyResponse(userMsg, history, { materials, queries, user, siteStats });
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
      fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ai', content: response })
      });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2"><Sparkles className="text-cyber-neon" /> ACADEMICS</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {['ai', 'materials', 'discussion', 'tools'].map((t: any) => (
              <button 
                key={t}
                onClick={() => setStudyTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
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
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/ai-core/1920/1080')] bg-cover bg-center opacity-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-cyber-dark/80 via-transparent to-cyber-dark/80 pointer-events-none" />
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn("max-w-[85%] p-4 rounded-2xl backdrop-blur-md shadow-lg", msg.role === 'user' ? "bg-cyber-neon/20 border border-cyber-neon/30 text-white" : "bg-white/10 border border-white/20 text-white")}>
                      <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    </div>
                  </div>
                ))}
                {isTyping && <div className="flex gap-1 p-4"><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse delay-75" /><div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse delay-150" /></div>}
              </div>
              <GatedFeature status={user.verification_status}>
                <div className="p-4 border-t border-white/10 bg-white/5 relative z-10 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask StudyBuddy AI..." className="flex-1 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyber-neon/50 transition-colors" />
                    <button onClick={handleSend} className="p-3 bg-cyber-neon text-cyber-dark rounded-xl hover:bg-cyber-neon/80 transition-colors"><Send size={20} /></button>
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input name="subject" placeholder="Subject (e.g. Physics)" className="w-full sm:w-1/3 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-cyber-neon/50" required />
                    <input name="query" placeholder="Ask a question to the campus..." className="flex-1 bg-cyber-dark/50 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-cyber-neon/50" required />
                    <button type="submit" className="px-4 py-2 sm:py-0 bg-cyber-blue text-white rounded-xl text-xs font-bold uppercase hover:bg-cyber-blue/80 transition-colors">Post</button>
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

function ChatView({ user, socket, onViewProfile }: { user: User, socket: Socket, onViewProfile: (id: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/conversations')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConversations(data);
        } else {
          console.error("Failed to fetch conversations:", data);
          setConversations([]);
        }
      })
      .catch(err => {
        console.error("Error fetching conversations:", err);
        setConversations([]);
      });
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
      setConversations(prev => Array.isArray(prev) ? prev.map(c => 
        c.id === msg.conversation_id ? { ...c, last_message: msg.content, last_message_at: msg.created_at } : c
      ) : []);
    };

    const handleTyping = ({ userId, isTyping }: any) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
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
  }, [messages, typingUsers]);

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

  const handleCreateChat = async () => {
    if (!newChatUsername.trim()) return;
    
    // First, search for the user
    const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(newChatUsername)}`);
    if (!searchRes.ok) {
      alert("Error searching for user.");
      return;
    }
    const users = await searchRes.json();
    const targetUser = users.find((u: any) => u.username.toLowerCase() === newChatUsername.toLowerCase());
    
    if (!targetUser) {
      alert("User not found.");
      return;
    }

    // Create conversation
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'private', participantIds: [targetUser.id] })
    });
    
    if (res.ok) {
      const { id } = await res.json();
      
      // Fetch the updated conversations list to get the full conversation object
      const convRes = await fetch('/api/conversations');
      if (convRes.ok) {
        const convs = await convRes.json();
        if (Array.isArray(convs)) {
          setConversations(convs);
          const newConv = convs.find((c: Conversation) => c.id === id);
          if (newConv) setActiveConv(newConv);
        }
      }
      
      setIsCreatingChat(false);
      setNewChatUsername('');
    } else {
      alert("Error creating chat.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-12rem)] flex bg-cyber-dark/40 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl relative">
      {/* Sidebar - WhatsApp/Insta Style */}
      <div className={cn("w-full md:w-80 flex flex-col border-r border-white/10 bg-white/5 absolute md:relative inset-0 z-20 transition-transform duration-300", activeConv ? "-translate-x-full md:translate-x-0" : "translate-x-0")}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tighter">CHATS</h3>
          <button onClick={() => setIsCreatingChat(true)} className="p-2 bg-cyber-neon/10 text-cyber-neon rounded-full hover:bg-cyber-neon/20 transition-all"><Plus size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Array.isArray(conversations) && conversations.map(conv => (
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

      {isCreatingChat && (
        <div className="fixed inset-0 z-50 bg-cyber-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
            <GlassCard className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tighter">NEW TRANSMISSION</h3>
                <button onClick={() => setIsCreatingChat(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Recipient Username</label>
                  <input 
                    value={newChatUsername} 
                    onChange={e => setNewChatUsername(e.target.value)} 
                    placeholder="Enter exact username..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyber-neon/50" 
                  />
                </div>
                <NeonButton onClick={handleCreateChat} className="w-full py-3">Establish Connection</NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className={cn("flex-1 flex flex-col relative w-full h-full absolute md:relative inset-0 z-10 transition-transform duration-300", activeConv ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        {activeConv ? (
          <>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveConv(null)} className="md:hidden p-2 -ml-2 text-white/60 hover:text-white">
                  <ChevronRight className="rotate-180" size={24} />
                </button>
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => activeConv.other_user_id && onViewProfile(activeConv.other_user_id)}>
                  <Avatar seed={activeConv.name || activeConv.id} size="sm" />
                  <div>
                    <h3 className="font-bold text-sm group-hover:text-cyber-neon transition-colors">{activeConv.name || "Private Frequency"}</h3>
                    <p className="text-[10px] text-cyber-neon font-mono uppercase tracking-widest animate-pulse">Online</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <button className="text-white/40 hover:text-white transition-colors"><Search size={20} /></button>
                <button className="text-white/40 hover:text-white transition-colors"><MoreHorizontal size={20} /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 relative">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/cyberpunk/1920/1080')] bg-cover bg-center opacity-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-cyber-dark/80 via-transparent to-cyber-dark/80 pointer-events-none" />
              
              <div className="relative z-10 space-y-4">
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] p-3 px-4 rounded-2xl text-sm shadow-lg backdrop-blur-md relative group",
                        isMe ? "bg-cyber-neon/90 text-cyber-dark rounded-tr-none" : "bg-white/10 border border-white/20 text-white rounded-tl-none"
                      )}>
                        {msg.content}
                        <div className={cn("flex items-center justify-end gap-1 mt-1", isMe ? "text-cyber-dark/60" : "text-white/40")}>
                          <p className="text-[9px]">
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </p>
                          {isMe && (
                            <CheckCheck size={12} className="text-cyber-dark/80" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typingUsers.size > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 border border-white/20 text-white rounded-2xl rounded-tl-none p-3 px-4 shadow-lg backdrop-blur-md flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-bounce delay-75" />
                        <div className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-bounce delay-150" />
                      </div>
                      <span className="text-[10px] text-white/60 font-mono uppercase tracking-widest ml-1">Typing...</span>
                    </div>
                  </div>
                )}
              </div>
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

function MarketView({ user, onViewProfile }: { user: User, onViewProfile: (id: string) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newListing, setNewListing] = useState({ title: '', description: '', price: 0, category: 'academic', image_url: '' });

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setNewListing(prev => ({ ...prev, image_url: base64 }));
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="bg-cyber-neon/10 border border-cyber-neon/20 px-6 py-3 rounded-2xl flex items-center justify-between sm:justify-start gap-4">
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-cyber-neon" />
              <div>
                <p className="text-[10px] uppercase font-bold text-cyber-neon">Balance</p>
                <p className="text-xl font-black font-mono">{user.toins} TOINS</p>
              </div>
            </div>
          </div>
          <NeonButton onClick={() => setIsCreating(true)} className="w-full sm:w-auto"><Plus size={18} /> List Item</NeonButton>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'academic', 'electronics', 'digital', 'codes', 'services', 'other'].map(cat => (
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
              <img src={item.image_url || `https://picsum.photos/seed/${item.id}/400/400`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={item.title} referrerPolicy="no-referrer" />
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
              <NeonButton variant="ghost" className="text-xs py-1.5 px-3" onClick={() => onViewProfile(item.seller_id)}>Contact Seller</NeonButton>
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
                  <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Image</label>
                  <div className="flex items-center gap-4">
                    {newListing.image_url ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                        <img src={newListing.image_url} className="w-full h-full object-cover" alt="Preview" />
                        <button onClick={() => setNewListing({...newListing, image_url: ''})} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"><X size={12} /></button>
                      </div>
                    ) : (
                      <label className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyber-neon/50 transition-colors bg-white/5">
                        <Camera size={20} className="text-white/40 mb-1" />
                        <span className="text-[8px] uppercase font-bold text-white/40">Upload</span>
                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                      </label>
                    )}
                    <p className="text-[10px] text-white/40 flex-1">Upload an image of your item, code snippet, or service offering.</p>
                  </div>
                </div>
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
                      <option value="digital">Digital Assets</option>
                      <option value="codes">Codes/Scripts</option>
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

const PublicProfileModal = ({ userId, onClose, currentUser }: { userId: string, onClose: () => void, currentUser: User }) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setProfile(data);
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleAddFriend = async () => {
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId })
      });
      if (res.ok) {
        alert("Friend request sent!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send request");
      }
    } catch (e) {
      alert("Connection failed");
    }
  };

  const handleDM = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', participantIds: [userId] })
      });
      if (res.ok) {
        alert("Conversation started! Go to Chat tab.");
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start conversation");
      }
    } catch (e) {
      alert("Connection failed");
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="text-cyber-neon font-mono animate-pulse">DECRYPTING PROFILE...</div>
    </div>
  );

  if (error || !profile) return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <GlassCard className="text-center space-y-4">
        <p className="text-red-500 font-bold">{error || "User not found"}</p>
        <NeonButton onClick={onClose}>Close</NeonButton>
      </GlassCard>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg my-auto">
        <GlassCard className="p-0 overflow-hidden relative">
          <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/40 hover:text-white bg-black/20 p-1 rounded-full backdrop-blur-sm"><X size={20} /></button>
          
          <div className="h-32 w-full bg-white/5 relative">
            <img src={profile.cover || "https://picsum.photos/seed/profile/1200/400"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark to-transparent" />
          </div>

          <div className="px-6 pb-6 -mt-12 relative z-10 space-y-6">
            <div className="flex items-end justify-between">
              <div className="w-24 h-24 rounded-2xl border-4 border-cyber-dark overflow-hidden bg-cyber-dark">
                <Avatar seed={profile.username} src={profile.avatar} size="lg" />
              </div>
              <div className="flex gap-2">
                {profile.id !== currentUser.id && (
                  <>
                    <NeonButton onClick={handleAddFriend} variant="blue" className="px-4 py-2 text-xs">
                      <UserPlus size={14} /> Add Friend
                    </NeonButton>
                    <NeonButton onClick={handleDM} className="px-4 py-2 text-xs">
                      <MessageSquare size={14} /> DM
                    </NeonButton>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                {profile.display_name}
                {profile.verification_status === 'approved' && <ShieldCheck size={18} className="text-cyber-neon" />}
              </h3>
              <p className="text-sm text-white/40 font-mono">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="text-sm text-white/60 leading-relaxed italic">"{profile.bio}"</p>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-white/40">Level</p>
                <p className="text-xl font-black text-cyber-neon">{profile.level}</p>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-white/40">XP</p>
                <p className="text-xl font-black text-cyber-blue">{profile.xp}</p>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] uppercase font-bold text-white/40">Toins</p>
                <p className="text-xl font-black text-cyber-pink">{profile.toins}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Grid Rank</span>
                <span className="font-bold text-cyber-neon uppercase tracking-widest">{profile.role}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Joined Grid</span>
                <span className="font-mono">{new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

const EditProfileModal = ({ user, onClose, onUpdate }: { user: User, onClose: () => void, onUpdate: (u: User) => void }) => {
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [cover, setCover] = useState(user.cover || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar, cover })
      });
      if (res.ok) {
        onUpdate({ ...user, avatar, cover });
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (e) {
      setError("Connection failed");
    }
    setLoading(false);
  };

  const handleUnlock = async (type: 'pfp' | 'banner') => {
    setLoading(true);
    const res = await fetch('/api/users/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    if (res.ok) {
      const data = await res.json();
      // Optimistically update user state with unlock status
      onUpdate({ ...user, toins: data.toins, [type === 'pfp' ? 'unlock_custom_pfp' : 'unlock_custom_banner']: true });
    } else {
      const data = await res.json();
      setError(data.error || "Unlock failed");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-lg">
        <GlassCard className="space-y-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={20} /></button>
          <h3 className="text-xl font-black tracking-tighter">EDIT PROFILE</h3>
          
          {error && <div className="p-3 bg-red-500/10 text-red-500 text-xs font-bold rounded-xl">{error}</div>}

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-white/40">Avatar URL</label>
                {!user.unlock_custom_pfp && (
                  <button onClick={() => handleUnlock('pfp')} disabled={loading} className="text-[10px] font-bold text-cyber-neon flex items-center gap-1 hover:underline bg-cyber-neon/10 px-2 py-1 rounded">
                    <Lock size={10} /> UNLOCK (2000 T)
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden border border-white/10 shrink-0 relative">
                  <img src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full object-cover" />
                  {!user.unlock_custom_pfp && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Lock size={16} className="text-white/40" /></div>}
                </div>
                <input 
                  value={avatar} 
                  onChange={e => setAvatar(e.target.value)} 
                  disabled={!user.unlock_custom_pfp}
                  placeholder={user.unlock_custom_pfp ? "https://..." : "Unlock to customize"}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed focus:border-cyber-neon/50" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-white/40">Cover URL</label>
                {!user.unlock_custom_banner && (
                  <button onClick={() => handleUnlock('banner')} disabled={loading} className="text-[10px] font-bold text-cyber-neon flex items-center gap-1 hover:underline bg-cyber-neon/10 px-2 py-1 rounded">
                    <Lock size={10} /> UNLOCK (1500 T)
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                <div className="w-24 h-12 rounded-xl bg-white/5 overflow-hidden border border-white/10 shrink-0 relative">
                  <img src={cover || "https://picsum.photos/seed/profile/1200/400"} className="w-full h-full object-cover" />
                  {!user.unlock_custom_banner && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Lock size={16} className="text-white/40" /></div>}
                </div>
                <input 
                  value={cover} 
                  onChange={e => setCover(e.target.value)} 
                  disabled={!user.unlock_custom_banner}
                  placeholder={user.unlock_custom_banner ? "https://..." : "Unlock to customize"}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed focus:border-cyber-neon/50" 
                />
              </div>
            </div>
          </div>

          <NeonButton onClick={handleSave} disabled={loading} className="w-full py-3">Save Changes</NeonButton>
        </GlassCard>
      </motion.div>
    </div>
  );
};

function ProfileView({ user, setUser, onSecurity, onThemes, onStore, onTickets }: { user: User, setUser: (u: User) => void, onSecurity: () => void, onThemes: () => void, onStore: () => void, onTickets: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
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
      <AnimatePresence>
        {isEditing && <EditProfileModal user={user} onClose={() => setIsEditing(false)} onUpdate={setUser} />}
      </AnimatePresence>

      <div className="relative mb-16 sm:mb-0">
        <div className="h-48 rounded-3xl overflow-hidden border border-white/10 relative group">
          <img src={user.cover || "https://picsum.photos/seed/profile/1200/400"} className="w-full h-full object-cover opacity-50" alt="Cover" />
          {!user.unlock_custom_banner && <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-[10px] font-bold text-white/60 flex items-center gap-1"><Lock size={10} /> DEFAULT BANNER</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark to-transparent" />
        </div>
        <div className="absolute -bottom-12 left-4 sm:left-8 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 w-full sm:w-auto">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-cyber-dark overflow-hidden bg-cyber-dark relative group shrink-0">
            <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-full h-full" alt="Avatar" />
            {!user.unlock_custom_pfp && <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[8px] font-bold text-white/60 flex items-center gap-1"><Lock size={8} /> DEFAULT</div>}
          </div>
          <div className="pb-0 sm:pb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tighter">{user.display_name}</h2>
              {user.verification_status === 'approved' && <ShieldCheck className="text-cyber-neon w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <p className="text-cyber-neon font-mono text-xs sm:text-sm">@{user.username}</p>
          </div>
        </div>
        <div className="absolute top-4 right-4 hidden sm:flex gap-2">
          <NeonButton variant="ghost" onClick={onStore}><Store size={18} /> Store</NeonButton>
          <NeonButton variant="ghost" onClick={onTickets}><TicketIcon size={18} /> Tickets</NeonButton>
          <NeonButton variant="ghost" onClick={() => setShowRedeem(true)}><Gift size={18} /> Redeem</NeonButton>
          <NeonButton variant="ghost" onClick={onSecurity}><Shield size={18} /> Security</NeonButton>
          <NeonButton variant="ghost" onClick={() => setIsEditing(true)}><Settings size={18} /> Edit</NeonButton>
        </div>
      </div>

      <div className="sm:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-4">
        <NeonButton variant="ghost" onClick={onStore} className="shrink-0 text-xs py-1.5"><Store size={14} /> Store</NeonButton>
        <NeonButton variant="ghost" onClick={onTickets} className="shrink-0 text-xs py-1.5"><TicketIcon size={14} /> Tickets</NeonButton>
        <NeonButton variant="ghost" onClick={() => setShowRedeem(true)} className="shrink-0 text-xs py-1.5"><Gift size={14} /> Redeem</NeonButton>
        <NeonButton variant="ghost" onClick={() => setIsEditing(true)} className="shrink-0 text-xs py-1.5"><Settings size={14} /> Edit</NeonButton>
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
                      <Badge variant="pink">#{user.verification_status?.toUpperCase() || 'PENDING'}</Badge>
                      <Badge variant="gold">PRESTIGE {user.prestige_level || 0}</Badge>
                      <Badge variant="blue">STREAK {user.streak_count || 0}</Badge>
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
                          <p className="text-sm font-bold">{t.type?.toUpperCase() || 'TRANSACTION'}</p>
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
            <p className="text-3xl font-black text-cyber-blue tracking-tighter">{user.role?.toUpperCase() || 'USER'}</p>
          </GlassCard>
          
          <GlassCard className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase text-white/40 tracking-widest">Grid Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Posts</span>
                <span className="font-mono font-bold">{user.stats?.posts || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Followers</span>
                <span className="font-mono font-bold">{user.stats?.followers || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Reputation</span>
                <span className="font-mono font-bold text-cyber-neon">{user.stats?.reputation ?? 100}%</span>
              </div>
            </div>
          </GlassCard>

          <NeonButton variant="danger" className="w-full" onClick={handleLogout}><LogOut size={18} /> Disconnect Frequency</NeonButton>
        </div>
      </div>

      <AnimatePresence>
        {showRedeem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter">REDEEM CODE</h3>
                  <button onClick={() => setShowRedeem(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Access Code</label>
                    <input 
                      value={redeemCode}
                      onChange={e => setRedeemCode(e.target.value)}
                      placeholder="ENTER_CODE_HERE"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest outline-none"
                    />
                  </div>
                  <NeonButton 
                    className="w-full py-3"
                    onClick={async () => {
                      const res = await fetch('/api/redeem', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: redeemCode })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        alert(`Success! Redeemed: ${data.reward_value} ${data.reward_type}`);
                        setShowRedeem(false);
                        setRedeemCode('');
                        const updatedUser = await fetch('/api/users/me').then(r => r.json());
                        setUser(updatedUser);
                      } else {
                        const err = await res.json();
                        alert(err.error);
                      }
                    }}
                  >
                    VALIDATE CODE
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
              <div key={session.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                    <Globe size={20} className="text-white/40" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{session.ip_address}</p>
                    <p className="text-[10px] text-white/60 truncate max-w-[200px] sm:max-w-[300px]">{session.user_agent}</p>
                    <p className="text-[10px] text-white/40">Last active: {format(new Date(session.last_activity_at), 'MMM dd, HH:mm')}</p>
                  </div>
                </div>
                <NeonButton variant="ghost" className="text-xs px-3 py-1.5 w-full sm:w-auto" onClick={() => revokeSession(session.id)}>Revoke</NeonButton>
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

function VaultView({ user, setUser }: { user: User, setUser: (u: User) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSell, setShowSell] = useState(false);
  const [newListing, setNewListing] = useState({ title: '', description: '', category: 'item', price: 100 });

  useEffect(() => {
    fetch('/api/vault/listings').then(r => r.json()).then(data => {
      setListings(data);
      setLoading(false);
    });
  }, []);

  const handleBuy = async (listingId: string) => {
    const res = await fetch('/api/vault/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId })
    });
    if (res.ok) {
      alert('Purchase successful!');
      fetch('/api/vault/listings').then(r => r.json()).then(setListings);
      const updatedUser = await fetch('/api/users/me').then(r => r.json());
      setUser(updatedUser);
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  if (loading) return <div className="p-8 text-center opacity-40">LOADING VAULT...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-amber-500">THE VAULT</h2>
          <p className="text-xs text-white/40 font-mono uppercase">PLAYER TRADING MARKETPLACE</p>
        </div>
        <NeonButton onClick={() => setShowSell(true)} className="flex items-center gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
          <Plus size={18} /> SELL ITEM
        </NeonButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map(listing => (
          <GlassCard key={listing.id} className="border-amber-500/20">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="gold">{listing.category.toUpperCase()}</Badge>
              <div className="flex items-center gap-2">
                <Avatar seed={listing.seller_id} size="sm" />
                <span className="text-[10px] text-white/40">@{listing.seller_id.substring(0, 8)}</span>
              </div>
            </div>
            <h3 className="text-lg font-bold truncate">{listing.title}</h3>
            <p className="text-xs text-white/60 mt-1 h-10 overflow-hidden">{listing.description}</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Coins size={14} className="text-amber-500" />
                <span className="text-sm font-mono font-bold text-amber-500">{listing.price}</span>
              </div>
              <NeonButton 
                className="text-xs px-4 py-1.5 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={() => handleBuy(listing.id)}
                disabled={user.toins < listing.price || listing.seller_id === user.id}
              >
                {listing.seller_id === user.id ? 'YOUR LISTING' : 'BUY NOW'}
              </NeonButton>
            </div>
          </GlassCard>
        ))}
        {listings.length === 0 && <div className="col-span-full text-center py-12 opacity-40">NO ACTIVE LISTINGS IN THE VAULT</div>}
      </div>

      <AnimatePresence>
        {showSell && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6 border-amber-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter text-amber-500">LIST ITEM FOR SALE</h3>
                  <button onClick={() => setShowSell(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Item Title</label>
                    <input 
                      value={newListing.title}
                      onChange={e => setNewListing({...newListing, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="e.g. Rare Neon Frame"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Description</label>
                    <textarea 
                      value={newListing.description}
                      onChange={e => setNewListing({...newListing, description: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none min-h-[80px]"
                      placeholder="Describe what you are selling..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Category</label>
                      <select 
                        value={newListing.category}
                        onChange={e => setNewListing({...newListing, category: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      >
                        <option value="item">Digital Item</option>
                        <option value="service">Service</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Price (Toins)</label>
                      <input 
                        type="number"
                        value={newListing.price}
                        onChange={e => setNewListing({...newListing, price: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <NeonButton 
                    className="w-full py-3 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                    onClick={async () => {
                      const res = await fetch('/api/vault/listings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newListing)
                      });
                      if (res.ok) {
                        setShowSell(false);
                        fetch('/api/vault/listings').then(r => r.json()).then(setListings);
                      }
                    }}
                  >
                    CREATE LISTING
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StoreView({ user, setUser }: { user: User, setUser: (u: User) => void }) {
  const [storeTab, setStoreTab] = useState<'official' | 'vault'>('official');
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/store/items').then(r => r.json()),
      fetch('/api/store/inventory').then(r => r.json())
    ]).then(([itemsData, invData]) => {
      setItems(itemsData);
      setInventory(invData);
      setLoading(false);
    });
  }, []);

  const purchase = async (itemId: string) => {
    const res = await fetch('/api/store/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
    if (res.ok) {
      const updatedUser = await fetch('/api/users/me').then(r => r.json());
      setUser(updatedUser);
      const inv = await fetch('/api/store/inventory').then(r => r.json());
      setInventory(inv);
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const activate = async (itemId: string) => {
    const res = await fetch('/api/store/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
    if (res.ok) {
      const updatedUser = await fetch('/api/users/me').then(r => r.json());
      setUser(updatedUser);
      const inv = await fetch('/api/store/inventory').then(r => r.json());
      setInventory(inv);
    }
  };

  if (loading) return <div className="p-8 text-center opacity-40">LOADING STORE...</div>;

  if (storeTab === 'vault') return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <NeonButton variant="ghost" onClick={() => setStoreTab('official')}>OFFICIAL STORE</NeonButton>
        <NeonButton variant="blue" onClick={() => setStoreTab('vault')}>THE VAULT</NeonButton>
      </div>
      <VaultView user={user} setUser={setUser} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">PROFILE STORE</h2>
          <p className="text-xs text-white/40 font-mono uppercase">CUSTOMIZE YOUR DIGITAL IDENTITY</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <NeonButton variant="blue" onClick={() => setStoreTab('official')}>OFFICIAL STORE</NeonButton>
            <NeonButton variant="ghost" onClick={() => setStoreTab('vault')}>THE VAULT</NeonButton>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Coins className="text-cyber-neon" size={20} />
            <span className="font-mono font-bold text-xl">{user.toins}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => {
          const owned = inventory.find(i => i.item_id === item.id);
          return (
            <GlassCard key={item.id} className="flex flex-col h-full">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={item.category === 'frame' ? 'neon' : item.category === 'effect' ? 'pink' : 'blue'}>
                    {item.category}
                  </Badge>
                  {owned && <Badge variant="gold">OWNED</Badge>}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <p className="text-xs text-white/60 mt-1">{item.description}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Coins size={14} className="text-cyber-neon" />
                  <span className="text-sm font-mono font-bold">{item.price}</span>
                </div>
                {owned ? (
                  <NeonButton 
                    variant={owned.is_active ? 'ghost' : 'blue'} 
                    className="text-xs px-4 py-1.5"
                    onClick={() => !owned.is_active && activate(item.id)}
                  >
                    {owned.is_active ? 'ACTIVE' : 'ACTIVATE'}
                  </NeonButton>
                ) : (
                  <NeonButton 
                    className="text-xs px-4 py-1.5"
                    onClick={() => purchase(item.id)}
                    disabled={user.toins < item.price}
                  >
                    PURCHASE
                  </NeonButton>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </motion.div>
  );
}

function TasksView({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [showSubmit, setShowSubmit] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', reward: 100, deadline: format(new Date(Date.now() + 86400000 * 7), 'yyyy-MM-dd'), proof_requirement: '' });
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', stakes: 100, targetId: '', deadline: format(new Date(Date.now() + 86400000 * 7), 'yyyy-MM-dd') });

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/challenges').then(r => r.json())
    ]).then(([tasksData, challengesData]) => {
      setTasks(tasksData);
      setChallenges(challengesData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center opacity-40">LOADING TASKS...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">TASKS & CHALLENGES</h2>
          <p className="text-xs text-white/40 font-mono uppercase">EARN TOINS THROUGH ENGAGEMENT</p>
        </div>
        <NeonButton onClick={() => setShowCreateTask(true)} className="flex items-center gap-2">
          <Plus size={18} /> CREATE TASK
        </NeonButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="font-bold flex items-center gap-2 uppercase tracking-widest text-xs text-white/40">
            <ClipboardList size={14} /> Available Tasks
          </h3>
          <div className="space-y-4">
            {tasks.map(task => (
              <GlassCard key={task.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold">{task.title}</h4>
                  <div className="flex items-center gap-1 bg-cyber-neon/10 px-2 py-1 rounded-lg border border-cyber-neon/20">
                    <Coins size={12} className="text-cyber-neon" />
                    <span className="text-xs font-mono font-bold text-cyber-neon">{task.reward}</span>
                  </div>
                </div>
                <p className="text-xs text-white/60">{task.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-white/40 uppercase">By {task.creator_name}</span>
                  <NeonButton variant="ghost" className="text-[10px] px-3 py-1" onClick={() => setShowSubmit(task.id)}>SUBMIT PROOF</NeonButton>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 uppercase tracking-widest text-xs text-white/40">
              <Zap size={14} /> Active Challenges
            </h3>
            <NeonButton variant="ghost" className="text-[10px] px-2 py-1" onClick={() => setShowCreateChallenge(true)}>NEW CHALLENGE</NeonButton>
          </div>
          <div className="space-y-4">
            {challenges.map(chal => (
              <GlassCard key={chal.id} className="space-y-4 border-cyber-pink/20">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold">{chal.title}</h4>
                  <Badge variant="pink">{chal.stakes} T STAKES</Badge>
                </div>
                <p className="text-xs text-white/60">{chal.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Avatar seed={chal.challenger_name || ''} size="sm" />
                    <span className="text-[10px] text-white/40 uppercase">VS</span>
                    <Avatar seed={chal.target_name || ''} size="sm" />
                  </div>
                  <Badge variant={chal.status === 'pending' ? 'neon' : 'blue'}>{chal.status}</Badge>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreateTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter">CREATE NEW TASK</h3>
                  <button onClick={() => setShowCreateTask(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Title</label>
                    <input 
                      value={newTask.title}
                      onChange={e => setNewTask({...newTask, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="e.g. Help with Physics Homework"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Description</label>
                    <textarea 
                      value={newTask.description}
                      onChange={e => setNewTask({...newTask, description: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none min-h-[80px]"
                      placeholder="Describe the task..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Reward (Toins)</label>
                      <input 
                        type="number"
                        value={newTask.reward}
                        onChange={e => setNewTask({...newTask, reward: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Deadline</label>
                      <input 
                        type="date"
                        value={newTask.deadline}
                        onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Proof Requirement</label>
                    <input 
                      value={newTask.proof_requirement}
                      onChange={e => setNewTask({...newTask, proof_requirement: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="e.g. Screenshot of completed work"
                    />
                  </div>
                  <NeonButton 
                    className="w-full py-3"
                    onClick={async () => {
                      const res = await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newTask)
                      });
                      if (res.ok) {
                        setShowCreateTask(false);
                        fetch('/api/tasks').then(r => r.json()).then(setTasks);
                      }
                    }}
                  >
                    POST TASK
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {showCreateChallenge && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter">CREATE CHALLENGE</h3>
                  <button onClick={() => setShowCreateChallenge(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Title</label>
                    <input 
                      value={newChallenge.title}
                      onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="e.g. Math Duel"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Description</label>
                    <textarea 
                      value={newChallenge.description}
                      onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none min-h-[80px]"
                      placeholder="Rules of the challenge..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Stakes (Toins)</label>
                      <input 
                        type="number"
                        value={newChallenge.stakes}
                        onChange={e => setNewChallenge({...newChallenge, stakes: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Deadline</label>
                      <input 
                        type="date"
                        value={newChallenge.deadline}
                        onChange={e => setNewChallenge({...newChallenge, deadline: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Opponent ID</label>
                    <input 
                      value={newChallenge.targetId}
                      onChange={e => setNewChallenge({...newChallenge, targetId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                      placeholder="User ID to challenge"
                    />
                  </div>
                  <NeonButton 
                    className="w-full py-3"
                    onClick={async () => {
                      const res = await fetch('/api/challenges', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newChallenge)
                      });
                      if (res.ok) {
                        setShowCreateChallenge(false);
                        fetch('/api/challenges').then(r => r.json()).then(setChallenges);
                      } else {
                        const err = await res.json();
                        alert(err.error);
                      }
                    }}
                  >
                    ISSUE CHALLENGE
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {showSubmit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter">SUBMIT PROOF</h3>
                  <button onClick={() => setShowSubmit(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Proof Details</label>
                    <textarea 
                      value={proofText}
                      onChange={e => setProofText(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none min-h-[120px]"
                      placeholder="Explain how you completed the task..."
                    />
                  </div>
                  <NeonButton 
                    className="w-full py-3"
                    onClick={async () => {
                      const res = await fetch('/api/tasks/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: showSubmit, proofText })
                      });
                      if (res.ok) {
                        setShowSubmit(null);
                        setProofText('');
                        alert('Submission sent for verification!');
                      }
                    }}
                  >
                    SUBMIT FOR VERIFICATION
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function LeaderboardView({ user, onViewProfile }: { user: User, onViewProfile: (id: string) => void }) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(data => {
      setLeaderboard(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center opacity-40">LOADING RANKINGS...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-black tracking-tighter">CAMPUS RANKINGS</h2>
        <p className="text-xs text-white/40 font-mono uppercase">THE ELITE OF TGH CAMPUS</p>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Rank</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Student</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Level</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">XP</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-white/40">Toins</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, i) => (
                <tr 
                  key={u.id} 
                  onClick={() => onViewProfile(u.id)}
                  className={cn("border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer", u.id === user.id && "bg-cyber-neon/5")}
                >
                  <td className="p-4">
                    <span className={cn(
                      "font-mono font-bold",
                      i === 0 ? "text-yellow-400 text-lg" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-white/40"
                    )}>
                      #{i + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar seed={u.username} src={u.avatar} size="sm" />
                      <div>
                        <p className="text-sm font-bold">{u.display_name}</p>
                        <p className="text-[10px] text-white/40">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm">{u.level}</td>
                  <td className="p-4 font-mono text-sm">{u.xp}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Coins size={14} className="text-cyber-neon" />
                      <span className="font-mono font-bold text-sm">{u.toins}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function TicketsView({ user }: { user: User }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTicket, setNewTicket] = useState({ category: 'account_issue', content: '' });

  useEffect(() => {
    fetch('/api/tickets').then(r => r.json()).then(data => {
      setTickets(data);
      setLoading(false);
    });
  }, []);

  const createTicket = async () => {
    if (!newTicket.content) return;
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket)
    });
    if (res.ok) {
      setShowCreate(false);
      setNewTicket({ category: 'account_issue', content: '' });
      fetch('/api/tickets').then(r => r.json()).then(setTickets);
    }
  };

  if (loading) return <div className="p-8 text-center opacity-40">LOADING TICKETS...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter">SUPPORT CENTER</h2>
          <p className="text-xs text-white/40 font-mono uppercase">OFFICIAL HELP & REPORTING</p>
        </div>
        <NeonButton onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <TicketIcon size={18} /> OPEN TICKET
        </NeonButton>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tickets.map(ticket => (
          <GlassCard key={ticket.id} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border",
                ticket.status === 'open' ? "bg-cyber-neon/10 border-cyber-neon/30 text-cyber-neon" : "bg-white/5 border-white/10 text-white/40"
              )}>
                <TicketIcon size={20} />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wider">{ticket.category.replace('_', ' ')}</p>
                <p className="text-[10px] text-white/40">ID: {ticket.id} // Opened: {format(new Date(ticket.created_at), 'MMM dd, HH:mm')}</p>
              </div>
            </div>
            <Badge variant={ticket.status === 'open' ? 'neon' : 'blue'}>{ticket.status}</Badge>
          </GlassCard>
        ))}
        {tickets.length === 0 && (
          <div className="p-12 text-center opacity-40 border-2 border-dashed border-white/10 rounded-3xl">
            <TicketIcon className="mx-auto mb-4 opacity-20" size={48} />
            <p className="font-mono text-sm">NO ACTIVE TICKETS FOUND</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cyber-dark/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tighter">OPEN NEW TICKET</h3>
                  <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Category</label>
                    <select 
                      value={newTicket.category}
                      onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none"
                    >
                      <option value="account_issue">Account Issue</option>
                      <option value="report_user">Report User</option>
                      <option value="report_post">Report Content</option>
                      <option value="suggest_feature">Feature Suggestion</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-white/40 ml-1">Message</label>
                    <textarea 
                      value={newTicket.content}
                      onChange={e => setNewTicket({...newTicket, content: e.target.value})}
                      placeholder="Describe your issue in detail..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none min-h-[120px] resize-none"
                    />
                  </div>
                  <NeonButton onClick={createTicket} className="w-full py-3">SUBMIT TICKET</NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center gap-1 transition-all relative w-16 h-14", active ? "text-cyber-neon" : "text-white/40 hover:text-white/70")}>
      <motion.div 
        animate={active ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn("p-1.5 rounded-xl z-10", active && "bg-cyber-neon/10 shadow-[0_0_10px_rgba(0,255,159,0.2)]")}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </motion.div>
      <motion.span 
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0.7, y: 2 }}
        className="text-[9px] font-bold uppercase tracking-wider z-10"
      >
        {label}
      </motion.span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute inset-0 bg-gradient-to-t from-cyber-neon/10 to-transparent rounded-xl -z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}
