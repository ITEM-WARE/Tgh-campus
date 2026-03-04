import React, { useEffect, useState } from 'react';
import { Post, Story } from '../types';
import { Heart, MessageCircle, Share2, MoreHorizontal, Plus, Image as ImageIcon, Mic } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Feed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', type: 'public', title: '', tags: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [postsRes, storiesRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/stories')
      ]);
      
      const postsData = await postsRes.json();
      const storiesData = await storiesRes.json();

      setPosts(postsData);
      setStories(storiesData);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });
      
      if (res.ok) {
        setShowCreatePost(false);
        setNewPost({ content: '', type: 'public', title: '', tags: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      // Optimistic update
      setPosts(posts.map(p => p.id === postId ? { ...p, engagement_score: p.engagement_score + 0.1 } : p));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  if (loading) return <div className="p-8 text-center font-mono text-cyber-neon animate-pulse">LOADING FEED...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Stories Bar */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
          <div className="w-16 h-16 rounded-full bg-black/40 border-2 border-dashed border-white/20 flex items-center justify-center group-hover:border-cyber-neon transition-colors">
            <Plus size={24} className="text-white/40 group-hover:text-cyber-neon" />
          </div>
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">ADD STORY</span>
        </div>
        {stories.map(story => (
          <div key={story.id} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-cyber-neon to-cyber-blue animate-pulse-neon">
              <div className="w-full h-full rounded-full border-2 border-black overflow-hidden">
                <img src={story.media_url || story.user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${story.user_id}`} className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-white/60 truncate w-16 text-center">{story.user?.username}</span>
          </div>
        ))}
      </div>

      {/* Create Post Input */}
      <div className="glass-panel p-4 mb-6 cursor-pointer hover:border-cyber-neon/30 transition-colors group" onClick={() => setShowCreatePost(true)}>
        <div className="flex gap-4 items-center">
          <div className="w-10 h-10 rounded-full bg-black/40 overflow-hidden border border-white/10">
            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=User`} className="w-full h-full object-cover" />
          </div>
          <input 
            disabled
            placeholder="TRANSMIT MESSAGE..."
            className="flex-1 bg-transparent border-none outline-none text-white/40 cursor-pointer font-mono text-sm group-hover:text-cyber-neon/60 transition-colors"
          />
          <ImageIcon size={20} className="text-white/40 group-hover:text-cyber-neon transition-colors" />
          <Mic size={20} className="text-white/40 group-hover:text-cyber-neon transition-colors" />
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="glass-panel overflow-hidden hover:border-cyber-neon/20 transition-all">
            <div className="p-4 flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-black/40 overflow-hidden border border-white/10">
                  <img src={post.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author_username}`} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm tracking-wide">{post.author_username}</h3>
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{formatDistanceToNow(new Date(post.timestamp))} AGO</p>
                </div>
              </div>
              <button className="text-white/40 hover:text-white"><MoreHorizontal size={20} /></button>
            </div>

            <div className="px-4 pb-2">
              {post.title && <h4 className="font-bold text-lg text-cyber-neon mb-2 tracking-tight">{post.title}</h4>}
              <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            </div>

            {post.media_url && (
              <div className="mt-2 border-y border-white/5">
                <img src={post.media_url} className="w-full max-h-96 object-cover" />
              </div>
            )}

            <div className="p-4 flex items-center gap-6 border-t border-white/5 mt-2">
              <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-white/40 hover:text-cyber-pink transition-colors group">
                <Heart size={20} className="group-hover:drop-shadow-[0_0_5px_#FF00FF]" />
                <span className="text-xs font-mono group-hover:text-cyber-pink">{Math.floor(post.engagement_score * 10)}</span>
              </button>
              <button className="flex items-center gap-2 text-white/40 hover:text-cyber-blue transition-colors group">
                <MessageCircle size={20} className="group-hover:drop-shadow-[0_0_5px_#00FFFF]" />
                <span className="text-xs font-mono uppercase tracking-wider group-hover:text-cyber-blue">COMMENT</span>
              </button>
              <button className="flex items-center gap-2 text-white/40 hover:text-cyber-neon transition-colors ml-auto">
                <Share2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-8 w-full max-w-lg shadow-2xl shadow-cyber-neon/20 border-cyber-neon/30">
            <h3 className="text-xl font-bold text-white mb-6 font-mono tracking-tight text-cyber-neon">NEW TRANSMISSION</h3>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <input
                type="text"
                placeholder="HEADER (OPTIONAL)"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none font-mono text-sm placeholder:text-white/20"
                value={newPost.title}
                onChange={e => setNewPost({...newPost, title: e.target.value})}
              />
              <textarea
                placeholder="MESSAGE CONTENT..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-cyber-neon outline-none h-32 font-mono text-sm placeholder:text-white/20"
                value={newPost.content}
                onChange={e => setNewPost({...newPost, content: e.target.value})}
                required
              />
              <div className="flex gap-4">
                <select
                  className="bg-black/40 border border-white/10 rounded-xl p-2 text-white text-xs font-mono uppercase outline-none focus:border-cyber-neon"
                  value={newPost.type}
                  onChange={e => setNewPost({...newPost, type: e.target.value})}
                >
                  <option value="public">PUBLIC CHANNEL</option>
                  <option value="confession">ANONYMOUS</option>
                  <option value="news">NEWS FEED</option>
                </select>
                <input
                  type="text"
                  placeholder="TAGS (COMMA SEPARATED)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-white text-xs font-mono outline-none focus:border-cyber-neon placeholder:text-white/20"
                  value={newPost.tags}
                  onChange={e => setNewPost({...newPost, tags: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowCreatePost(false)}
                  className="px-6 py-2 text-white/40 hover:text-white font-mono text-xs uppercase tracking-wider"
                >
                  ABORT
                </button>
                <button
                  type="submit"
                  className="bg-cyber-neon hover:bg-cyber-neon/80 text-cyber-dark px-8 py-2 rounded-xl font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.3)] transition-all"
                >
                  TRANSMIT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
