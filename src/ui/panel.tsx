import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { HostState, Query, Range, Usage } from '../types';
import { DragHandle, Wave } from './components';
import { compact, exact } from './format';
const bridge = window.modeltide;
const ranges: [Range, string][] = [['today', '今天'], ['7d', '近 7 天'], ['30d', '近 30 天'], ['month', '本月'], ['custom', '自定义']];
function Trend({ data }: { data: Usage }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const b = data.buckets, max = Math.max(1, ...b.map(r => r.total ?? 0));
  const pow = 10 ** Math.floor(Math.log10(max)), top = Math.ceil(max / pow) * pow;
  const left = 39, width = 320, h = 64, step = width / Math.max(1, b.length);
  const tickIndexes = new Set([0, Math.floor(b.length / 3), Math.floor(b.length * 2 / 3), b.length - 1]);
  return <section className="trend" aria-label="Token 用量趋势">
    <div className="section-head"><h2>{data.query.range === 'today' ? '今日潮汐' : '每日潮汐'}</h2><span>{hovered !== null && b[hovered] ? `${b[hovered].label} · ${b[hovered].total == null ? '无记录' : exact(b[hovered].total)}` : 'Token / ' + (data.query.range === 'today' ? '小时' : '天')}</span></div>
    <svg viewBox="0 0 368 96" role="img" aria-label="按时段统计的 Token 柱状图，空缺代表无记录">
      {[0, .5, 1].map(f => <g key={f}><line x1={left} x2={360} y1={h - f * h + 7} y2={h - f * h + 7} className="gridline"/><text x={left - 6} y={h - f * h + 11} textAnchor="end" className="axis">{compact(top * f)}</text></g>)}
      {b.map((row, i) => <g key={row.key} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}><rect className="chart-hit" x={left + i * step} y={0} width={step} height={76}><title>{row.label}: {row.total == null ? '无用量记录' : exact(row.total) + ' Tokens'}</title></rect>{row.total != null && <rect className="bar" x={left + i * step + Math.min(1.5, step / 6)} y={h + 7 - row.total / top * h} width={Math.max(.4, step - Math.min(3, step / 3))} height={Math.max(1, row.total / top * h)}/>} {tickIndexes.has(i) && <text x={left + i * step + step / 2} y={91} textAnchor={i === 0 ? 'start' : i === b.length - 1 ? 'end' : 'middle'} className="axis">{data.query.range === 'today' ? row.label.split(' ')[0].replace('时', ':00') : row.label}</text>}</g>)}
    </svg>
  </section>;
}
export default function Panel({ host }: { host: HostState }) {
  const [q, setQ] = useState<Query>({ range: 'today' });
  const [data, setData] = useState<Usage>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timezone, setTimezone] = useState(host.settings.timezone);
  const sequence = useRef(0);
  const load = useCallback(async () => { const id = ++sequence.current; setBusy(true); try { const result = await bridge.query(q); if (id === sequence.current) { setData(result); setError(''); } } catch (e: any) { if (id === sequence.current) setError(e.message); } finally { if (id === sequence.current) setBusy(false); } }, [q, host.settings.timezone]);
  useEffect(() => { void load(); return bridge.subscribe(() => void load()); }, [load]);
  const chooseRange = (range: Range) => setQ(old => ({ ...old, range, ...(range === 'custom' ? { start: data?.query.start, end: data?.query.end } : {}) }));
  const summary = data?.summary;
  return <main className="panel">
    <header><DragHandle className="brand"><div className="character"><img src="./assets/logo.png" alt="ModelTide 托腮龙娘 Logo" draggable="false"/></div><div><h1>ModelTide<span className="brand-dot">.</span></h1><p>今天也有好好记录哦</p></div></DragHandle><button className="icon-button" aria-label="设置" title="设置" onClick={() => setSettingsOpen(!settingsOpen)}>⚙</button><button className="icon-button close" aria-label="收起面板" title="收起 · Esc" onClick={() => void bridge.action('collapse')}>−</button></header>
    <div className="panel-body">
      {settingsOpen ? <section className="settings"><h2>挂件设置</h2><label>统计时区<input value={timezone} onChange={e => setTimezone(e.target.value)} list="timezones" spellCheck={false}/></label><datalist id="timezones"><option value="America/Los_Angeles"/><option value="Asia/Shanghai"/><option value="UTC"/><option value="Asia/Tokyo"/></datalist><button className="save-button" onClick={async () => { try { await bridge.settings({ timezone }); setError(''); setSettingsOpen(false); } catch (e: any) { setError(e.message); } }}>保存时区</button>{([['followCodex', '跟随 Codex 启动'], ['launchAtLogin', '开机直接启动挂件'], ['alwaysOnTop', '窗口置顶']] as const).map(([key, label]) => <label className="checkbox" key={key}><input type="checkbox" checked={host.settings[key]} onChange={e => void bridge.settings({ [key]: e.target.checked }).catch(e => setError(e.message))}/>{label}</label>)}<button className="text-button" onClick={() => void bridge.action('reset')}>重置挂件位置</button><p>跟随启动使用轻量后台侦测程序，等待 Codex 打开后显示挂件。两个启动选项默认关闭。</p><p>{host.attached ? '已由原生挂件启动' : '独立详情窗口'}</p></section> : <>
      <nav className="range-tabs" aria-label="统计时间范围">{ranges.map(([value, label]) => <button key={value} aria-pressed={q.range === value} className={q.range === value ? 'active' : ''} onClick={() => chooseRange(value)}>{label}</button>)}</nav>
      {q.range === 'custom' && <div className="custom-range"><input aria-label="开始日期" type="date" value={q.start ?? ''} onChange={e => setQ({ ...q, start: e.target.value })}/><span>—</span><input aria-label="结束日期" type="date" value={q.end ?? ''} onChange={e => setQ({ ...q, end: e.target.value })}/></div>}
      <div className="scope-line"><span className="scope-tag">本机 · CODEX</span><select aria-label="模型筛选" value={q.model ?? ''} onChange={e => setQ({ ...q, model: e.target.value || undefined })}><option value="">全部模型</option>{data?.availableModels.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
      <section className="total-block"><div><span className="eyebrow">{ranges.find(r => r[0] === q.range)?.[1]}用量</span><div className="total-line" title={`${exact(summary?.total)} Tokens`}><strong>{compact(summary?.total)}</strong><span>TOKENS</span><svg className="burst" viewBox="0 0 45 45" aria-hidden="true"><path d="M6 31 19 25 13 17 28 18 28 5M25 34 38 28M36 12 40 7"/></svg></div></div><div className="session-count"><strong>{summary ? summary.sessions : '—'}</strong><span>活跃会话</span></div></section>
      <section className="metrics" aria-label="Token 明细">{([['输入', summary?.input, '包含缓存输入'], ['输出', summary?.output, '包含推理输出'], ['缓存输入', summary?.cached, '已包含在输入中，不重复相加'], ['推理输出', summary?.reasoning, '已包含在输出中，不重复相加']] as const).map(([label, value, help]) => <div key={label} title={`${help} · ${exact(value)}`}><span>{label}</span><strong>{compact(value)}</strong></div>)}</section>
      {data ? <Trend data={data}/> : <div className="pending">正在整理本机用量…</div>}
      <section className="models"><div className="section-head"><h2>模型出场榜</h2><span>{data?.models.length ?? 0} 个模型</span></div>{data?.models.length ? <ol>{data.models.map((row, i) => <li key={row.model}><span className="rank">{String(i + 1).padStart(2, '0')}</span><div className="model-info"><span className="model-name" title={row.model}>{row.model === 'unknown' ? '模型未记录' : row.model}</span><div className="model-track"><i style={{ width: `${row.share * 100}%` }}/></div></div><div className="model-value" title={exact(row.total)}><strong>{compact(row.total)}</strong><span>{(row.share * 100).toFixed(1)}%</span></div></li>)}</ol> : <p className="empty">{data?.coverage.state === 'indexing' ? '正在读取历史记录…' : '这个时间范围暂无用量记录'}</p>}</section>
      </>}
      {(error || host.error) && <div className="error" role="alert">{error || host.error}<button onClick={() => void load()}>重试</button></div>}
    </div>
    <footer><div className="freshness"><span className={data?.coverage.state === 'partial' ? 'notice-light' : 'fresh-light'}/><span>{data?.coverage.state === 'indexing' ? data.coverage.message : data?.updatedAt ? `更新于 ${new Intl.DateTimeFormat('zh-CN', { timeZone: host.settings.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(data.updatedAt))}` : '等待本机记录'}</span><button className="text-button" disabled={busy} onClick={() => void bridge.action('refresh').then(load)}>刷新</button></div><p title={host.settings.timezone}>记录覆盖 {data?.coverage.first ? new Intl.DateTimeFormat('zh-CN', { timeZone: host.settings.timezone }).format(new Date(data.coverage.first)) : '—'} — {data?.coverage.last ? new Intl.DateTimeFormat('zh-CN', { timeZone: host.settings.timezone }).format(new Date(data.coverage.last)) : '—'}</p><p title={data?.coverage.message}>{data?.coverage.state === 'indexing' ? '首次整理完成后自动更新' : data?.coverage.message ?? '仅本机保留记录'}</p></footer>
  </main>;
}
