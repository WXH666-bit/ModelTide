import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { HostState, Usage } from '../types';
import { compact, exact } from './format';
import { DragHandle, Wave } from './components';
import './style.css';
import './theme.css';
const Panel = lazy(() => import('./panel'));
const bridge = window.modeltide;
function App() {
  const [host, setHost] = useState<HostState>();
  const [today, setToday] = useState<Usage>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => bridge.query({ range: 'today' }).then(r => { if (active) { setToday(r); setError(''); } }).catch(e => active && setError(e.message));
    void bridge.state().then(setHost); void refresh();
    const unsubscribe = bridge.subscribe(s => { setHost(s); void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') void bridge.action('collapse'); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  if (host?.expanded) return <Suspense fallback={<div className="loading-panel">ModelTide <span>正在展开…</span></div>}><Panel host={host}/></Suspense>;
  const indexing = today?.coverage.state === 'indexing';
  return <main className="mini" aria-label="ModelTide 今日用量">
    <DragHandle className="mini-grip"><span/><span/><span/></DragHandle>
    <button className="mini-open" onClick={() => void bridge.action('toggle')} title={`${error || host?.error || (indexing ? '首次整理中 · ' : '')}${today?.summary ? exact(today.summary.total) + ' Tokens' : '暂无用量记录'}\n点击展开 · 顶部拖动`} aria-label="展开用量面板">
      <span className="mini-label">今日</span><strong>{indexing && !today?.summary ? '···' : compact(today?.summary?.total)}</strong><span className="mini-unit">TOKENS</span><Wave small/>
      {(indexing || error || host?.error) && <i className="status-dot"/>}
    </button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
