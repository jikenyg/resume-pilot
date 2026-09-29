const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'shared/site-moka.js');
const field = (label, control, required = false) => `<div class="apply-field-fixture"><div class="title-fixture">${label}${required ? '*' : ''}</div><div class="ctrl-fixture">${control}</div></div>`;
const text = label => field(label, '<input maxlength="255">');
const select = (value = '', id = '') => `<div class="sd-Dropdown-container-fixture"><label class="sd-Select-container-fixture" ${id ? `aria-controls="${id}"` : ''}><span class="sd-Input-display-value-fixture">${value}</span><input placeholder="请选择" value=""></label></div>`;
const entry = html => `<div class="apply-fields-fixture">${html}</div>`;
const section = (label, content, add = false) => `<div class="apply-block-fixture"><div class="blockTitle-fixture"><span class="text-fixture">${label}</span>${add ? '<button type="button">添加</button>' : ''}</div>${content}</div>`;
const months = () => select() + select() + select() + select() + '<label><input type="checkbox">至今</label>';
const resume = {
  base: { name: '合成姓名', gender: '女', currentCity: '合成城市', recentCompany: '合成最近公司', idType: '身份证', idCard: '110101200002290027', currentSalary: '合成薪资', expectedSalary: '合成期望', expectedCity: '合成意向城市' },
  collections: { work: [{ company: '合成工作甲', position: '合成职位甲', startDate: '2021-02-01', endDate: '2022-02-01', isCurrent: '否' }, { company: '合成工作乙', position: '合成职位乙' }], internship: [{ company: '合成实习甲' }], project: [{ name: '合成项目', role: '合成角色', dutySummary: '合成简短职责', description: '合成描述', responsibilities: '合成职责' }], language: [{ name: '英语', level: '六级' }] },
};
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addScriptTag({ path: file }); // Works before schema.js.
    await page.addScriptTag({ path: file }); // Registration is idempotent.
    assert.equal(await page.evaluate(() => ResumeSiteAdapters.length), 1);
    await page.evaluate(r => { window.resume = r; window.adapter = ResumeSiteAdapters[0]; }, resume);
    const html = section('个人信息', entry(field('性别', select('', 'gender-options')) + text('所在地') + text('最近公司') + field('证件号码', select('身份证') + '<input placeholder="证件号码">'))) +
      section('求职意向', entry(text('当前薪资') + text('期望薪资') + text('期望城市'))) +
      section('工作经历', entry(field('起止时间', months()) + text('公司名称') + text('职位名称')) + entry(field('公司名称', '<input value="网页已有公司">') + text('职位名称')), true) +
      section('实习经历', entry(text('公司名称'))) +
      section('项目经验', entry(text('项目名称') + text('职责') + field('项目描述', '<textarea></textarea>') + field('项目中职责', '<textarea></textarea>'))) +
      section('语言能力', entry(text('语言类型') + field('掌握程度', select()) + field('听说', select()) + field('读写', select()))) + '<button id="submit" type="submit">提交</button>';
    let requests = 0;
    await page.route('**/*', route => { requests++; return route.abort(); });
    const audit = await page.evaluate(html => {
      const template = document.createElement('template'); template.innerHTML = html + '<img src="https://example.invalid/moka-tracker"><script>window.untrustedExecuted=true</script>';
      return adapter.scan(template.content, resume);
    }, html);
    assert.equal(requests, 0);
    assert.equal(await page.evaluate(() => window.untrustedExecuted), undefined);
    assert.equal(await page.locator('input').count(), 0);
    assert.equal(audit.canGuaranteeComplete, false);
    assert.equal(audit.rows.find(r => r.label === '掌握程度').path, 'language[0].proficiency');
    assert.equal(audit.rows.find(r => r.label === '掌握程度').dataStatus, 'missing');
    assert.equal(audit.rows.find(r => r.label === '项目中职责').path, 'project[0].responsibilities');
    assert.equal(audit.rows.find(r => r.label === '职责').path, 'project[0].dutySummary');
    assert.equal(audit.rows.find(r => r.label === '起止时间 / 结束').path, 'work[0].endDate');
    assert.equal(audit.rows.find(r => r.label === '是否至今').path, 'work[0].isCurrent');
    assert.equal(audit.rows.find(r => r.section === '实习经历').path, 'internship[0].company');
    assert.ok(!JSON.stringify(audit).includes('合成'));
    assert.ok(!JSON.stringify(audit).includes('网页已有公司'));
    await page.setContent(html);
    await page.evaluate(() => {
      window.submits = 0; document.getElementById('submit').onclick = () => submits++;
      const el = document.querySelector('[aria-controls="gender-options"]');
      el.onclick = () => {
        if (document.getElementById('gender-options')) return;
        const list = document.createElement('div'); list.id = 'gender-options'; list.setAttribute('role', 'listbox');
        const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '女';
        option.onclick = () => { el.querySelector('span').textContent = '女'; list.remove(); }; list.append(option); document.body.append(list);
      };
    });
    const preview = await page.evaluate(() => adapter.run('PREVIEW', resume));
    assert.equal(preview.filled, 0);
    assert.equal(await page.locator('input').nth(1).inputValue(), '');
    const result = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(result.filled, 15);
    assert.equal(await page.locator('.sd-Input-display-value-fixture').first().textContent(), '女');
    assert.equal(await page.locator('input[value="网页已有公司"]').inputValue(), '网页已有公司');
    assert.equal(await page.locator('input').evaluateAll(els => els.some(n => n.value === '合成职位乙')), false);
    assert.ok(result.issues.some(r => /避免混合经历/.test(r.reason)));
    assert.ok(await page.locator('input').evaluateAll(els => els.some(n => n.value === '合成实习甲')));
    assert.equal(await page.evaluate(() => submits), 0);
    assert.equal((await page.evaluate(() => adapter.run('FILL', resume))).filled, 0);

    // Linked writes: a page reaction pre-populates a later field, then clears an earlier one.
    await page.setContent(section('个人信息', entry(field('性别', select('女')) + text('所在地') + text('最近公司'))) + section('求职意向', entry(text('期望城市'))));
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      inputs[1].addEventListener('change', () => { inputs[2].value = '网页联动公司'; });
      inputs[3].addEventListener('change', () => { inputs[1].value = ''; });
    });
    const linked = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(linked.filled, 1);
    assert.ok(linked.issues.some(r => /已保留/.test(r.reason)));
    assert.ok(linked.issues.some(r => /读回不一致/.test(r.reason)));
    assert.equal(await page.locator('input').nth(2).inputValue(), '网页联动公司');

    // Search input text is never considered a committed selection. Duplicate choices are refused.
    await page.setContent(section('个人信息', entry(field('性别', select('', 'duplicate')))));
    await page.evaluate(() => {
      document.querySelector('input').value = '女';
      document.querySelector('[aria-controls]').onclick = () => {
        const list = document.createElement('div'); list.id = 'duplicate'; list.innerHTML = '<div role="option">女</div><div role="option">女</div>'; document.body.append(list);
      };
    });
    assert.equal((await page.evaluate(() => adapter.scan(document, resume))).rows[0].existing, false);
    const duplicate = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(duplicate.filled, 0);
    assert.ok(duplicate.issues.some(r => /唯一/.test(r.reason)));

    // Exact add button expands within its section, never saves/submits, and remains idempotent.
    await page.setContent(section('个人信息', entry(field('性别', select('女')))) + section('工作经历', entry(text('公司名称')), true));
    await page.evaluate(() => {
      const button = document.querySelector('button'); button.onclick = () => {
        const block = button.closest('.apply-block-fixture'); const original = block.querySelector('.apply-fields-fixture');
        const copy = original.cloneNode(true); copy.querySelector('input').value = ''; block.append(copy);
      };
    });
    const expanded = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(expanded.created, 1);
    assert.equal(expanded.filled, 2);
    assert.equal((await page.evaluate(() => adapter.run('FILL', resume))).created, 0);

    // Validation and partial-month preservation.
    await page.setContent(section('个人信息', entry(field('性别', select('女')) + field('证件号码', select('身份证') + '<input>'))) + section('工作经历', entry(field('起止时间', select('2021') + select() + select() + select() + '<input type="checkbox">'))));
    const invalid = await page.evaluate(() => adapter.scan(document, { base: { idCard: '123' }, collections: { work: [{ startDate: '2021-02-30', endDate: '2020' }] } }));
    assert.equal(invalid.counts.invalid, 3);
    assert.equal(invalid.rows.find(r => r.label === '起止时间 / 开始').partial, true);

    // Owned year/month choices accept only a date projection, and detect subsequent clearing.
    await page.setContent(section('个人信息', entry(field('性别', select('女')))) + section('教育背景', entry(field('就读时间', select('', 'start-year') + select('', 'start-month') + select('', 'end-year') + select('', 'end-month')))));
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[aria-controls]')) el.onclick = () => {
        const id = el.getAttribute('aria-controls'); if (document.getElementById(id)) return;
        const list = document.createElement('div'); list.id = id; list.setAttribute('role', 'listbox');
        const option = document.createElement('div'); option.setAttribute('role', 'option');
        option.textContent = id.endsWith('year') ? id.startsWith('start') ? '2020年' : '2024年' : '9月';
        option.onclick = () => { el.querySelector('span').textContent = option.textContent; list.remove(); }; list.append(option); document.body.append(list);
      };
    });
    const monthResult = await page.evaluate(() => adapter.run('FILL', { collections: { education: [{ startDate: '2020-09-01', endDate: '2024-09' }] } }));
    assert.equal(monthResult.filled, 2);
    assert.equal(await page.locator('[aria-controls="start-month"] span').textContent(), '9月');
    const ongoing = await page.evaluate(html => {
      const t = document.createElement('template'); t.innerHTML = html;
      return adapter.scan(t.content, { collections: { internship: [{ startDate: '2024-09', endDate: '至今' }] } });
    }, section('实习经历', entry(field('起止时间', months()))));
    assert.equal(ongoing.rows.find(r => r.label === '起止时间 / 结束').dataStatus, 'notApplicable');
    assert.equal(ongoing.rows.find(r => r.label === '是否至今').dataStatus, 'present');
    const manual = await page.evaluate(html => {
      const t = document.createElement('template'); t.innerHTML = html;
      return adapter.scan(t.content, {});
    }, '<input type="file"><label><input type="checkbox">同意隐私协议</label><div class="avatar-fixture">头像</div>');
    assert.equal(manual.counts.manual, 3);
    assert.deepEqual(errors, []);

    // Optional original snapshot: inert template only. Never attach, execute, or log personal values.
    const snapshot = process.argv[2] || process.env.MOKA_HTML;
    if (snapshot && fs.existsSync(snapshot)) {
      await page.addScriptTag({ path: path.join(root, 'shared/schema.js') });
      const original = await page.evaluate(html => {
        const template = document.createElement('template'); template.innerHTML = html;
        if (!adapter.match(template.content)) throw Error('Original Moka snapshot must match');
        return adapter.scan(template.content, ResumeShared.sampleResume());
      }, fs.readFileSync(snapshot, 'utf8'));
      assert.equal(original.counts.unmapped, 0);
      assert.equal(original.rows.filter(r => r.section === '基础信息').length, 3);
      assert.equal(original.rows.filter(r => r.section === '基础信息' && r.existing).length, 3);
      assert.ok(original.rows.some(r => r.path === 'education[0].school' && r.capability === 'dynamic'));
      console.log('Original snapshot summary:', JSON.stringify({ total: original.total, counts: original.counts,
        missing: original.rows.filter(r => r.dataStatus === 'missing').map(r => ({ section: r.section, label: r.label, path: r.path })),
        invalid: original.rows.filter(r => r.dataStatus === 'invalid').map(r => ({ label: r.label, path: r.path, reason: r.reason })) }));
    }
    console.log('Moka adapter tests passed (Edge, synthetic controls + inert original snapshot).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
