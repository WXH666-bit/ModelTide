import catalog from './themes.json';
export const themes = catalog.themes;
export type ThemeId = keyof typeof themes;
export const themeIds = Object.keys(themes) as ThemeId[];
export const defaultTheme = catalog.default as ThemeId;
export function validTheme(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.hasOwn(themes, value);
}
export function applyTheme(value: ThemeId, element: HTMLElement) {
  const theme = themes[value];
  element.dataset.theme = value;
  element.style.colorScheme = theme.scheme;
  for (const [role, color] of Object.entries(theme.colors)) element.style.setProperty(`--${role}`, color);
}
