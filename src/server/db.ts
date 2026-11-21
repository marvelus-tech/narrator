import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { openPg } from "./pg-sync";
import { writableDataFile } from "./paths";

const globalForDb = globalThis as unknown as { narratorDb?: Database.Database | null };

// DATABASE_URL selects Postgres (Cursor hosting). Otherwise SQLite.
// Postgres schema lives in migrations/. SQLite schema lives in src/server/schema/.
const schemaDir = path.join(process.cwd(), "src", "server", "schema");

export function databasePath(): string {
  return writableDataFile("narrator.sqlite", process.env.DATABASE_PATH);
}

export function openDatabase(file: string): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 4000");
  return db;
}

export function migrate(db: Database.Database, dir = schemaDir): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`,
  );
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const seen = new Set(
    (db.prepare(`SELECT id FROM schema_migrations`).all() as { id: string }[]).map((row) => row.id),
  );
  const insert = db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`);
  for (const file of files) {
    if (seen.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const apply = db.transaction(() => {
      db.exec(sql);
      insert.run(file, Date.now());
    });
    apply();
  }
}

export function getDb(): Database.Database {
  if (!globalForDb.narratorDb) {
    const url = process.env.DATABASE_URL?.trim();
    if (url) {
      globalForDb.narratorDb = openPg(url);
    } else {
      const db = openDatabase(databasePath());
      migrate(db);
      globalForDb.narratorDb = db;
    }
  }
  return globalForDb.narratorDb;
}

export function closeDb(): void {
  globalForDb.narratorDb?.close();
  globalForDb.narratorDb = null;
}

export function withTx<T>(db: Database.Database, fn: () => T): T {
  if (db.inTransaction) return fn();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      db.exec("BEGIN IMMEDIATE");
      try {
        const value = fn();
        db.exec("COMMIT");
        return value;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // The connection may already have rolled back after a busy error.
        }
        throw err;
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "SQLITE_BUSY" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("transaction retries exhausted");
}
