import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { HostState, Query, Range, Usage } from '../types';
import { coverageText, t, timezones, type Language, type MessageKey } from '../locale';
import { DragHandle } from './components';
import { compact, exact } from './format';
import { validTimezone } from '../time';
const bridge = window.modeltide;
const rangeKeys: [Range, MessageKey][] = [['today', 'today'], ['7d', 'week'], ['30d', 'month30'], ['month', 'month'], ['custom', 'custom']];

function Trend({ data, language }: { data: Usage; language: Language }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const b = data.buckets, max = Math.max(1, ...b.map(r => r.total ?? 0));
  const pow = 10 ** Math.floor(Math.log10(max)), top = Math.ceil(max / pow) * pow;
  const left = 39, width = 320, h = 64, step = width / Math.max(1, b.length);
  const ticks = new Set([0, Math.floor(b.length / 3), Math.floor(b.length * 2 / 3), b.length - 1]);
  const detail = hovered !== null ? b[hovered] : null;
  return <section className="trend" aria-label={t(language, 'trend')}>
    <div className="section-head"><h2>{t(language, data.query.range === 'today' ? 'hourlyTrend' : 'dailyTrend')}</h2><span>{detail ? detail.label + ' · ' + (detail.total == null ? t(language, 'noRecord') : exact(detail.total)) : 'Token / ' + t(language, data.query.range === 'today' ? 'hour' : 'day')}</span></div>
    <svg viewBox="0 0 368 96" role="img" aria-label={t(language, 'chartDescription')}>
      {[0, .5, 1].map(f => <g key={f}><line x1={left} x2={360} y1={h - f * h + 7} y2={h - f * h + 7} className="gridline"/><text x={left - 6} y={h - f * h + 11} textAnchor="end" className="axis">{compact(top * f)}</text></g>)}
      {b.map((row, i) => <g key={row.key} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
        <rect className="chart-hit" x={left + i * step} y={0} width={step} height={76}><title>{row.label + ': ' + (row.total == null ? t(language, 'noUsage') : exact(row.total) + ' Tokens')}</title></rect>
        {row.total != null && <rect className="bar" x={left + i * step + Math.min(1.5, step / 6)} y={h + 7 - row.total / top * h} width={Math.max(.4, step - Math.min(3, step / 3))} height={Math.max(1, row.total / top * h)}/>}
        {ticks.has(i) && <text x={left + i * step + step / 2} y={91} textAnchor={i === 0 ? 'start' : i === b.length - 1 ? 'end' : 'middle'} className="axis">{data.query.range === 'today' ? row.label.split(' ')[0] : row.label}</text>}
      </g>)}
    </svg>
  </section>;
}

