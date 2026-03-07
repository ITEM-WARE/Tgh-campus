import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from 'better-sqlite3';
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

import pg from 'pg';
const { Pool } = pg;

// Database Configuration
const isPostgres = !!process.env.DATABASE_URL;
let pgPool: pg.Pool | null = null;
let db: Database.Database | null = null;

if (isPostgres) {
  console.log("Using PostgreSQL database");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.log("Using SQLite database");
  db = new Database('database.sqlite');
}

// Helper for Database Queries (Supports both SQLite and Postgres)
async function query(text: string, params: any[] = []) {
  if (isPostgres && pgPool) {
    // PostgreSQL Implementation
    // Convert SQLite syntax ($1, $2) to Postgres syntax ($1, $2) - they are compatible!
    // However, we need to handle "lastInsertRowid" manually for Postgres if needed, 
    // but for now we return rows.
    
    // Handle specific syntax differences if necessary
    let pgText = text;
    
    // Simple query execution
    try {
      const res = await pgPool.query(pgText, params);
      return { 
        rows: res.rows, 
        lastInsertRowid: null, // PG doesn't return this by default without RETURNING clause
        changes: res.rowCount 
      };
    } catch (err) {
      console.error("Database Error:", err);
      throw err;
    }
  } else if (db) {
    // SQLite Implementation
    const sqliteText = text.replace(/\$\d+/g, '?');
    
    if (sqliteText.trim().toUpperCase() === 'BEGIN') {
      db.prepare('BEGIN').run();
      return { rows: [] };
    }
    if (sqliteText.trim().toUpperCase() === 'COMMIT') {
      db.prepare('COMMIT').run();
      return { rows: [] };
    }
    if (sqliteText.trim().toUpperCase() === 'ROLLBACK') {
      db.prepare('ROLLBACK').run();
      return { rows: [] };
    }

    const stmt = db.prepare(sqliteText);
    
    if (sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.trim().toUpperCase().startsWith('PRAGMA')) {
      const rows = stmt.all(...params);
      return { rows };
    } else {
      const info = stmt.run(...params);
      return { rows: [], lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    }
  }
  throw new Error("Database not initialized");
}

const pool = {
  connect: async () => ({
    query: async (text: string, params?: any[]) => query(text, params),
    release: () => {}
  })
};

async function updateBountyProgress(userId: string, type: string, amount: number = 1) {
  try {
    const dailyBountyRes = await query("SELECT * FROM bounties WHERE type = $1 ORDER BY created_at DESC LIMIT 1", [type]);
    if (dailyBountyRes.rows.length === 0) return;
    
    const bounty = dailyBountyRes.rows[0];
    const userBountyRes = await query("SELECT * FROM user_bounties WHERE user_id = $1 AND bounty_id = $2", [userId, bounty.id]);
    
    if (userBountyRes.rows.length === 0) {
      await query("INSERT INTO user_bounties (user_id, bounty_id, progress) VALUES ($1, $2, $3)", [userId, bounty.id, amount]);
    } else {
      const userBounty = userBountyRes.rows[0];
      if (userBounty.completed_at) return;
      
      const newProgress = Math.min(userBounty.progress + amount, bounty.target_value);
      const completedAt = newProgress >= bounty.target_value ? new Date().toISOString() : null;
      
      await query("UPDATE user_bounties SET progress = $1, completed_at = $2 WHERE user_id = $3 AND bounty_id = $4", 
        [newProgress, completedAt, userId, bounty.id]);
        
      if (completedAt) {
        await query("INSERT INTO notifications (user_id, type, content) VALUES ($1, $2, $3)",
          [userId, 'bounty_completed', `Daily Bounty Completed: ${bounty.title}! Claim your rewards in the hub.`]);
      }
    }
  } catch (e) {
    console.error("Error updating bounty progress:", e);
  }
}

async function seedBounties() {
  const res = await query("SELECT COUNT(*) as count FROM bounties");
  if (res.rows[0].count === 0) {
    await query("INSERT INTO bounties (id, title, description, reward_xp, reward_toins, type, target_value) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ['bounty_posts_1', 'Campus Broadcaster', 'Broadcast 3 posts to the campus grid today.', 100, 50, 'post_count', 3]);
    await query("INSERT INTO bounties (id, title, description, reward_xp, reward_toins, type, target_value) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ['bounty_likes_1', 'Grid Curator', 'Show some love! Like 5 posts from other students.', 50, 25, 'like_count', 5]);
  }
}

// Initialize Database with PostgreSQL schema
async function initDb() {
  if (isPostgres) {
    // PostgreSQL Initialization
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        username TEXT UNIQUE,
        username_locked INTEGER DEFAULT 1,
        verification_status TEXT DEFAULT 'pending',
        role TEXT DEFAULT 'pending_student',
        grade TEXT,
        section TEXT,
        toins INTEGER DEFAULT 1000,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        avatar TEXT,
        cover TEXT,
        ip_address_signup TEXT,
        ip_address_last_login TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP,
        strikes INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_until TIMESTAMP,
        last_failed_login_at TIMESTAMP,
        risk_score INTEGER DEFAULT 0,
        is_flagged INTEGER DEFAULT 0,
        unlock_custom_pfp INTEGER DEFAULT 0,
        unlock_custom_banner INTEGER DEFAULT 0,
        bio TEXT,
        active_frame TEXT,
        active_username_effect TEXT,
        active_profile_theme TEXT DEFAULT 'minimal',
        active_chat_bubble TEXT,
        active_status_icon TEXT,
        streak_count INTEGER DEFAULT 0,
        last_login_at TIMESTAMP,
        prestige_level INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ai_chat_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        role TEXT,
        content TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS store_items (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        category TEXT,
        price INTEGER,
        type TEXT,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS user_inventory (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        item_id TEXT,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_equipped INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        revoked INTEGER DEFAULT 0,
        ip_address TEXT,
        device_hash TEXT,
        user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        event_type TEXT,
        ip_address TEXT,
        device_hash TEXT,
        risk_score INTEGER,
        details TEXT,
        resolved INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS verification_answers (
        user_id TEXT PRIMARY KEY,
        question_1 TEXT,
        question_2 TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS ip_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        ip_address TEXT,
        action_type TEXT,
        device_info TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        action_type TEXT,
        target_id TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        content TEXT,
        media_url TEXT,
        type TEXT DEFAULT 'public',
        status TEXT DEFAULT 'approved',
        engagement_score REAL DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        campus_id TEXT DEFAULT 'main',
        title TEXT,
        tags TEXT,
        voice_url TEXT,
        is_edited INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS post_edits (
        id SERIAL PRIMARY KEY,
        post_id INTEGER,
        content TEXT,
        media_url TEXT,
        voice_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id TEXT,
        target_type TEXT,
        target_id TEXT,
        reason TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS bounties (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        reward_xp INTEGER,
        reward_toins INTEGER,
        type TEXT,
        target_value INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_bounties (
        user_id TEXT,
        bounty_id TEXT,
        progress INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        claimed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, bounty_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (bounty_id) REFERENCES bounties(id)
      );

      CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT,
        post_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, post_id),
        FOREIGN KEY (post_id) REFERENCES posts(id)
      );

      CREATE TABLE IF NOT EXISTS message_reads (
        message_id TEXT,
        user_id TEXT,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT 'private',
        name TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        campus_id TEXT DEFAULT 'main'
      );

      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id TEXT,
        user_id TEXT,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS academic_materials (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        content TEXT,
        grade TEXT,
        section TEXT,
        subject TEXT,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
      );

      CREATE TABLE IF NOT EXISTS discussion_queries (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        subject TEXT,
        query TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        sender_id TEXT,
        content TEXT,
        content_type TEXT DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        edited_at TIMESTAMP,
        deleted_at TIMESTAMP,
        reply_to_id TEXT,
        risk_score INTEGER DEFAULT 0,
        flagged INTEGER DEFAULT 0,
        read_by_all INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        media_url TEXT,
        text_overlay TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        visibility TEXT DEFAULT 'public',
        view_count INTEGER DEFAULT 0,
        campus_id TEXT DEFAULT 'main',
        title TEXT,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS story_views (
        story_id TEXT,
        viewer_id TEXT,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (story_id, viewer_id)
      );

      CREATE TABLE IF NOT EXISTS friendships (
        user_id TEXT,
        friend_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        title TEXT,
        content TEXT,
        is_read INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS custom_themes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        config TEXT,
        is_active INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        category TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        sender_id TEXT,
        content TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_verifications (
        user_id TEXT PRIMARY KEY,
        otp_hash TEXT,
        expires_at TIMESTAMP,
        attempt_count INTEGER DEFAULT 0,
        last_resend_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        device_hash TEXT,
        ip_address TEXT,
        user_agent TEXT,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        risk_score INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        seller_id TEXT,
        title TEXT,
        description TEXT,
        category TEXT,
        price INTEGER,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        campus_id TEXT DEFAULT 'main'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        amount INTEGER,
        type TEXT,
        reason TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        user_id TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // SQLite Initialization (Existing)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        username TEXT UNIQUE,
        username_locked INTEGER DEFAULT 1,
        verification_status TEXT DEFAULT 'pending',
        role TEXT DEFAULT 'pending_student',
        grade TEXT,
        section TEXT,
        toins INTEGER DEFAULT 1000,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      avatar TEXT,
      cover TEXT,
      ip_address_signup TEXT,
      ip_address_last_login TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      verified_at TIMESTAMP,
      strikes INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      account_locked_until TIMESTAMP,
      last_failed_login_at TIMESTAMP,
      risk_score INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      unlock_custom_pfp INTEGER DEFAULT 0,
      unlock_custom_banner INTEGER DEFAULT 0,
      bio TEXT,
      active_frame TEXT,
      active_username_effect TEXT,
      active_profile_theme TEXT DEFAULT 'minimal',
      active_chat_bubble TEXT,
      active_status_icon TEXT,
      streak_count INTEGER DEFAULT 0,
      last_login_at TIMESTAMP,
      prestige_level INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      role TEXT,
      content TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS store_items (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      category TEXT,
      price INTEGER,
      type TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      user_id TEXT,
      item_id TEXT,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      reward_type TEXT,
      reward_value TEXT,
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      expires_at TIMESTAMP,
      created_by TEXT,
      hint TEXT,
      is_treasure_hunt INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      title TEXT,
      description TEXT,
      reward INTEGER,
      deadline TIMESTAMP,
      proof_requirement TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_submissions (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      user_id TEXT,
      proof_text TEXT,
      proof_media TEXT,
      status TEXT DEFAULT 'pending',
      admin_feedback TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      challenger_id TEXT,
      target_id TEXT,
      title TEXT,
      description TEXT,
      stakes INTEGER,
      deadline TIMESTAMP,
      status TEXT DEFAULT 'pending',
      winner_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      sender_id TEXT,
      content TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      user_id TEXT PRIMARY KEY,
      otp_hash TEXT,
      expires_at TIMESTAMP,
      attempt_count INTEGER DEFAULT 0,
      last_resend_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      device_hash TEXT,
      ip_address TEXT,
      user_agent TEXT,
      first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      risk_score INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      refresh_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      revoked INTEGER DEFAULT 0,
      ip_address TEXT,
      device_hash TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event_type TEXT,
      ip_address TEXT,
      device_hash TEXT,
      risk_score INTEGER,
      details TEXT,
      resolved INTEGER DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS verification_answers (
      user_id TEXT PRIMARY KEY,
      question_1 TEXT,
      question_2 TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ip_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      ip_address TEXT,
      action_type TEXT,
      device_info TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      content TEXT,
      media_url TEXT,
      type TEXT DEFAULT 'public',
      status TEXT DEFAULT 'approved',
      engagement_score REAL DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      campus_id TEXT DEFAULT 'main',
      title TEXT,
      tags TEXT,
      voice_url TEXT,
      is_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS post_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER,
      content TEXT,
      media_url TEXT,
      voice_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id TEXT,
      target_type TEXT,
      target_id TEXT,
      reason TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      reward_xp INTEGER,
      reward_toins INTEGER,
      type TEXT,
      target_value INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_bounties (
      user_id TEXT,
      bounty_id TEXT,
      progress INTEGER DEFAULT 0,
      completed_at TIMESTAMP,
      claimed INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, bounty_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (bounty_id) REFERENCES bounties(id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT,
      post_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT,
      user_id TEXT,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'private',
      name TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      campus_id TEXT DEFAULT 'main'
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT,
      user_id TEXT,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS academic_materials (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      content TEXT,
      grade TEXT,
      section TEXT,
      subject TEXT,
      due_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS discussion_queries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      subject TEXT,
      query TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      sender_id TEXT,
      content TEXT,
      content_type TEXT DEFAULT 'text',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      edited_at TIMESTAMP,
      deleted_at TIMESTAMP,
      reply_to_id TEXT,
      risk_score INTEGER DEFAULT 0,
      flagged INTEGER DEFAULT 0,
      read_by_all INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      media_url TEXT,
      text_overlay TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      visibility TEXT DEFAULT 'public',
      view_count INTEGER DEFAULT 0,
      campus_id TEXT DEFAULT 'main',
      title TEXT,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT,
      viewer_id TEXT,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (story_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      requester_id TEXT,
      receiver_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (requester_id, receiver_id)
    );

    CREATE TABLE IF NOT EXISTS close_friends (
      user_id TEXT,
      friend_id TEXT,
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT,
      title TEXT,
      description TEXT,
      category TEXT,
      price INTEGER,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      campus_id TEXT DEFAULT 'main'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      amount INTEGER,
      type TEXT,
      reason TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      user_id TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT,
      actor_id TEXT,
      target_id TEXT,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_themes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      config TEXT,
      is_active INTEGER DEFAULT 0
    );
  `);

  // Ensure new columns exist in users table
  const userColumns = ['bio', 'active_frame', 'active_username_effect', 'active_profile_theme', 'active_chat_bubble', 'active_status_icon', 'streak_count', 'last_login_at', 'prestige_level'];
  for (const col of userColumns) {
    try {
      await query(`ALTER TABLE users ADD COLUMN ${col} ${col.includes('count') || col.includes('level') ? 'INTEGER DEFAULT 0' : col.includes('at') ? 'TIMESTAMP' : 'TEXT'}`, []);
    } catch (e) {
      // Column likely already exists
    }
  }

  // Seed Store Items
  const existingItems = await query("SELECT COUNT(*) as count FROM store_items", []);
  if (parseInt(existingItems.rows[0].count) === 0) {
    const seedItems = [
      { id: 'frame_neon', name: 'Neon Pulse Frame', description: 'A glowing neon border for your avatar.', category: 'frame', price: 500, type: 'digital' },
      { id: 'frame_gold', name: 'Gold Elite Frame', description: 'Show off your wealth with this golden frame.', category: 'frame', price: 2000, type: 'digital' },
      { id: 'effect_sparkle', name: 'Sparkle Effect', description: 'Sparkles around your username.', category: 'effect', price: 800, type: 'digital' },
      { id: 'theme_cyber', name: 'Cyberpunk Theme', description: 'Dark mode with neon accents.', category: 'theme', price: 1000, type: 'digital' },
      { id: 'chat_bubble_blue', name: 'Blue Bubble', description: 'Custom blue chat bubble.', category: 'chat', price: 300, type: 'digital' },
      { id: 'badge_early', name: 'Early Adopter', description: 'Badge for early users.', category: 'badge', price: 5000, type: 'digital' }
    ];
    for (const item of seedItems) {
      await query("INSERT INTO store_items (id, name, description, category, price, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING", [item.id, item.name, item.description, item.category, item.price, item.type, '{}']);
    }
  }

  // Migration: Ensure all columns exist in users table
  const columns = await query("PRAGMA table_info('users')", []);
  const columnNames = columns.rows.map((c: any) => c.name);
  const requiredColumns = [
    { name: 'email', type: 'TEXT' },
    { name: 'password_hash', type: 'TEXT' },
    { name: 'display_name', type: 'TEXT' },
    { name: 'username', type: 'TEXT' },
    { name: 'username_locked', type: 'INTEGER DEFAULT 1' },
    { name: 'verification_status', type: "TEXT DEFAULT 'pending'" },
    { name: 'role', type: "TEXT DEFAULT 'pending_student'" },
    { name: 'grade', type: 'TEXT' },
    { name: 'section', type: 'TEXT' },
    { name: 'house', type: 'TEXT' },
    { name: 'toins', type: 'INTEGER DEFAULT 1000' },
    { name: 'xp', type: 'INTEGER DEFAULT 0' },
    { name: 'level', type: 'INTEGER DEFAULT 1' },
    { name: 'avatar', type: 'TEXT' },
    { name: 'cover', type: 'TEXT' },
    { name: 'ip_address_signup', type: 'TEXT' },
    { name: 'ip_address_last_login', type: 'TEXT' },
    { name: 'failed_login_attempts', type: 'INTEGER DEFAULT 0' },
    { name: 'account_locked_until', type: 'TIMESTAMP' },
    { name: 'last_failed_login_at', type: 'TIMESTAMP' },
    { name: 'risk_score', type: 'INTEGER DEFAULT 0' },
    { name: 'is_flagged', type: 'INTEGER DEFAULT 0' },
    { name: 'strikes', type: 'INTEGER DEFAULT 0' },
    { name: 'unlock_custom_pfp', type: 'INTEGER DEFAULT 0' },
    { name: 'unlock_custom_banner', type: 'INTEGER DEFAULT 0' },
    { name: 'active_frame', type: 'TEXT' },
    { name: 'active_username_effect', type: 'TEXT' },
    { name: 'active_profile_theme', type: "TEXT DEFAULT 'minimal'" },
    { name: 'active_chat_bubble', type: 'TEXT' },
    { name: 'active_status_icon', type: 'TEXT' },
    { name: 'streak_count', type: 'INTEGER DEFAULT 0' },
    { name: 'last_login_at', type: 'TIMESTAMP' },
    { name: 'prestige_level', type: 'INTEGER DEFAULT 0' }
  ];

  for (const col of requiredColumns) {
    if (!columnNames.includes(col.name)) {
      try {
        await query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, []);
        if (col.name === 'email' || col.name === 'username') {
          await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_${col.name} ON users(${col.name})`, []);
        }
      } catch (e) {
        console.error(`Migration failed for column ${col.name}:`, e);
      }
    }
  }

  // Migration: Ensure engagement_score exists in posts table
  const postColumns = await query("PRAGMA table_info('posts')", []);
  const postColumnNames = postColumns.rows.map((c: any) => c.name);
  if (!postColumnNames.includes('engagement_score')) {
    try {
      await query("ALTER TABLE posts ADD COLUMN engagement_score REAL DEFAULT 0", []);
    } catch (e) {
      console.error("Migration failed for posts.engagement_score:", e);
    }
  }
  if (!postColumnNames.includes('is_edited')) {
    try {
      await query("ALTER TABLE posts ADD COLUMN is_edited INTEGER DEFAULT 0", []);
    } catch (e) {}
  }

  // Migration for sessions table
  const sessionColumns = await query("PRAGMA table_info('sessions')", []);
  const sessionColumnNames = sessionColumns.rows.map((c: any) => c.name);
  const requiredSessionColumns = [
    { name: 'user_agent', type: 'TEXT' },
    { name: 'last_activity_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'revoked', type: 'INTEGER DEFAULT 0' },
    { name: 'ip_address', type: 'TEXT' },
    { name: 'device_hash', type: 'TEXT' }
  ];

  for (const col of requiredSessionColumns) {
    if (!sessionColumnNames.includes(col.name)) {
      try {
        await query(`ALTER TABLE sessions ADD COLUMN ${col.name} ${col.type}`, []);
      } catch (e) {}
    }
  }

  await seedBounties();
}

// Global Lockdown Mode
let LOCKDOWN_MODE = process.env.LOCKDOWN_MODE === 'true';

// Helper for audit logging
async function logAction(userId: string | null, action: string, targetId: string | null, details: string, ip: string) {
  await query("INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5)", [userId, action, targetId, details, ip]);
}

// Helper for security events
async function logSecurityEvent(userId: string | null, type: string, ip: string, deviceHash: string | null, risk: number, details: string) {
  await query("INSERT INTO security_events (user_id, event_type, ip_address, device_hash, risk_score, details) VALUES ($1, $2, $3, $4, $5, $6)", [userId, type, ip, deviceHash, risk, details]);
}

async function startServer() {
  console.log("Starting server...");
  try {
    await initDb();
    
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
    
    let ai: GoogleGenAI | null = null;
    const getAi = () => {
      if (!ai) {
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
          throw new Error('GEMINI_API_KEY environment variable is required');
        }
        ai = new GoogleGenAI({ apiKey: key });
      }
      return ai;
    };

    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    // Auto-promote admin user
    const adminEmail = 'driveserverhosting0944@gmail.com';
    const adminUsers = await query("SELECT * FROM users WHERE email = $1", [adminEmail]);
    if (adminUsers.rows.length > 0) {
      await query("UPDATE users SET role = 'admin', verification_status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE email = $1", [adminEmail]);
      console.log(`Promoted ${adminEmail} to admin and approved.`);
    }

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Rate Limiting Middleware (Simple memory-based for demo, could use DB)
  const rateLimits = new Map<string, { count: number, reset: number }>();
  const checkRateLimit = (key: string, limit: number, windowMs: number) => {
    const now = Date.now();
    const record = rateLimits.get(key) || { count: 0, reset: now + windowMs };
    if (now > record.reset) {
      record.count = 1;
      record.reset = now + windowMs;
    } else {
      record.count++;
    }
    rateLimits.set(key, record);
    return record.count <= limit;
  };

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify session in DB and check timeouts
      const sessionRes = await query("SELECT * FROM sessions WHERE id = $1 AND revoked = 0", [decoded.sessionId]);
      const session = sessionRes.rows[0];
      
      if (!session) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session invalid or revoked" });
      }

      const now = Date.now();
      // PostgreSQL timestamps are usually Date objects.
      const lastActivity = new Date(session.last_activity_at).getTime();
      const createdAt = new Date(session.created_at).getTime();

      // Idle timeout: 30 days
      if (now - lastActivity > 30 * 24 * 60 * 60 * 1000) {
        await query("UPDATE sessions SET revoked = 1 WHERE id = $1", [decoded.sessionId]);
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session timed out due to inactivity" });
      }

      // Absolute timeout: 30 days
      if (now - createdAt > 30 * 24 * 60 * 60 * 1000) {
        await query("UPDATE sessions SET revoked = 1 WHERE id = $1", [decoded.sessionId]);
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session expired (30d limit)" });
      }

      req.user = decoded;
      
      // Update session activity
      await query("UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1", [decoded.sessionId]);
      next();
    } catch (e) {
      res.status(401).json({ error: "Authentication failed" });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.email !== 'driveserverhosting0944@gmail.com') return res.status(403).json({ error: "Admin access required" });
    next();
  };

  const isVerified = (req: any, res: any, next: any) => {
    if (req.user?.verification_status !== 'approved') return res.status(403).json({ error: "Account not verified" });
    next();
  };

  // API Routes
  app.get("/api/users/me", authenticate, async (req: any, res) => {
    const userRes = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const postsRes = await query("SELECT COUNT(*) as count FROM posts WHERE user_id = $1", [req.user.id]);
    const followersRes = await query("SELECT COUNT(*) as count FROM friendships WHERE receiver_id = $1", [req.user.id]);
    
    // Calculate reputation (100 - strikes * 10 - risk_score)
    const reputation = Math.max(0, 100 - (user.strikes * 10) - (user.risk_score || 0));

    res.json({
      ...user,
      stats: {
        posts: parseInt(postsRes.rows[0].count),
        followers: parseInt(followersRes.rows[0].count),
        reputation: reputation
      }
    });
  });

  app.get("/api/users/search", authenticate, async (req: any, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    
    const usersRes = await query(`
      SELECT id, display_name, username, avatar, role, verification_status 
      FROM users 
      WHERE (username LIKE $1 OR display_name LIKE $1) AND id != $2
      LIMIT 10
    `, [`%${q}%`, req.user.id]);
    
    res.json(usersRes.rows);
  });

  // Add comment
  app.post("/api/posts/:id/comments", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const commentId = `comment_${Math.random().toString(36).substr(2, 9)}`;
    await query("INSERT INTO comments (id, post_id, user_id, content) VALUES ($1, $2, $3, $4)", [commentId, id, req.user.id, content]);
    res.json({ success: true });
  });

  // Get comments
  app.get("/api/posts/:id/comments", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const commentsRes = await query("SELECT c.*, u.username, u.avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC", [id]);
    res.json(commentsRes.rows);
  });

  // Store management
  app.get("/api/admin/store", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const itemsRes = await query("SELECT * FROM store_items", []);
    res.json(itemsRes.rows);
  });

  app.post("/api/admin/store", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const { id, name, description, category, price, type } = req.body;
    await query("INSERT INTO store_items (id, name, description, category, price, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)", [id, name, description, category, price, type, '{}']);
    res.json({ success: true });
  });

  app.delete("/api/admin/store/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    await query("DELETE FROM store_items WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  });

  app.get("/api/users/:id", authenticate, async (req: any, res) => {
    const userRes = await query("SELECT id, display_name, username, avatar, cover, role, grade, level, verification_status, bio FROM users WHERE id = $1", [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(userRes.rows[0]);
  });

  // --- Conversations ---

  app.post("/api/users/unlock", authenticate, async (req: any, res) => {
    const { type } = req.body;
    const cost = type === 'pfp' ? 2000 : type === 'banner' ? 1500 : 0;
    
    if (cost === 0) return res.status(400).json({ error: "Invalid unlock type" });

    const userRes = await query("SELECT toins, unlock_custom_pfp, unlock_custom_banner FROM users WHERE id = $1", [req.user.id]);
    const user = userRes.rows[0];
    
    if (type === 'pfp' && user.unlock_custom_pfp) return res.status(400).json({ error: "Already unlocked" });
    if (type === 'banner' && user.unlock_custom_banner) return res.status(400).json({ error: "Already unlocked" });
    
    if (user.toins < cost) return res.status(400).json({ error: "Insufficient funds" });

    await query("BEGIN");
    try {
      await query("UPDATE users SET toins = toins - $1 WHERE id = $2", [cost, req.user.id]);
      if (type === 'pfp') await query("UPDATE users SET unlock_custom_pfp = 1 WHERE id = $1", [req.user.id]);
      if (type === 'banner') await query("UPDATE users SET unlock_custom_banner = 1 WHERE id = $1", [req.user.id]);
      
      await logAction(req.user.id, 'unlock_feature', type, `Unlocked custom ${type}`, req.ip);
      
      // Record transaction
      const txId = `tx_${Math.random().toString(36).substr(2, 9)}`;
      await query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)", [txId, req.user.id, -cost, 'spend', `Unlocked custom ${type}`]);
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }

    res.json({ success: true, toins: user.toins - cost });
  });

  app.patch("/api/users/me", authenticate, async (req: any, res) => {
    const { avatar, cover, bio } = req.body;
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (avatar !== undefined) {
      const userRes = await query("SELECT unlock_custom_pfp FROM users WHERE id = $1", [req.user.id]);
      if (!userRes.rows[0].unlock_custom_pfp) return res.status(403).json({ error: "Custom avatar locked" });
      updates.push(`avatar = $${paramCount++}`);
      params.push(avatar);
    }
    if (cover !== undefined) {
      const userRes = await query("SELECT unlock_custom_banner FROM users WHERE id = $1", [req.user.id]);
      if (!userRes.rows[0].unlock_custom_banner) return res.status(403).json({ error: "Custom banner locked" });
      updates.push(`cover = $${paramCount++}`);
      params.push(cover);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      params.push(bio);
    }
    
    if (updates.length === 0) return res.json({ success: true }); // Nothing to update

    params.push(req.user.id);
    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount}`, params);
    res.json({ success: true });
  });

  app.patch("/api/users/:id/username", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { username } = req.body;
    
    if (req.user.id !== id) return res.status(403).json({ error: "Unauthorized" });
    
    try {
      await query("UPDATE users SET username = $1, username_locked = 0 WHERE id = $2", [username, id]);
      await logAction(id, 'update_username', id, `Username set to ${username}`, req.ip);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    if (LOCKDOWN_MODE) return res.status(503).json({ error: "Registration currently disabled" });
    
    const { email, password, fullName, grade, section, house, answers } = req.body;
    const ip = req.ip || '0.0.0.0';
    
    if (!checkRateLimit(`signup_${ip}`, 5, 3600000)) {
      return res.status(429).json({ error: "Too many signup attempts" });
    }

    const id = `user_${Math.random().toString(36).substr(2, 9)}`;
    const tempUsername = `user_${Math.floor(Math.random() * 900000) + 100000}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    
    try {
      await query("BEGIN");
      await query(`
        INSERT INTO users (id, email, password_hash, display_name, username, grade, section, house, ip_address_signup, ip_address_last_login) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [id, email, passwordHash, fullName, tempUsername, grade, section, house, ip, ip]);
      
      await query("INSERT INTO verification_answers (user_id, question_1, question_2) VALUES ($1, $2, $3)", [id, answers.q1, answers.q2 || '']);
      await query("INSERT INTO ip_logs (user_id, ip_address, action_type) VALUES ($1, $2, $3)", [id, ip, 'signup']);
      
      // Auto-promote specific admin
      if (email === 'driveserverhosting0944@gmail.com') {
        await query("UPDATE users SET role = 'admin', verification_status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
      }

      await logAction(id, 'signup', id, 'Account created', ip);
      await query("COMMIT");
      
      res.json({ success: true, message: "Account created. Awaiting verification." });
    } catch (e) {
      await query("ROLLBACK");
      res.status(400).json({ error: "Email or username already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, deviceHash } = req.body;
    const ip = req.ip || '0.0.0.0';

    if (!checkRateLimit(`login_ip_${ip}`, 20, 3600000) || !checkRateLimit(`login_email_${email}`, 10, 3600000)) {
      return res.status(429).json({ error: "Too many login attempts" });
    }

    const userRes = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = userRes.rows[0];
    
    // Generic error to prevent enumeration
    const invalidCreds = () => res.status(401).json({ error: "Invalid credentials" });

    if (!user) {
      return invalidCreds();
    }

    // Check account lock
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return res.status(403).json({ error: "Account temporarily locked due to multiple failed attempts" });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);

    if (!isMatch) {
      const attempts = user.failed_login_attempts + 1;
      let lockUntil = null;
      if (attempts >= 10) {
        lockUntil = new Date(Date.now() + 86400000).toISOString(); // 24h
        await logSecurityEvent(user.id, 'ACCOUNT_LOCK_24H', ip, deviceHash, 50, "Max failed attempts reached");
      } else if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 900000).toISOString(); // 15m
        await logSecurityEvent(user.id, 'ACCOUNT_LOCK_15M', ip, deviceHash, 20, "5 failed attempts reached");
      }
      
      await query("UPDATE users SET failed_login_attempts = $1, account_locked_until = $2, last_failed_login_at = CURRENT_TIMESTAMP WHERE id = $3", [attempts, lockUntil, user.id]);
      
      return invalidCreds();
    }

    // Success - Reset failed attempts
    await query("UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, ip_address_last_login = $1 WHERE id = $2", [ip, user.id]);

    // Risk Scoring
    let riskScore = 0;
    const knownDeviceRes = await query("SELECT * FROM device_sessions WHERE user_id = $1 AND device_hash = $2", [user.id, deviceHash]);
    const knownDevice = knownDeviceRes.rows[0];
    if (!knownDevice) {
      riskScore += 20;
      await logSecurityEvent(user.id, 'NEW_DEVICE', ip, deviceHash, 20, "Login from unrecognized device");
    }

    const activeSessionsRes = await query("SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND revoked = 0", [user.id]);
    const activeSessions = parseInt(activeSessionsRes.rows[0].count);
    if (activeSessions >= 3) {
      // Expire oldest session
      await query("UPDATE sessions SET revoked = 1 WHERE id = (SELECT id FROM sessions WHERE user_id = $1 AND revoked = 0 ORDER BY created_at ASC LIMIT 1)", [user.id]);
    }

    // Create Session
    const sessionId = `sess_${Math.random().toString(36).substr(2, 9)}`;
    const accessToken = jwt.sign({ id: user.id, role: user.role, verification_status: user.verification_status, sessionId }, JWT_SECRET, { expiresIn: '30d' });
    const refreshToken = jwt.sign({ id: user.id, sessionId }, JWT_SECRET, { expiresIn: '30d' });

    await query(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at, ip_address, device_hash, user_agent) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sessionId, user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), ip, deviceHash, req.headers['user-agent']]);

    if (!knownDevice) {
      await query("INSERT INTO device_sessions (id, user_id, device_hash, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)",
        [`dev_${Math.random().toString(36).substr(2, 9)}`, user.id, deviceHash, ip, req.headers['user-agent']]);
    } else {
      await query("UPDATE device_sessions SET last_seen_at = CURRENT_TIMESTAMP, ip_address = $1 WHERE id = $2", [ip, knownDevice.id]);
    }

    const cookieOptions = { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, cookieOptions);

    await logAction(user.id, 'login', user.id, 'User logged in', ip);
    res.json(user);
  });

  app.post("/api/auth/logout", authenticate, async (req: any, res) => {
    await query("UPDATE sessions SET revoked = 1 WHERE id = $1", [req.user.sessionId]);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true });
  });

  // Existing Routes (Updated with Auth)
  app.get("/api/site/context", authenticate, async (req, res) => {
    const totalUsersRes = await query("SELECT COUNT(*) as count FROM users", []);
    const userSampleRes = await query("SELECT display_name, username FROM users LIMIT 50", []);
    res.json({ totalUsers: parseInt(totalUsersRes.rows[0].count), userSample: userSampleRes.rows });
  });

  app.get("/api/admin/stats", authenticate, isAdmin, async (req, res) => {
    const totalUsersRes = await query("SELECT COUNT(*) as count FROM users", []);
    const pendingVerificationsRes = await query("SELECT COUNT(*) as count FROM users WHERE verification_status = 'pending'", []);
    const activeTodayRes = await query("SELECT COUNT(DISTINCT user_id) as count FROM ip_logs WHERE timestamp > CURRENT_DATE", []);
    const flaggedAccountsRes = await query("SELECT COUNT(*) as count FROM users WHERE strikes > 0 OR is_flagged = 1", []);
    const lockedAccountsRes = await query("SELECT id, display_name, account_locked_until FROM users WHERE account_locked_until > CURRENT_TIMESTAMP", []);
    
    const stats = {
      totalUsers: parseInt(totalUsersRes.rows[0].count),
      pendingVerifications: parseInt(pendingVerificationsRes.rows[0].count),
      activeToday: parseInt(activeTodayRes.rows[0].count),
      flaggedAccounts: parseInt(flaggedAccountsRes.rows[0].count),
      lockedAccounts: lockedAccountsRes.rows,
      lockdown: LOCKDOWN_MODE
    };
    res.json(stats);
  });

  app.get("/api/admin/verification-queue", authenticate, isAdmin, async (req, res) => {
    const queueRes = await query(`
      SELECT u.*, va.question_1, va.question_2 
      FROM users u 
      JOIN verification_answers va ON u.id = va.user_id 
      WHERE u.verification_status = 'pending'
    `, []);
    res.json(queueRes.rows);
  });

  app.get("/api/admin/audit-logs", authenticate, isAdmin, async (req, res) => {
    const logsRes = await query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100", []);
    res.json(logsRes.rows);
  });

  app.get("/api/admin/ip-clusters", authenticate, isAdmin, async (req, res) => {
    const clustersRes = await query(`
      SELECT ip_address, COUNT(DISTINCT user_id) as user_count, GROUP_CONCAT(DISTINCT user_id) as user_ids 
      FROM ip_logs 
      GROUP BY ip_address 
      HAVING COUNT(DISTINCT user_id) > 1
    `, []);
    res.json(clustersRes.rows);
  });

  app.post("/api/admin/verify", authenticate, isAdmin, async (req: any, res) => {
    const { userId, status } = req.body;
    const verifiedAt = status === 'approved' ? new Date().toISOString() : null;
    await query("UPDATE users SET verification_status = $1, verified_at = $2, role = $3 WHERE id = $4", [status, verifiedAt, status === 'approved' ? 'student' : 'pending_student', userId]);
    await logAction(req.user.id, 'verify_user', userId, `Status set to ${status}`, req.ip);
    res.json({ success: true });
  });

  app.get("/api/admin/security/events", authenticate, isAdmin, async (req: any, res) => {
    const eventsRes = await query("SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50", []);
    res.json(eventsRes.rows);
  });

  app.post("/api/admin/security/lockdown", authenticate, isAdmin, async (req: any, res) => {
    const { enabled } = req.body;
    LOCKDOWN_MODE = !!enabled;
    await logAction(req.user.id, 'toggle_lockdown', 'system', `Lockdown mode set to ${LOCKDOWN_MODE}`, req.ip);
    res.json({ lockdown: LOCKDOWN_MODE });
  });

  app.get("/api/user/sessions", authenticate, async (req: any, res) => {
    const sessionsRes = await query("SELECT id, ip_address, user_agent, last_activity_at, revoked FROM sessions WHERE user_id = $1 AND revoked = 0 ORDER BY last_activity_at DESC", [req.user.id]);
    res.json(sessionsRes.rows);
  });

  app.post("/api/user/sessions/revoke", authenticate, async (req: any, res) => {
    const { sessionId } = req.body;
    await query("UPDATE sessions SET revoked = 1 WHERE id = $1 AND user_id = $2", [sessionId, req.user.id]);
    await logAction(req.user.id, 'revoke_session', sessionId, `User revoked session`, req.ip);
    res.json({ success: true });
  });

  // --- Feed & Posts API ---
  app.get("/api/posts", authenticate, async (req: any, res) => {
    // Algorithmic ranking: (engagement_score * 0.7) + (recency_decay * 0.3)
    // For simplicity, we'll just use a weighted sort in SQL
    const postsRes = await query(`
      SELECT p.*, u.display_name, u.username, u.avatar,
             (p.engagement_score * 100 + (1000000 / (CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', p.timestamp) AS INTEGER) + 1))) as rank_score
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.status = 'approved' 
      ORDER BY rank_score DESC LIMIT 50
    `, []);
    res.json(postsRes.rows);
  });

  app.post("/api/posts", authenticate, isVerified, async (req: any, res) => {
    if (LOCKDOWN_MODE && req.body.type === 'confession') return res.status(503).json({ error: "Confessions disabled in lockdown mode" });
    const { content, type, media_url, title, tags, voice_url } = req.body;
    const status = type === 'confession' ? 'pending' : 'approved';
    const id = `post_${Math.random().toString(36).substr(2, 9)}`;
    
    await query("INSERT INTO posts (user_id, content, type, status, media_url, title, tags, voice_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [req.user.id, content, type, status, media_url || null, title, tags, voice_url]);
    
    await updateBountyProgress(req.user.id, 'post_count');
    await logAction(req.user.id, 'create_post', id, `Created ${type} post`, req.ip);
    res.json({ id, status });
  });

  app.post("/api/posts/:id/like", authenticate, async (req: any, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    
    const existingLikeRes = await query("SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    if (existingLikeRes.rows.length > 0) {
      return res.status(400).json({ error: "Already liked" });
    }
    
    await query("INSERT INTO likes (user_id, post_id) VALUES ($1, $2)", [userId, postId]);
    await query("UPDATE posts SET engagement_score = engagement_score + 0.1 WHERE id = $1", [postId]);
    await updateBountyProgress(userId, 'like_count');
    res.json({ success: true });
  });

  // Post Management & Reporting
  app.delete("/api/posts/:id", authenticate, async (req: any, res) => {
    const postId = parseInt(req.params.id);
    const postRes = await query("SELECT user_id FROM posts WHERE id = $1", [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    
    if (postRes.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    await query("DELETE FROM posts WHERE id = $1", [postId]);
    await logAction(req.user.id, 'delete_post', postId.toString(), `Deleted post ${postId}`, req.ip);
    res.json({ success: true });
  });

  app.patch("/api/posts/:id", authenticate, async (req: any, res) => {
    const postId = parseInt(req.params.id);
    const { content, media_url, voice_url } = req.body;
    
    const postRes = await query("SELECT * FROM posts WHERE id = $1", [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    
    if (postRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    // Save history
    await query("INSERT INTO post_edits (post_id, content, media_url, voice_url) VALUES ($1, $2, $3, $4)",
      [postId, postRes.rows[0].content, postRes.rows[0].media_url, postRes.rows[0].voice_url]);
      
    await query("UPDATE posts SET content = $1, media_url = $2, voice_url = $3, is_edited = 1 WHERE id = $4",
      [content, media_url || null, voice_url || null, postId]);
      
    await logAction(req.user.id, 'edit_post', postId.toString(), `Edited post ${postId}`, req.ip);
    res.json({ success: true });
  });

  app.get("/api/posts/:id/history", authenticate, async (req: any, res) => {
    const postId = parseInt(req.params.id);
    const historyRes = await query("SELECT * FROM post_edits WHERE post_id = $1 ORDER BY created_at DESC", [postId]);
    res.json(historyRes.rows);
  });

  app.post("/api/posts/:id/report", authenticate, async (req: any, res) => {
    const postId = req.params.id;
    const { reason } = req.body;
    
    await query("INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)",
      [req.user.id, 'post', postId, reason]);
      
    await logAction(req.user.id, 'report_post', postId, `Reported post ${postId} for: ${reason}`, req.ip);
    res.json({ success: true });
  });

  // Bounties
  app.get("/api/bounties/daily", authenticate, async (req: any, res) => {
    const bountyRes = await query("SELECT * FROM bounties ORDER BY created_at DESC LIMIT 1");
    if (bountyRes.rows.length === 0) return res.json(null);
    
    const bounty = bountyRes.rows[0];
    const userBountyRes = await query("SELECT * FROM user_bounties WHERE user_id = $1 AND bounty_id = $2", [req.user.id, bounty.id]);
    
    res.json({
      ...bounty,
      progress: userBountyRes.rows[0]?.progress || 0,
      completed_at: userBountyRes.rows[0]?.completed_at || null,
      claimed: userBountyRes.rows[0]?.claimed || 0
    });
  });

  app.post("/api/bounties/claim", authenticate, async (req: any, res) => {
    const { bounty_id } = req.body;
    const userBountyRes = await query("SELECT * FROM user_bounties WHERE user_id = $1 AND bounty_id = $2", [req.user.id, bounty_id]);
    
    if (userBountyRes.rows.length === 0 || !userBountyRes.rows[0].completed_at || userBountyRes.rows[0].claimed) {
      return res.status(400).json({ error: "Bounty not ready to claim" });
    }
    
    const bountyRes = await query("SELECT * FROM bounties WHERE id = $1", [bounty_id]);
    const bounty = bountyRes.rows[0];
    
    await query("UPDATE user_bounties SET claimed = 1 WHERE user_id = $1 AND bounty_id = $2", [req.user.id, bounty_id]);
    await query("UPDATE users SET xp = xp + $1, toins = toins + $2 WHERE id = $3", [bounty.reward_xp, bounty.reward_toins, req.user.id]);
    
    await logAction(req.user.id, 'claim_bounty', bounty_id, `Claimed bounty ${bounty_id}`, req.ip);
    res.json({ success: true, reward_xp: bounty.reward_xp, reward_toins: bounty.reward_toins });
  });

  // Admin Reports
  app.get("/api/admin/reports", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const reportsRes = await query(`
      SELECT r.*, u.username as reporter_username, p.content as post_content, p.user_id as post_author_id
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN posts p ON r.target_id = CAST(p.id AS TEXT) AND r.target_type = 'post'
      ORDER BY r.created_at DESC
    `);
    res.json(reportsRes.rows);
  });

  app.post("/api/admin/reports/:id/resolve", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });
    const { status } = req.body; // 'resolved', 'dismissed'
    await query("UPDATE reports SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true });
  });

  app.post("/api/upload", authenticate, upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const url = `data:${mimeType};base64,${base64}`;
    res.json({ url });
  });

  // --- Messaging API ---
  
  // Create Conversation (DM, Group, or AI)
  app.post("/api/conversations", authenticate, async (req: any, res) => {
    const { type, name, participantIds = [] } = req.body; // type: 'private' | 'group' | 'ai'
    const id = `conv_${Math.random().toString(36).substr(2, 9)}`;
    
    if (type === 'private' && participantIds.length > 0) {
      // Check if DM already exists
      const existingRes = await query(`
        SELECT c.id FROM conversations c
        JOIN conversation_members m1 ON c.id = m1.conversation_id
        JOIN conversation_members m2 ON c.id = m2.conversation_id
        WHERE c.type = 'private' AND m1.user_id = $1 AND m2.user_id = $2
      `, [req.user.id, participantIds[0]]);
      
      if (existingRes.rows.length > 0) return res.json({ id: existingRes.rows[0].id });
    }

    await query("BEGIN");
    try {
      await query("INSERT INTO conversations (id, type, name, created_by) VALUES ($1, $2, $3, $4)", [id, type, name || (type === 'ai' ? 'New Chat' : null), req.user.id]);
      
      // Add creator
      await query("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin')", [id, req.user.id]);
      
      if (type === 'ai') {
        // AI chats don't have other participants, just the user
      } else {
        // Add participants
        if (Array.isArray(participantIds)) {
          for (const pid of participantIds) {
            await query("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')", [id, pid]);
          }
        }
      }
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }
    
    res.json({ id });
  });

  // Delete Conversation
  app.delete("/api/conversations/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    
    // Verify ownership or admin status
    const conversationRes = await query("SELECT created_by, type FROM conversations WHERE id = $1", [id]);
    if (conversationRes.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
    const conversation = conversationRes.rows[0];
    
    if (conversation.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await query("BEGIN");
    try {
      await query("DELETE FROM messages WHERE conversation_id = $1", [id]);
      await query("DELETE FROM conversation_members WHERE conversation_id = $1", [id]);
      await query("DELETE FROM conversations WHERE id = $1", [id]);
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }
    
    res.json({ success: true });
  });

  // Rename Conversation
  app.patch("/api/conversations/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    // Verify ownership
    const conversationRes = await query("SELECT created_by FROM conversations WHERE id = $1", [id]);
    if (conversationRes.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
    const conversation = conversationRes.rows[0];
    
    if (conversation.created_by !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await query("UPDATE conversations SET name = $1 WHERE id = $2", [name, id]);
    res.json({ success: true });
  });

  // Export Conversation Context
  app.get("/api/conversations/:id/export", authenticate, async (req: any, res) => {
    const { id } = req.params;
    
    // Verify membership
    const memberRes = await query("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [id, req.user.id]);
    if (memberRes.rows.length === 0) return res.status(403).json({ error: "Not a member" });

    const messagesRes = await query(`
      SELECT m.content, m.created_at, u.display_name as sender_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [id]);

    const exportText = messagesRes.rows.map((m: any) => 
      `[${m.created_at}] ${m.sender_name || 'AI'}: ${m.content}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="chat_export_${id}.txt"`);
    res.send(exportText);
  });

  // Get Conversations
  app.get("/api/conversations", authenticate, async (req: any, res) => {
    const convsRes = await query(`
      SELECT c.*, 
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT content_type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
             (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at_real
      FROM conversations c
      JOIN conversation_members m ON c.id = m.conversation_id
      WHERE m.user_id = $1
      ORDER BY COALESCE(last_message_at_real, c.created_at) DESC
    `, [req.user.id]);

    const detailedConvs = await Promise.all(convsRes.rows.map(async (c: any) => {
      if (c.type === 'private') {
        const otherMemberRes = await query("SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2", [c.id, req.user.id]);
        if (otherMemberRes.rows.length > 0) {
          const otherUserRes = await query("SELECT id, display_name, avatar FROM users WHERE id = $1", [otherMemberRes.rows[0].user_id]);
          const otherUser = otherUserRes.rows[0];
          return {
            ...c,
            name: otherUser?.display_name || 'Unknown User',
            avatar: otherUser?.avatar,
            other_user_id: otherMemberRes.rows[0].user_id
          };
        }
      } else if (c.type === 'ai') {
        return {
          ...c,
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + c.id, // AI Avatar
          is_ai: true
        };
      }
      return c;
    }));

    res.json(detailedConvs);
  });

  // Get Messages
  app.get("/api/conversations/:id/messages", authenticate, async (req: any, res) => {
    // Verify membership
    const memberRes = await query("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (memberRes.rows.length === 0) return res.status(403).json({ error: "Not a member" });

    const messagesRes = await query(`
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar 
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [req.params.id]);
    res.json(messagesRes.rows);
  });

  // Send Message (Updated for AI)
  app.post("/api/conversations/:id/messages", authenticate, async (req: any, res) => {
    const { content, content_type, reply_to_id } = req.body;
    const id = `msg_${Math.random().toString(36).substr(2, 9)}`;
    const conversationId = req.params.id;
    
    // Verify membership
    const memberRes = await query("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [conversationId, req.user.id]);
    if (memberRes.rows.length === 0) return res.status(403).json({ error: "Not a member" });

    // Check conversation type
    const conversationRes = await query("SELECT type FROM conversations WHERE id = $1", [conversationId]);
    const conversation = conversationRes.rows[0];

    await query("BEGIN");
    try {
      await query(`
        INSERT INTO messages (id, conversation_id, sender_id, content, content_type, reply_to_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, conversationId, req.user.id, content, content_type || 'text', reply_to_id]);

      await query("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [conversationId]);
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }

    const msgRes = await query(`
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1
    `, [id]);
    const msg = msgRes.rows[0];

    io.to(conversationId).emit('new_message', msg);
    
    // If AI chat, trigger response
    if (conversation.type === 'ai') {
      // Fetch context (last 20 messages)
      const historyRes = await query(`
        SELECT content, sender_id 
        FROM messages 
        WHERE conversation_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20
      `, [conversationId]);
      const history = historyRes.rows.reverse();

      const formattedHistory = history.map((h: any) => ({
        role: h.sender_id === req.user.id ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));
      
      try {
        // Use the new SDK method
        const chat = getAi().chats.create({
          model: "gemini-2.5-flash-latest",
          history: formattedHistory.slice(0, -1), // All except last
          config: {
            maxOutputTokens: 500,
          },
        });

        const result = await chat.sendMessage({ message: content });
        const responseText = result.text;

        if (responseText) {
          const aiMsgId = `msg_${Math.random().toString(36).substr(2, 9)}`;
          
          await query("BEGIN");
          try {
            await query(`
              INSERT INTO messages (id, conversation_id, sender_id, content, content_type)
              VALUES ($1, $2, $3, $4, $5)
            `, [aiMsgId, conversationId, 'ai_system', responseText, 'text']);
            
            await query("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [conversationId]);
            await query("COMMIT");
          } catch (e) {
            await query("ROLLBACK");
            throw e;
          }

          const aiMsg = {
            id: aiMsgId,
            conversation_id: conversationId,
            sender_id: 'ai_system',
            sender_name: 'AI Assistant',
            sender_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + conversationId,
            content: responseText,
            content_type: 'text',
            created_at: new Date().toISOString()
          };

          io.to(conversationId).emit('new_message', aiMsg);
        }

      } catch (error) {
        console.error("AI Error:", error);
      }
    }

    res.json(msg);
  });

  // --- Stories API ---
  app.get("/api/stories", authenticate, async (req: any, res) => {
    const now = new Date().toISOString();
    const storiesRes = await query(`
      SELECT s.*, u.display_name, u.username, u.avatar 
      FROM stories s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.expires_at > $1 
      ORDER BY s.created_at DESC
    `, [now]);
    res.json(storiesRes.rows);
  });

  app.post("/api/stories", authenticate, isVerified, async (req: any, res) => {
    const { media_url, text_overlay, visibility, title, tags } = req.body;
    const id = `story_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await query("INSERT INTO stories (id, user_id, media_url, text_overlay, expires_at, visibility, title, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, req.user.id, media_url, text_overlay, expiresAt, visibility || 'public', title, tags]);
    
    res.json({ id });
  });

  // --- Marketplace API ---
  app.get("/api/marketplace/listings", authenticate, async (req, res) => {
    const listingsRes = await query(`
      SELECT l.*, u.display_name, u.username, u.avatar 
      FROM listings l 
      JOIN users u ON l.seller_id = u.id 
      WHERE l.status = 'active' 
      ORDER BY l.created_at DESC
    `, []);
    res.json(listingsRes.rows);
  });

  app.post("/api/marketplace/listings", authenticate, isVerified, async (req: any, res) => {
    const { title, description, category, price } = req.body;
    const id = `list_${Math.random().toString(36).substr(2, 9)}`;
    
    await query("INSERT INTO listings (id, seller_id, title, description, category, price) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, req.user.id, title, description, category, price]);
    
    res.json({ id });
  });

  // --- Academic API ---
  app.get("/api/academic/materials", authenticate, async (req: any, res) => {
    const { grade, section, type } = req.query;
    let queryStr = "SELECT * FROM academic_materials WHERE 1=1";
    const params = [];
    let paramCount = 1;
    if (grade) { queryStr += ` AND grade = $${paramCount++}`; params.push(grade); }
    if (section) { queryStr += ` AND section = $${paramCount++}`; params.push(section); }
    if (type) { queryStr += ` AND type = $${paramCount++}`; params.push(type); }
    queryStr += " ORDER BY created_at DESC";
    const materialsRes = await query(queryStr, params);
    res.json(materialsRes.rows);
  });

  app.post("/api/academic/materials", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const { type, title, content, grade, section, subject, due_date } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    await query(`
      INSERT INTO academic_materials (id, type, title, content, grade, section, subject, due_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, type, title, content, grade, section, subject, due_date, req.user.id]);
    await logAction(req.user.id, 'upload_material', id, `Uploaded ${type}: ${title}`, req.ip);
    res.json({ success: true, id });
  });

  app.get("/api/academic/queries", authenticate, async (req: any, res) => {
    const queriesRes = await query(`
      SELECT q.*, u.display_name, u.username, u.avatar 
      FROM discussion_queries q
      JOIN users u ON q.user_id = u.id
      ORDER BY q.created_at DESC
    `, []);
    res.json(queriesRes.rows);
  });

  app.post("/api/academic/queries", authenticate, async (req: any, res) => {
    const { subject, query: queryText } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    await query("INSERT INTO discussion_queries (id, user_id, subject, query) VALUES ($1, $2, $3, $4)", [id, req.user.id, subject, queryText]);
    res.json({ success: true, id });
  });

  // --- Social Graph API ---
  app.get("/api/friendships", authenticate, async (req: any, res) => {
    const friendsRes = await query(`
      SELECT f.*, u.display_name, u.username, u.avatar, u.id as user_id
      FROM friendships f
      JOIN users u ON (f.requester_id = u.id OR f.receiver_id = u.id)
      WHERE (f.requester_id = $1 OR f.receiver_id = $2) AND u.id != $3
    `, [req.user.id, req.user.id, req.user.id]);
    res.json(friendsRes.rows);
  });

  app.post("/api/friendships", authenticate, async (req: any, res) => {
    const { receiverId } = req.body;
    await query("INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2)", [req.user.id, receiverId]);
    res.json({ success: true });
  });

  // --- Economy API ---
  app.get("/api/economy/balance", authenticate, async (req: any, res) => {
    const userRes = await query("SELECT toins FROM users WHERE id = $1", [req.user.id]);
    res.json({ balance: userRes.rows[0].toins });
  });

  app.get("/api/economy/transactions", authenticate, async (req: any, res) => {
    const txsRes = await query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50", [req.user.id]);
    res.json(txsRes.rows);
  });

  // --- Store API ---
  app.get("/api/store/items", authenticate, async (req, res) => {
    const itemsRes = await query("SELECT * FROM store_items ORDER BY category, price", []);
    res.json(itemsRes.rows);
  });

  app.get("/api/store/inventory", authenticate, async (req: any, res) => {
    const inventoryRes = await query(`
      SELECT i.*, s.name, s.category, s.metadata
      FROM user_inventory i
      JOIN store_items s ON i.item_id = s.id
      WHERE i.user_id = $1
    `, [req.user.id]);
    res.json(inventoryRes.rows);
  });

  app.post("/api/store/purchase", authenticate, async (req: any, res) => {
    const { itemId } = req.body;
    const itemRes = await query("SELECT * FROM store_items WHERE id = $1", [itemId]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: "Item not found" });
    const item = itemRes.rows[0];

    const userRes = await query("SELECT toins FROM users WHERE id = $1", [req.user.id]);
    if (userRes.rows[0].toins < item.price) return res.status(400).json({ error: "Insufficient Toins" });

    const alreadyOwnedRes = await query("SELECT 1 FROM user_inventory WHERE user_id = $1 AND item_id = $2", [req.user.id, itemId]);
    if (alreadyOwnedRes.rows.length > 0) return res.status(400).json({ error: "Item already owned" });

    await query("BEGIN");
    try {
      await query("UPDATE users SET toins = toins - $1 WHERE id = $2", [item.price, req.user.id]);
      await query("INSERT INTO user_inventory (user_id, item_id) VALUES ($1, $2)", [req.user.id, itemId]);
      await query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)",
        [`tx_${Math.random().toString(36).substr(2, 9)}`, req.user.id, -item.price, 'spend', `Purchased ${item.name}`]);
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }

    res.json({ success: true });
  });

  app.post("/api/store/activate", authenticate, async (req: any, res) => {
    const { itemId } = req.body;
    const itemRes = await query(`
      SELECT i.*, s.category 
      FROM user_inventory i 
      JOIN store_items s ON i.item_id = s.id 
      WHERE i.user_id = $1 AND i.item_id = $2
    `, [req.user.id, itemId]);
    
    if (itemRes.rows.length === 0) return res.status(404).json({ error: "Item not owned" });
    const item = itemRes.rows[0];

    await query("BEGIN");
    try {
      // Deactivate others in same category
      const othersRes = await query(`
        SELECT item_id FROM user_inventory i
        JOIN store_items s ON i.item_id = s.id
        WHERE i.user_id = $1 AND s.category = $2
      `, [req.user.id, item.category]);
      
      for (const other of othersRes.rows) {
        await query("UPDATE user_inventory SET is_active = 0 WHERE user_id = $1 AND item_id = $2", [req.user.id, other.item_id]);
      }

      await query("UPDATE user_inventory SET is_active = 1 WHERE user_id = $1 AND item_id = $2", [req.user.id, itemId]);
      
      // Update user profile
      const columnMap: any = {
        'frame': 'active_frame',
        'effect': 'active_username_effect',
        'theme': 'active_profile_theme',
        'chat': 'active_chat_bubble'
      };
      
      if (columnMap[item.category]) {
        await query(`UPDATE users SET ${columnMap[item.category]} = $1 WHERE id = $2`, [itemId, req.user.id]);
      }
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK");
      throw e;
    }

    res.json({ success: true });
  });

  // --- Redeem API ---
  app.post("/api/redeem", authenticate, async (req: any, res) => {
    const { code } = req.body;
    const redeemRes = await query("SELECT * FROM redeem_codes WHERE code = $1", [code]);
    
    if (redeemRes.rows.length === 0) return res.status(404).json({ error: "Invalid code" });
    const redeem = redeemRes.rows[0];
    if (redeem.current_uses >= redeem.max_uses) return res.status(400).json({ error: "Code fully used" });
    if (redeem.expires_at && new Date(redeem.expires_at) < new Date()) return res.status(400).json({ error: "Code expired" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE redeem_codes SET current_uses = current_uses + 1 WHERE code = $1", [code]);
      
      if (redeem.reward_type === 'toins') {
        const amount = parseInt(redeem.reward_value);
        await client.query("UPDATE users SET toins = toins + $1 WHERE id = $2", [amount, req.user.id]);
        await client.query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)",
          [`tx_${Math.random().toString(36).substr(2, 9)}`, req.user.id, amount, 'earn', `Redeemed code: ${code}`]);
      } else if (redeem.reward_type === 'item') {
        await client.query("INSERT INTO user_inventory (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [req.user.id, redeem.reward_value]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, reward_type: redeem.reward_type, reward_value: redeem.reward_value });
  });

  // --- Tasks API ---
  app.get("/api/tasks", authenticate, async (req, res) => {
    const tasksRes = await query(`
      SELECT t.*, u.display_name as creator_name 
      FROM tasks t 
      JOIN users u ON t.creator_id = u.id 
      WHERE t.status = 'active'
      ORDER BY t.created_at DESC
    `);
    res.json(tasksRes.rows);
  });

  app.post("/api/tasks", authenticate, isVerified, async (req: any, res) => {
    const { title, description, reward, deadline, proof_requirement } = req.body;
    const id = `task_${Math.random().toString(36).substr(2, 9)}`;
    
    const userRes = await query("SELECT toins FROM users WHERE id = $1", [req.user.id]);
    const user = userRes.rows[0];
    if (user.toins < reward) return res.status(400).json({ error: "Insufficient Toins for reward escrow" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE users SET toins = toins - $1 WHERE id = $2", [reward, req.user.id]);
      await client.query("INSERT INTO tasks (id, creator_id, title, description, reward, deadline, proof_requirement) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, req.user.id, title, description, reward, deadline, proof_requirement]);
      await client.query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)",
        [`tx_${Math.random().toString(36).substr(2, 9)}`, req.user.id, -reward, 'spend', `Created task: ${title} (Escrow)`]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ id });
  });

  app.post("/api/tasks/:id/submit", authenticate, isVerified, async (req: any, res) => {
    const { proof_text, proof_media } = req.body;
    const taskId = req.params.id;
    const id = `sub_${Math.random().toString(36).substr(2, 9)}`;
    
    await query("INSERT INTO task_submissions (id, task_id, user_id, proof_text, proof_media) VALUES ($1, $2, $3, $4, $5)",
      [id, taskId, req.user.id, proof_text, proof_media]);
    
    res.json({ id });
  });

  // --- Challenges API ---
  app.get("/api/challenges", authenticate, async (req: any, res) => {
    const challengesRes = await query(`
      SELECT c.*, u1.display_name as challenger_name, u2.display_name as target_name
      FROM challenges c
      JOIN users u1 ON c.challenger_id = u1.id
      JOIN users u2 ON c.target_id = u2.id
      WHERE c.challenger_id = $1 OR c.target_id = $2
      ORDER BY c.created_at DESC
    `, [req.user.id, req.user.id]);
    res.json(challengesRes.rows);
  });

  app.post("/api/challenges", authenticate, isVerified, async (req: any, res) => {
    const { targetId, title, description, stakes, deadline } = req.body;
    const id = `chal_${Math.random().toString(36).substr(2, 9)}`;
    
    const userRes = await query("SELECT toins FROM users WHERE id = $1", [req.user.id]);
    const user = userRes.rows[0];
    if (user.toins < stakes) return res.status(400).json({ error: "Insufficient Toins for stakes" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE users SET toins = toins - $1 WHERE id = $2", [stakes, req.user.id]);
      await client.query("INSERT INTO challenges (id, challenger_id, target_id, title, description, stakes, deadline) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, req.user.id, targetId, title, description, stakes, deadline]);
      await client.query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)",
        [`tx_${Math.random().toString(36).substr(2, 9)}`, req.user.id, -stakes, 'spend', `Challenged user: ${targetId} (Stakes)`]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ id });
  });

  // --- Tickets API ---
  app.get("/api/tickets", authenticate, async (req: any, res) => {
    const ticketsRes = await query("SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
    res.json(ticketsRes.rows);
  });

  app.post("/api/tickets", authenticate, async (req: any, res) => {
    const { category, content } = req.body;
    const id = `tick_${Math.random().toString(36).substr(2, 9)}`;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO tickets (id, user_id, category) VALUES ($1, $2, $3)", [id, req.user.id, category]);
      await client.query("INSERT INTO ticket_messages (id, ticket_id, sender_id, content) VALUES ($1, $2, $3, $4)",
        [`tm_${Math.random().toString(36).substr(2, 9)}`, id, req.user.id, content]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ id });
  });

  // --- AI History API ---
  app.get("/api/ai/history", authenticate, async (req: any, res) => {
    const historyRes = await query("SELECT role, content FROM ai_chat_history WHERE user_id = $1 ORDER BY timestamp ASC LIMIT 50", [req.user.id]);
    res.json(historyRes.rows);
  });

  app.post("/api/ai/chat", authenticate, async (req: any, res) => {
    const { role, content } = req.body;
    await query("INSERT INTO ai_chat_history (user_id, role, content) VALUES ($1, $2, $3)", [req.user.id, role, content]);
    res.json({ success: true });
  });

  // --- Admin Expansion API ---
  app.get("/api/admin/tickets", authenticate, isAdmin, async (req, res) => {
    const ticketsRes = await query(`
      SELECT t.*, u.display_name, u.username 
      FROM tickets t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC
    `);
    res.json(ticketsRes.rows);
  });

  app.get("/api/admin/tasks/submissions", authenticate, isAdmin, async (req, res) => {
    const subsRes = await query(`
      SELECT s.*, t.title as task_title, u.display_name, u.username
      FROM task_submissions s
      JOIN tasks t ON s.task_id = t.id
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'pending'
    `);
    res.json(subsRes.rows);
  });

  app.post("/api/admin/tasks/verify", authenticate, isAdmin, async (req: any, res) => {
    const { submissionId, status, feedback } = req.body;
    const subRes = await query("SELECT * FROM task_submissions WHERE id = $1", [submissionId]);
    if (subRes.rows.length === 0) return res.status(404).json({ error: "Submission not found" });
    const sub = subRes.rows[0];

    const taskRes = await query("SELECT * FROM tasks WHERE id = $1", [sub.task_id]);
    const task = taskRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE task_submissions SET status = $1, admin_feedback = $2 WHERE id = $3", [status, feedback, submissionId]);
      
      if (status === 'approved') {
        await client.query("UPDATE users SET toins = toins + $1 WHERE id = $2", [task.reward, sub.user_id]);
        await client.query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)",
          [`tx_${Math.random().toString(36).substr(2, 9)}`, sub.user_id, task.reward, 'earn', `Task approved: ${task.title}`]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true });
  });

  app.post("/api/admin/redeem", authenticate, isAdmin, async (req: any, res) => {
    const { code, reward_type, reward_value, max_uses, hint, is_treasure_hunt } = req.body;
    await query("INSERT INTO redeem_codes (code, reward_type, reward_value, max_uses, hint, is_treasure_hunt, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [code, reward_type, reward_value, max_uses, hint, is_treasure_hunt ? 1 : 0, req.user.id]);
    res.json({ success: true });
  });

  // --- Leaderboard API ---
  app.get("/api/leaderboard", authenticate, async (req, res) => {
    const leaderboardRes = await query(`
      SELECT id, display_name, username, avatar, toins, xp, level
      FROM users
      ORDER BY toins DESC, xp DESC
      LIMIT 100
    `);
    res.json(leaderboardRes.rows);
  });

  app.get("/api/economy/transactions", authenticate, async (req: any, res) => {
    const txsRes = await query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC", [req.user.id]);
    res.json(txsRes.rows);
  });

  // --- Notifications API ---
  app.get("/api/notifications", authenticate, async (req: any, res) => {
    const notesRes = await query(`
      SELECT n.*, u.display_name as actor_name, u.avatar as actor_avatar 
      FROM notifications n 
      LEFT JOIN users u ON n.actor_id = u.id 
      WHERE n.user_id = $1 
      ORDER BY n.timestamp DESC LIMIT 50
    `, [req.user.id]);
    res.json(notesRes.rows);
  });

  // Socket.io logic
  const onlineUsers = new Map<string, string>(); // userId -> socketId

  io.on("connection", (socket: any) => {
    socket.on("authenticate", (userId: string) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      io.emit("user-presence", { userId, status: 'online' });
    });

    socket.on("join-conversation", (convId: string) => {
      socket.join(convId);
    });

    socket.on("send-message", async (data: any) => {
      const { conversationId, content, contentType, replyToId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const userRes = await query("SELECT verification_status FROM users WHERE id = $1", [userId]);
      if (userRes.rows.length === 0 || userRes.rows[0].verification_status !== 'approved') return;

      const id = `msg_${Math.random().toString(36).substr(2, 9)}`;
      await query(`
        INSERT INTO messages (id, conversation_id, sender_id, content, content_type, reply_to_id) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, conversationId, userId, content, contentType || 'text', replyToId || null]);

      const message = {
        id,
        conversation_id: conversationId,
        sender_id: userId,
        content,
        content_type: contentType || 'text',
        created_at: new Date().toISOString(),
        reply_to_id: replyToId || null
      };

      io.to(conversationId).emit("new-message", message);
      
      // Update conversation last activity
      await query("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [conversationId]);
    });

    socket.on("message-read", async (data: any) => {
      const { messageId, conversationId } = data;
      const userId = socket.userId;
      if (!userId) return;
      
      try {
        await query("INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2)", [messageId, userId]);
        socket.to(conversationId).emit("message-read", { messageId, userId });
      } catch (e) {
        // Ignore duplicate reads
      }
    });

    socket.on("typing", (data: any) => {
      const { conversationId, isTyping } = data;
      socket.to(conversationId).emit("user-typing", { userId: socket.userId, isTyping });
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit("user-presence", { userId: socket.userId, status: 'offline' });
      }
    });
  });

  app.post("/api/challenges", authenticate, async (req: any, res) => {
    const { title, description, stakes, targetId, deadline } = req.body;
    
    // Check if user has enough toins
    if (req.user.toins < stakes) {
      return res.status(400).json({ error: "Insufficient funds for stakes" });
    }

    const id = `chal_${Math.random().toString(36).substr(2, 9)}`;
    await query(`
      INSERT INTO challenges (id, challenger_id, target_id, title, description, stakes, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, req.user.id, targetId, title, description, stakes, deadline]);

    // Deduct stakes from challenger immediately (escrow)
    await query("UPDATE users SET toins = toins - $1 WHERE id = $2", [stakes, req.user.id]);

    res.json({ success: true, id });
  });

  // --- Vault / Marketplace API ---
  app.get("/api/vault/listings", authenticate, async (req, res) => {
    const listingsRes = await query(`
      SELECT l.*, u.display_name as seller_name, u.username as seller_username, u.avatar as seller_avatar
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.status = 'active'
      ORDER BY l.created_at DESC
    `);
    res.json(listingsRes.rows);
  });

  app.post("/api/vault/listings", authenticate, async (req: any, res) => {
    const { title, description, category, price } = req.body;
    const id = `list_${Math.random().toString(36).substr(2, 9)}`;
    
    await query(`
      INSERT INTO listings (id, seller_id, title, description, category, price)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, req.user.id, title, description, category, price]);
    
    res.json({ success: true, id });
  });

  app.post("/api/vault/buy", authenticate, async (req: any, res) => {
    const { listingId } = req.body;
    const listingRes = await query("SELECT * FROM listings WHERE id = $1 AND status = 'active'", [listingId]);
    
    if (listingRes.rows.length === 0) return res.status(404).json({ error: "Listing not found or sold" });
    const listing = listingRes.rows[0];
    if (listing.seller_id === req.user.id) return res.status(400).json({ error: "Cannot buy your own item" });
    
    const userRes = await query("SELECT toins FROM users WHERE id = $1", [req.user.id]);
    const user = userRes.rows[0];
    if (user.toins < listing.price) return res.status(400).json({ error: "Insufficient funds" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Deduct from buyer
      await client.query("UPDATE users SET toins = toins - $1 WHERE id = $2", [listing.price, req.user.id]);
      // Add to seller
      await client.query("UPDATE users SET toins = toins + $1 WHERE id = $2", [listing.price, listing.seller_id]);
      // Mark as sold
      await client.query("UPDATE listings SET status = 'sold' WHERE id = $1", [listingId]);
      // Record transaction
      const txId = `tx_${Math.random().toString(36).substr(2, 9)}`;
      await client.query("INSERT INTO transactions (id, user_id, amount, type, reason) VALUES ($1, $2, $3, $4, $5)", [txId, req.user.id, -listing.price, 'spend', `Bought ${listing.title}`]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: "Transaction failed", details: e.message });
    } finally {
      client.release();
    }
  });

  // API 404 Handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.originalUrl} not found` });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err);
    if (req.path.startsWith('/api')) {
      return res.status(500).json({ error: "Internal server error", details: err.message });
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (error) {
    console.error("CRITICAL: Server failed to start:", error);
    process.exit(1);
  }
}

startServer();
