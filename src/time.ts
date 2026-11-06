import type { Query } from './types';
const formatters = new Map<string, Intl.DateTimeFormat>();
export function validTimezone(tz: string) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }
export function dateParts(timestamp: string | number, tz: string) {
  let f = formatters.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset', hourCycle: 'h23' }); if (formatters.size > 8) formatters.clear(); formatters.set(tz, f); }
  const parts = Object.fromEntries(f.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return { day, hour: parts.hour, minute: parts.minute, zone: parts.timeZoneName, hourKey: `${day}T${parts.hour} ${parts.timeZoneName}` };
}
export function addDays(day: string, days: number) { return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
export function isDay(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
export function resolveQuery(q: Query, now = Date.now(), defaultTimezone = 'America/Los_Angeles') {
  const timezone = q.timezone ?? defaultTimezone;
  if (!validTimezone(timezone)) throw new Error('无效的 IANA 时区');
  const range = q.range ?? 'today';
  if (!['today', '7d', '30d', 'month', 'custom'].includes(range)) throw new Error('无效的日期范围');
  const today = dateParts(now, timezone).day;
  const start = range === 'today' ? today : range === '7d' ? addDays(today, -6) : range === '30d' ? addDays(today, -29) : range === 'month' ? today.slice(0, 7) + '-01' : q.start ?? '';
  const end = range === 'custom' ? q.end ?? '' : today;
  if (!isDay(start) || !isDay(end) || start > end) throw new Error('请选择有效的开始和结束日期');
  if (Date.parse(end) - Date.parse(start) > 366 * 86400000) throw new Error('单次查询最多支持 367 个自然日');
  return { range, timezone, start, end, ...(q.model ? { model: q.model } : {}) };
}
