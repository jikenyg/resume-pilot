const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/beisen-ccdc.sanitized.html'), 'utf8');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<input id="unrelated" placeholder="姓名"><button id="save">保存</button>' + fixture);
    for (const script of ['shared/site-recruit2.js', 'shared/site-citic.js', 'shared/site-beisen.js', 'shared/schema.js', 'shared/page-audit.js', 'content/control-adapters.js']) await page.addScriptTag({ path: path.join(root, script) });
    const audit = await page.evaluate(() => {
      window.adapter = ResumeSiteAdapters.find(a => a.id === 'beisen');
      window.resume = ResumeShared.emptyResume();
      window.saves = 0; document.querySelector('#save').onclick = () => saves++;
      window.row = (section, label, slot = 0) => adapter.describe(document, resume).find(r => r.section === section && r.label === label && r.slot === slot);
      return ResumePageAudit.scan(document, resume);
    });
    assert.equal(audit.adapter, '北森 / 中央结算 Phoenix');
    assert.ok(audit.total > 95);
    assert.deepEqual(audit.rows.filter(r => r.capability === 'unmapped'), []);
    assert.ok(audit.rows.some(r => r.label === '高中经历缺失'));
    const schemaMissing = await page.evaluate(() => adapter.describe(document, resume).filter(r => r.path && !(r.path.startsWith('base.') ? ResumeShared.BASE_FIELD_DEFS : ResumeShared.COLLECTION_DEFS.find(c => c.key === r.path.split('[')[0])?.fields || []).some(f => r.path.endsWith('.' + f.key))).map(r => r.path));
    assert.deepEqual(schemaMissing, []);
    if (process.argv[2]) {
      const actual = await page.evaluate(html => ResumePageAudit.fromHTML(html, ResumeShared.emptyResume()), fs.readFileSync(process.argv[2], 'utf8'));
      assert.equal(actual.adapter, audit.adapter);
      assert.deepEqual(actual.rows.map(r => [r.section, r.label, r.path]), audit.rows.map(r => [r.section, r.label, r.path]));
    }
    await page.evaluate(() => {
      resume.base = { name: '本人测试', email: 'test@example.invalid', birthDate: '2001-06-03', phone: '13800000000', height: '163', weight: '52', specialty: '图像处理', hobby: '摄影', gender: '女', nationality: '汉族', household: '中国/河北省/唐山市/测试区' };
    });
    await page.evaluate(() => {
      resume.collections.education = [
        { school: '测试硕士学校', degree: '硕士', startDate: '2024-09-01', department: '计算机学院', major: '计算机科学', courses: '算法；数据库', gpa: '3.8' },
        { school: '测试高中', degree: '高中', startDate: '2017-09-01' },
        { school: '测试本科学校', degree: '本科', startDate: '2020-09-01', endDate: '2024-06-30' },
      ];
      resume.collections.internship = [{ company: '实习公司', description: '实习内容', refereeName: '实习证明人', refereePosition: '工程师', refereePhone: '13900000000', endDate: '至今' }];
      resume.collections.work = [{ company: '正式公司', position: '开发', department: '技术部', refereeName: '工作证明人', refereePosition: '经理', refereePhone: '13700000000' }];
      resume.collections.cadre = [{ role: '班长', startDate: '2022-09-01', description: '组织班级活动' }];
      resume.collections.publication = [{ name: '测试论文', journal: '测试期刊', journalLevel: '核心期刊', issue: '2025年第3期', authorOrder: '第一作者' }];
      resume.collections.certificate = [{ name: '教师资格证', category: '职业资格', authority: '测试发证机构', description: '数学教学资格' }];
      resume.collections.language = [{ name: '英语', level: '六级', proficiency: '熟练', score: '458' }];
      resume.collections.familyMember = [{ name: '测试父亲', age: '50', relation: '父亲', company: '测试农场', position: '务农', phone: '13600000000', politicalStatus: '群众' }, { name: '测试母亲', age: '49', relation: '母亲' }];
      window.adds = 0;
      for (const button of document.querySelectorAll('[id$="_addButton"]')) {
        button.onclick = () => {
          const container = button.parentElement;
          const clone = container.querySelector('.ux-standard-form').cloneNode(true);
          clone.querySelectorAll('input,textarea').forEach(n => n.value = '');
          clone.querySelectorAll('.phoenix-select__tipEle').forEach(n => n.remove());
          button.before(clone); adds++;
        };
      }
      // Synthetic component contract: isolated popups, no website script/network.
      document.addEventListener('click', event => {
        const radio = event.target.closest('.phoenix-radio');
        if (radio) {
          radio.closest('.phoenix-radio-group').querySelectorAll('.phoenix-radio').forEach(n => n.classList.remove('phoenix-radio--checked'));
          radio.classList.add('phoenix-radio--checked'); return;
        }
        const checkbox = event.target.closest('.phoenix-checkbox');
        if (checkbox) { checkbox.classList.toggle('phoenix-checkbox--checked'); return; }
        const host = event.target.closest('.phoenix-select');
        if (!host) return;
        document.querySelectorAll('.phoenix-selectList,.phoenix-date-picker,.constant-main-selector-container').forEach(n => n.remove());
        const label = host.closest('.form-item').querySelector('.form-item__text').textContent;
        const commit = text => { host.querySelectorAll('.phoenix-select__tipEle').forEach(n => n.remove()); const tip = document.createElement('span'); tip.className = 'phoenix-select__tipEle'; tip.textContent = text; host.append(tip); };
        const popup = document.createElement('div');
        if (/时间|日期/.test(label)) {
          popup.className = 'phoenix-date-picker'; popup.innerHTML = '<input class="phoenix-calendar-input" placeholder="YYYY-MM-DD">';
          popup.querySelector('input').onkeydown = e => { if (e.key === 'Enter') { commit(e.target.value); popup.remove(); } };
        } else if (label === '户口所在地') {
          popup.className = 'constant-main-selector-container';
          const route = ['中国', '河北省', '唐山市', '测试区']; let depth = 0;
          const render = () => {
            popup.innerHTML = '<div class="list-item-container"><span class="item-text-label">' + route[depth] + '</span></div>';
            popup.querySelector('.item-text-label').onclick = () => { if (depth === route.length - 1) { commit(route.join('/')); popup.remove(); } else { depth++; render(); } };
          }; render();
        } else if (label === '民族') {
          popup.className = 'constant-main-selector-container';
          if (window.useFooter) {
            popup.innerHTML = '<div class="list-item-container"><span class="item-text-label">汉族</span><span class="icon-container"><svg class="RadioUnchecked"></svg></span></div><div class="selector-footer-button"><div class="phoenix-button">确定</div></div>';
            let selected = false;
            popup.querySelector('svg').onclick = () => { selected = true; };
            popup.querySelector('.phoenix-button').onclick = () => { if (selected) { commit('汉族'); popup.remove(); } };
          } else {
            popup.innerHTML = '<div class="list-item-container"><span class="item-text-label">汉族</span></div>';
            popup.firstChild.onclick = () => { commit('汉族'); popup.remove(); }; // no footer, commits immediately
          }
        } else {
          popup.className = 'phoenix-selectList';
          for (const text of ['高中', '本科', '硕士研究生', '英语', '熟练', '父亲', '母亲', '群众', '职业资格']) {
            const option = document.createElement('div'); option.className = 'phoenix-selectList__listItem'; option.textContent = text;
            option.onclick = () => { commit(text); popup.remove(); }; popup.append(option);
          }
        }
        document.body.append(popup);
      });
    });
    const preview = await page.evaluate(() => adapter.run('PREVIEW', resume));
    assert.equal(preview.filled, 0);
    assert.equal(await page.evaluate(() => adds), 0);
    const result = await page.evaluate(() => adapter.run('FILL', resume));
    assert.equal(result.created, 3);
    assert.equal(result.dropdownFailed, 0, JSON.stringify(result.issues));
    const readback = await page.evaluate(() => {
      const text = (section, label, slot = 0) => row(section, label, slot)?.before;
      return { name: text('个人信息', '姓名'), email: text('个人信息', '邮箱'), birth: text('个人信息', '出生日期'), weight: text('个人信息', '体重(公斤)'),
        gender: text('个人信息', '性别'), nation: text('个人信息', '民族'), household: text('个人信息', '户口所在地'),
        schools: [0, 1, 2].map(i => text('教育经历', '学校名称', i)), courses: text('教育经历', '专业课程', 2),
        intern: text('实习经历', '单位名称'), referee: text('实习经历', '证明人职务'), ongoing: text('实习经历', '结束时间'), work: text('工作经历', '公司名称'),
        role: text('在校职务', '职务名称'), issue: text('论文/专著', '年度/期次'), journal: text('论文/专著', '所属期刊'),
        score: text('证书', '成绩'), exam: text('语言能力', '语言考试名称'),
        family: [text('家庭情况', '姓名'), text('家庭情况', '年龄'), text('家庭情况', '政治面貌'), text('家庭情况', '联系电话')],
        specialty: text('附加信息', '特长'), declaration: text('近亲属从业声明', '是否有近亲属在金融监管总局系统和本公司从业'), unrelated: document.querySelector('#unrelated').value, saves };
    });
    assert.deepEqual(readback, { name: '本人测试', email: 'test@example.invalid', birth: '2001-06-03', weight: '52', gender: '女', nation: '汉族', household: '中国/河北省/唐山市/测试区', schools: ['测试高中', '测试本科学校', '测试硕士学校'], courses: '算法；数据库', intern: '实习公司', referee: '工程师', ongoing: '至今', work: '正式公司', role: '班长', issue: '2025年第3期', journal: '测试期刊', score: '', exam: '六级', family: ['测试父亲', '50', '群众', '13600000000'], specialty: '图像处理', declaration: '', unrelated: '', saves: 0 });
    assert.ok(!JSON.stringify(result.audit).includes('本人测试'));
    assert.equal((await page.evaluate(() => adapter.run('FILL', resume))).created, 0);
    // A non-native Phoenix footer must commit its radio selection; never click page Save.
    const footer = await page.evaluate(async () => {
      window.useFooter = true;
      const host = row('个人信息', '民族').el;
      host.querySelector('.phoenix-select__tipEle').remove();
      return { status: await ResumeControlAdapters.fill(host, '汉族'), value: ResumeControlAdapters.read(host), saves };
    });
    assert.deepEqual(footer, { status: 'ok', value: '汉族', saves: 0 });
    // A nonexistent parent cannot fall through to a leaf from a different region.
    const wrongRegion = await page.evaluate(async () => {
      const host = row('个人信息', '户口所在地').el;
      host.querySelector('.phoenix-select__tipEle').remove();
      return { status: await ResumeControlAdapters.fill(host, '中国/不存在省/唐山市/测试区'), value: ResumeControlAdapters.read(host) };
    });
    assert.notEqual(wrongRegion.status, 'ok'); assert.equal(wrongRegion.value, '');
    // Existing bad values are reported and never silently blessed or overwritten.
    await page.evaluate(() => { row('个人信息', '邮箱').el.value = '2001-06-03'; row('家庭情况', '姓名').el.value = '本人测试'; row('家庭情况', '年龄').el.value = ''; });
    const conflict = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(conflict.issues.some(i => i.label.includes('邮箱') && i.reason.includes('已有内容')));
    assert.ok(conflict.audit.rows.some(r => r.path === 'base.email' && r.dataStatus === 'invalid'));
    assert.equal(await page.evaluate(() => row('家庭情况', '年龄').el.value), '');
    // Missing related-person data never inherits the applicant's values.
    await page.evaluate(() => { resume.collections.familyMember = []; resume.collections.internship = []; });
    const missing = await page.evaluate(() => adapter.describe(document, resume).filter(r => r.section === '家庭情况' || r.section === '实习经历').map(r => r.value));
    assert.ok(missing.every(v => v === ''));
    // Invalid dates and long journal fields fail before writing.
    const invalid = await page.evaluate(() => {
      resume.collections.publication[0].journal = '长'.repeat(101);
      resume.base.birthDate = '2025-02-30';
      return adapter.scan(document, resume).rows.filter(r => r.dataStatus === 'invalid').map(r => r.path);
    });
    assert.ok(invalid.includes('base.birthDate'));
    assert.ok(invalid.includes('publication[0].journal'));
    // A framework validation error must not count as a successful write.
    await page.evaluate(() => {
      resume.base.email = 'test@example.invalid'; row('个人信息', '邮箱').el.value = '';
      row('个人信息', '邮箱').el.oninput = () => {
        const message = document.createElement('div'); message.className = 'form-item__message--error'; message.textContent = '模拟网页校验失败'; row('个人信息', '邮箱').item.append(message);
      };
    });
    const rejected = await page.evaluate(() => adapter.run('FILL', resume));
    assert.ok(rejected.issues.some(i => i.label.includes('邮箱') && i.reason.includes('校验未通过')));
    // The normal popup route must select this adapter before generic/AI matching.
    await page.evaluate(() => {
      window.chrome = {
        storage: { local: { get(keys, callback) { const saved = { resume, aiConfig: { enabled: true } }; callback?.(saved); return Promise.resolve(saved); }, async set() {} } },
        runtime: { onMessage: { addListener() {} }, async sendMessage() { throw Error('Unexpected AI fallback'); } },
      };
    });
    for (const script of ['shared/keywords.js', 'content/content.js']) await page.addScriptTag({ path: path.join(root, script) });
    assert.equal((await page.evaluate(() => ResumeAssistant.run('PREVIEW'))).adapter, 'beisen');
    assert.deepEqual(errors, []);
    console.log(`PASS Beisen: ${audit.total} audit items; exact labels, related people, repeated records, dates, radios, cascading regions, immediate select commits, missing data and conflict protection.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
