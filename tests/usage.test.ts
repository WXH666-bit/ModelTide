import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, appendFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { UsageStore } from '../src/store';
import { initialState, parseRecord } from '../src/parser';
import { resolveQuery } from '../src/time';
const root = resolve('tests/tmp/usage-tests');
const meta = (id: string, timestamp = '2026-11-05T08:00:00Z', parent?: string) => ({ type: 'session_meta', timestamp, payload: { id, timestamp, ...(parent ? { forked_from_id: parent } : {}) } });
const model = (name: string) => ({ type: 'turn_context', payload: { model: name } });
function tokens(timestamp: string, input: number, output: number, cached = 0, reasoning = 0, last?: [number, number]) {
  const usage = { input_tokens: input, output_tokens: output, cached_input_tokens: cached, reasoning_output_tokens: reasoning };
  return { type: 'event_msg', timestamp, payload: { type: 'token_count', info: { total_token_usage: usage, last_token_usage: last ? { input_tokens: last[0], output_tokens: last[1] } : usage } } };
}
const jsonl = (records: unknown[]) => records.map(r => JSON.stringify(r)).join('\n') + '\n';
async function fixture(name: string, rows: unknown[]) {
  const dir = join(root, name); await rm(dir, { recursive: true, force: true }); await mkdir(join(dir, 'codex/sessions'), { recursive: true });
  const file = join(dir, 'codex/sessions/log.jsonl'); await writeFile(file, jsonl(rows));
  const store = new UsageStore(join(dir, 'codex'), join(dir, 'index.sqlite')); await store.scan();
  return { dir, file, store };
}
const now = Date.parse('2026-11-05T18:00:00Z');
test('cumulative deltas, duplicate notifications, models, and contained metrics reconcile', async () => {
  const a = tokens('2026-11-05T09:00:00Z', 100, 20, 40, 10);
  const { store } = await fixture('totals', [meta('one'), model('alpha'), a, a, model('beta'), tokens('2026-11-05T10:00:00Z', 150, 30, 60, 15)]);
  try {
    const r = store.query({}, now);
    assert.deepEqual(r.summary, { input: 150, output: 30, cached: 60, reasoning: 15, total: 180, sessions: 1 });
    assert.deepEqual(r.models.map(m => [m.model, m.total]), [['alpha', 120], ['beta', 60]]);
    assert.equal(r.buckets.reduce((n, b) => n + (b.total ?? 0), 0), 180);
    assert.equal(store.query({ model: 'beta' }, now).summary?.total, 60);
    assert.equal(store.query({ model: 'missing' }, now).summary, null);
  } finally { await store.close(); }
});
test('incremental reads, unfinished lines, restart, and archive moves do not duplicate', async () => {
  const { store, dir, file } = await fixture('incremental', [meta('incremental'), model('alpha'), tokens('2026-11-05T09:00:00Z', 100, 20)]);
  const row = JSON.stringify(tokens('2026-11-05T10:00:00Z', 200, 30));
  await appendFile(file, row.slice(0, 42)); await store.scan(); assert.equal(store.query({}, now).summary?.total, 120);
  await appendFile(file, row.slice(42) + '\n'); await store.scan(); assert.equal(store.query({}, now).summary?.total, 230);
  const offset = (store.db.prepare('SELECT offset FROM files').get() as any).offset;
  await store.scan(); assert.equal((store.db.prepare('SELECT offset FROM files').get() as any).offset, offset);
  await store.close();
  const resumed = new UsageStore(join(dir, 'codex'), join(dir, 'index.sqlite'));
  try {
    await resumed.scan(); assert.equal(resumed.query({}, now).summary?.total, 230);
    await mkdir(join(dir, 'codex/archived_sessions')); await rename(file, join(dir, 'codex/archived_sessions/log.jsonl'));
    await resumed.scan(); assert.equal(resumed.query({}, now).summary?.total, 230);
  } finally { await resumed.close(); }
});
test('fork replay is excluded and only child increments are counted', async () => {
  const prior = tokens('2026-11-05T09:00:00Z', 100, 20);
  const { store, dir } = await fixture('fork', [meta('parent'), model('alpha'), prior]);
  try {
    await writeFile(join(dir, 'codex/sessions/fork.jsonl'), jsonl([meta('child', '2026-11-05T10:00:00Z', 'parent'), model('alpha'), prior, model('beta'), tokens('2026-11-05T11:00:00Z', 150, 30)]));
    await store.scan(); const r = store.query({}, now);
    assert.equal(r.summary?.total, 180); assert.equal(r.summary?.sessions, 2);
    assert.deepEqual(r.models.map(m => [m.model, m.total]), [['alpha', 120], ['beta', 60]]);
  } finally { await store.close(); }
});
test('reset, missing prefix, unknown model and corrupt records are explicitly partial', async () => {
  const { store, file } = await fixture('partial', [meta('partial'), tokens('2026-11-05T09:00:00Z', 1000, 200, 0, 0, [100, 20]), tokens('2026-11-05T10:00:00Z', 50, 10)]);
  try {
    await appendFile(file, '{"type":"event_msg","payload":{"type":"token_count",broken}\n'); await store.scan();
    const r = store.query({}, now); assert.equal(r.summary?.total, 180); assert.equal(r.coverage.state, 'partial'); assert.ok(r.coverage.issues >= 3); assert.equal(r.models[0].model, 'unknown');
  } finally { await store.close(); }
});
test('cross-day and month boundaries use the chosen timezone', async () => {
  const { store } = await fixture('boundaries', [meta('time', '2026-10-31T00:00:00Z'), model('alpha'), tokens('2026-11-01T06:59:00Z', 100, 20), tokens('2026-11-01T07:01:00Z', 150, 30)]);
  try {
    assert.equal(store.query({ range: 'custom', start: '2026-10-31', end: '2026-10-31' }, now).summary?.total, 120);
    assert.equal(store.query({ range: 'month' }, Date.parse('2026-11-02T12:00:00Z')).summary?.total, 60);
    assert.equal(store.query({ range: 'custom', start: '2026-11-01', end: '2026-11-01', timezone: 'UTC' }, now).summary?.total, 180);
  } finally { await store.close(); }
});
test('DST has 25 fall hours and 23 spring hours; repeated hours stay separate', async () => {
  const { store } = await fixture('dst', [meta('dst', '2026-11-01T07:00:00Z'), model('alpha'), tokens('2026-11-01T08:30:00Z', 100, 20), tokens('2026-11-01T09:30:00Z', 150, 30)]);
  try {
    const fall = store.query({}, Date.parse('2026-11-01T20:00:00Z'));
    assert.equal(fall.buckets.length, 25); assert.equal(fall.buckets.filter(b => b.total !== null).length, 2);
    assert.equal(store.query({}, Date.parse('2026-03-08T20:00:00Z')).buckets.length, 23);
  } finally { await store.close(); }
});
test('empty means no records, filters are validated, quota-only messages do not count', async () => {
  const { store } = await fixture('empty', []);
  try {
    assert.equal(store.query({}, now).summary, null); assert.equal(store.query({}, now).coverage.state, 'empty');
    assert.throws(() => resolveQuery({ range: 'custom', start: '2026-02-30', end: '2026-03-01' }));
    assert.throws(() => resolveQuery({ timezone: 'invalid' }));
    const state = initialState(); assert.deepEqual(parseRecord({ type: 'event_msg', payload: { type: 'token_count', info: null } }, state), {});
  } finally { await store.close(); }
});
test('source log remains untouched and conversation text is not persisted', async () => {
  const secretText = 'TEST_PRIVATE_CONVERSATION_DO_NOT_INDEX';
  const { store } = await fixture('privacy', [meta('private'), model('alpha'), { type: 'response_item', payload: { content: secretText } }, tokens('2026-11-05T09:00:00Z', 12, 4)]);
  try {
    for (const table of ['events', 'files', 'issues', 'meta']) assert.ok(!JSON.stringify(store.db.prepare(`SELECT * FROM ${table}`).all()).includes(secretText));
  } finally { await store.close(); }
});
