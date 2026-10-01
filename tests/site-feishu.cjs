const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/feishu-satellite.sanitized.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => route.abort());
    await page.setContent(fixture + '<input id="unrelated" placeholder="姓名"><button id="save">保存</button>');
    for (const file of [...manifest.content_scripts[0].js.filter(p => p.startsWith('shared/site-')), 'shared/schema.js', 'shared/page-audit.js']) await page.addScriptTag({ path: path.join(root, file) });
    const initial = await page.evaluate(() => {
      window.adapter = ResumeSiteAdapters.find(a => a.id === 'feishu');
      window.resume = ResumeShared.emptyResume();
      window.rows = () => adapter.describe(document, resume);
      window.row = (section, field, slot = 0) => rows().find(r => r.section === section && r.key === field && r.slot === slot);
      window.saves = 0; document.querySelector('#save').onclick = () => saves++;
      return { matches: ResumeSiteAdapters.filter(a => a.match(document)).map(a => a.id), audit: adapter.scan(document, resume) };
    });
    assert.deepEqual(initial.matches, ['feishu']);
    assert.deepEqual(initial.audit.rows.filter(r => r.capability === 'unmapped'), []);
    assert.equal(initial.audit.rows.filter(r => r.section === '教育经历').length, 5);
    assert.ok(initial.audit.rows.some(r => r.path === 'base.phone' && r.capability === 'manual' && r.existing));
    if (process.argv[2]) {
      const actual = await page.evaluate(html => ResumePageAudit.scan(new DOMParser().parseFromString(html, 'text/html'), ResumeShared.emptyResume()), fs.readFileSync(process.argv[2], 'utf8'));
      assert.deepEqual(actual.rows.map(r => [r.section, r.label, r.path]), initial.audit.rows.map(r => [r.section, r.label, r.path]));
    }
    await page.evaluate(() => {
      resume.base = { name: '应聘人测试', email: 'applicant@example.invalid', phone: '13800000000', selfEval: '严谨协作，专注研发' };
      resume.collections.education = [{ school: '自由输入测试学校', degree: '硕士', major: '计算机', startDate: '2024-09-01', endDate: '2027-06-30' }, { school: '测试本科学校', degree: '本科', major: '软件工程', startDate: '2020-09', endDate: '2024-06' }];
      resume.collections.work = [{ company: '正式公司', position: '工程师', description: '正式研发工作', startDate: '2023-07', endDate: '2024-06' }];
      resume.collections.internship = [{ company: '实习公司一', position: '实习生', description: '实习项目一', startDate: '2021-07', endDate: '2021-08' }, { company: '实习公司二', position: '开发实习生', description: '实习项目二', startDate: '2022-07', endDate: '2022-08' }];
      resume.collections.project = [{ name: '科研项目', role: '算法开发', description: '项目内容', link: 'https://example.invalid/project', startDate: '2024-09', endDate: '至今' }];
      resume.collections.award = [{ name: '测试竞赛奖', date: '2023-05-01', description: '竞赛成果' }];
      resume.collections.honor = [{ name: '测试荣誉', date: '2022', description: '学校荣誉' }];
      resume.collections.language = [{ name: '英语', level: '六级', proficiency: '熟练' }];
      resume.collections.portfolio = [{ link: 'https://example.invalid/work', description: '作品内容' }];
      resume.collections.socialAccount = [{ platform: 'GitHub', link: 'https://example.invalid/account' }];
      window.adds = 0;
      // The collapsed blocks use public ATSX binding names; ids are intentionally sparse.
      const sections = () => [...document.querySelectorAll('.createFormSection-container')];
      const find = name => sections().find(n => n.querySelector('.createFormSection-title')?.textContent === name);
      const prototype = document.querySelector('.resumeEditForm-item.resumeEditForm-education');
      const textTemplate = prototype.querySelector('[data-cy="education[0].fieldOfStudy"]');
      const selectTemplate = prototype.querySelector('[data-cy="education[0].degree"]');
      const periodTemplate = prototype.querySelector('[data-cy="education[0].period"]');
      const definitions = {
        实习经历: ['internship', [['company', '公司名称'], ['title', '职位名称'], ['period', '起止时间', 'period'], ['desc', '描述', 'textarea']]],
        项目经历: ['project', [['name', '项目名称'], ['role', '角色'], ['period', '起止时间', 'period'], ['link', '链接'], ['desc', '描述', 'textarea']]],
        获奖: ['award', [['title', '奖项名称'], ['date', '获奖时间', 'year'], ['desc', '描述', 'textarea']]],
        语言能力: ['language', [['language', '语言', 'select'], ['proficiency', '掌握程度', 'select']]],
        作品: ['works', [['link', '链接'], ['desc', '描述', 'textarea'], ['attachmentId', '附件', 'file']]],
        社交账号: ['sns', [['snsType', '平台', 'select'], ['link', '链接']]],
      };
      function make(name, index) {
        const [prefix, fields] = definitions[name], record = document.createElement('div'); record.className = 'resumeEditForm-item resumeEditForm-' + prefix;
        for (const [field, label, kind = 'text'] of fields) {
          const item = (kind === 'period' ? periodTemplate : kind === 'select' ? selectTemplate : textTemplate).cloneNode(true);
          const old = item.getAttribute('data-cy'), id = `${prefix}[${index}].${field}`;
          for (const n of [item, ...item.querySelectorAll('*')]) for (const attr of ['id', 'for', 'data-cy']) { const v = n.getAttribute(attr); if (v?.startsWith(old)) n.setAttribute(attr, v.replace(old, id)); }
          item.querySelector('.customResumeForm-fieldName').textContent = label;
          if (kind === 'textarea') { const input = item.querySelector('input'), area = document.createElement('textarea'); area.id = id; input.replaceWith(area); }
          if (kind === 'file') item.querySelector('input').type = 'file';
          if (kind === 'year') { const input = item.querySelector('input'), picker = document.createElement('div'); picker.className = 'atsx-date-picker'; input.placeholder = 'YYYY'; input.replaceWith(picker); picker.append(input); }
          record.append(item);
        }
        return record;
      }
      document.addEventListener('click', event => {
        const button = event.target.closest('.createFormSection-addBtn,.formOperate-addBtn');
        if (button) {
          const section = button.closest('.createFormSection-container'), name = section.querySelector('.createFormSection-title').textContent, index = section.querySelectorAll('.resumeEditForm-item').length * 3 + 2;
          let record;
          if (definitions[name]) record = make(name, index);
          else {
            record = section.querySelector('.resumeEditForm-item').cloneNode(true);
            for (const n of [record, ...record.querySelectorAll('*')]) for (const attr of ['id', 'for', 'data-cy']) { const v = n.getAttribute(attr); if (v) n.setAttribute(attr, v.replace(/\[\d+\]/g, `[${index}]`)); }
          }
          record.querySelectorAll('input,textarea').forEach(n => { if (n.type !== 'file') n.value = ''; });
          record.querySelectorAll('.atsx-select-selection-selected-value,.formOperate-addBtn-container').forEach(n => n.remove());
          section.querySelector('.createFormSection-right').append(record); adds++;
          return;
        }
        const select = event.target.closest('.atsx-select:not(.atsx-select-combobox)');
        if (select) {
          const box = select.querySelector('[role="combobox"]');
          document.querySelectorAll('.test-options').forEach(n => n.remove());
          const list = document.createElement('ul'); list.id = 'owned-' + Math.random(); list.className = 'test-options'; box.setAttribute('aria-controls', list.id);
          for (const text of ['硕士研究生', '本科', '英语', '熟练', 'GitHub']) {
            const option = document.createElement('li'); option.className = 'atsx-select-dropdown-menu-item'; option.textContent = text;
            option.onclick = () => { select.querySelector('.atsx-select-selection-selected-value')?.remove(); const value = document.createElement('div'); value.className = 'atsx-select-selection-selected-value'; value.textContent = text; select.append(value); list.remove(); }; list.append(option);
          }
          document.body.append(list); return;
        }
        const label = event.target.closest('.atsx-date-picker-period-month-label');
        if (label) {
          const picker = label.closest('.atsx-date-picker-period-month'), part = [...picker.querySelectorAll('.atsx-date-picker-period-month-label')].indexOf(label);
          document.querySelectorAll('.atsx-date-picker-period-month-panel').forEach(n => n.remove());
          const panel = document.createElement('div'); panel.className = 'atsx-date-picker-period-month-panel'; panel.setAttribute('data-cy', picker.getAttribute('data-cy') + (part ? 'EndDropdown' : 'BeginDropdown'));
          for (const [column, values] of [[0, ['-', '2020', '2021', '2022', '2023', '2024', '2027']], [1, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))]]) {
            const list = document.createElement('div'); list.className = 'atsx-date-picker-period-month-panel-list';
            for (const value of values) {
              if (value === '-' && !part) continue;
              const option = document.createElement('div'); option.className = 'atsx-date-picker-period-month-panel-list-item'; option.setAttribute('data-cy', value); option.textContent = value === '-' ? '至今' : value;
              option.onclick = () => { if (value === '-') { label.innerHTML = '<span class="atsx-date-picker-period-month-label-toToday">至今</span>'; panel.remove(); } else { label.querySelector(column ? '[data-cy="month"]' : '[data-cy="year"]').textContent = value; if (column) panel.remove(); } };
              list.append(option);
            }
            panel.append(list);
          }
          document.body.append(panel);
        }
      });
    });
    assert.equal((await page.evaluate(() => adapter.run('PREVIEW', resume))).created, 0);
    assert.equal(await page.evaluate(() => adds), 0);
    const result = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(result.created, 9);
    assert.equal(result.dropdownFailed, 0, JSON.stringify(result.issues));
    const actual = await page.evaluate(() => {
      const get = (section, field, index = 0) => row(section, field, index)?.before;
      return { name: get('基本信息', 'name'), email: get('基本信息', 'email'), phone: get('基本信息', 'phone'), schools: [0, 1].map(i => get('教育经历', 'school', i)), degree: get('教育经历', 'degree'), dates: ['startDate', 'endDate'].map(k => get('教育经历', k)),
        work: get('工作经历', 'company'), interns: [0, 1].map(i => get('实习经历', 'company', i)), project: get('项目经历', 'name'), ongoing: get('项目经历', 'endDate'),
        awards: [0, 1].map(i => get('获奖', 'name', i)), year: get('获奖', 'date'), proficiency: get('语言能力', 'proficiency'), portfolio: get('作品', 'link'), social: get('社交账号', 'platform'), selfEval: get('自我评价', 'selfEval'),
        hidden: document.querySelector('.atsx-date-picker-period-hidden-input').value, unchecked: !document.querySelector('.noExperience-container input').checked, unrelated: document.querySelector('#unrelated').value, saves };
    });
    assert.deepEqual(actual, { name: '应聘人测试', email: 'applicant@example.invalid', phone: '13800000000', schools: ['自由输入测试学校', '测试本科学校'], degree: '硕士研究生', dates: ['2024-09', '2027-06'], work: '正式公司', interns: ['实习公司一', '实习公司二'], project: '科研项目', ongoing: '至今', awards: ['测试竞赛奖', '测试荣誉'], year: '2023', proficiency: '熟练', portfolio: 'https://example.invalid/work', social: 'GitHub', selfEval: '严谨协作，专注研发', hidden: '', unchecked: true, unrelated: '', saves: 0 });
    assert.ok(!JSON.stringify(result.audit).includes('应聘人测试'));
    const second = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(second.created, 0); assert.equal(second.filled, 0);
    assert.deepEqual(await page.evaluate(() => rows().filter(r => r.path && !(r.path.startsWith('base.') ? ResumeShared.BASE_FIELD_DEFS : ResumeShared.COLLECTION_DEFS.find(c => c.key === r.path.split('[')[0])?.fields || []).some(f => r.path.endsWith('.' + f.key))).map(r => r.path)), []);
    await page.evaluate(() => { row('教育经历', 'school').el.querySelector('input').value = '另一所学校'; row('教育经历', 'major').el.value = ''; resume.base.phone = '13900000000'; });
    const conflict = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(conflict.issues.some(i => i.reason.includes('停止补填')));
    assert.ok(conflict.issues.some(i => i.reason.includes('登录手机号')));
    assert.equal(await page.evaluate(() => row('教育经历', 'major').before), '');
    const invalid = await page.evaluate(() => {
      resume.collections.internship[0].startDate = '2021-02-30'; resume.collections.project[0].endDate = '2023-01'; resume.base.feishuNoWorkExperience = '是';
      return rows().filter(r => r.dataStatus === 'invalid').map(r => r.path);
    });
    for (const key of ['internship[0].startDate', 'project[0].endDate', 'base.feishuNoWorkExperience']) assert.ok(invalid.includes(key));
    // Unowned popups and unknown custom fields must never trigger generic guessing.
    await page.evaluate(() => {
      row('语言能力', 'proficiency').el.querySelector('.atsx-select-selection-selected-value').remove(); resume.collections.language[0].proficiency = '不存在选项';
      const unrelated = document.createElement('ul'); unrelated.innerHTML = '<li role="option">不存在选项</li>'; unrelated.onclick = () => saves++; document.body.append(unrelated);
      const custom = row('自我评价', 'selfEval').item.cloneNode(true); custom.querySelector('.customResumeForm-fieldName').textContent = '另一个自定义问题'; custom.querySelector('textarea').value = ''; row('自我评价', 'selfEval').sectionEl.append(custom);
    });
    const missing = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(missing.issues.some(i => /没有唯一匹配/.test(i.reason)));
    assert.ok(missing.audit.rows.some(r => r.label === '另一个自定义问题' && r.capability === 'unmapped'));
    assert.equal(await page.evaluate(() => saves), 0);
    // Framework rejection after typing cannot be counted as successful school input.
    await page.evaluate(() => {
      const input = row('教育经历', 'school', 1).el.querySelector('input'); input.value = '';
      input.oninput = () => { input.value = ''; };
    });
    const rejected = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(rejected.issues.some(i => i.label.includes('学校名称') && /未被页面接受/.test(i.reason)));
    assert.equal(await page.evaluate(() => row('教育经历', 'school', 1).before), '');
    await page.evaluate(() => { window.chrome = { storage: { local: { get(keys, cb) { const saved = { resume, aiConfig: { enabled: true } }; cb?.(saved); return Promise.resolve(saved); }, async set() {} } }, runtime: { onMessage: { addListener() {} }, async sendMessage() { throw Error('Unexpected AI fallback'); } } }; });
    for (const file of ['shared/keywords.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, file) });
    assert.equal((await page.evaluate(() => ResumeAssistant.run('PREVIEW'))).adapter, 'feishu');
    assert.deepEqual(errors, []);
    console.log('PASS Feishu ATSX: supplied DOM, empty-block expansion, sparse ids, free-text schools, owned selects, period months/ongoing, awards, account phone, conflicts and routing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
