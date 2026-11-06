import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { HostState } from '../types';
import { t } from '../locale';
import './style.css';
import './theme.css';
const Panel = lazy(() => import('./panel'));
const bridge = window.modeltide;
function App() {
  const [host, setHost] = useState<HostState>();
  const [error, setError] = useState('');
  const language = host?.settings.language ?? 'zh-CN';
  useEffect(() => {
    let active = true;
    void bridge.state().then(value => { if (active) setHost(value); }).catch(e => active && setError(e.message));
    const unsubscribe = bridge.subscribe(setHost);
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { document.documentElement.lang = language; document.title = t(language, 'title'); }, [language]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') void bridge.action('collapse'); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const loading = <div className="loading-panel">ModelTide <span>{error || t(language, 'opening')}</span></div>;
  return host ? <Suspense fallback={loading}><Panel host={host}/></Suspense> : loading;
}
createRoot(document.getElementById('root')!).render(<App/>);
