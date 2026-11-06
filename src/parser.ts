import { createHash } from 'node:crypto';
import type { Counts } from './types';
export interface ParseState { session: string; model: string; created: string; parent: string | null; previous: Counts | null; boundary: string | null }
export interface TokenEvent extends Counts { key: string; session: string; timestamp: string; model: string; uncertain: boolean }
export const emptyCounts = (): Counts => ({ input: 0, output: 0, cached: 0, reasoning: 0 });
export function initialState(): ParseState { return { session: '', model: 'unknown', created: '', parent: null, previous: null, boundary: null }; }
function counts(raw: any): Counts | null {
  if (!raw || !Number.isSafeInteger(raw.input_tokens) || !Number.isSafeInteger(raw.output_tokens) || raw.input_tokens < 0 || raw.output_tokens < 0) return null;
  const optional = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0;
  return { input: raw.input_tokens, output: raw.output_tokens, cached: optional(raw.cached_input_tokens), reasoning: optional(raw.reasoning_output_tokens) };
}
export function parseRecord(record: any, state: ParseState): { event?: TokenEvent; issue?: string } {
  const p = record.payload;
  if (!p || typeof p !== 'object') return {};
  if (record.type === 'session_meta') {
    if (typeof p.id !== 'string' || !p.id) return { issue: 'missing_session_id' };
    state.session = p.id; state.created = p.timestamp || record.timestamp;
    state.parent = p.forked_from_id || p.forked_from_thread_id || null;
    return {};
  }
  if (record.type === 'turn_context') { if (typeof p.model === 'string' && p.model) state.model = p.model; return {}; }
  if (record.type !== 'event_msg' || p.type !== 'token_count') return {};
  if (!p.info) return {}; // Quota-only notifications carry no usage.
  const cumulative = counts(p.info.total_token_usage);
  const last = counts(p.info.last_token_usage);
  if (!state.session || !cumulative || !Number.isFinite(Date.parse(record.timestamp))) return { issue: 'invalid_usage' };
  const timestamp = new Date(record.timestamp).toISOString();
  // A fork replays the parent's prefix. Advance its counter, but do not bill that prefix twice.
  const inherited = Boolean(state.parent && state.created && timestamp < new Date(state.created).toISOString());
  const prev = state.previous;
  let delta: Counts;
  let uncertain = state.model === 'unknown';
  if (prev && cumulative.input === prev.input && cumulative.output === prev.output) return {};
  if (prev && cumulative.input >= prev.input && cumulative.output >= prev.output) {
    delta = { input: cumulative.input - prev.input, output: cumulative.output - prev.output, cached: cumulative.cached - prev.cached, reasoning: cumulative.reasoning - prev.reasoning };
    if (delta.cached < 0 || delta.reasoning < 0) uncertain = true;
  } else if (prev) {
    // Explicit counter reset: use the most recent operation, not the old accumulator.
    delta = last ?? cumulative; uncertain = true;
  } else if (last && (last.input !== cumulative.input || last.output !== cumulative.output)) {
    // An incomplete prefix cannot be assigned to the first observed timestamp.
    delta = last; uncertain = true;
  } else { delta = cumulative; }
  state.previous = cumulative;
  if (inherited) return {};
  if (!prev && state.parent) uncertain = true;
  if (delta.input + delta.output === 0) return {};
  if (delta.cached > delta.input || delta.reasoning > delta.output) uncertain = true;
  delta.cached = Math.min(delta.input, Math.max(0, delta.cached));
  delta.reasoning = Math.min(delta.output, Math.max(0, delta.reasoning));
  const key = createHash('sha256').update(JSON.stringify([state.session, timestamp, cumulative, state.boundary])).digest('hex');
  return { event: { key, session: state.session, timestamp, model: state.model, uncertain, ...delta } };
}
