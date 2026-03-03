import { Type } from "@google/genai";

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  username_locked: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | 'banned';
  role: 'pending_student' | 'student' | 'moderator' | 'admin';
  grade: string;
  section: string;
  house: string;
  toins: number;
  xp: number;
  level: number;
  avatar: string | null;
  cover: string | null;
  strikes: number;
  created_at: string;
  verified_at: string | null;
  failed_login_attempts: number;
  account_locked_until: string | null;
  risk_score: number;
  is_flagged: boolean;
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
  content: string;
  content_type: 'text' | 'image' | 'file' | 'poll' | 'system';
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
  members?: User[];
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  text_overlay: string | null;
  created_at: string;
  expires_at: string;
  visibility: 'public' | 'close_friends';
  view_count: number;
  user?: User;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
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

export const USER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    username: { type: Type.STRING },
    fullName: { type: Type.STRING },
    bio: { type: Type.STRING },
  },
  required: ["username", "fullName"],
};
