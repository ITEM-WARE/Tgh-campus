
import Database from "better-sqlite3";
import fs from "fs";

try {
  const db = new Database("campus.db");
  const data: any = {};
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  for (const table of tables) {
    data[table.name] = db.prepare(`SELECT * FROM ${table.name}`).all();
  }
  fs.writeFileSync("campus.db.json", JSON.stringify(data, null, 2));
  console.log("Database dumped to JSON successfully");
  db.close();
} catch (e) {
  console.error("Database error:", e);
}
