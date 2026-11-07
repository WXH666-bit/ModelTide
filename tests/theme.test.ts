import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTheme, themes, themeIds, validTheme } from '../src/theme';
import catalog from '../src/localization.json';
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
test('themes have translated labels, valid roles and legible text on every surface', () => {
  assert.equal(defaultTheme, 'violet');
  assert.deepEqual(themeIds, ['dark', 'light', 'violet']);
  for (const theme of Object.values(themes)) {
    assert.deepEqual(Object.keys(theme.colors), Object.keys(themes.violet.colors));
    for (const color of Object.values(theme.colors)) assert.match(color, /^#[0-9A-F]{6}$/);
    for (const language of ['en', 'zh-CN'] as const) assert.ok(catalog.messages[language][theme.label as keyof typeof catalog.messages.en]);
    for (const ink of ['ink', 'muted', 'accent'] as const) for (const ground of ['bg', 'control', 'surface', 'selected', 'footer'] as const) {
      const a = luminance(theme.colors[ink]), b = luminance(theme.colors[ground]);
      assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${theme.label}: ${ink} on ${ground}`);
    }
  }
  for (const invalid of [undefined, null, '', 'system', 'constructor', '__proto__']) assert.equal(validTheme(invalid), false);
});
