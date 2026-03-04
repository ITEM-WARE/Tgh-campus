import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';
import { MessageSquare, Plus, X, AlertCircle } from 'lucide-react';

const Support = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({ category: 'general', subject: '', description: '' });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      setTickets(data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setNewTicket({ category: 'general', subject: '', description: '' });
        fetchTickets();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING SUPPORT SYSTEM...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SUPPORT CENTER</h1>
          <p className="text-white/60 font-mono text-xs">SUBMIT REPORTS & APPEALS</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-6 py-2 rounded-xl flex items-center gap-2 font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.3)] transition-all"
        >
          <Plus size={16} />
          NEW TICKET
        </button>
      </div>

      <div className="grid gap-4">
        {tickets.map(ticket => (
          <div key={ticket.id} className="glass-panel p-6 flex justify-between items-center hover:border-cyber-neon/30 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                ticket.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyber-neon transition-colors">{ticket.subject}</h3>
                <p className="text-white/60 text-sm mb-2 line-clamp-1">{ticket.description}</p>
                <div className="flex items-center gap-4 text-xs font-mono text-white/40">
                  <span className="uppercase tracking-wider">{ticket.category.replace('_', ' ')}</span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                ticket.status === 'open' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                ticket.status === 'resolved' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              }`}>
                {ticket.status}
              </span>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="text-center py-12 glass-panel border-dashed border-white/10">
            <MessageSquare className="mx-auto text-white/20 mb-4" size={48} />
            <p className="text-white/40 font-mono text-sm uppercase tracking-widest">NO TICKETS FOUND</p>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-8 w-full max-w-md shadow-2xl shadow-cyber-neon/20 border-cyber-neon/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white font-mono tracking-tight text-cyber-neon">OPEN TICKET</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyber-neon/80 mb-2 uppercase tracking-wider">Category</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm"
                  value={newTicket.category}
                  onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                >
                  <option value="general">General Inquiry</option>
                  <option value="report_user">Report User</option>
                  <option value="bug_report">Bug Report</option>
                  <option value="appeal">Ban Appeal</option>
                  <option value="suggestion">Suggestion</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-mono text-cyber-neon/80 mb-2 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm placeholder:text-white/20"
                  placeholder="BRIEF SUMMARY"
                  value={newTicket.subject}
                  onChange={e => setNewTicket({...newTicket, subject: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-cyber-neon/80 mb-2 uppercase tracking-wider">Description</label>
                <textarea
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none h-32 font-mono text-sm placeholder:text-white/20"
                  placeholder="PROVIDE DETAILED INFORMATION..."
                  value={newTicket.description}
                  onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 text-white/40 hover:text-white font-mono text-xs uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-8 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.3)] transition-all"
                >
                  SUBMIT TICKET
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
