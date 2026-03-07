import { Type } from "@google/genai";

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  username_locked: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | 'banned';
  is_verified?: boolean; // Derived helper
  role: 'pending_student' | 'student' | 'moderator' | 'admin';
  grade: string;
  section: string;
  house: string;
  toins: number;
  xp: number;
  level: number;
  avatar: string | null;
  cover: string | null;
  cover_url?: string; // Alias
  strikes: number;
  created_at: string;
  verified_at: string | null;
  failed_login_attempts: number;
  account_locked_until: string | null;
  risk_score: number;
  is_flagged: boolean;
  unlock_custom_pfp?: boolean;
  unlock_custom_banner?: boolean;
  bio?: string;
  active_frame?: string;
  active_username_effect?: string;
  active_profile_theme?: string;
  active_chat_bubble?: string;
  active_status_icon?: string;
  streak_count?: number;
  last_login_at?: string;
  prestige_level?: number;
  reputation?: number;
  stats?: {
    posts: number;
    followers: number;
    reputation: number;
  };
}

export interface SecurityEvent {
  id: number;
  user_id: string;
  event_type: string;
  ip_address: string;
  device_hash: string;
  risk_score: number;
  details: string;
  resolved: boolean;
  timestamp: string;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked: boolean;
  ip_address: string;
  device_hash: string;
  user_agent: string;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  device_hash: string;
  ip_address: string;
  user_agent: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  risk_score: number;
}

export interface AuditLog {
  id: number;
  user_id: string;
  action_type: string;
  target_id: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

export interface IPCluster {
  ip_address: string;
  user_count: number;
  user_ids: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  content_type: 'text' | 'image' | 'voice' | 'gif' | 'file' | 'poll' | 'system';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  risk_score: number;
  flagged: boolean;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group' | 'section' | 'broadcast';
  name: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  last_message?: string;
  last_message_type?: string;
  members?: User[];
  avatar?: string;
  other_user_id?: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  text_overlay: string | null;
  title?: string;
  tags?: string;
  created_at: string;
  expires_at: string;
  visibility: 'public' | 'close_friends';
  view_count: number;
  user?: User;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  voice_url?: string;
  title?: string;
  tags?: string;
  type: 'public' | 'confession' | 'news';
  status: 'pending' | 'approved' | 'rejected';
  engagement_score: number;
  timestamp: string;
  author?: string;
  author_username?: string;
  author_avatar?: string;
  author_role?: string;
  author_status?: string;
  is_edited?: boolean;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  image_url?: string;
  status: 'active' | 'sold' | 'removed';
  created_at: string;
  seller?: User;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reason: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  actor_id: string;
  target_id: string;
  content: string;
  is_read: boolean;
  timestamp: string;
  actor?: User;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface AcademicMaterial {
  id: string;
  type: 'homework' | 'classwork' | 'note' | 'schedule';
  title: string;
  content: string;
  grade: string;
  section: string;
  subject: string;
  due_date: string | null;
  created_at: string;
  created_by: string;
}

export interface DiscussionQuery {
  id: string;
  user_id: string;
  subject: string;
  query: string;
  created_at: string;
  user?: User;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'frame' | 'effect' | 'theme' | 'banner' | 'chat' | 'booster' | 'badge';
  price: number;
  type: string;
  metadata?: string;
  created_at: string;
  is_owned?: boolean;
  is_equipped?: boolean;
}

export interface UserInventory {
  user_id: string;
  item_id: string;
  purchased_at: string;
  is_active: boolean;
  name?: string;
  category?: string;
  metadata?: string;
}

export interface Task {
  id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  description: string;
  reward: number;
  deadline: string;
  proof_requirement: string;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  task_title?: string;
  user_id: string;
  display_name?: string;
  username?: string;
  proof_text: string;
  proof_media?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_feedback?: string;
  submitted_at: string;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challenger_name?: string;
  target_id: string;
  target_name?: string;
  title: string;
  description: string;
  stakes: number;
  deadline: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'disputed';
  winner_id?: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  display_name?: string;
  username?: string;
  subject: string;
  description: string;
  category: 'report_user' | 'report_post' | 'appeal_ban' | 'account_issue' | 'suggest_feature' | 'other' | 'general' | 'bug_report' | 'suggestion' | 'appeal';
  status: 'open' | 'in_progress' | 'resolved' | 'flagged';
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  timestamp: string;
}

export interface AIHistory {
  id: number;
  user_id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface RedeemCode {
  code: string;
  reward_type: 'toins' | 'item';
  reward_value: string;
  max_uses: number;
  current_uses: number;
  expires_at?: string;
  created_by: string;
  hint?: string;
  is_treasure_hunt: boolean;
}

export const USER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    username: { type: Type.STRING },
    fullName: { type: Type.STRING },
    bio: { type: Type.STRING },
  },
  required: ["username", "fullName"],
};