export default function Panel({ host }: { host: HostState }) {
  const language = host.settings.language ?? 'zh-CN';
  const text = (key: MessageKey, values?: Record<string, string | number>) => t(language, key, values);
  const [q, setQ] = useState<Query>({ range: 'today' });
  const [data, setData] = useState<Usage>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current; setBusy(true);
    try { const result = await bridge.query(q); if (id === sequence.current) { setData(result); setError(''); } }
    catch (e: any) { if (id === sequence.current) setError(e.message); }
    finally { if (id === sequence.current) setBusy(false); }
  }, [q, host.settings.timezone]);
  useEffect(() => { void load(); return bridge.subscribe(() => void load()); }, [load]);
  const chooseRange = (range: Range) => setQ(old => ({ ...old, range, ...(range === 'custom' ? { start: data?.query.start, end: data?.query.end } : {}) }));
  const change = async (value: Parameters<typeof bridge.settings>[0]) => { try { await bridge.settings(value); setError(''); } catch (e: any) { setError(e.message); } };
  const summary = data?.summary;
  const ranges = rangeKeys.map(([key, label]) => [key, text(label)] as const);
  const filteredZones = timezones.filter(zone => (zone.id + ' ' + zone['zh-CN'] + ' ' + zone.en).toLowerCase().includes(zoneSearch.trim().toLowerCase()));
  const customZone = zoneSearch.trim();
  const showCustomZone = customZone && !timezones.some(zone => zone.id.toLowerCase() === customZone.toLowerCase()) && validTimezone(customZone);
  const selectZone = async (timezone: string) => {
    setZoneBusy(true); setZoneError('');
    try { await bridge.settings({ timezone }); setZonesOpen(false); setZoneSearch(''); }
    catch (e: any) { setZoneError(e.message); }
    finally { setZoneBusy(false); }
  };
  const coverage = data ? coverageText(data.coverage, language) : text('coverageLocal');
  const formatDate = (date: string | null | undefined) => date ? new Intl.DateTimeFormat(language, { timeZone: host.settings.timezone }).format(new Date(date)) : '—';
  return <main className="panel">
    <header><DragHandle className="brand" title={text('drag')}><div className="character"><img src="./assets/logo.png" alt={text('logo')} draggable="false"/></div><div><h1>ModelTide<span className="brand-dot">.</span></h1><p>{text('tagline')}</p></div></DragHandle><button className="icon-button" aria-label={text('settings')} title={text('settings')} onClick={() => setSettingsOpen(!settingsOpen)}>⚙</button><button className="icon-button close" aria-label={text('close')} title={text('closeHint')} onClick={() => void bridge.action('collapse')}>−</button></header>
    <div className="panel-body">
      {settingsOpen ? <section className="settings">
        <h2>{text('widgetSettings')}</h2>
        <label>{text('language')}<select aria-label={text('language')} value={language} onChange={e => void change({ language: e.target.value as Language })}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>
        <div className="timezone-setting">
          <span id="timezone-label">{text('timezone')}</span>
          <button className="timezone-trigger" type="button" aria-labelledby="timezone-label timezone-value" aria-expanded={zonesOpen} aria-controls="timezone-choices" disabled={zoneBusy} onClick={() => { setZonesOpen(!zonesOpen); setZoneSearch(''); }}><span id="timezone-value">{zoneBusy ? text('savingTimezone') : timezones.find(zone => zone.id === host.settings.timezone)?.[language] ?? host.settings.timezone}</span><span aria-hidden="true">{zonesOpen ? '▴' : '▾'}</span></button>
          {zonesOpen && <div className="timezone-picker" id="timezone-choices" aria-busy={zoneBusy}>
            <input type="search" aria-label={text('searchTimezone')} value={zoneSearch} onChange={e => setZoneSearch(e.target.value)} placeholder={text('timezonePlaceholder')} spellCheck={false} autoFocus disabled={zoneBusy}/>
            <div className="timezone-options" role="group" aria-label={text('chooseTimezone')}>
              {filteredZones.map(zone => <button key={zone.id} type="button" disabled={zoneBusy} aria-pressed={host.settings.timezone === zone.id} onClick={() => void selectZone(zone.id)}><span>{zone[language]}</span><small>{zone.id}</small></button>)}
              {showCustomZone && <button type="button" disabled={zoneBusy} aria-pressed={host.settings.timezone === customZone} onClick={() => void selectZone(customZone)}><span>{customZone}</span><small>{text('customTimezone')}</small></button>}
              {!filteredZones.length && !showCustomZone && <p>{text('noTimezone')}</p>}
            </div>
          </div>}
          {zoneError && <p className="error" role="alert">{zoneError}</p>}
        </div>
        <p className="timezone-help">{text('timezoneAutoSave')}</p>
        {(['onlyInCodex', 'followCodex', 'launchAtLogin', 'alwaysOnTop'] as const).map(key => <label className="checkbox" key={key} title={key === 'onlyInCodex' ? text('onlyInCodexHint') : key === 'followCodex' ? text('followCodexHint') : undefined}><input type="checkbox" checked={host.settings[key]} onChange={e => void change({ [key]: e.target.checked })}/>{text(key)}</label>)}
        <button className="text-button" onClick={() => void bridge.action('reset')}>{text('reset')}</button>
        <p>{text('startupHint')}</p><p>{text(host.attached ? 'attached' : 'standalone')}</p>
      </section> : <>
        <nav className="range-tabs" aria-label={text('ranges')}>{ranges.map(([value, label]) => <button key={value} aria-pressed={q.range === value} className={q.range === value ? 'active' : ''} onClick={() => chooseRange(value)}>{label}</button>)}</nav>
        {q.range === 'custom' && <div className="custom-range"><input aria-label={text('startDate')} type="date" value={q.start ?? ''} onChange={e => setQ({ ...q, start: e.target.value })}/><span>—</span><input aria-label={text('endDate')} type="date" value={q.end ?? ''} onChange={e => setQ({ ...q, end: e.target.value })}/></div>}
        <div className="scope-line"><span className="scope-tag">{text('localCodex')}</span><select aria-label={text('modelFilter')} value={q.model ?? ''} onChange={e => setQ({ ...q, model: e.target.value || undefined })}><option value="">{text('allModels')}</option>{data?.availableModels.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <section className="total-block"><div><span className="eyebrow">{text('usage', { range: ranges.find(r => r[0] === q.range)?.[1] ?? '' })}</span><div className="total-line" title={exact(summary?.total) + ' Tokens'}><strong>{compact(summary?.total)}</strong><span>TOKENS</span><svg className="burst" viewBox="0 0 45 45" aria-hidden="true"><path d="M6 31 19 25 13 17 28 18 28 5M25 34 38 28M36 12 40 7"/></svg></div></div><div className="session-count"><strong>{summary ? summary.sessions : '—'}</strong><span>{text('sessions')}</span></div></section>
        <section className="metrics" aria-label={text('metrics')}>{(['input', 'output', 'cached', 'reasoning'] as const).map(key => <div key={key} title={text((key + 'Hint') as MessageKey) + ' · ' + exact(summary?.[key])}><span>{text(key)}</span><strong>{compact(summary?.[key])}</strong></div>)}</section>
        {data ? <Trend data={data} language={language}/> : <div className="pending">{text('loading')}</div>}
        <section className="models"><div className="section-head"><h2>{text('models')}</h2><span>{text('modelCount', { count: data?.models.length ?? 0 })}</span></div>{data?.models.length ? <ol>{data.models.map((row, i) => <li key={row.model}><span className="rank">{String(i + 1).padStart(2, '0')}</span><div className="model-info"><span className="model-name" title={row.model}>{row.model === 'unknown' ? text('unknownModel') : row.model}</span><div className="model-track"><i style={{ width: row.share * 100 + '%' }}/></div></div><div className="model-value" title={exact(row.total)}><strong>{compact(row.total)}</strong><span>{(row.share * 100).toFixed(1)}%</span></div></li>)}</ol> : <p className="empty">{text(data?.coverage.state === 'indexing' ? 'indexing' : 'empty')}</p>}</section>
      </>}
      {(error || host.error) && <div className="error" role="alert">{error || host.error}<button onClick={() => void load()}>{text('retry')}</button></div>}
    </div>
    <footer>
      <div className="freshness"><span className={data?.coverage.state === 'partial' ? 'notice-light' : 'fresh-light'}/><span>{data?.coverage.state === 'indexing' ? coverage : data?.updatedAt ? text('updated', { time: new Intl.DateTimeFormat(language, { timeZone: host.settings.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(data.updatedAt)) }) : text('waiting')}</span><button className="text-button" disabled={busy} onClick={() => void bridge.action('refresh').then(load)}>{text('refresh')}</button></div>
      <p>{text('coverage')} {formatDate(data?.coverage.first)} — {formatDate(data?.coverage.last)}</p>
      <button className="text-button current-timezone" title={text('timezoneHint')} onClick={() => setSettingsOpen(true)}>{text('currentTimezone')}: {timezones.find(zone => zone.id === host.settings.timezone)?.[language] ?? host.settings.timezone} · {host.settings.timezone}</button>
      <p title={coverage}>{data?.coverage.state === 'indexing' ? text('afterIndexing') : coverage}</p>
    </footer>
  </main>;
}
