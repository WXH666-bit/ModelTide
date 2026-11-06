export const metrics = ['input', 'output', 'cached', 'reasoning'] as const;
export type Counts = { input: number; output: number; cached: number; reasoning: number };
export type Range = 'today' | '7d' | '30d' | 'month' | 'custom';
export interface Query { range?: Range; start?: string; end?: string; timezone?: string; model?: string }
export interface Summary extends Counts { total: number; sessions: number }
export interface Breakdown extends Summary { model: string; share: number }
export interface Bucket { key: string; label: string; total: number | null }
export interface Usage {
  query: Required<Pick<Query, 'range' | 'timezone'>> & { start: string; end: string; model?: string };
  summary: Summary | null; models: Breakdown[]; availableModels: string[]; buckets: Bucket[];
  coverage: { first: string | null; last: string | null; state: 'indexing' | 'partial' | 'available' | 'empty'; issues: number; files: number; processedFiles: number; message: string };
  updatedAt: string | null;
}
export interface Settings { timezone: string; language: import('./locale').Language; offset: { x: number; y: number } | null; launchAtLogin: boolean; followCodex: boolean; alwaysOnTop: boolean; onlyInCodex: boolean }
export interface HostState { expanded: boolean; attached: boolean; settings: Settings; error?: string }
export interface Bridge {
  query(q: Query): Promise<Usage>;
  state(): Promise<HostState>;
  action(action: 'toggle' | 'collapse' | 'refresh' | 'reset' | 'quit' | 'drag-start' | 'drag-end'): Promise<void>;
  settings(settings: Partial<Pick<Settings, 'timezone' | 'language' | 'launchAtLogin' | 'followCodex' | 'alwaysOnTop' | 'onlyInCodex'>>): Promise<Settings>;
  subscribe(callback: (state: HostState) => void): () => void;
}
declare global { interface Window { modeltide: Bridge } }
