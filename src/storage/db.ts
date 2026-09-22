import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { nowIso } from '../core/ids.js';
import { MIGRATIONS } from './migrations.js';

export type Row = Record<string, string | number | null | Uint8Array | bigint>;

export class Db {
  readonly path: string;
  private readonly db: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(dbPath: string) {
    this.path = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA busy_timeout = 8000');
  }

  migrate(): { applied: string[]; version: number } {
    this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const applied: string[] = [];
    this.transaction(() => {
      const current = this.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['schema_version']);
      let version = current ? Number(current.value) : 0;
      for (const m of MIGRATIONS) {
        if (m.version <= version) continue;
        this.db.exec(m.sql);
        version = m.version;
        applied.push(m.name);
      }
      this.run('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['schema_version', String(version)]);
      if (applied.length) this.run('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['migrated_at', nowIso()]);
    });
    const v = this.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['schema_version']);
    return { applied, version: v ? Number(v.value) : 0 };
  }

  schemaVersion(): number {
    try {
      const v = this.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['schema_version']);
      return v ? Number(v.value) : 0;
    } catch {
      return 0;
    }
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  run(sql: string, params: SQLInputValue[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
    return this.stmt(sql).run(...params);
  }

  get<T extends object>(sql: string, params: SQLInputValue[] = []): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T extends object>(sql: string, params: SQLInputValue[] = []): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  /**
   * Run fn inside BEGIN IMMEDIATE so concurrent processes serialize on the write lock. Nested
   * calls join the outer transaction. Any throw rolls back everything.
   */
  transaction<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth++;
      try {
        return fn();
      } finally {
        this.depth--;
      }
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err;
    } finally {
      this.depth = 0;
    }
  }

  inTransaction(): boolean {
    return this.depth > 0;
  }

  close(): void {
    this.db.close();
  }
}
