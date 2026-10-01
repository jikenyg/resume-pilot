const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/beisen-chinalife.sanitized.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.setContent('<input id="unrelated" placeholder="姓名"><button id="save">保存</button>' + fixture);
    for (const script of [...manifest.content_scripts[0].js.filter(s => s.startsWith('shared/site-')), 'shared/schema.js', 'shared/page-audit.js', 'content/control-adapters.js']) await page.addScriptTag({ path: path.join(root, script) });
    const initial = await page.evaluate(() => {
      window.adapter = ResumeSiteAdapters.find(a => a.id === 'chinalife');
      window.resume = ResumeShared.emptyResume();
      window.row = (section, label, slot = 0) => adapter.describe(document, resume).find(r => r.section === section && r.label === label && r.slot === slot);
      window.saves = 0; document.querySelector('#save').onclick = () => saves++;
      return { matches: ResumeSiteAdapters.filter(a => a.match(document)).map(a => a.id), audit: ResumePageAudit.scan(document, resume),
        unsafe: [...document.querySelectorAll('input,textarea')].some(n => n.value || n.checked) || !!document.querySelector('script[src^="http"],iframe,img,.phoenix-radio--checked,.phoenix-select__tipEle') };
    });
    assert.deepEqual(initial.matches, ['chinalife']);
    assert.equal(initial.unsafe, false);
    const audit = initial.audit;
    assert.equal(audit.adapter, '中国人寿 / 北森 Phoenix');
    assert.equal(new Set(audit.rows.map(r => r.section)).size, 15);
    assert.ok(audit.total >= 90);
    assert.deepEqual(audit.rows.filter(r => r.capability === 'unmapped'), []);
    assert.equal(audit.rows.filter(r => r.capability === 'manual').length, 7);
    assert.deepEqual(await page.evaluate(() => adapter.describe(document, resume).filter(r => r.path && !(r.path.startsWith('base.') ? ResumeShared.BASE_FIELD_DEFS : ResumeShared.COLLECTION_DEFS.find(c => c.key === r.path.split('[')[0])?.fields || []).some(f => r.path.endsWith('.' + f.key))).map(r => r.path)), []);
    if (process.argv[2]) {
      const actual = await page.evaluate(html => ResumePageAudit.fromHTML(html, ResumeShared.emptyResume()), fs.readFileSync(process.argv[2], 'utf8'));
      assert.equal(actual.adapter, audit.adapter);
      assert.deepEqual(actual.rows.map(r => [r.section, r.label, r.path]), audit.rows.map(r => [r.section, r.label, r.path]));
    }
    await page.evaluate(() => {
      resume.base = { name: '本人测试', gender: '女', email: 'test@example.invalid', phone: '13800000000', birthDate: '2001-06-03', height: '163', weight: '52', country: '中国', nationality: '汉族', politicalStatus: '群众', maritalStatus: '未婚', health: '良好',
        partyJoinDate: '2021-05-04', acceptAdjustment: '否', chinaLifeCountyWork: '是', chinaLifeRelativeEmployment: '否', chinaLifeRelativeRetirement: '是',
        origin: '中国/河北省/唐山市/测试区', expectedCity: '北京市', expectedSalary: '20000元/月', chinaLifeExpectedAnnualSalaryWan: '24',
        emergencyName: '紧急联系人测试', emergencyPhone: '13900000000', hobbiesAndSpecialties: '摄影；编程', strengthsAndWeaknesses: '算法基础扎实；需加强业务积累', selfEvaluationAndGoals: '专注研发，希望从事技术工作' };
      resume.collections.education = [{ school: '测试硕士学校', degree: '硕士', academicDegree: '硕士', major: '计算机', secondMajor: '数学', startDate: '2024-09-01', endDate: '2027-06-30', fullTime: '是', highestFullTimeEducation: '是', primaryMajor: '是' }, { school: '测试本科学校', degree: '本科', fullTime: '是', highestFullTimeEducation: '否' }];
      resume.collections.work = [{ company: '测试正式公司', position: '工程师', department: '研发部', employmentType: '合同制', description: '研发工作', startDate: '2023-07-01', endDate: '2024-07-01' }];
      resume.collections.internship = [{ company: '测试实习公司', position: '实习生', department: '技术部', employmentType: '实习', description: '实习工作', startDate: '2022-07-01', endDate: '2022-08-31' }];
      resume.collections.award = [{ name: '测试竞赛奖', date: '2023-05-01', organization: '测试主办单位', level: '国家级', role: '队长', description: '竞赛成果' }];
      resume.collections.honor = [{ name: '测试荣誉', organization: '测试学校', role: '个人' }];
      resume.collections.publication = [{ name: '测试论文', journal: '测试期刊', role: '第一作者', authorOrder: '第二作者', date: '2025-01-01', description: '论文摘要' }];
      resume.collections.project = [{ name: '测试科研项目', level: '校级', role: '负责人', description: '算法研究', startDate: '2024-09-01', endDate: '至今' }];
      resume.collections.skill = [{ name: '羽毛球', section: '其他技能' }, { name: 'Java', section: '计算机技能' }];
      resume.collections.language = [{ name: '英语', level: '六级', score: '458' }];
      resume.collections.certificate = [{ name: '测试资格证', chinaLifeQualification: '专业技术资格', date: '2025-06-01' }];
      resume.collections.familyMember = [{ name: '测试父亲', relation: '父亲', birthDate: '1970-01-01', company: '测试农场', position: '务农' }, { name: '测试母亲', relation: '母亲', birthDate: '1972-02-02' }];
      window.adds = 0;
      for (const button of document.querySelectorAll('[id$="_addButton"]')) button.onclick = () => {
        const clone = button.parentElement.querySelector('.ux-standard-form').cloneNode(true);
        clone.querySelectorAll('input,textarea').forEach(n => n.value = '');
        clone.querySelectorAll('.phoenix-select__tipEle').forEach(n => n.remove());
        button.before(clone); adds++;
      };
      // Local component contracts, deliberately independent of the adapter's desired values.
      const options = ['汉族', '群众', '北京市', '硕士', '硕士研究生', '本科', '合同制', '实习', '国家级', '校级', '第一作者', '英语', '六级', '专业技术资格', '父亲', '母亲'];
      document.addEventListener('click', event => {
        const radio = event.target.closest('.phoenix-radio');
        if (radio) {
          radio.closest('.phoenix-radio-group').querySelectorAll('.phoenix-radio').forEach(n => n.classList.remove('phoenix-radio--checked'));
          radio.classList.add('phoenix-radio--checked');
          // Changing a preceding declaration can replace a later field's DOM node.
          if (radio.closest('.form-item').querySelector('.form-item__text').textContent === '是否愿意去县级公司工作') {
            const target = row('个人基本信息', '期望待遇(万元/年)').item;
            target.replaceWith(target.cloneNode(true));
          }
          return;
        }
        const check = event.target.closest('.phoenix-checkbox');
        if (check) { check.classList.toggle('phoenix-checkbox--checked'); return; }
        const host = event.target.closest('.phoenix-select');
        if (!host) return;
        document.querySelectorAll('.phoenix-selectList,.phoenix-date-picker,.constant-main-selector-container').forEach(n => n.remove());
        const label = host.closest('.form-item').querySelector('.form-item__text').textContent;
        const commit = text => { host.querySelectorAll('.phoenix-select__tipEle').forEach(n => n.remove()); const tip = document.createElement('span'); tip.className = 'phoenix-select__tipEle'; tip.textContent = text; host.append(tip); };
        const popup = document.createElement('div');
        if (/时间|日期|出生年月/.test(label)) {
          popup.className = 'phoenix-date-picker'; popup.innerHTML = '<input class="phoenix-calendar-input" placeholder="YYYY-MM-DD">';
          popup.firstChild.onkeydown = e => { if (e.key === 'Enter') { commit(e.target.value); popup.remove(); } };
        } else if (label === '籍贯') {
          popup.className = 'constant-main-selector-container'; let depth = 0; const route = ['中国', '河北省', '唐山市', '测试区'];
          const render = () => { popup.innerHTML = '<div class="list-item-container"><span class="item-text-label">' + route[depth] + '</span></div>'; popup.firstChild.onclick = () => { if (++depth === route.length) { commit(route.join('/')); popup.remove(); } else render(); }; }; render();
        } else {
          popup.className = 'phoenix-selectList';
          for (const text of options) { const option = document.createElement('div'); option.className = 'phoenix-selectList__listItem'; option.textContent = text; option.onclick = () => { commit(text); popup.remove(); }; popup.append(option); }
        }
        document.body.append(popup);
      });
    });
    const preview = await page.evaluate(() => adapter.run('PREVIEW', resume));
    assert.equal(preview.filled, 0); assert.equal(await page.evaluate(() => adds), 0);
    const result = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(result.created, 4);
    assert.equal(result.dropdownFailed, 0, JSON.stringify(result.issues));
    const actual = await page.evaluate(() => {
      const text = (s, l, i = 0) => row(s, l, i)?.before;
      return { basics: ['姓名', '电子邮箱', '出生年月', '身高(CM)', '体重(公斤)', '是否服从调剂', '期望待遇(万元/年)', '籍贯'].map(l => text('个人基本信息', l)),
        schools: [0, 1].map(i => text('教育经历', '学校', i)), companies: [0, 1].map(i => text('工作/实习经历', '单位名称', i)),
        internPath: row('工作/实习经历', '工作描述', 1).path, awards: [0, 1].map(i => text('学习/工作获奖情况', '奖项名称', i)),
        paper: ['文章名、书名', '刊物、出版社', '担任角色', '内容摘要'].map(l => text('专业论著', l)),
        family: [text('家庭成员及重要社会关系', '姓名'), text('家庭成员及重要社会关系', '出生日期'), text('家庭成员及重要社会关系', '姓名', 1)],
        declarations: ['个人基本信息', '附加信息'].map(s => text(s, '是否有亲属现在中国人寿或广发银行工作')),
        missing: [text('个人基本信息', '是否获得过奖学金'), text('个人基本信息', '是否为学生干部')],
        skill: text('计算机技能', '技能类别'), skillPath: row('计算机技能', '技能类别').path,
        score: text('语言能力', '得分'), qualification: text('专业资格', '具有资格证书'), ongoing: text('参与科研项目', '结束时间'),
        manual: adapter.describe(document, resume).filter(r => r.capability === 'manual').map(r => r.before), unrelated: document.querySelector('#unrelated').value, saves };
    });
    assert.deepEqual(actual, { basics: ['本人测试', 'test@example.invalid', '2001-06-03', '163', '52', '不接受', '24', '中国/河北省/唐山市/测试区'], schools: ['测试硕士学校', '测试本科学校'], companies: ['测试正式公司', '测试实习公司'], internPath: 'internship[0].description', awards: ['测试竞赛奖', '测试荣誉'], paper: ['测试论文', '测试期刊', '第一作者', '论文摘要'], family: ['测试父亲', '1970-01-01', '测试母亲'], declarations: ['否', '否'], missing: ['', ''], skill: 'Java', skillPath: 'skill[1].name', score: '458', qualification: '专业技术资格', ongoing: '至今', manual: Array(7).fill(''), unrelated: '', saves: 0 });
    assert.ok(!JSON.stringify(result.audit).includes('本人测试'));
    const repeat = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(repeat.created, 0); assert.equal(repeat.filled, 0);
    assert.ok(!repeat.issues.some(i => /已有内容/.test(i.reason)), JSON.stringify(repeat.issues));
    await page.evaluate(() => { row('家庭成员及重要社会关系', '姓名').el.value = '其他成员'; row('家庭成员及重要社会关系', '所属职务').el.value = ''; });
    const conflicts = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(conflicts.issues.some(i => /家庭成员/.test(i.label) && /已停止补填/.test(i.reason)));
    assert.equal(await page.evaluate(() => row('家庭成员及重要社会关系', '所属职务').before), '');
    const invalid = await page.evaluate(() => {
      resume.base.chinaLifeExpectedAnnualSalaryWan = '20000元/月'; resume.base.birthDate = '2025-02-30'; resume.base.chinaLifeScholarship = '应该是';
      return adapter.scan(document, resume).rows.filter(r => r.dataStatus === 'invalid').map(r => r.path);
    });
    for (const key of ['chinaLifeExpectedAnnualSalaryWan', 'birthDate', 'chinaLifeScholarship']) assert.ok(invalid.includes('base.' + key));
    await page.evaluate(() => { resume.base.chinaLifeExpectedAnnualSalaryWan = ''; resume.collections.familyMember = []; resume.collections.work = []; resume.collections.internship = []; });
    assert.ok((await page.evaluate(() => adapter.describe(document, resume).filter(r => ['家庭成员及重要社会关系', '工作/实习经历'].includes(r.section)).map(r => r.value))).every(v => v === ''));
    assert.equal(await page.evaluate(() => row('个人基本信息', '期望待遇(万元/年)').value), '');
    // Newly revealed unknown fields are reported, never routed to generic/AI guessing.
    await page.evaluate(() => {
      resume.base.chinaLifeCountyWork = '是'; row('个人基本信息', '是否愿意去县级公司工作').el.querySelectorAll('.phoenix-radio').forEach(n => n.classList.remove('phoenix-radio--checked'));
      row('个人基本信息', '是否愿意去县级公司工作').el.addEventListener('click', () => {
        if (document.querySelector('#conditional')) return;
        const clone = row('个人基本信息', '姓名').item.cloneNode(true); clone.id = 'conditional'; clone.querySelector('.form-item__text').textContent = '未提供的条件说明'; clone.querySelector('input').value = ''; row('个人基本信息', '姓名').form.append(clone);
      });
    });
    assert.ok((await page.evaluate(() => adapter.run('FILL', resume))).issues.some(i => i.label.includes('未提供的条件说明')));
    await page.evaluate(() => { window.chrome = { storage: { local: { get(keys, cb) { const saved = { resume, aiConfig: { enabled: true } }; cb?.(saved); return Promise.resolve(saved); }, async set() {} } }, runtime: { onMessage: { addListener() {} }, async sendMessage() { throw Error('Unexpected AI fallback'); } } }; });
    for (const script of ['shared/keywords.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, script) });
    assert.equal((await page.evaluate(() => ResumeAssistant.run('PREVIEW'))).adapter, 'chinalife');
    await page.setContent(fs.readFileSync(path.join(__dirname, 'fixtures/beisen-ccdc.sanitized.html'), 'utf8'));
    assert.deepEqual(await page.evaluate(() => ResumeSiteAdapters.filter(a => a.match(document)).map(a => a.id)), ['beisen']);
    assert.deepEqual(errors, []);
    console.log(`PASS China Life: ${audit.total} fields, 15 sections; exact mapping, combined records, declarations, controls, rerenders, conflicts and previous Beisen route.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
