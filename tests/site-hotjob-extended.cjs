const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/hotjob-extended.sanitized.html'), 'utf8');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(fixture + '<button id="save">保存</button>');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    for (const file of manifest.content_scripts[0].js.filter(f => f.startsWith('shared/site-') || ['shared/schema.js', 'shared/page-audit.js', 'content/hotjob.js'].includes(f))) await page.addScriptTag({ path: path.join(root, file) });
    const initial = await page.evaluate(() => {
      window.adapter = ResumeSiteAdapters.find(a => a.id === 'hotjob-extended');
      window.resume = ResumeShared.emptyResume();
      window.row = (id) => adapter.describe(document, resume).find(r => r.item.id === id);
      return { audit: ResumePageAudit.scan(document, resume), badPaths: adapter.describe(document, resume).filter(r => r.path && !(r.path.startsWith('base.') ? ResumeShared.BASE_FIELD_DEFS : ResumeShared.COLLECTION_DEFS.find(c => c.key === r.path.split('[')[0])?.fields || []).some(f => r.path.endsWith('.' + f.key))).map(r => r.path) };
    });
    assert.deepEqual(initial.badPaths, []);
    assert.equal(initial.audit.adapter, 'Hotjob / 扩展招聘表单');
    assert.deepEqual(initial.audit.rows.filter(r => r.capability === 'unmapped'), []);
    assert.ok(initial.audit.rows.some(r => r.section === '工作经历' && r.dataStatus === 'unknown'));
    if (process.argv[2]) {
      const actual = await page.evaluate(html => ResumePageAudit.fromHTML(html, ResumeShared.emptyResume()), fs.readFileSync(process.argv[2], 'utf8'));
      assert.deepEqual(actual.rows.map(r => [r.section, r.label, r.path]), initial.audit.rows.map(r => [r.section, r.label, r.path]));
    }
    await page.evaluate(() => {
      resume.base = { name: '测试本人', formerName: '无', email: 'test@example.invalid', phone: '13800000000', gender: '女', educationDegree: '硕士', birthDate: '2001-06-03', acceptAdjustment: '是', household: '中国/河北/唐山', school: '测试大学', major: '计算机科学', hobby: '摄影', specialty: '写作' };
      resume.collections.education = [{ degree: '硕士', startDate: '2024-09-01', endDate: '2027-07-01', overseasEducation: '否', city: '河北/唐山' }, { degree: '高中', startDate: '2017-09-01', endDate: '2020-07-01', overseasEducation: '否' }];
      resume.collections.internship = [{ company: '实习单位', department: '研发部', position: '实习开发', description: '实习描述', city: '河北/唐山', overseasExperience: '否' }];
      resume.collections.project = [{ name: '项目甲', description: '项目甲内容', responsibilities: '项目甲职责' }, { name: '项目乙', description: '项目乙内容', responsibilities: '项目乙职责' }];
      resume.collections.language = [{ name: '日语', certificate: 'N2', score: '150' }, { name: '英语', level: '六级', score: '458', date: '2023-06-01' }];
      resume.collections.skill = [{ category: '开发语言', name: 'Java', duration: '2年', level: '熟练' }];
      resume.collections.familyMember = [{ name: '测试父亲', relation: '父亲', company: '家庭单位', position: '职员', phone: '13900000000' }, { name: '测试母亲', relation: '母亲', company: '另一单位', position: '教师' }];
      window.saves = 0; window.adds = 0; document.querySelector('#save').onclick = () => saves++;
      // Keep this source's empty sections inert except the educational repeat control.
      document.querySelector('[id="14"] .add-more-btn').onclick = event => {
        const section = event.currentTarget.closest('.form-cell'), cards = section.querySelectorAll('.form-cell-inner');
        const clone = cards[0].cloneNode(true);
        clone.querySelectorAll('[id]').forEach(n => n.id = n.id.replace(/_\d+$/, '_' + cards.length));
        clone.querySelectorAll('input,textarea').forEach(n => n.value = '');
        clone.querySelectorAll('[role="combobox"]').forEach(n => { n.setAttribute('aria-controls', n.getAttribute('aria-controls') + '-' + cards.length); n.querySelectorAll('.ant-select-selection-selected-value').forEach(c => c.remove()); });
        event.currentTarget.parentElement.before(clone); adds++;
      };
      document.addEventListener('click', event => {
        const combo = event.target.closest('[role="combobox"]');
        if (combo) {
          document.querySelectorAll('.ant-select-dropdown').forEach(n => n.remove());
          const popup = document.createElement('div'); popup.className = 'ant-select-dropdown'; popup.id = combo.getAttribute('aria-controls');
          for (const text of ['硕士研究生', '高中', '河北', '唐山', '否', '六级', '开发语言', 'Java', '2年', '熟练', '父亲', '母亲']) {
            const opt = document.createElement('div'); opt.className = 'ant-select-dropdown-menu-item'; opt.textContent = text;
            opt.onclick = () => {
              combo.querySelectorAll('.ant-select-selection-selected-value').forEach(n => n.remove());
              const selected = document.createElement('span'); selected.className = 'ant-select-selection-selected-value'; selected.textContent = text; combo.append(selected); popup.remove();
              // Degree reveals additional fields not in the supplied snapshot.
              if (combo.closest('[id="14_53_0"]') && !document.getElementById('14_999_0')) {
                const field = document.createElement('div'); field.id = '14_999_0'; field.innerHTML = '<div class="ant-form-item"><div class="ant-form-item-label"><label>专业描述</label></div><textarea></textarea></div>'; combo.closest('.form-cell-inner').append(field);
              }
            }; popup.append(opt);
          }
          document.body.append(popup); return;
        }
        const date = event.target.closest('.ant-calendar-picker-input');
        if (date) {
          document.querySelectorAll('.ant-calendar').forEach(n => n.remove());
          const panel = document.createElement('div'); panel.className = 'ant-calendar'; panel.innerHTML = '<input class="ant-calendar-input">';
          panel.firstChild.onkeydown = e => { if (e.key === 'Enter') { date.value = e.target.value; panel.remove(); } }; document.body.append(panel); return;
        }
        const item = event.target.closest('[id="11_32_0"],[id="11_33_0"]');
        if (item && event.target.tagName === 'INPUT') {
          const modal = document.createElement('div'); modal.className = 'ant-modal';
          modal.innerHTML = '<input placeholder="搜索"><div class="options"></div><button class="ant-modal-close">关闭</button>';
          modal.querySelector('input').oninput = e => { const option = document.createElement('span'); option.textContent = e.target.value; option.onclick = () => { event.target.value = option.textContent; modal.remove(); }; modal.querySelector('.options').replaceChildren(option); };
          modal.querySelector('button').onclick = () => modal.remove(); document.body.append(modal);
        }
      });
      resume.collections.education[1].description = '高中说明';
    });
    assert.equal((await page.evaluate(() => adapter.run('PREVIEW', resume))).filled, 0);
    assert.equal(await page.evaluate(() => adds), 0);
    const result = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(result.created, 1);
    assert.equal(result.dropdownFailed, 0, JSON.stringify(result.issues));
    const values = await page.evaluate(() => Object.fromEntries(['11_2_0', '11_100101_0', '11_37_0', '11_21_0', '11_30_0', '11_400_0', '11_27_0', '11_32_0', '11_33_0', '14_53_0', '14_53_1', '14_999_0', '123_2130_0', '123_2133_0', '40_210_1', '16_64_0', '18_69_0', '21_86_0', '21_100203_0', '21_100203_1', '101201_108505_0', '101301_108702_0'].map(id => [id, row(id)?.before])));
    assert.deepEqual(values, { '11_2_0': '测试本人', '11_100101_0': '无', '11_37_0': 'test@example.invalid', '11_21_0': '2001-06-03', '11_30_0': '硕士研究生', '11_400_0': '接受', '11_27_0': '河北 / 唐山', '11_32_0': '测试大学', '11_33_0': '计算机科学', '14_53_0': '高中', '14_53_1': '硕士研究生', '14_999_0': '高中说明', '123_2130_0': '实习单位', '123_2133_0': '研发部', '40_210_1': '项目乙职责', '16_64_0': '458', '18_69_0': '开发语言 / Java', '21_86_0': '测试父亲', '21_100203_0': '13900000000', '21_100203_1': '', '101201_108505_0': '', '101301_108702_0': '' });
    assert.equal(await page.evaluate(() => saves), 0);
    assert.equal(await page.locator('[id="11_32_0"] input').nth(1).inputValue(), '', 'Hidden fallback input must stay empty');
    assert.ok(!JSON.stringify(result.audit).includes('测试本人'));
    assert.equal((await page.evaluate(() => adapter.run('FILL', resume))).created, 0);
    await page.evaluate(() => { row('21_86_0').els[0].value = '已填其他人'; row('21_100203_0').els[0].value = ''; });
    const conflict = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(await page.evaluate(() => row('21_100203_0').before), '');
    assert.ok(conflict.issues.some(i => i.reason.includes('停止补填')));
    // Legacy Hotjob and Beisen must retain their own routes.
    const legacy = await page.evaluate(() => { const t = document.createElement('template'); t.innerHTML = '<div class="resume-operation-wrap"><div class="form-cell"><div class="tit"><p>个人基本信息</p></div><div class="ant-form-item"></div></div></div>'; return { ours: adapter.match(t.content), supported: ResumePageAudit.supported(t.content) }; });
    assert.deepEqual(legacy, { ours: false, supported: true });
    assert.deepEqual(errors, []);
    console.log(`PASS extended Hotjob: ${initial.audit.total} audit items; schema paths, original snapshot, repeated records, conditional fields, hidden alternatives, related people, English filtering, cascading skills/regions, picker commits and old route isolation.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
