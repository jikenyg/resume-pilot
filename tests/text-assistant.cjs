// Synthetic data only. No network requests or real applicant information.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

async function testWorker() {
  let listener, request, calls = 0;
  const store = { aiConfig: { apiKey: 'fake-test-key', model: 'test-model', sendFullResume: false },
    resume: { base: { name: 'Test applicant' }, collections: { award: [{ name: 'Test award' }] } } };
  const sandbox = {
    chrome: { storage: { local: { get(keys, cb) { cb(store); } } }, runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
    fetch: async (url, config) => { calls++; request = JSON.parse(config.body); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ value: 'Test award', reason: 'Saved award' }) } }], usage: { total_tokens: 123 } }) }; },
    AbortController, setTimeout, clearTimeout, URL,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8'), sandbox);
  const invoke = payload => new Promise(resolve => listener({ type: 'AI_TEXT_GENERATE', payload }, {}, resolve));
  assert.match((await invoke({ label: 'Honors' })).error, /允许发送/);
  assert.equal(calls, 0, 'no resume sent without saved permission');
  store.aiConfig.sendFullResume = true;
  const response = await invoke({ label: 'Honors', context: 'Within 200 characters', instruction: 'Summarize', maxLength: 200 });
  assert.equal(response.value, 'Test award');
  assert.equal(response.usage.total_tokens, 123);
  const sent = JSON.parse(request.messages[1].content);
  assert.equal(sent.resume.collections.award[0].name, 'Test award');
  assert.equal(sent.field.label, 'Honors');
  assert.equal(sent.resume.base.name, 'Test applicant');
  assert.equal(JSON.stringify(sent).includes('fake-test-key'), false);
  console.log('PASS: single-field worker authorization, stored resume, model request and token usage');
}

(async () => {
  await testWorker();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(`<form><h2>获奖情况</h2><div class="form-item"><label for="award">荣誉称号</label>
      <textarea id="award" maxlength="20" aria-describedby="help"></textarea><span id="help">20字以内</span></div>
      <label for="other">其他字段</label><input id="other" value="do not touch">
      <input id="password" type="password"><div class="phoenix-select"><input id="search"></div>
      <button type="submit">提交</button></form>`);
    await page.evaluate(() => {
      window.listeners = []; window.calls = []; window.submits = 0;
      document.querySelector('form').onsubmit = e => { e.preventDefault(); window.submits++; };
      window.testStorage = {};
      window.chrome = {
        storage: { local: { get(keys, cb) { cb(window.testStorage); }, async set() {} } },
        runtime: { onMessage: { addListener(fn) { window.listeners.push(fn); } },
          sendMessage: async msg => {
            window.calls.push(msg);
            if (window.slow) return new Promise(resolve => { window.resolveAI = resolve; });
            return { value: '校级一等奖', reason: '来自保存的获奖经历', usage: { total_tokens: 42 } };
          } },
      };
    });
    for (const file of ['shared/schema.js', 'shared/keywords.js', 'content/control-adapters.js', 'content/content.js', 'content/text-assistant.js']) {
      await page.addScriptTag({ path: path.join(root, file) });
    }
    const start = () => page.evaluate(() => {
      const replies = [];
      window.listeners.forEach(fn => fn({ type: 'AI_TEXT_START' }, {}, response => replies.push(response)));
      return replies;
    });
    assert.deepEqual(await start(), [{ ok: true }], 'legacy message handler must not race with the new action');
    const panel = page.locator('#resume-ai-text-host');
    await page.locator('#password').click();
    assert.equal(await panel.locator('#editor').isVisible(), false);
    await page.locator('#search').click();
    assert.equal(await panel.locator('#editor').isVisible(), false, 'dropdown search input is excluded');
    await page.locator('#award').click();
    assert.equal(await panel.locator('#label').inputValue(), '荣誉称号');
    assert.match(await panel.locator('#context').textContent(), /获奖情况/);
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'selecting a field does not call AI');
    await panel.locator('#generate').click();
    await page.waitForFunction(() => document.querySelector('#resume-ai-text-host').shadowRoot.querySelector('#answer').value);
    assert.equal(await page.inputValue('#award'), '', 'generation only previews');
    if (process.env.RA_SCREENSHOT) await page.screenshot({ path: process.env.RA_SCREENSHOT });
    const payload = await page.evaluate(() => window.calls[0].payload);
    assert.equal(payload.maxLength, 20);
    assert.equal(JSON.stringify(payload).includes('do not touch'), false);
    await panel.locator('#apply').click();
    await page.waitForFunction(() => document.querySelector('#resume-ai-text-host').shadowRoot.querySelector('#status').textContent.includes('已写入并核对'));
    assert.equal(await page.inputValue('#award'), '校级一等奖');
    assert.equal(await page.inputValue('#other'), 'do not touch');
    assert.equal(await page.evaluate(() => window.submits), 0);
    await panel.locator('#answer').fill('替换内容');
    await panel.locator('#apply').click();
    assert.equal(await page.inputValue('#award'), '校级一等奖', 'existing value requires consent');
    await panel.locator('#overwrite').check();
    await panel.locator('#answer').fill('长'.repeat(21));
    await panel.locator('#apply').click();
    assert.match(await panel.locator('#status').textContent(), /超过上限/);
    await panel.locator('#answer').fill('替换内容');
    await panel.locator('#apply').click();
    await page.waitForFunction(() => document.querySelector('#resume-ai-text-host').shadowRoot.querySelector('#status').textContent.includes('已写入并核对'));
    assert.equal(await page.inputValue('#award'), '替换内容');
    await page.locator('#award').fill('用户刚改的值');
    await panel.locator('#apply').click();
    assert.match(await panel.locator('#status').textContent(), /发生变化/);
    assert.equal(await page.inputValue('#award'), '用户刚改的值');
    await panel.locator('#overwrite').check();
    await page.evaluate(() => document.querySelector('#award').addEventListener('input', e => { e.target.value = ''; }));
    await panel.locator('#apply').click();
    await page.waitForFunction(() => document.querySelector('#resume-ai-text-host').shadowRoot.querySelector('#status').textContent.includes('未验证成功'));
    assert.equal(await panel.locator('#answer').inputValue(), '替换内容', 'failed write retains answer');
    await page.evaluate(() => { window.slow = true; });
    await panel.locator('#generate').click();
    await panel.locator('#pick').click();
    await page.evaluate(() => window.resolveAI({ value: '过期响应' }));
    assert.equal(await panel.locator('#editor').isVisible(), false, 'obsolete response cannot target another selection');
    await page.keyboard.press('Escape');
    assert.equal(await panel.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: point selection, context, preview, target isolation, length guard, overwrite guard, changed value, rejected update, stale AI response, Escape and legacy coexistence');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
