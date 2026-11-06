import { DatabaseSync } from 'node:sqlite';
import { readdir, stat, open, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { initialState, parseRecord, type ParseState } from './parser';
import { addDays, dateParts, resolveQuery } from './time';
import type { Query, Usage, Summary } from './types';

interface FileState { path: string; offset: number; size: number; mtime: number; state: string }
const sumColumns = 'coalesce(sum(input),0) input, coalesce(sum(output),0) output, coalesce(sum(cached),0) cached, coalesce(sum(reasoning),0) reasoning, coalesce(sum(input+output),0) total, count(distinct session) sessions';
export class UsageStore {
  db: DatabaseSync;
  indexing = false;
  files = 0;
  processedFiles = 0;
  updatedAt: string | null = null;
  revision = 0;
  private activeScan: Promise<void> | null = null;
  private cache = new Map<string, Usage>();
  private closed = false;
  constructor(readonly root: string, database: string) {
    this.db = new DatabaseSync(database);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA cache_size=-4096; PRAGMA mmap_size=0; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, offset INTEGER, size INTEGER, mtime REAL, state TEXT);
      CREATE TABLE IF NOT EXISTS events(key TEXT PRIMARY KEY,session TEXT,timestamp TEXT,model TEXT,input INTEGER,output INTEGER,cached INTEGER,reasoning INTEGER,uncertain INTEGER);
      CREATE INDEX IF NOT EXISTS event_time ON events(timestamp);
      CREATE TABLE IF NOT EXISTS issues(key TEXT PRIMARY KEY, kind TEXT);
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);`);
    this.updatedAt = (this.db.prepare("SELECT value FROM meta WHERE key='updatedAt'").get() as any)?.value ?? null;
    this.db.function('local_day', { deterministic: true }, (timestamp: any, tz: any) => dateParts(timestamp, tz).day);
  }
  static async create(root: string, database: string) { await mkdir(dirname(database), { recursive: true }); return new UsageStore(root, database); }
  scan() {
    if (this.activeScan) return this.activeScan;
    if (this.closed) return Promise.resolve();
    this.activeScan = this.runScan().finally(() => { this.indexing = false; this.activeScan = null; this.cache.clear(); });
    return this.activeScan;
  }
  private async *walk(path: string): AsyncGenerator<string> {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (e: any) { if (e.code === 'ENOENT') return; throw e; }
    for (const entry of entries) {
      if (entry.isDirectory()) yield* this.walk(join(path, entry.name));
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) yield join(path, entry.name);
    }
  }
  private async runScan() {
    this.indexing = true; this.files = 0; this.processedFiles = 0; this.cache.clear();
    for (const folder of ['sessions', 'archived_sessions']) {
      for await (const path of this.walk(join(this.root, folder))) {
        if (this.closed) return;
        this.files++;
        try { await this.scanFile(path); this.db.prepare('DELETE FROM issues WHERE key=?').run(`read:${path}`); }
        catch (e: any) { this.db.prepare('INSERT OR REPLACE INTO issues VALUES(?,?)').run(`read:${path}`, `read_${e.code ?? 'error'}`); }
        this.processedFiles++;
        await yieldTurn();
      }
    }
    this.updatedAt = new Date().toISOString();
    this.db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run('updatedAt', this.updatedAt);
    this.revision++;
  }
  private async scanFile(path: string) {
    const info = await stat(path);
    const prior = this.db.prepare('SELECT * FROM files WHERE path=?').get(path) as unknown as FileState | undefined;
    if (prior && prior.size === info.size && prior.mtime === info.mtimeMs && prior.offset === info.size) return;
    let offset = prior && prior.offset <= info.size ? prior.offset : 0;
    let state: ParseState = offset && prior ? JSON.parse(prior.state) : initialState();
    const handle = await open(path, 'r');
    const save = this.db.prepare('INSERT OR REPLACE INTO files VALUES(?,?,?,?,?)');
    const insert = this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?,?)');
    const issue = this.db.prepare('INSERT OR IGNORE INTO issues VALUES(?,?)');
    let tail = Buffer.alloc(0), position = offset;
    // Bounded 256 KiB chunks; conversations are discarded before JSON decoding.
    let oversized = false;
    const buffer = Buffer.allocUnsafe(256 * 1024);
    try {
      while (position < info.size) {
        if (this.closed) break;
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, info.size - position), position);
        if (!bytesRead) break;
        position += bytesRead;
        const chunk = tail.length ? Buffer.concat([tail, buffer.subarray(0, bytesRead)]) : buffer.subarray(0, bytesRead);
        let start = 0, end: number;
        this.db.exec('BEGIN');
        try {
          while ((end = chunk.indexOf(10, start)) >= 0) {
            const line = chunk.subarray(start, end);
            offset += end - start + 1;
            if (!oversized && (line.includes('"token_count"') || line.includes('"turn_context"') || line.includes('"session_meta"'))) {
              try {
                const result = parseRecord(JSON.parse(line.toString('utf8')), state);
                if (result.event) { const e = result.event; insert.run(e.key, e.session, e.timestamp, e.model, e.input, e.output, e.cached, e.reasoning, +e.uncertain); }
                if (result.issue) issue.run(`${path}:${offset}`, result.issue);
              } catch { issue.run(`${path}:${offset}`, 'invalid_json_or_usage'); }
            }
            oversized = false; start = end + 1;
          }
          tail = Buffer.from(chunk.subarray(start));
          if (tail.length > 4 * 1024 * 1024) {
            // Long message bodies are not retained. Flag potentially skipped metadata honestly.
            issue.run(`${path}:${offset}`, 'oversized_line'); oversized = true;
            offset += tail.length; tail = Buffer.alloc(0);
          }
          if (!oversized) save.run(path, offset, info.size, info.mtimeMs, JSON.stringify(state));
          this.db.exec('COMMIT');
        } catch (e) { this.db.exec('ROLLBACK'); throw e; }
        await yieldTurn();
      }
      // Never checkpoint an unfinished line: it will be re-read on the next scan.
      if (!oversized) save.run(path, offset, info.size, info.mtimeMs, JSON.stringify(state));
    } finally { await handle.close(); }
  }
  query(raw: Query, now = Date.now(), defaultTimezone?: string): Usage {
    const q = resolveQuery(raw, now, defaultTimezone);
    const key = JSON.stringify(q);
    const cached = this.cache.get(key);
    if (cached && !this.indexing) return cached;
    const min = new Date(Date.parse(q.start) - 14 * 3600000).toISOString();
    const max = new Date(Date.parse(addDays(q.end, 1)) + 14 * 3600000).toISOString();
    const where = 'timestamp>=? AND timestamp<? AND local_day(timestamp,?)>=? AND local_day(timestamp,?)<=?';
    const params = [min, max, q.timezone, q.start, q.timezone, q.end];
    const filtered = where + (q.model ? ' AND model=?' : '');
    const args = q.model ? [...params, q.model] : params;
    const summary = this.db.prepare(`SELECT ${sumColumns}, count(*) count FROM events WHERE ${filtered}`).get(...args) as any;
    const modelRows = this.db.prepare(`SELECT model, ${sumColumns} FROM events WHERE ${filtered} GROUP BY model ORDER BY total DESC, model`).all(...args) as any[];
    const availableModels = (this.db.prepare(`SELECT DISTINCT model FROM events WHERE ${where} ORDER BY model`).all(...params) as any[]).map(r => r.model);
    const hourly = q.range === 'today';
    const bucketExpr = hourly ? 'substr(timestamp,1,13)' : 'local_day(timestamp,?)';
    const rows = this.db.prepare(`SELECT ${bucketExpr} bucket,sum(input+output) total FROM events WHERE ${filtered} GROUP BY bucket ORDER BY bucket`).all(...(hourly ? args : [q.timezone, ...args])) as any[];
    const values = new Map<string, number>(rows.map(r => [r.bucket, r.total]));
    const buckets: Usage['buckets'] = [];
    if (hourly) {
      for (let t = Date.parse(min); t < Date.parse(max); t += 3600000) {
        if (dateParts(t, q.timezone).day !== q.start) continue;
        const stamp = new Date(t).toISOString().slice(0, 13);
        const zone = new Intl.DateTimeFormat('en', { timeZone: q.timezone, timeZoneName: 'shortOffset' }).formatToParts(t).find(p => p.type === 'timeZoneName')!.value;
        const label = `${dateParts(t, q.timezone).hour}:00 ${zone}`;
        buckets.push({ key: stamp, label, total: values.get(stamp) ?? null });
      }
    } else {
      for (let day = q.start; day <= q.end; day = addDays(day, 1)) buckets.push({ key: day, label: day.slice(5).replace('-', '/'), total: values.get(day) ?? null });
    }
    const coverage = this.db.prepare('SELECT min(timestamp) first,max(timestamp) last,sum(uncertain) uncertain FROM events').get() as any;
    const issues = Number((this.db.prepare('SELECT count(*) n FROM issues').get() as any).n) + Number(coverage.uncertain ?? 0);
    const result: Usage = {
      query: q, summary: summary.count ? { input: summary.input, output: summary.output, cached: summary.cached, reasoning: summary.reasoning, total: summary.total, sessions: summary.sessions } : null,
      models: modelRows.map(r => ({ ...r, share: summary.total ? r.total / summary.total : 0 })), availableModels, buckets,
      coverage: { first: coverage.first, last: coverage.last, state: this.indexing ? 'indexing' : issues ? 'partial' : summary.count ? 'available' : 'empty', issues, files: this.files, processedFiles: this.processedFiles,
        message: this.indexing ? `正在读取本机记录 · 已处理 ${this.processedFiles} 个文件` : issues ? `仅本机保留记录 · ${issues} 处记录不完整或归属待确认` : '仅本机保留记录 · 无记录的时段不代表零用量' },
      updatedAt: this.updatedAt
    };
    if (!this.indexing) { if (this.cache.size >= 6) this.cache.delete(this.cache.keys().next().value!); this.cache.set(key, result); }
    return result;
  }
  async close() { this.closed = true; await this.activeScan; this.db.close(); }
}
