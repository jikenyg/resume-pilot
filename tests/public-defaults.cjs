const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
require('../shared/schema.js');
for (const factory of [ResumeShared.emptyResume, ResumeShared.sampleResume]) {
  const resume = factory();
  assert.ok(Object.values(resume.base).every(value => value === ''));
  assert.ok(Object.values(resume.collections).flat().every(entry => Object.values(entry).every(value => value === '')));
  assert.ok(!resume.custom?.length);
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const existing of [false, true]) {
      const page = await browser.newPage();
      await page.addInitScript(existing => {
        window.saved = existing ? { resume: { base: { name: 'SYNTHETIC_TEST_USER' }, collections: { award: Array.from({ length: 12 }, (_, i) => ({ name: `Test award ${i}` })) } } } : {};
        window.writes = 0;
        window.chrome = { storage: { local: {
          get: async (keys, callback) => { const result = structuredClone(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, saved[key]]))); callback?.(result); return result; },
          set: async data => { writes++; Object.assign(saved, structuredClone(data)); },
        } }, runtime: { sendMessage: async () => ({ skipped: true }) } };
      }, existing);
      await page.goto(pathToFileURL(path.resolve(__dirname, '../options/options.html')).href);
      await page.waitForSelector('[data-field="base.name"]');
      assert.equal(await page.locator('[data-field="base.name"]').inputValue(), existing ? 'SYNTHETIC_TEST_USER' : '');
      assert.equal(await page.evaluate(() => writes), 0);
      if (existing) {
        assert.equal(await page.locator('[data-field^="award["][data-field$=".name"]').count(), 12);
      } else {
        await page.locator('#btn-sample').click();
        assert.equal(await page.locator('[data-field="education[0].school"]').inputValue(), '');
        assert.equal(await page.locator('[data-field="base.name"]').inputValue(), '');
        assert.equal(await page.evaluate(() => writes), 0);
      }
      await page.close();
    }
    console.log('PASS: empty public defaults, blank templates and existing data protection.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
