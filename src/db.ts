import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';

export async function setupDatabase(dbPath: string): Promise<Database> {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      startLine INTEGER,
      endLine INTEGER,
      content TEXT
    );

    CREATE TABLE IF NOT EXISTS edges (
      from_id INTEGER,
      to_id INTEGER,
      type TEXT NOT NULL,
      FOREIGN KEY (from_id) REFERENCES nodes (id),
      FOREIGN KEY (to_id) REFERENCES nodes (id)
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes (path);
    CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes (name);
  `);

  return db;
}
