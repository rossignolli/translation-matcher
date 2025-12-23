import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'translation-matcher.db');
    console.log(`Initializing database at: ${dbPath}`);
    this.db = new Database(dbPath, { verbose: console.log });
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');

    const schema = `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, -- Hash
        corpus TEXT CHECK(corpus IN ('A', 'B')),
        filename TEXT,
        path TEXT,
        extracted_text TEXT,
        meta_json TEXT,
        gpt_index_json TEXT,
        status TEXT DEFAULT 'scanned', -- 'scanned', 'indexed', 'error'
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_a_id TEXT,
        doc_b_id TEXT,
        reason TEXT,
        confidence REAL,
        gpt_response_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_a_id TEXT,
        doc_b_id TEXT,
        match_type TEXT,
        confidence REAL,
        evidence_json TEXT,
        citation_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

    this.db.exec(schema);
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close() {
    this.db.close();
  }
}

export const dbService = new DatabaseService();
