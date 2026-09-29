const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const fileURL = file => 'file:///' + path.join(root, file).replaceAll('\\', '/');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.saved = { resume: { base: {}, collections: { education: [
        { degree: '硕士', school: '私有测试学校', startDate: '2024-09', endDate: '2027-06', city: '城市', highestEducation: '是' },
        { degree: '本科', school: '私有测试本科', startDate: '2020-09', endDate: '2024-06', city: '城市', highestEducation: '否' },
      ] }, custom: [] } };
      window.listeners = []; window.sent = [];
      window.framesFixture = [
        { frameId: 0, documentId: 'outer', result: { ready: true, controls: 0, shell: true, location: 'https://example.test/index' } },
        { frameId: 7, documentId: 'inner', result: { ready: true, controls: 5, datang: true, location: 'https://example.test/resume' } },
      ];
      window.chrome = {
        storage: { local: {
          get: async (keys, callback) => { const result = structuredClone(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, saved[k]]))); callback?.(result); return result; },
          set: async data => Object.assign(saved, JSON.parse(JSON.stringify(data))),
        } },
        runtime: { onMessage: { addListener: fn => listeners.push(fn) }, getManifest: () => ({ version: 'test' }), openOptionsPage: async () => {}, sendMessage: async () => ({ skipped: true }) },
        tabs: { query: async () => [{ id: 1 }], sendMessage: async (tabId, message, options) => { sent.push({ tabId, message, options }); return { ok: true, matched: 1 }; } },
        scripting: { executeScript: async () => framesFixture },
      };
    });
    await page.goto(fileURL('options/options.html'));
    await page.waitForSelector('[data-field="education[0].school"]');
    assert.match(await page.locator('.education-check-result').innerText(), /缺少高中/);
    await page.locator('[data-field="education[0].school"]').fill('未保存的新学校');
    await page.locator('[data-action="add-high-school"]').click();
    assert.equal(await page.locator('[data-field="education[0].school"]').inputValue(), '未保存的新学校');
    assert.equal(await page.locator('[data-field="education[2].degree"]').inputValue(), '高中');
    assert.equal(await page.locator('[data-field="education[2].school"]').inputValue(), '');
    assert.equal(await page.evaluate(() => saved.resume.collections.education.length), 2, 'Adding must not silently save');
    assert.equal(await page.locator('[data-action="add-high-school"]').isDisabled(), true);
    await page.getByRole('button', { name: '检查高中至最高学历资料', exact: true }).click();
    assert.match(await page.locator('.education-check-result').innerText(), /第 3 条（高中） → 第 1 条（硕士） → 第 2 条（本科）/);
    await page.locator('.education-check-result p').filter({ hasText: '请补充学校所在城市' }).getByRole('button').click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'education[2].city');
    await page.locator('[data-field="education[1].highestEducation"]').selectOption('是');
    await page.getByRole('button', { name: '检查高中至最高学历资料', exact: true }).click();
    assert.match(await page.locator('.education-check-result').innerText(), /有多条标为最高学历/);
    const check = await page.evaluate(() => {
      const resume = { collections: { education: [{ degree: '高中', school: 'a', startDate: '2020-02-30', endDate: '2019-06', city: 'b' }, { degree: '研究生' }] } };
      const before = JSON.stringify(resume); const result = ResumeEducationPlan.check(resume);
      return { result, unchanged: before === JSON.stringify(resume) };
    });
    assert.ok(check.unchanged);
    assert.ok(check.result.issues.some(i => i.reason.includes('有效年月')));
    assert.ok(check.result.issues.some(i => i.reason.includes('不能早于')));
    assert.ok(check.result.issues.some(i => i.reason.includes('具体学历')));
    const sources = process.argv.slice(2);
    const hashes = [];
    for (const source of sources.length ? sources : [null]) {
      const html = source ? fs.readFileSync(source, 'utf8') : '<iframe src="https://zhaopin.china-cdt.com/resume/resume/showAdd?sid=PRIVATE_TOKEN"></iframe>';
      hashes.push(crypto.createHash('sha256').update(html).digest('hex'));
      const report = await page.evaluate(html => ResumePageAudit.fromHTML(html, saved.resume), html);
      assert.match(report.adapter, /缺少实际表单/);
      assert.equal(report.canGuaranteeComplete, false);
      assert.equal(report.rows[0].dataStatus, 'unknown');
      assert.ok(!JSON.stringify(report).includes('PRIVATE_TOKEN'));
      assert.ok(!JSON.stringify(report).includes('私有测试'));
    }
    if (sources.length > 1) assert.equal(new Set(hashes).size, 1, 'Expected identical outer snapshots');
    await page.goto(fileURL('popup/popup.html'));
    await page.waitForFunction(() => document.querySelector('#frame-select').options.length === 3);
    await page.locator('#btn-preview').click();
    await page.waitForFunction(() => sent.length > 0);
    assert.deepEqual(await page.evaluate(() => sent[0].options), { frameId: 7, documentId: 'inner' });
    assert.match(await page.locator('#collection-select').innerText(), /教育经历（硕士）/);
    await page.evaluate(() => framesFixture.push({ frameId: 8, documentId: 'another', result: { ready: true, controls: 2, location: 'https://example.test/other' } }));
    await page.locator('#btn-fill').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('多个表单'));
    assert.equal(await page.evaluate(() => sent.length), 1, 'Ambiguous frames must not receive writes');
    await page.locator('#frame-select').selectOption('7');
    await page.locator('#btn-preview').click();
    await page.waitForFunction(() => sent.length === 2);
    await page.evaluate(() => { framesFixture[1].documentId = 'navigated'; });
    await page.locator('#btn-fill').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已跳转'));
    assert.equal(await page.evaluate(() => sent.length), 2);
    // Verify read-only frame discovery actually excludes hidden controls and session query strings.
    const inspected = await page.evaluate(async () => {
      globalThis.ResumeAssistant = {}; globalThis.ResumePageAudit = {};
      chrome.scripting.executeScript = async ({ func }) => [{ frameId: 0, documentId: 'doc', result: func() }];
      const input = document.createElement('input'); input.hidden = true; document.body.append(input);
      return (await ResumeFrameRouter.list(1))[0];
    });
    assert.equal(inspected.ready, true);
    assert.ok(inspected.controls > 0);
    assert.ok(!inspected.location.includes('?'));
    // Export handler removes executable/remote content and never mutates the original page.
    await page.goto(fileURL('options/options.html'));
    await page.waitForSelector('[data-field="base.name"]');
    for (const script of ['content/control-adapters.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, script) });
    const exported = await page.evaluate(async () => {
      const div = document.createElement('div'); div.id = 'export-fixture';
      div.innerHTML = '<input aria-label="学校" value="测试"><button onclick="window.exportExecuted=true">保存</button><script>ignored</script><a href="javascript:alert(1)">链接</a><iframe srcdoc="<p>embedded</p>"></iframe>';
      document.body.append(div);
      const response = await new Promise(resolve => listeners.at(-1)({ type: 'EXPORT_PAGE_HTML' }, {}, resolve));
      const template = document.createElement('template'); template.innerHTML = response.html;
      return { ok: response.ok, scripts: template.content.querySelectorAll('script,iframe,[onclick],[href],[src]').length,
        label: template.content.querySelector('#export-fixture input').getAttribute('aria-label'),
        originalIntact: !!document.querySelector('#export-fixture [onclick]') };
    });
    assert.deepEqual(exported, { ok: true, scripts: 0, label: '学校', originalIntact: true });
    // Known Datang inner route must not run the generic multi-card click loop without an adapter.
    await page.route('https://zhaopin.china-cdt.com/**', route => route.fulfill({ contentType: 'text/html', body: '<label>学校<input></label><button id="add">＋</button>' }));
    await page.goto('https://zhaopin.china-cdt.com/resume/resume/showAdd');
    for (const script of ['shared/schema.js', 'shared/keywords.js', 'shared/education-plan.js', 'shared/page-audit.js', 'content/control-adapters.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, script) });
    const guarded = await page.evaluate(async () => {
      window.addClicks = 0; document.querySelector('#add').onclick = () => addClicks++;
      const result = await ResumeAssistant.run('FILL');
      return { result, clicks: addClicks, value: document.querySelector('input').value };
    });
    assert.equal(guarded.result.ok, false);
    assert.match(guarded.result.error, /尚未适配/);
    assert.equal(guarded.clicks, 0);
    assert.equal(guarded.value, '');
    assert.deepEqual(errors, []);
    console.log(`PASS Datang education checklist, frame routing, structural export, ${sources.length || 1} shell snapshots`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message.slice(0, 1200)); process.exitCode = 1; });
