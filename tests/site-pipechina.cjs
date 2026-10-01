const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const field = (key, label, control) => `<div class="hc-form-field" key="${key}"><div class="hc-form-label"><span ng-bind-html="field.label|toTrusted">${label}</span></div><div class="hc-form-control">${control}</div></div>`;
const section = (name, body) => `<div class="rec-resume-detail-child ${name === '基本信息' ? 'my-resume-resume' : ''}"><div class="rec-profile-block-title">${name}</div>${body}</div>`;
const html = body => `<title>国家管网招聘</title><div class="rec-candidate-resume-pc">${body}</div>`;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const requests = []; await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    for (const file of ['shared/site-pipechina.js', 'shared/schema.js', 'shared/page-audit.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(() => {
      window.resume = ResumeShared.emptyResume();
      Object.assign(resume.base, { name: '合成测试甲', phone: '13800000000', gender: '女', otherOrigin: '资料甲', acceptAdjustment: '否' });
      resume.collections.familyMember = [{ name: '合成家属甲' }, { name: '合成家属乙' }];
      resume.collections.education = [{ school: '合成大学甲' }];
    });
    const source = html(section('基本信息', field('name', '姓名', '<span class="text">无</span>') + field('u_attachment', '（京籍）户口本/身份证扫描件', '<span>无</span>')) + section('教育经历', '<div class="table-header-cell" col-key="school"><div class="head-label">学校名称</div></div>'));
    const preflight = await page.evaluate(source => ResumePageAudit.fromHTML(source + '<script>window.executed=true</script><img src="https://example.invalid/track">', resume), source);
    assert.equal(preflight.adapter, 'pipechina');
    assert.equal(preflight.rows[0].capability, 'dynamic');
    assert.equal(preflight.rows[1].capability, 'manual');
    assert.equal(preflight.rows[2].path, 'education[0].school');
    assert.equal(JSON.stringify(preflight).includes('合成'), false);
    assert.equal(await page.evaluate(() => window.executed), undefined);
    assert.equal(await page.locator('.rec-candidate-resume-pc').count(), 0);
    assert.deepEqual(requests, []);
    await page.setContent(html(section('基本信息',
      field('name', '姓名', '<input required>') + field('mobile', '手机', '<input>') +
      field('u_birthplace_other_id', '其他籍贯', '<input value="无">') +
      field('gender', '性别', '<label><input type="radio" name="gender" value="m">男</label><label><input type="radio" name="gender" value="f">女</label>') +
      field('u_obey_transfer', '是否服从调剂', '<select><option value="">请选择</option><option value="n">否</option><option value="y">是</option></select>') +
      field('birth', '出生日期', '<input readonly>')) +
      section('家庭成员信息', field('name', '家庭成员姓名', '<input>') + field('name', '家庭成员姓名', '<input value="保留家属">')) +
      `<div class="ng-hide">${section('隐藏区块', field('unknown', '未知字段', '<input>'))}</div>` +
      `<div class="tt-resume-hidden">${section('隐藏副本', field('unknown', '未知字段', '<input>'))}</div>`));
    assert.equal(await page.evaluate(() => ResumePageAudit.scan(document, resume).total), 8);
    assert.equal((await page.evaluate(() => ResumeSiteAdapters[0].run('PREVIEW', resume))).filled, 0);
    assert.equal(await page.locator('[key="name"] input').first().inputValue(), '');
    const filled = await page.evaluate(() => ResumeSiteAdapters[0].run('FILL', resume));
    assert.equal(filled.filled, 5);
    assert.equal(await page.locator('[key="u_birthplace_other_id"] input').inputValue(), '无');
    assert.equal(await page.locator('[key="name"] input').nth(1).inputValue(), '合成家属甲');
    assert.equal(await page.locator('[key="name"] input').nth(2).inputValue(), '保留家属');
    assert.equal((await page.evaluate(() => ResumeSiteAdapters[0].run('FILL', resume))).filled, 0);
    await page.setContent(html(section('基本信息', field('name', '姓名', '<input>') + field('mobile', '手机', '<input>'))));
    await page.evaluate(() => { document.querySelector('[key="mobile"] input').oninput = () => { document.querySelector('[key="name"] input').value = ''; }; });
    const cleared = await page.evaluate(() => ResumeSiteAdapters[0].run('FILL', resume));
    assert.equal(cleared.filled, 1); assert.ok(cleared.issues.some(r => /联动清空/.test(r.reason)));
    await page.evaluate(() => {
      const a = document.querySelector('[key="name"] input'), b = document.querySelector('[key="mobile"] input');
      a.value = ''; b.value = ''; b.oninput = null; a.oninput = () => { b.value = '13900000000'; };
    });
    assert.equal((await page.evaluate(() => ResumeSiteAdapters[0].run('FILL', resume))).filled, 1);
    assert.equal(await page.locator('[key="mobile"] input').inputValue(), '13900000000');
    // Public content entry point uses the registry and stores a value-free audit.
    await page.evaluate(() => {
      window.saved = { resume };
      window.chrome = { storage: { local: {
        get: async (keys, callback) => { const r = Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, saved[k]])); callback?.(r); return r; },
        set: async data => Object.assign(saved, data),
      } }, runtime: { getManifest: () => ({ version: 'test-script-version' }), onMessage: { addListener: () => {} }, sendMessage: async () => ({ skipped: true }) } };
    });
    for (const file of ['shared/keywords.js', 'content/control-adapters.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, file) });
    assert.equal((await page.evaluate(() => ResumeAssistant.run('FILL'))).adapter, 'pipechina');
    assert.equal(await page.evaluate(() => saved.latestPageAudit.adapter), 'pipechina');
    assert.equal(await page.evaluate(() => JSON.stringify(saved.latestPageAudit).includes('合成')), false);
    assert.equal(await page.evaluate(() => saved.latestFillDiagnostic.summary.extensionVersion), 'test-script-version');
    await page.setContent(html(section('家庭成员信息', field('name', '家庭成员姓名', '<input value="其他成员">') + field('job_title', '家庭成员职务', '<input>'))));
    await page.evaluate(() => { resume.collections.familyMember[0].position = '不得串填'; });
    assert.equal((await page.evaluate(() => ResumeSiteAdapters[0].run('FILL', resume))).filled, 0);
    assert.equal(await page.locator('[key="job_title"] input').inputValue(), '');
    if (process.argv[2]) {
      const snapshot = fs.readFileSync(process.argv[2], 'utf8');
      const audit = await page.evaluate(snapshot => ResumePageAudit.fromHTML(snapshot, ResumeShared.sampleResume()), snapshot);
      assert.equal(audit.adapter, 'pipechina'); assert.equal(audit.canGuaranteeComplete, false);
      assert.equal(audit.rows.filter(r => r.capability === 'ready').length, 0);
      assert.equal(audit.counts.unmapped, 0);
      assert.ok(audit.total >= 80); assert.ok(!audit.rows.some(r => /背景调查|AI面试|现职级/.test(r.section + r.label)));
      console.log(JSON.stringify({ total: audit.total, counts: audit.counts, sections: [...new Set(audit.rows.map(r => r.section))], missing: audit.rows.filter(r => r.dataStatus === 'missing').map(r => r.path), invalid: audit.rows.filter(r => r.dataStatus === 'invalid').map(r => r.path) }, null, 2));
    }
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS PipeChina: inert snapshot, hidden exclusions, exact indexed mapping, preview, native controls, preservation, repeated fill and final verification.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
