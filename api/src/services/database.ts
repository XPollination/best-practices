import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/thought-tracing.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { verbose: undefined });
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      context_text TEXT,
      query_vector BLOB,
      returned_ids TEXT NOT NULL DEFAULT '[]',
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      result_count INTEGER NOT NULL DEFAULT 0,
      knowledge_space_id TEXT NOT NULL DEFAULT 'ks-default'
    );

    CREATE INDEX IF NOT EXISTS idx_query_log_agent ON query_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_query_log_session ON query_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log(timestamp);
  `);
}

export interface QueryLogEntry {
  id: string;
  agent_id: string;
  query_text: string;
  context_text: string | null;
  query_vector: Buffer | null;
  returned_ids: string;
  session_id: string;
  timestamp: string;
  result_count: number;
  knowledge_space_id: string;
}

export function insertQueryLog(entry: QueryLogEntry): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO query_log (id, agent_id, query_text, context_text, query_vector, returned_ids, session_id, timestamp, result_count, knowledge_space_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    entry.id,
    entry.agent_id,
    entry.query_text,
    entry.context_text,
    entry.query_vector,
    entry.returned_ids,
    entry.session_id,
    entry.timestamp,
    entry.result_count,
    entry.knowledge_space_id
  );
}
