import catalog from './localization.json';
import type { Usage } from './types';
export type Language = 'zh-CN' | 'en';
export type MessageKey = keyof typeof catalog.messages['zh-CN'];
export const timezones = catalog.timezones;
export function validLanguage(value: unknown): value is Language { return value === 'zh-CN' || value === 'en'; }
export function t(language: Language, key: MessageKey, values: Record<string, string | number> = {}) {
  return catalog.messages[language][key].replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
export function coverageText(coverage: Usage['coverage'], language: Language) {
  if (coverage.state === 'indexing') return t(language, 'coverageIndexing', { count: coverage.processedFiles });
  if (coverage.issues) return t(language, 'coveragePartial', { count: coverage.issues });
  return t(language, 'coverageAvailable');
}
export function translateError(message: string, language: Language) {
  const key = (Object.keys(catalog.messages['zh-CN']) as MessageKey[]).find(key => catalog.messages['zh-CN'][key] === message || catalog.messages.en[key] === message);
  return key ? t(language, key) : message;
}
export function zoneLabel(zone: typeof timezones[number], language: Language) { return `${zone[language]} · ${zone.id}`; }
