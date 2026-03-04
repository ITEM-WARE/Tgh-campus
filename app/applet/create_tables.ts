
import Database from "better-sqlite3";

try {
  const db = new Database("campus.db");
  db.exec(`
  CREATE TABLE IF NOT EXISTS ai_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS store_items (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    category TEXT,
    price INTEGER,
    type TEXT, -- 'digital'
    metadata TEXT, -- JSON string for specific item properties
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `);
  console.log("Tables created successfully");
  db.close();
} catch (e) {
  console.error("Database error:", e);
}
