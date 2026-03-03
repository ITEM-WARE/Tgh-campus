import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("campus.db");
const JWT_SECRET = process.env.JWT_SECRET || "cyber-luxury-secret-key-2026";

// Initialize Database with advanced security schema
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    strikes INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until DATETIME,
    last_failed_login_at DATETIME,
    risk_score INTEGER DEFAULT 0,
    is_flagged INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    user_id TEXT PRIMARY KEY,
    otp_hash TEXT,
    expires_at DATETIME,
    attempt_count INTEGER DEFAULT 0,
    last_resend_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS device_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    device_hash TEXT,
    ip_address TEXT,
    user_agent TEXT,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    risk_score INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    refresh_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action_type TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    content TEXT,
    media_url TEXT,
    type TEXT DEFAULT 'public',
    status TEXT DEFAULT 'approved',
    engagement_score REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    campus_id TEXT DEFAULT 'main'
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'private', -- 'private', 'group', 'section', 'broadcast'
    name TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    campus_id TEXT DEFAULT 'main'
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member', -- 'member', 'admin'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS academic_materials (
    id TEXT PRIMARY KEY,
    type TEXT, -- 'homework', 'classwork', 'note', 'schedule'
    title TEXT,
    content TEXT,
    grade TEXT,
    section TEXT,
    subject TEXT,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS discussion_queries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    subject TEXT,
    query TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Drop and recreate messages to match new spec
  DROP TABLE IF EXISTS messages;
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    sender_id TEXT,
    content TEXT,
    content_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'poll', 'system'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    deleted_at DATETIME,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    visibility TEXT DEFAULT 'public', -- 'public', 'close_friends'
    view_count INTEGER DEFAULT 0,
    campus_id TEXT DEFAULT 'main'
  );

  CREATE TABLE IF NOT EXISTS story_views (
    story_id TEXT,
    viewer_id TEXT,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, viewer_id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    requester_id TEXT,
    receiver_id TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    status TEXT DEFAULT 'active', -- 'active', 'sold', 'removed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    campus_id TEXT DEFAULT 'main'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    amount INTEGER,
    type TEXT, -- 'earn', 'spend'
    reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    type TEXT,
    actor_id TEXT,
    target_id TEXT,
    content TEXT,
    is_read INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_themes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    config TEXT, -- JSON string of palette, fonts, etc.
    is_active INTEGER DEFAULT 0
  );
`);

// Migration: Ensure all columns exist in users table
const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
const columnNames = columns.map(c => c.name);
const requiredColumns = [
  { name: 'email', type: 'TEXT' },
  { name: 'password_hash', type: 'TEXT' },
  { name: 'display_name', type: 'TEXT' },
  { name: 'username', type: 'TEXT' },
  { name: 'username_locked', type: 'INTEGER DEFAULT 1' },
  { name: 'verification_status', type: 'TEXT DEFAULT \'pending\'' },
  { name: 'role', type: 'TEXT DEFAULT \'pending_student\'' },
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
  { name: 'account_locked_until', type: 'DATETIME' },
  { name: 'last_failed_login_at', type: 'DATETIME' },
  { name: 'risk_score', type: 'INTEGER DEFAULT 0' },
  { name: 'is_flagged', type: 'INTEGER DEFAULT 0' },
  { name: 'strikes', type: 'INTEGER DEFAULT 0' }
];

for (const col of requiredColumns) {
  if (!columnNames.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      if (col.name === 'email' || col.name === 'username') {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_${col.name} ON users(${col.name})`);
      }
    } catch (e) {
      console.error(`Migration failed for column ${col.name}:`, e);
    }
  }
}

// Migration: Ensure engagement_score exists in posts table
const postColumns = db.prepare("PRAGMA table_info(posts)").all() as any[];
const postColumnNames = postColumns.map(c => c.name);
if (!postColumnNames.includes('engagement_score')) {
  try {
    db.exec("ALTER TABLE posts ADD COLUMN engagement_score REAL DEFAULT 0");
  } catch (e) {
    console.error("Migration failed for posts.engagement_score:", e);
  }
}

