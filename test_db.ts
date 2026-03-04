
import Database from "better-sqlite3";

try {
  const db = new Database("campus.db");
  console.log("Database opened successfully");
  db.close();
} catch (e) {
  console.error("Database error:", e);
}
