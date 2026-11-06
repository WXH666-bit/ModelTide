import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/localization.json';
import { timezones, t, validLanguage, translateError } from '../src/locale';
import { validTimezone } from '../src/time';
test('all shared native and renderer translations have matching keys and interpolation tokens', () => {
  assert.deepEqual(Object.keys(catalog.messages.en).sort(), Object.keys(catalog.messages['zh-CN']).sort());
  for (const key of Object.keys(catalog.messages.en) as (keyof typeof catalog.messages.en)[]) {
    assert.ok(catalog.messages.en[key].trim()); assert.ok(catalog.messages['zh-CN'][key].trim());
    assert.deepEqual(catalog.messages.en[key].match(/\{\w+\}/g) ?? [], catalog.messages['zh-CN'][key].match(/\{\w+\}/g) ?? []);
  }
  assert.equal(t('en', 'modelCount', { count: 4 }), '4 models');
  assert.equal(translateError('无效的 IANA 时区', 'en'), 'Invalid IANA time zone');
  assert.ok(validLanguage('en')); assert.ok(validLanguage('zh-CN')); assert.ok(!validLanguage('fr'));
});
test('preset regions have supported, unique IANA zones and include Beijing', () => {
  assert.equal(timezones.length, 27);
  assert.equal(new Set(timezones.map(z => z.id)).size, timezones.length);
  for (const zone of timezones) { assert.ok(validTimezone(zone.id), zone.id); assert.ok(zone.en && zone['zh-CN']); }
  assert.match(timezones.find(z => z.id === 'Asia/Shanghai')!['zh-CN'], /北京时间/);
});
