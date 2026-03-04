
import Database from "better-sqlite3";
import fs from "fs";

try {
  console.log("Opening database...");
  const db = new Database("campus.db");
  console.log("Database opened.");
  const dump = db.serialize();
  console.log("Database serialized.");
  fs.writeFileSync("campus.db.dump", dump);
  console.log("Database dumped successfully");
  db.close();
} catch (e) {
  console.error("Database error:", e);
}
