import React, { useEffect, useState } from 'react';
import { Task, Challenge } from '../types';
import { CheckCircle, Swords, Plus, Clock, User, Award } from 'lucide-react';

const Tasks = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'challenges'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  // Form states
  const [newTask, setNewTask] = useState({ title: '', description: '', reward: 0, deadline: '', proof_requirement: '' });
  const [newChallenge, setNewChallenge] = useState({ targetId: '', title: '', description: '', stakes: 0, deadline: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, chalRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/challenges')
      ]);
      
      const tasksData = await tasksRes.json();
      const chalData = await chalRes.json();

      setTasks(tasksData);
      setChallenges(chalData);
    } catch (error) {
      console.error('Error fetching tasks/challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      
      if (res.ok) {
        alert('Task created successfully!');
        setShowCreateTask(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChallenge)
      });
      
      if (res.ok) {
        alert('Challenge sent successfully!');
        setShowCreateChallenge(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create challenge');
      }
    } catch (error) {
      console.error('Error creating challenge:', error);
    }
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING MISSIONS...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">TASKS & CHALLENGES</h1>
          <p className="text-white/60 font-mono text-xs">EARN TOINS BY COMPLETING MISSIONS</p>
        </div>
        
        <div className="flex gap-4 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'tasks' 
                ? 'bg-cyber-neon text-cyber-dark font-bold shadow-[0_0_10px_rgba(0,255,0,0.3)]' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <CheckCircle className="inline-block mr-2 mb-0.5" size={14} />
            PUBLIC TASKS
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'challenges' 
                ? 'bg-red-500 text-white font-bold shadow-[0_0_10px_rgba(255,0,0,0.3)]' 
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Swords className="inline-block mr-2 mb-0.5" size={14} />
            PVP ARENA
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'tasks' ? (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-8 bg-cyber-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.5)]"></span>
              AVAILABLE MISSIONS
            </h2>
            <button
              onClick={() => setShowCreateTask(true)}
              className="bg-cyber-neon/10 hover:bg-cyber-neon/20 text-cyber-neon border border-cyber-neon/50 px-4 py-2 rounded-xl flex items-center gap-2 font-mono text-xs uppercase tracking-wider transition-all"
            >
              <Plus size={16} />
              CREATE TASK
            </button>
          </div>

          <div className="grid gap-4">
            {tasks.map(task => (
              <div key={task.id} className="glass-panel p-6 flex justify-between items-center hover:border-cyber-neon/30 transition-all group">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyber-neon transition-colors">{task.title}</h3>
                  <p className="text-white/60 text-sm mb-3">{task.description}</p>
                  <div className="flex items-center gap-4 text-xs font-mono text-white/40">
                    <span className="flex items-center gap-1"><User size={12} /> {task.creator_name}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(task.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-mono font-bold text-xl mb-3 drop-shadow-[0_0_5px_rgba(255,215,0,0.3)]">{task.reward} TOINS</div>
                  <button className="bg-cyber-neon text-cyber-dark px-6 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider hover:bg-cyber-neon/80 transition-all shadow-[0_0_10px_rgba(0,255,0,0.2)]">
                    SUBMIT PROOF
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-white/20 text-center py-12 font-mono uppercase tracking-widest">NO ACTIVE MISSIONS DETECTED.</p>}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-8 bg-red-500 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.5)]"></span>
              ACTIVE DUELS
            </h2>
            <button
              onClick={() => setShowCreateChallenge(true)}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 px-4 py-2 rounded-xl flex items-center gap-2 font-mono text-xs uppercase tracking-wider transition-all"
            >
              <Swords size={16} />
              NEW CHALLENGE
            </button>
          </div>

          <div className="grid gap-4">
            {challenges.map(chal => (
              <div key={chal.id} className="glass-panel p-6 flex justify-between items-center border-l-4 border-l-red-500">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{chal.title}</h3>
                  <p className="text-white/60 text-sm mb-3">{chal.description}</p>
                  <div className="flex items-center gap-4 text-xs font-mono text-white/40">
                    <span className="text-red-400 font-bold">VS {chal.target_name}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(chal.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-red-500 font-mono font-bold text-xl mb-3 drop-shadow-[0_0_5px_rgba(255,0,0,0.3)]">{chal.stakes} TOINS</div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    chal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    chal.status === 'accepted' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {chal.status}
                  </span>
                </div>
              </div>
            ))}
            {challenges.length === 0 && <p className="text-white/20 text-center py-12 font-mono uppercase tracking-widest">NO ACTIVE DUELS FOUND.</p>}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-8 w-full max-w-md shadow-2xl shadow-cyber-neon/20 border-cyber-neon/30">
            <h3 className="text-xl font-bold text-white mb-6 font-mono tracking-tight text-center text-cyber-neon">INITIATE NEW MISSION</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <input
                type="text"
                placeholder="MISSION TITLE"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm placeholder:text-white/20"
                value={newTask.title}
                onChange={e => setNewTask({...newTask, title: e.target.value})}
                required
              />
              <textarea
                placeholder="MISSION BRIEFING"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none h-24 font-mono text-sm placeholder:text-white/20"
                value={newTask.description}
                onChange={e => setNewTask({...newTask, description: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="BOUNTY (TOINS)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm placeholder:text-white/20"
                  value={newTask.reward}
                  onChange={e => setNewTask({...newTask, reward: parseInt(e.target.value)})}
                  required
                />
                <input
                  type="date"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm"
                  value={newTask.deadline}
                  onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                  required
                />
              </div>
              <input
                type="text"
                placeholder="PROOF REQUIRED (E.G. SCREENSHOT)"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm placeholder:text-white/20"
                value={newTask.proof_requirement}
                onChange={e => setNewTask({...newTask, proof_requirement: e.target.value})}
                required
              />
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="px-6 py-2 text-white/40 hover:text-white font-mono text-xs uppercase tracking-wider"
                >
                  ABORT
                </button>
                <button
                  type="submit"
                  className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-8 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.3)] transition-all"
                >
                  DEPLOY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateChallenge && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-8 w-full max-w-md shadow-2xl shadow-red-500/20 border-red-500/30">
            <h3 className="text-xl font-bold text-white mb-6 font-mono tracking-tight text-center text-red-500">ISSUE CHALLENGE</h3>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <input
                type="text"
                placeholder="TARGET USER ID"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none font-mono text-sm placeholder:text-white/20"
                value={newChallenge.targetId}
                onChange={e => setNewChallenge({...newChallenge, targetId: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="CHALLENGE TITLE"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none font-mono text-sm placeholder:text-white/20"
                value={newChallenge.title}
                onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                required
              />
              <textarea
                placeholder="CONDITIONS OF VICTORY"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none h-24 font-mono text-sm placeholder:text-white/20"
                value={newChallenge.description}
                onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="STAKES (TOINS)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none font-mono text-sm placeholder:text-white/20"
                  value={newChallenge.stakes}
                  onChange={e => setNewChallenge({...newChallenge, stakes: parseInt(e.target.value)})}
                  required
                />
                <input
                  type="date"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none font-mono text-sm"
                  value={newChallenge.deadline}
                  onChange={e => setNewChallenge({...newChallenge, deadline: e.target.value})}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowCreateChallenge(false)}
                  className="px-6 py-2 text-white/40 hover:text-white font-mono text-xs uppercase tracking-wider"
                >
                  RETREAT
                </button>
                <button
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all"
                >
                  FIGHT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
