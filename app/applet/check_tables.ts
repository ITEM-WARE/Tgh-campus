
import Database from "better-sqlite3";

try {
  const db = new Database("campus.db");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  console.log("Tables in database:", tables.map(t => t.name));
  db.close();
} catch (e) {
  console.error("Database error:", e);
}
