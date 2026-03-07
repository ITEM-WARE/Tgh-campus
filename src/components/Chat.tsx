import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Image as ImageIcon, Mic, Smile, Paperclip, MoreVertical, Phone, Video, Search, ArrowLeft, Plus, X, Users, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { VoiceRecorder } from './VoiceRecorder';
import { User, Conversation, Message } from '../types';

// --- Mock Data for GIFs ---
const MOCK_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHJGHe3yAMhdQY/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT9IgusfDcqpPFzjdS/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eW54eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKUM3IgJBX2as9O/giphy.gif"
];

interface ChatProps {
  user: User;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ user, onClose, onViewProfile }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ... (useEffect hooks)

  const handleVoiceRecording = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'voice_message.webm');
    
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (res.ok) {
      const { url } = await res.json();
      await handleSendMessage('voice', url);
      setShowVoiceRecorder(false);
    }
  };

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      newSocket.emit('authenticate', user.id);
    });

    newSocket.on('new_message', (msg: Message) => {
      if (activeConversation?.id === msg.conversation_id) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
      // Update conversation list last message
      setConversations(prev => Array.isArray(prev) ? prev.map(c => 
        c.id === msg.conversation_id 
          ? { ...c, last_message: msg.content, last_message_at: msg.created_at } 
          : c
      ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()) : []);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [activeConversation, user.id]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      socket?.emit('join_room', activeConversation.id);
    }
  }, [activeConversation]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
        } else {
          console.error("Failed to fetch conversations:", data);
          setConversations([]);
        }
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const fetchMessages = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (type: 'text' | 'image' | 'gif' | 'voice' = 'text', content: string = inputText) => {
    if (!content.trim() && type === 'text') return;
    if (!activeConversation) return;

    const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, content_type: type })
    });

    if (res.ok) {
      setInputText('');
      setShowGifPicker(false);
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const { url } = await res.json();
        handleSendMessage('image', url);
      }
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchUserQuery(query);
    if (query.length > 1) {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } else {
      setSearchResults([]);
    }
  };

  const startNewChat = async (targetUserId: string) => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'private', participantIds: [targetUserId] })
    });
    
    if (res.ok) {
      const { id } = await res.json();
      await fetchConversations();
      // Find the new conversation in the updated list
      // Since fetchConversations is async and updates state, we might need to wait or just refetch
      // A better way is to wait for the state update or just set it manually if we had the full object
      // For now, let's just close the modal and let the user find it, or try to select it
      setShowNewChatModal(false);
      setSearchUserQuery('');
      setSearchResults([]);
      
      // Ideally we would set active conversation here, but we need the full conversation object
      // Let's try to fetch it individually
      const convRes = await fetch(`/api/conversations`);
      if (convRes.ok) {
        const convs = await convRes.json();
        if (Array.isArray(convs)) {
          const newConv = convs.find((c: Conversation) => c.id === id);
          if (newConv) setActiveConversation(newConv);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[50] bg-black/90 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl h-[85vh] bg-cyber-dark border border-white/10 rounded-3xl overflow-hidden flex shadow-2xl shadow-cyber-neon/10 relative">
        
        {/* New Chat Modal */}
        <AnimatePresence>
          {showNewChatModal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-cyber-dark border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">New Message</h3>
                  <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    value={searchUserQuery}
                    onChange={e => handleSearchUsers(e.target.value)}
                    placeholder="Search users..." 
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-cyber-neon/50"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {searchResults.length > 0 ? (
                    searchResults.map(u => (
                      <div 
                        key={u.id} 
                        onClick={() => startNewChat(u.id)}
                        className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-cyber-dark border border-white/10 overflow-hidden">
                          <img src={u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${u.display_name}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm">{u.display_name}</h4>
                          <p className="text-xs text-white/40">@{u.username}</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfile(u.id);
                          }}
                          className="p-2 text-cyber-neon hover:bg-cyber-neon/10 rounded-lg transition-colors"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-white/40 text-sm py-4">
                      {searchUserQuery.length > 1 ? 'No users found.' : 'Search for users to start a chat.'}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar - Conversations List */}
        <div className={`w-full sm:w-80 border-r border-white/10 flex flex-col ${activeConversation ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
            <h3 className="font-bold text-lg tracking-tight">MESSAGES</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowNewChatModal(true)} className="p-2 hover:bg-white/5 rounded-full text-cyber-neon"><Plus size={20} /></button>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
            </div>
          </div>
          
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input 
                placeholder="Search grid..." 
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-cyber-neon/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {Array.isArray(conversations) && conversations.map(conv => (
              <div 
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 ${activeConversation?.id === conv.id ? 'bg-white/5 border-l-2 border-l-cyber-neon' : ''}`}
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-cyber-dark border border-white/10 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${conv.name}`} className="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold truncate text-sm">{conv.name || 'Unknown'}</h4>
                      <span className="text-[10px] text-white/40 font-mono">{conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}</span>
                    </div>
                    <p className="text-xs text-white/60 truncate mt-1">{conv.last_message || 'Start a conversation'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-black/40 ${!activeConversation ? 'hidden sm:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveConversation(null)} className="sm:hidden p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
                  <div 
                    className="w-10 h-10 rounded-full bg-cyber-dark border border-white/10 overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (activeConversation.other_user_id) {
                        onViewProfile(activeConversation.other_user_id);
                      }
                    }}
                  >
                    <img src={activeConversation.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${activeConversation.name}`} className="w-full h-full" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{activeConversation.name}</h3>
                    <p className="text-[10px] text-cyber-neon flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyber-neon animate-pulse" /> ONLINE</p>
                  </div>
                </div>
                <div className="flex gap-2 text-white/60">
                  <button className="p-2 hover:text-white hover:bg-white/5 rounded-full"><Phone size={18} /></button>
                  <button className="p-2 hover:text-white hover:bg-white/5 rounded-full"><Video size={18} /></button>
                  <button className="p-2 hover:text-white hover:bg-white/5 rounded-full"><MoreVertical size={18} /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                  const isMe = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-3 ${isMe ? 'bg-cyber-neon text-cyber-dark rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                        {msg.content_type === 'image' ? (
                          <img src={msg.content} className="rounded-lg max-w-full" />
                        ) : msg.content_type === 'gif' ? (
                          <img src={msg.content} className="rounded-lg max-w-full" />
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-cyber-dark/60' : 'text-white/40'}`}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/10 bg-black/20 relative">
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 z-10"
                    >
                      <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} />
                    </motion.div>
                  )}
                  {showGifPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-12 mb-2 bg-cyber-dark border border-white/10 rounded-xl p-2 shadow-xl grid grid-cols-2 gap-2 w-64 z-10"
                    >
                      {MOCK_GIFS.map((gif, i) => (
                        <img 
                          key={i} 
                          src={gif} 
                          className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80" 
                          onClick={() => handleSendMessage('gif', gif)}
                        />
                      ))}
                    </motion.div>
                  )}
                  {showAttachMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-24 mb-2 bg-cyber-dark border border-white/10 rounded-xl p-2 shadow-xl flex flex-col gap-2 z-10 w-40"
                    >
                      <label className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                        <ImageIcon size={18} className="text-cyber-blue" />
                        <span className="text-sm font-bold">Image</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                      <label className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                        <Video size={18} className="text-cyber-pink" />
                        <span className="text-sm font-bold">Video</span>
                        <input type="file" accept="video/*" className="hidden" />
                      </label>
                      <button className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors text-left">
                        <Paperclip size={18} className="text-cyber-neon" />
                        <span className="text-sm font-bold">File</span>
                      </button>
                    </motion.div>
                  )}
                  {showVoiceRecorder && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full right-0 mb-2 z-10 w-full max-w-sm"
                    >
                      <div className="bg-cyber-dark border border-white/10 rounded-xl p-2 shadow-xl">
                        <div className="flex justify-between items-center mb-2 px-2">
                          <span className="text-xs font-bold text-cyber-neon">VOICE MESSAGE</span>
                          <button onClick={() => setShowVoiceRecorder(false)}><X size={14} /></button>
                        </div>
                        <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); setShowAttachMenu(false); setShowVoiceRecorder(false); }} 
                    className={`p-2 transition-colors ${showEmojiPicker ? 'text-cyber-neon' : 'text-white/40 hover:text-cyber-neon'}`}
                  >
                    <Smile size={20} />
                  </button>
                  <button 
                    onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); setShowAttachMenu(false); setShowVoiceRecorder(false); }} 
                    className={`p-2 font-bold text-xs transition-colors ${showGifPicker ? 'text-cyber-neon' : 'text-white/40 hover:text-cyber-neon'}`}
                  >
                    GIF
                  </button>
                  <button 
                    onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); setShowGifPicker(false); setShowVoiceRecorder(false); }} 
                    className={`p-2 transition-colors ${showAttachMenu ? 'text-cyber-neon' : 'text-white/40 hover:text-cyber-neon'}`}
                  >
                    <Plus size={20} />
                  </button>
                  
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl flex items-center px-4">
                    <input 
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent border-none outline-none text-sm py-3 text-white placeholder:text-white/30"
                    />
                  </div>
                  {inputText.trim() ? (
                    <button onClick={() => handleSendMessage()} className="p-3 bg-cyber-neon text-cyber-dark rounded-xl hover:bg-cyber-neon/80 transition-colors">
                      <Send size={18} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setShowVoiceRecorder(!showVoiceRecorder); setShowEmojiPicker(false); setShowGifPicker(false); setShowAttachMenu(false); }}
                      className={`p-3 rounded-xl transition-colors ${showVoiceRecorder ? 'bg-cyber-neon text-cyber-dark' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <MessageSquare size={40} />
              </div>
              <p className="font-mono text-sm">Select a conversation to start chatting</p>
              <button onClick={() => setShowNewChatModal(true)} className="mt-4 px-6 py-2 bg-cyber-neon text-cyber-dark font-bold rounded-xl hover:bg-cyber-neon/80 transition-colors">
                Start New Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
