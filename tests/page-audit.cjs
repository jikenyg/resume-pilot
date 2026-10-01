const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const field = (id, label, control) => `<div id="${id}"><div class="ant-form-item"><div class="ant-form-item-label"><label class="ant-form-item-required">${label}*</label></div>${control}</div></div>`;
const section = (title, inner) => `<div class="form-cell"><div class="tit"><p>${title}</p></div>${inner}</div>`;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const file of ['shared/schema.js', 'shared/keywords.js', 'shared/page-audit.js']) await page.addScriptTag({ path: path.join(root, file) });
    const html = `<div class="resume-operation-wrap">${section('个人基本信息',
      field('11_1_0', '姓名', '<input>') + field('11_2_0', '国籍/地区', '<div role="combobox" aria-controls="country-options">请选择</div>') +
      field('11_3_0', '接受调剂', '<label><input type="radio" name="adjust">是</label><label><input type="radio" name="adjust">否</label>') +
      field('11_4_0', '出生日期', '<input class="ant-calendar-picker-input" readonly>') +
      field('11_5_0', '照片', '<input type="file">'))}
      ${section('教育信息', `<div class="form-cell-inner">${field('14_1_0', '学校', '<input>')}</div><button class="add-more-btn">添加新的教育信息</button>`)}
      ${section('家庭关系', field('21_1_0', '姓名', '<input>') + field('21_1_1', '姓名', '<input value="已填成员">'))}
      ${section('语言能力', field('43_1_0', '成绩', '<input>') + field('43_2_0', '获得时间', '<input class="ant-calendar-picker-input">') + field('43_3_0', '英语能力', '<label><input type="checkbox">大学英语四级考试</label><label><input type="checkbox">大学英语六级考试</label>'))}
      ${section('项目经验', field('40_1_0', '项目职责', '<textarea></textarea>'))}
      ${section('工作或实习经历', '<button class="add-more-btn">添加新的工作经历</button>')}</div>`;
    const report = await page.evaluate(html => {
      window.resume = ResumeShared.emptyResume();
      Object.assign(resume.base, { name: '测试候选人', country: '中国', acceptAdjustment: '否', birthDate: '2000-02-29' });
      resume.collections.education = [{ school: '测试大学甲' }, { school: '测试大学乙' }];
      resume.collections.familyMember = [{ name: '测试家属' }, { name: '不能覆盖' }];
      resume.collections.language = [{ level: '六级' }];
      resume.collections.project = [{ description: '项目描述不是职责' }];
      return ResumePageAudit.fromHTML(html + '<img src="https://example.invalid/track"><script>window.importExecuted=true</script>', resume);
    }, html);
    assert.equal(report.canGuaranteeComplete, false);
    assert.equal(report.rows.find(r => r.label === '成绩').path, 'language[0].score');
    assert.equal(report.rows.find(r => r.label === '成绩').dataStatus, 'missing');
    assert.equal(report.rows.find(r => r.label === '项目职责').dataStatus, 'missing');
    assert.equal(report.rows.find(r => r.label === '照片').capability, 'manual');
    assert.equal(report.rows.find(r => r.section === '工作或实习经历').dataStatus, 'unknown');
    assert.equal(report.rows.find(r => r.section === '家庭关系').path, 'familyMember[0].name');
    assert.equal(JSON.stringify(report).includes('测试候选人'), false);
    assert.equal(await page.evaluate(() => window.importExecuted), undefined);
    // Detached parsing must not write to the live page.
    assert.equal(await page.locator('.form-cell').count(), 0);
    await page.setContent(html);
    await page.evaluate(() => {
      window.saved = {}; window.chrome = { storage: { local: { set: async data => Object.assign(saved, data) } } };
      document.querySelector('[role="combobox"]').onclick = event => {
        if (document.getElementById('country-options')) return;
        const list = document.createElement('div'); list.id = 'country-options'; list.className = 'ant-select-dropdown';
        const option = document.createElement('div'); option.className = 'ant-select-dropdown-menu-item'; option.textContent = '中国';
        option.onclick = () => { event.currentTarget; document.querySelector('[role="combobox"]').innerHTML = '<span class="ant-select-selection-selected-value">中国</span>'; list.remove(); };
        list.append(option); document.body.append(list);
      };
      document.querySelector('.ant-calendar-picker-input').onclick = event => {
        const host = event.target; const panel = document.createElement('div'); panel.className = 'ant-calendar';
        panel.innerHTML = '<input class="ant-calendar-input">';
        panel.firstChild.onkeydown = e => { if (e.key === 'Enter') { host.value = e.target.value; panel.remove(); } };
        document.body.append(panel);
      };
      document.querySelector('.add-more-btn').onclick = event => {
        const card = document.createElement('div'); card.className = 'form-cell-inner';
        card.innerHTML = '<div id="14_1_1"><div class="ant-form-item"><div class="ant-form-item-label"><label>学校</label></div><input></div></div>';
        event.target.before(card);
      };
    });
    await page.addScriptTag({ path: path.join(root, 'content/hotjob.js') });
    await page.evaluate(() => ResumeHotjob.run('PREVIEW', resume, () => {}));
    assert.equal(await page.locator('[id="11_1_0"] input').inputValue(), '');
    assert.equal(await page.locator('[id="14_1_1"]').count(), 0);
    const result = await page.evaluate(() => ResumeHotjob.run('FILL', resume, () => {}));
    assert.equal(result.created, 1);
    assert.equal(await page.locator('[id="14_1_1"] input').inputValue(), '测试大学乙');
    assert.equal(await page.locator('[id="21_1_0"] input').inputValue(), '测试家属');
    assert.equal(await page.locator('[id="21_1_1"] input').inputValue(), '已填成员');
    assert.equal(await page.locator('[id="43_1_0"] input').inputValue(), '');
    assert.equal(await page.locator('[id="11_4_0"] input').inputValue(), '2000-02-29');
    assert.equal(await page.locator('[name="adjust"]').nth(1).isChecked(), true);
    assert.equal(result.filled, 8);
    assert.equal(await page.locator('[id="43_3_0"] input').nth(1).isChecked(), true);
    assert.equal(await page.locator('[id="43_3_0"] input').nth(0).isChecked(), false);
    assert.ok(result.requiredMissing >= 3);
    assert.equal(JSON.stringify(await page.evaluate(() => saved.latestPageAudit)).includes('测试家属'), false);
    // Repeated fill preserves existing values and creates no duplicate entries.
    assert.equal((await page.evaluate(() => ResumeHotjob.run('FILL', resume, () => {}))).filled, 0);
    assert.equal(await page.locator('.form-cell-inner').count(), 2);
    assert.deepEqual(errors, []);

    // Protect a later field populated by a page reaction after scanning.
    await page.setContent(`<div class="resume-operation-wrap">${section('个人基本信息', field('11_1_0', '姓名', '<input>') + field('11_2_0', '手机', '<input>'))}</div>`);
    await page.evaluate(() => {
      resume.base.phone = '13800000000';
      document.querySelector('[id="11_1_0"] input').oninput = () => { document.querySelector('[id="11_2_0"] input').value = '13900000000'; };
    });
    const changed = await page.evaluate(() => ResumeHotjob.run('FILL', resume, () => {}));
    assert.equal(changed.filled, 1);
    assert.equal(await page.locator('[id="11_2_0"] input').inputValue(), '13900000000');
    assert.ok(changed.issues.some(i => i.reason.includes('内容已变化')));
    // Later reactions clearing an earlier value must remove it from the success count.
    await page.evaluate(() => {
      const first = document.querySelector('[id="11_1_0"] input'), second = document.querySelector('[id="11_2_0"] input');
      first.oninput = null; first.value = ''; second.value = '';
      second.oninput = () => { first.value = ''; };
    });
    const cleared = await page.evaluate(() => ResumeHotjob.run('FILL', resume, () => {}));
    assert.equal(cleared.filled, 1);
    assert.ok(cleared.issues.some(i => i.reason.includes('联动清空')));
    // A partly selected address fills only the empty city; the province is never clicked.
    await page.setContent(`<div class="resume-operation-wrap">${section('个人基本信息', field('11_3_0', '家庭所在城市', '<div role="combobox"><span class="ant-select-selection-selected-value">省甲</span></div><div role="combobox" aria-controls="cities">请选择</div>'))}</div>`);
    await page.evaluate(() => {
      resume.base.homeCity = '省甲/市乙';
      const combos = document.querySelectorAll('[role="combobox"]');
      combos[0].onclick = () => { throw Error('must not overwrite province'); };
      combos[1].onclick = () => {
        const list = document.createElement('div'); list.id = 'cities'; list.className = 'ant-select-dropdown';
        const option = document.createElement('div'); option.className = 'ant-select-dropdown-menu-item'; option.textContent = '市乙';
        option.onclick = () => { combos[1].innerHTML = '<span class="ant-select-selection-selected-value">市乙</span>'; list.remove(); };
        list.append(option); document.body.append(list);
      };
    });
    const partial = await page.evaluate(() => ResumePageAudit.scan(document, resume));
    assert.equal(partial.rows[0].partial, true);
    assert.equal((await page.evaluate(() => ResumeHotjob.run('FILL', resume, () => {}))).filled, 1);
    assert.deepEqual(errors, []);

    // Main content entry point must dispatch to the same adapter and persist its report.
    await page.evaluate(() => {
      saved.resume = resume;
      chrome.storage.local.get = async (keys, callback) => {
        const result = Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, saved[key]]));
        callback?.(result); return result;
      };
      chrome.runtime = { getManifest: () => ({ version: 'test-script-version' }), onMessage: { addListener: fn => { window.listener = fn; } }, sendMessage: async () => ({ skipped: true }) };
    });
    for (const file of ['content/control-adapters.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, file) });
    assert.equal((await page.evaluate(() => ResumeAssistant.run('FILL'))).adapter, 'hotjob');
    assert.equal(await page.evaluate(() => saved.latestFillDiagnostic.summary.extensionVersion), 'test-script-version');
    const liveAudit = await page.evaluate(() => new Promise(resolve => listener({ type: 'PAGE_AUDIT' }, {}, resolve)));
    assert.equal(liveAudit.ok, true);
    assert.equal(liveAudit.report.total, 1);
    assert.deepEqual(errors, []);

    // Editor integration with mocked extension storage (no access to the user's profile).
    const editor = await browser.newPage({ viewport: { width: 1360, height: 980 } });
    editor.on('pageerror', e => errors.push(e.message));
    await editor.addInitScript(() => {
      window.saved = { resume: { base: { name: '编辑器测试' }, collections: { education: [{ school: '旧学校', endDate: '2024-06' }], honor: [] }, custom: [] } };
      window.chrome = { storage: { local: {
        get: async (keys, callback) => { const result = Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, saved[key]])); callback?.(result); return result; },
        set: async data => Object.assign(saved, data),
      } }, runtime: { sendMessage: async () => ({ ok: true }) } };
    });
    await editor.goto('file:///' + path.join(root, 'options/options.html').replaceAll('\\', '/'));
    await editor.locator('[data-field="education[0].school"]').fill('尚未保存的学校');
    await editor.locator('.collection-card').filter({ has: editor.locator('.name', { hasText: /^教育经历$/ }) }).getByRole('button', { name: '＋ 添加', exact: true }).click();
    assert.equal(await editor.locator('[data-field="education[0].school"]').inputValue(), '尚未保存的学校');
    assert.equal(await editor.locator('[data-field="education[0].endDate"]').inputValue(), '2024-06');
    assert.equal(await editor.locator('[data-field="base.acceptAdjustment"]').inputValue(), '');
    await editor.locator('#audit-html').fill(html);
    await editor.locator('#btn-audit-html').click();
    const familyRow = editor.locator('.audit-table tr').filter({ hasText: '家庭关系 / 第 1 条 / 姓名' });
    await familyRow.getByRole('button', { name: '去补充' }).click();
    await editor.locator('[data-field="familyMember[0].name"]').fill('编辑器家属');
    await editor.locator('#btn-save').click();
    const persisted = await editor.evaluate(() => saved.resume);
    assert.equal(persisted.collections.familyMember[0].name, '编辑器家属');
    assert.equal(persisted.collections.education[0].school, '尚未保存的学校');
    assert.equal(persisted.collections.education[0].endDate, '2024-06');
    assert.equal(persisted.collections.honor.length, 0);
    assert.equal(persisted.base.acceptAdjustment, '');
    await editor.locator('#audit-status').scrollIntoViewIfNeeded();
    if (process.env.RA_SCREENSHOT) await editor.screenshot({ path: process.env.RA_SCREENSHOT });
    assert.deepEqual(errors, []);

    // Real pasted snapshot: inspect in an inert document, never execute site code.
    if (process.argv[2]) {
      const source = fs.readFileSync(process.argv[2], 'utf8');
      const actual = await page.evaluate(source => ResumePageAudit.fromHTML(source, ResumeShared.sampleResume()), source);
      console.log(JSON.stringify({ total: actual.total, counts: actual.counts, missing: actual.rows.filter(r => r.dataStatus === 'missing').map(r => r.source), unmapped: actual.rows.filter(r => r.capability === 'unmapped').map(r => r.label) }, null, 2));
      assert.ok(actual.total >= 80);
      assert.equal(actual.rows.filter(r => r.capability === 'unmapped').length, 0);
    }
    console.log('PASS: inert HTML preflight, exact indexed mappings, missing facts, Ant select/date/radio, expansion, existing-value protection, final verification, editor navigation and lossless save.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