// Migration for sessions table
const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all() as any[];
const sessionColumnNames = sessionColumns.map(c => c.name);
const requiredSessionColumns = [
  { name: 'user_agent', type: 'TEXT' },
  { name: 'last_activity_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  { name: 'revoked', type: 'INTEGER DEFAULT 0' },
  { name: 'ip_address', type: 'TEXT' },
  { name: 'device_hash', type: 'TEXT' }
];

for (const col of requiredSessionColumns) {
  if (!sessionColumnNames.includes(col.name)) {
    db.exec(`ALTER TABLE sessions ADD COLUMN ${col.name} ${col.type}`);
  }
}

// Global Lockdown Mode
let LOCKDOWN_MODE = false;

// Helper for audit logging
function logAction(userId: string | null, action: string, targetId: string | null, details: string, ip: string) {
  db.prepare("INSERT INTO audit_logs (user_id, action_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?)").run(userId, action, targetId, details, ip);
}

// Helper for security events
function logSecurityEvent(userId: string | null, type: string, ip: string, deviceHash: string | null, risk: number, details: string) {
  db.prepare("INSERT INTO security_events (user_id, event_type, ip_address, device_hash, risk_score, details) VALUES (?, ?, ?, ?, ?, ?)").run(userId, type, ip, deviceHash, risk, details);
}

async function startServer() {
  try {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    // Auto-promote admin user
    const adminEmail = 'driveserverhosting0944@gmail.com';
    const adminUser = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail) as any;
    if (adminUser) {
      db.prepare("UPDATE users SET role = 'admin', verification_status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE email = ?").run(adminEmail);
      console.log(`Promoted ${adminEmail} to admin and approved.`);
    }

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

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
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify session in DB and check timeouts
      const session = db.prepare("SELECT * FROM sessions WHERE id = ? AND revoked = 0").get(decoded.sessionId) as any;
      
      if (!session) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session invalid or revoked" });
      }

      const now = Date.now();
      // SQLite timestamps are UTC. Convert to JS Date objects.
      // better-sqlite3 returns strings for DATETIME columns.
      // Ensure we handle the format correctly.
      const lastActivity = new Date(session.last_activity_at.replace(' ', 'T') + 'Z').getTime();
      const createdAt = new Date(session.created_at.replace(' ', 'T') + 'Z').getTime();

      // Idle timeout: 30 days
      if (now - lastActivity > 30 * 24 * 60 * 60 * 1000) {
        db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(decoded.sessionId);
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session timed out due to inactivity" });
      }

      // Absolute timeout: 30 days
      if (now - createdAt > 30 * 24 * 60 * 60 * 1000) {
        db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(decoded.sessionId);
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: "Session expired (30d limit)" });
      }

      req.user = decoded;
      
      // Update session activity
      db.prepare("UPDATE sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?").run(decoded.sessionId);
      next();
    } catch (e) {
      res.status(401).json({ error: "Authentication failed" });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
    next();
  };

  const isVerified = (req: any, res: any, next: any) => {
    if (req.user?.verification_status !== 'approved') return res.status(403).json({ error: "Account not verified" });
    next();
  };

  // API Routes
  app.get("/api/users/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json(user);
  });

  app.get("/api/users/:id", authenticate, (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.patch("/api/users/:id/username", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { username } = req.body;
    
    if (req.user.id !== id) return res.status(403).json({ error: "Unauthorized" });
    
    try {
      db.prepare("UPDATE users SET username = ?, username_locked = 0 WHERE id = ?").run(username, id);
      logAction(id, 'update_username', id, `Username set to ${username}`, req.ip);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/auth/signup", (req, res) => {
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
      db.transaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, username, grade, section, house, ip_address_signup, ip_address_last_login) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, email, passwordHash, fullName, tempUsername, grade, section, house, ip, ip);
        
        db.prepare("INSERT INTO verification_answers (user_id, question_1, question_2) VALUES (?, ?, ?)").run(id, answers.q1, answers.q2 || '');
        db.prepare("INSERT INTO ip_logs (user_id, ip_address, action_type) VALUES (?, ?, ?)").run(id, ip, 'signup');
        
        // Auto-promote specific admin
        if (email === 'driveserverhosting0944@gmail.com') {
          db.prepare("UPDATE users SET role = 'admin', verification_status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        }

        logAction(id, 'signup', id, 'Account created', ip);
      })();
      
      res.json({ success: true, message: "Account created. Awaiting verification." });
    } catch (e) {
      res.status(400).json({ error: "Email or username already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password, deviceHash } = req.body;
    const ip = req.ip || '0.0.0.0';

    if (!checkRateLimit(`login_ip_${ip}`, 20, 3600000) || !checkRateLimit(`login_email_${email}`, 10, 3600000)) {
      return res.status(429).json({ error: "Too many login attempts" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    
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
        logSecurityEvent(user.id, 'ACCOUNT_LOCK_24H', ip, deviceHash, 50, "Max failed attempts reached");
      } else if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 900000).toISOString(); // 15m
        logSecurityEvent(user.id, 'ACCOUNT_LOCK_15M', ip, deviceHash, 20, "5 failed attempts reached");
      }
      
      db.prepare("UPDATE users SET failed_login_attempts = ?, account_locked_until = ?, last_failed_login_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(attempts, lockUntil, user.id);
      
      return invalidCreds();
    }

    // Success - Reset failed attempts
    db.prepare("UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, ip_address_last_login = ? WHERE id = ?").run(ip, user.id);

    // Risk Scoring
    let riskScore = 0;
    const knownDevice = db.prepare("SELECT * FROM device_sessions WHERE user_id = ? AND device_hash = ?").get(user.id, deviceHash);
    if (!knownDevice) {
      riskScore += 20;
      logSecurityEvent(user.id, 'NEW_DEVICE', ip, deviceHash, 20, "Login from unrecognized device");
    }

    const activeSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND revoked = 0").get(user.id).count;
    if (activeSessions >= 3) {
      // Expire oldest session
      db.prepare("UPDATE sessions SET revoked = 1 WHERE id = (SELECT id FROM sessions WHERE user_id = ? AND revoked = 0 ORDER BY created_at ASC LIMIT 1)").run(user.id);
    }

    // Create Session
    const sessionId = `sess_${Math.random().toString(36).substr(2, 9)}`;
    const accessToken = jwt.sign({ id: user.id, role: user.role, verification_status: user.verification_status, sessionId }, JWT_SECRET, { expiresIn: '30d' });
    const refreshToken = jwt.sign({ id: user.id, sessionId }, JWT_SECRET, { expiresIn: '30d' });

    db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, expires_at, ip_address, device_hash, user_agent) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), ip, deviceHash, req.headers['user-agent']);

    if (!knownDevice) {
      db.prepare("INSERT INTO device_sessions (id, user_id, device_hash, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)")
        .run(`dev_${Math.random().toString(36).substr(2, 9)}`, user.id, deviceHash, ip, req.headers['user-agent']);
    } else {
      db.prepare("UPDATE device_sessions SET last_seen_at = CURRENT_TIMESTAMP, ip_address = ? WHERE id = ?").run(ip, knownDevice.id);
    }

    const cookieOptions = { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, cookieOptions);

    logAction(user.id, 'login', user.id, 'User logged in', ip);
    res.json(user);
  });

  app.post("/api/auth/logout", authenticate, (req: any, res) => {
    db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(req.user.sessionId);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ success: true });
  });

  // Existing Routes (Updated with Auth)
  app.get("/api/admin/stats", authenticate, isAdmin, (req, res) => {
    const stats = {
      totalUsers: db.prepare("SELECT COUNT(*) as count FROM users").get().count,
      pendingVerifications: db.prepare("SELECT COUNT(*) as count FROM users WHERE verification_status = 'pending'").get().count,
      activeToday: db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM ip_logs WHERE timestamp > date('now')").get().count,
      flaggedAccounts: db.prepare("SELECT COUNT(*) as count FROM users WHERE strikes > 0 OR is_flagged = 1").get().count,
      lockedAccounts: db.prepare("SELECT id, display_name, account_locked_until FROM users WHERE account_locked_until > CURRENT_TIMESTAMP").all(),
      lockdown: LOCKDOWN_MODE
    };
    res.json(stats);
  });

  app.get("/api/admin/verification-queue", authenticate, isAdmin, (req, res) => {
    const queue = db.prepare(`
      SELECT u.*, va.question_1, va.question_2 
      FROM users u 
      JOIN verification_answers va ON u.id = va.user_id 
      WHERE u.verification_status = 'pending'
    `).all();
    res.json(queue);
  });

  app.get("/api/admin/audit-logs", authenticate, isAdmin, (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });

  app.get("/api/admin/ip-clusters", authenticate, isAdmin, (req, res) => {
    const clusters = db.prepare(`
      SELECT ip_address, COUNT(DISTINCT user_id) as user_count, GROUP_CONCAT(DISTINCT user_id) as user_ids 
      FROM ip_logs 
      GROUP BY ip_address 
      HAVING user_count > 1
    `).all();
    res.json(clusters);
  });

  app.post("/api/admin/verify", authenticate, isAdmin, (req: any, res) => {
    const { userId, status } = req.body;
    const verifiedAt = status === 'approved' ? new Date().toISOString() : null;
    db.prepare("UPDATE users SET verification_status = ?, verified_at = ?, role = ? WHERE id = ?").run(status, verifiedAt, status === 'approved' ? 'student' : 'pending_student', userId);
    logAction(req.user.id, 'verify_user', userId, `Status set to ${status}`, req.ip);
    res.json({ success: true });
  });

  app.get("/api/admin/security/events", authenticate, isAdmin, (req: any, res) => {
    const events = db.prepare("SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50").all();
    res.json(events);
  });

  app.post("/api/admin/security/lockdown", authenticate, isAdmin, (req: any, res) => {
    const { enabled } = req.body;
    LOCKDOWN_MODE = !!enabled;
    logAction(req.user.id, 'toggle_lockdown', 'system', `Lockdown mode set to ${LOCKDOWN_MODE}`, req.ip);
    res.json({ lockdown: LOCKDOWN_MODE });
  });

  app.get("/api/user/sessions", authenticate, (req: any, res) => {
    const sessions = db.prepare("SELECT id, ip_address, user_agent, last_activity_at, revoked FROM sessions WHERE user_id = ? AND revoked = 0 ORDER BY last_activity_at DESC").all(req.user.id);
    res.json(sessions);
  });

  app.post("/api/user/sessions/revoke", authenticate, (req: any, res) => {
    const { sessionId } = req.body;
    db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ? AND user_id = ?").run(sessionId, req.user.id);
    logAction(req.user.id, 'revoke_session', sessionId, `User revoked session`, req.ip);
    res.json({ success: true });
  });

  // --- Feed & Posts API ---
  app.get("/api/posts", authenticate, (req: any, res) => {
    // Algorithmic ranking: (engagement_score * 0.7) + (recency_decay * 0.3)
    // For simplicity, we'll just use a weighted sort in SQL
    const posts = db.prepare(`
      SELECT p.*, u.display_name, u.username, u.avatar,
             (p.engagement_score * 100 + (1000000 / (strftime('%s','now') - strftime('%s', p.timestamp) + 1))) as rank_score
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.status = 'approved' 
      ORDER BY rank_score DESC LIMIT 50
    `).all();
    res.json(posts);
  });

  app.post("/api/posts", authenticate, isVerified, (req: any, res) => {
    if (LOCKDOWN_MODE && req.body.type === 'confession') return res.status(503).json({ error: "Confessions disabled in lockdown mode" });
    const { content, type, media_url } = req.body;
    const status = type === 'confession' ? 'pending' : 'approved';
    const id = `post_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare("INSERT INTO posts (id, user_id, content, type, status, media_url) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, req.user.id, content, type, status, media_url || null);
    
    logAction(req.user.id, 'create_post', id, `Created ${type} post`, req.ip);
    res.json({ id, status });
  });

  app.post("/api/posts/:id/like", authenticate, (req: any, res) => {
    db.prepare("UPDATE posts SET engagement_score = engagement_score + 0.1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // --- Messaging API ---
  app.get("/api/conversations", authenticate, (req: any, res) => {
    const convs = db.prepare(`
      SELECT c.*, 
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ?
      ORDER BY last_message_time DESC
    `).all(req.user.id);
    res.json(convs);
  });

  app.post("/api/conversations", authenticate, (req: any, res) => {
    const { type, name, participantIds } = req.body;
    const id = `conv_${Math.random().toString(36).substr(2, 9)}`;
    
    db.transaction(() => {
      db.prepare("INSERT INTO conversations (id, type, name, created_by) VALUES (?, ?, ?, ?)").run(id, type, name, req.user.id);
      db.prepare("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?)").run(id, req.user.id, 'admin');
      for (const pId of participantIds) {
        db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)").run(id, pId);
      }
    })();
    
    res.json({ id });
  });

  app.get("/api/conversations/:id/messages", authenticate, (req: any, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100").all(req.params.id);
    res.json(messages);
  });

  // --- Stories API ---
  app.get("/api/stories", authenticate, (req: any, res) => {
    const now = new Date().toISOString();
    const stories = db.prepare(`
      SELECT s.*, u.display_name, u.username, u.avatar 
      FROM stories s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.expires_at > ? 
      ORDER BY s.created_at DESC
    `).all(now);
    res.json(stories);
  });

  app.post("/api/stories", authenticate, isVerified, (req: any, res) => {
    const { media_url, text_overlay, visibility } = req.body;
    const id = `story_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    db.prepare("INSERT INTO stories (id, user_id, media_url, text_overlay, expires_at, visibility) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, req.user.id, media_url, text_overlay, expiresAt, visibility || 'public');
    
    res.json({ id });
  });

  // --- Marketplace API ---
  app.get("/api/marketplace/listings", authenticate, (req, res) => {
    const listings = db.prepare(`
      SELECT l.*, u.display_name, u.username, u.avatar 
      FROM listings l 
      JOIN users u ON l.seller_id = u.id 
      WHERE l.status = 'active' 
      ORDER BY l.created_at DESC
    `).all();
    res.json(listings);
  });

  app.post("/api/marketplace/listings", authenticate, isVerified, (req: any, res) => {
    const { title, description, category, price } = req.body;
    const id = `list_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare("INSERT INTO listings (id, seller_id, title, description, category, price) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, req.user.id, title, description, category, price);
    
    res.json({ id });
  });

  // --- Academic API ---
  app.get("/api/academic/materials", authenticate, (req: any, res) => {
    const { grade, section, type } = req.query;
    let query = "SELECT * FROM academic_materials WHERE 1=1";
    const params = [];
    if (grade) { query += " AND grade = ?"; params.push(grade); }
    if (section) { query += " AND section = ?"; params.push(section); }
    if (type) { query += " AND type = ?"; params.push(type); }
    query += " ORDER BY created_at DESC";
    const materials = db.prepare(query).all(...params);
    res.json(materials);
  });

  app.post("/api/academic/materials", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const { type, title, content, grade, section, subject, due_date } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    db.prepare(`
      INSERT INTO academic_materials (id, type, title, content, grade, section, subject, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, title, content, grade, section, subject, due_date, req.user.id);
    logAction(req.user.id, 'upload_material', id, `Uploaded ${type}: ${title}`, req.ip);
    res.json({ success: true, id });
  });

  app.get("/api/academic/queries", authenticate, (req: any, res) => {
    const queries = db.prepare(`
      SELECT q.*, u.display_name, u.username, u.avatar 
      FROM discussion_queries q
      JOIN users u ON q.user_id = u.id
      ORDER BY q.created_at DESC
    `).all();
    res.json(queries);
  });

  app.post("/api/academic/queries", authenticate, (req: any, res) => {
    const { subject, query } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    db.prepare("INSERT INTO discussion_queries (id, user_id, subject, query) VALUES (?, ?, ?, ?)").run(id, req.user.id, subject, query);
    res.json({ success: true, id });
  });

  // --- Social Graph API ---
  app.get("/api/friendships", authenticate, (req: any, res) => {
    const friends = db.prepare(`
      SELECT f.*, u.display_name, u.username, u.avatar, u.id as user_id
      FROM friendships f
      JOIN users u ON (f.requester_id = u.id OR f.receiver_id = u.id)
      WHERE (f.requester_id = ? OR f.receiver_id = ?) AND u.id != ?
    `).all(req.user.id, req.user.id, req.user.id);
    res.json(friends);
  });

  app.post("/api/friendships", authenticate, (req: any, res) => {
    const { receiverId } = req.body;
    db.prepare("INSERT INTO friendships (requester_id, receiver_id) VALUES (?, ?)").run(req.user.id, receiverId);
    res.json({ success: true });
  });

  // --- Economy API ---
  app.get("/api/economy/balance", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT toins FROM users WHERE id = ?").get(req.user.id);
    res.json({ balance: user.toins });
  });

  app.get("/api/economy/transactions", authenticate, (req: any, res) => {
    const txs = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC").all(req.user.id);
    res.json(txs);
  });

  // --- Notifications API ---
  app.get("/api/notifications", authenticate, (req: any, res) => {
    const notes = db.prepare(`
      SELECT n.*, u.display_name as actor_name, u.avatar as actor_avatar 
      FROM notifications n 
      LEFT JOIN users u ON n.actor_id = u.id 
      WHERE n.user_id = ? 
      ORDER BY n.timestamp DESC LIMIT 50
    `).all(req.user.id);
    res.json(notes);
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

    socket.on("send-message", (data: any) => {
      const { conversationId, content, contentType, replyToId } = data;
      const userId = socket.userId;
      if (!userId) return;

      const user = db.prepare("SELECT verification_status FROM users WHERE id = ?").get(userId) as any;
      if (!user || user.verification_status !== 'approved') return;

      const id = `msg_${Math.random().toString(36).substr(2, 9)}`;
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, content, content_type, reply_to_id) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, conversationId, userId, content, contentType || 'text', replyToId || null);

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
      db.prepare("UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
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
