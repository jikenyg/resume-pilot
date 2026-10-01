/* Beisen Phoenix resume forms: exact section + record + local label mapping.
 * No adjacent-label matching, global base fallbacks, AI synthesis, or form submission. */
(function () {
  'use strict';
  const field = (key, label, type = 'text') => ({ key, label, type });
  const yesNo = (key, label) => ({ key, label, type: 'select', options: ['是', '否'] });
  const referee = [field('refereeName', '证明人姓名'), field('refereePosition', '证明人职务'), field('refereePhone', '证明人联系方式')];
  const schema = {
    base: [field('learningForm', '最高学历学习形式'), field('studentOrigin', '生源地（省/市/区）'), yesNo('schoolCollectiveHousehold', '是否为学校集体户口'), field('emergencyName', '紧急联系人'), field('emergencyPhone', '紧急联系电话'), yesNo('ccdcRelativeEmployment', '是否有近亲属在金融监管总局系统和中央结算公司从业'), field('additionalInfo', '附加信息：其他', 'textarea')],
    collections: [
      { key: 'publication', label: '论文/专著', entryLabel: '论文', fields: [field('name', '名称'), field('date', '发布时间', 'date'), field('journal', '所属期刊'), field('journalLevel', '期刊级别'), field('issue', '年度/期次'), field('authorOrder', '作者顺序')] },
      { key: 'socialPractice', label: '在校实践', entryLabel: '实践', fields: [field('name', '实践名称'), field('startDate', '开始时间', 'date'), field('endDate', '结束时间', 'date'), field('description', '实践描述', 'textarea')] },
    ],
    extendCollections: {
      education: [field('city', '学校所在城市（省/市）'), field('trainingMode', '培养方式'), field('department', '学院名称'), field('majorCategory', '专业类别'), field('courses', '专业课程', 'textarea')],
      internship: referee,
      work: [...referee, field('companyType', '单位类型'), field('industry', '所属行业'), field('positionCategory', '职位类别'), field('workNature', '工作性质'), field('city', '工作地点（省/市）'), field('monthlySalary', '月薪（税前，按网页选项）'), field('companyDescription', '单位介绍', 'textarea'), field('leavingReason', '离职原因')],
      language: [field('proficiency', '掌握程度（与考试等级分开）')],
      certificate: [field('category', '证书种类'), field('score', '证书成绩'), field('description', '证书描述', 'textarea')],
      familyMember: [field('age', '年龄', 'number'), field('phone', '联系电话')],
    },
  };
  const specs = {
    '个人信息': { fields: { 姓名: 'name', 性别: 'gender', 出生日期: 'birthDate', 邮箱: 'email', 手机号码: 'phone', 证件号码: 'idCard', 最高学历: 'educationDegree', 学习形式: 'learningForm', 毕业时间: 'graduationDate', 专业名称: 'major', 生源地: 'studentOrigin', 户口所在地: 'household', 是否为学校集体户口: 'schoolCollectiveHousehold', 政治面貌: 'politicalStatus', 民族: 'nationality', 籍贯: 'origin', '身高(厘米)': 'height', '体重(公斤)': 'weight', 紧急联系人: 'emergencyName', 紧急联系电话: 'emergencyPhone', 自我评价: 'selfEval', 是否接受调剂: 'acceptAdjustment' } },
    '教育经历': { collection: 'education', identity: 'school', fields: { 学校名称: 'school', 城市: 'city', 开始时间: 'startDate', 结束时间: 'endDate', 培养方式: 'trainingMode', 学院名称: 'department', 专业类别: 'majorCategory', 专业名称: 'major', 学历: 'degree', 学位: 'academicDegree', '成绩(GPA)': 'gpa', 专业排名: 'rank', 专业课程: 'courses' } },
    '实习经历': { collection: 'internship', identity: 'company', fields: { 单位名称: 'company', 开始时间: 'startDate', 结束时间: 'endDate', 证明人: 'refereeName', 证明人职务: 'refereePosition', 证明人联系方式: 'refereePhone', 实习内容: 'description' } },
    '工作经历': { collection: 'work', identity: 'company', fields: { 公司名称: 'company', 职位名称: 'position', 开始时间: 'startDate', 结束时间: 'endDate', 单位类型: 'companyType', 所属行业: 'industry', 部门: 'department', 职位类别: 'positionCategory', 工作性质: 'workNature', 工作地点: 'city', '月薪(税前)': 'monthlySalary', 证明人姓名: 'refereeName', 证明人职位: 'refereePosition', 证明人联系方式: 'refereePhone', 工作职责: 'description', 单位介绍: 'companyDescription', 离职原因: 'leavingReason' } },
    '在校职务': { collection: 'cadre', identity: 'role', fields: { 职务名称: 'role', 开始时间: 'startDate', 结束时间: 'endDate', 职务描述: 'description' } },
    '在校实践': { collection: 'socialPractice', identity: 'name', fields: { 实践名称: 'name', 开始时间: 'startDate', 结束时间: 'endDate', 实践描述: 'description' } },
    '论文/专著': { collection: 'publication', identity: 'name', fields: { 名称: 'name', 发布时间: 'date', 所属期刊: 'journal', 期刊级别: 'journalLevel', '年度/期次': 'issue', 作者顺序: 'authorOrder' } },
    '获奖情况': { collection: 'award', identity: 'name', fields: { 获奖项: 'name', 获奖时间: 'date', 获奖级别: 'level', 获奖描述: 'description' } },
    '语言能力': { collection: 'language', identity: 'name', fields: { 语言类型: 'name', 掌握程度: 'proficiency', 语言考试名称: 'certificate', 语言考试成绩: 'score' } },
    '证书': { collection: 'certificate', identity: 'name', fields: { 证书名称: 'name', 证书种类: 'category', 成绩: 'score', 获得时间: 'date', 颁发机构: 'authority', 证书描述: 'description' } },
    '家庭情况': { collection: 'familyMember', identity: 'name', fields: { 姓名: 'name', 年龄: 'age', 与本人关系: 'relation', 政治面貌: 'politicalStatus', 工作单位: 'company', 职务: 'position', 联系电话: 'phone' } },
    '近亲属从业声明': { fields: { 是否有近亲属在金融监管总局系统和本公司从业: 'ccdcRelativeEmployment' } },
    '附加信息': { fields: { 兴趣爱好: 'hobby', 特长: 'specialty', 其他: 'additionalInfo' } },
    '附件': { fields: {} },
  };
  const clean = s => String(s ?? '').replace(/[\s*＊]/g, '').replace(/（/g, '(').replace(/）/g, ')');
  const has = s => s !== undefined && s !== null && String(s).trim() !== '';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const A = () => globalThis.ResumeControlAdapters;
  function hidden(n) { for (; n?.nodeType === 1; n = n.parentElement) if (n.hidden || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true; return false; }
  const visible = n => !!n && !hidden(n) && !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  function sectionOf(form) {
    for (let block = form.parentElement; block; block = block.parentElement) {
      const title = [...block.children].find(n => n.id.includes('_Recruitment_') && !n.id.endsWith('_addButton') && !n.matches('.form') && !n.querySelector('.form-item'));
      if (title) return { block, title: clean(title.textContent) };
    }
    return null;
  }
  function blocks(root) {
    const result = new Map();
    for (const form of root.querySelectorAll('.ux-standard-form')) {
      const section = sectionOf(form);
      if (section && !hidden(form)) {
        if (!result.has(section.block)) result.set(section.block, { ...section, forms: [] });
        result.get(section.block).forms.push(form);
      }
    }
    return [...result.values()];
  }
  const match = root => blocks(root).some(b => b.title === '个人信息' && b.block.querySelector('.form-item--phoenix'));
  function entries(title, resume) {
    const collection = specs[title]?.collection;
    const list = (title === '获奖情况' ? ['award', 'honor'] : [collection]).flatMap(key => (resume.collections?.[key] || []).map((data, index) => ({ data, index, collection: key })));
    const level = value => ({ 高中: 0, 中专: 0, 大专: 1, 专科: 1, 本科: 2, 硕士: 3, 硕士研究生: 3, 博士: 4, 博士研究生: 4 }[clean(value)] ?? 99);
    if (title === '教育经历') list.sort((a, b) => level(a.data.degree) - level(b.data.degree) || String(a.data.startDate || '9999').localeCompare(String(b.data.startDate || '9999')) || a.index - b.index);
    return list;
  }
  const labelOf = item => clean(item.querySelector(':scope > .form-item__title .form-item__text')?.textContent);
  function control(item) { return item.querySelector('.phoenix-radio-group,.phoenix-select,textarea,input:not([type="hidden"])'); }
  function ongoing(item) { return item.closest('.fields-col')?.querySelector('.phoenix-checkbox'); }
  const checked = n => !!n && (n.getAttribute('aria-checked') === 'true' || n.classList.contains('phoenix-checkbox--checked') || n.classList.contains('phoenix-radio--checked') || !!n.querySelector('.phoenix-checkbox__input:checked,input:checked'));
  function read(el) {
    if (!el) return '';
    if (el.matches('.phoenix-radio-group')) return [...el.querySelectorAll('.phoenix-radio')].filter(checked).map(n => clean(n.querySelector('.phoenix-radio__radio-text')?.textContent)).join('/');
    if (el.matches('.phoenix-select')) return A()?.read(el) ?? [...el.querySelectorAll('.phoenix-select__tipEle,.phoenix-select__tagItem')].map(n => n.textContent.trim()).join('、');
    if (el.type === 'file') return el.files?.length ? '已上传' : '';
    return String(el.value || '').trim();
  }
  function same(a, b) { return clean(a) === clean(b) || !!A()?.equivalent(a, b); }
  function describe(root, resume) {
    const rows = [];
    for (const block of blocks(root)) {
      const spec = specs[block.title];
      for (const [slot, form] of block.forms.entries()) {
        const source = spec?.collection ? entries(block.title, resume)[slot] : { data: resume.base || {}, index: 0 };
        for (const item of form.querySelectorAll('.form-item--phoenix')) {
          if (hidden(item)) continue;
          const label = labelOf(item), key = spec?.fields[label], el = control(item), index = source?.index ?? slot;
          let value = String(source?.data?.[key] ?? '');
          const path = key ? spec.collection ? `${source?.collection || spec.collection}[${index}].${key}` : `base.${key}` : '';
          // A language exam grade is acceptable as the exam name only within this language entry.
          if (block.title === '语言能力' && key === 'certificate' && !value && /^(四级|六级|专四|专八|CET[- ]?[46]|TEM[- ]?[48]|雅思|托福|IELTS|TOEFL)$/i.test(source?.data?.level || '')) value = source.data.level;
          const isOngoing = key === 'endDate' && /^(至今|现在|Present|Current)$/i.test(value);
          const check = key === 'endDate' ? ongoing(item) : null;
          const before = key === 'endDate' && checked(check) ? '至今' : read(el);
          const row = { item, el, form, block, key, slot, index, path, value, before, check, isOngoing,
            section: block.title, label, required: !!item.querySelector('.form-item__required'), existing: has(before),
            source: `${block.title}${spec?.collection ? ` / 简历第 ${index + 1} 条` : ''} / ${label}`,
            dataStatus: has(value) ? 'present' : 'missing', capability: 'ready', reason: '按区块、条目及字段精确对应' };
          if (!el || el.type === 'file') { row.capability = 'manual'; row.reason = '附件需要手动上传'; }
          else if (!path) { row.capability = 'unmapped'; row.reason = '未建立精确映射，保留空白供人工填写'; }
          else if (el.matches('.phoenix-select,.phoenix-radio-group')) { row.capability = 'dynamic'; row.reason = '通过控件提交并读回验证'; }
          const invalid = reason => { row.dataStatus = 'invalid'; row.reason = reason; };
          if (value && /Date$|^date$/.test(key) && !isOngoing) {
            const date = new Date(value + 'T00:00:00Z');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('需要完整有效年月日，不自动补造日期');
          }
          if (value && key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid('邮箱格式不正确');
          if (value && ['height', 'weight', 'age', 'gpa', 'score'].includes(key) && !/^\d+(\.\d+)?$/.test(value)) invalid('需要独立数字，不能使用姓名或说明文字');
          if (value && key === 'age' && !/^\d+$/.test(value)) invalid('年龄需要整数');
          if (value && el?.maxLength > 0 && value.length > el.maxLength) invalid(`超过网页 ${el.maxLength} 字上限，请精简资料`);
          const knownLimit = block.title === '论文/专著' ? { journal: 100, journalLevel: 50 }[key] : 0;
          if (knownLimit && value.length > knownLimit) invalid(`超过网页 ${knownLimit} 字上限，请精简资料`);
          if (row.existing && value && !same(before, value)) { row.dataStatus = 'invalid'; row.reason = '网页已有内容与资料不同，请核对后清空需要重填的项'; }
          rows.push(row);
        }
      }
    }
    return rows;
  }
  function scan(root, resume) {
    const rows = describe(root, resume).map(({ item, el, form, block, value, before, check, isOngoing, key, slot, ...row }) => row);
    for (const block of blocks(root)) {
      const desired = entries(block.title, resume).length;
      if (desired > block.forms.length) rows.push({ section: block.title, label: `还有 ${desired - block.forms.length} 条待展开`, required: false, existing: false, path: '', source: '', dataStatus: 'present', capability: 'dynamic', reason: '填写时使用本区块添加按钮逐条展开' });
      if (block.title === '教育经历' && /从高中开始/.test(block.block.textContent) && !(resume.collections?.education || []).some(e => /高中/.test(e.degree || ''))) rows.push({ section: block.title, label: '高中经历缺失', required: true, existing: false, path: '', source: '教育经历', dataStatus: 'missing', capability: 'manual', reason: '网页要求从高中开始，请补充真实高中信息' });
    }
    return { adapter: '北森 / 中央结算 Phoenix', total: rows.length, canGuaranteeComplete: false, limitation: '已适配可见表单；远程字典、条件字段及服务器校验仍以网页反馈为准。', rows,
      counts: Object.fromEntries(['missing', 'invalid', 'dynamic', 'manual', 'unmapped'].map(k => [k, rows.filter(r => r.dataStatus === k || r.capability === k).length])) };
  }
  async function until(fn) { for (let i = 0; i < 30; i++) { if (fn()) return true; await pause(50); } return false; }
  async function expand(resume, report) {
    for (const block of blocks(document)) {
      if (!specs[block.title]?.collection) continue;
      const count = () => block.block.querySelectorAll('.ux-standard-form').length;
      const target = Math.min(50, entries(block.title, resume).length);
      while (count() < target) {
        const buttons = [...block.block.querySelectorAll('[id$="_addButton"]')].filter(n => visible(n) && clean(n.textContent) === '添加' + block.title);
        if (buttons.length !== 1) { report.issues.push({ label: block.title, reason: '未找到唯一的添加按钮，请手动展开剩余条目' }); break; }
        const before = count(); buttons[0].click();
        if (!await until(() => count() === before + 1)) { report.issues.push({ label: block.title, reason: '添加未生成新条目，已停止重试' }); break; }
        report.created++;
      }
    }
  }
  function verify(row) {
    if (!row.item.isConnected || !row.el?.isConnected) return '页面重建字段，请重新检查';
    const errors = [...row.item.querySelectorAll('[class*="error"],[class*="invalid"],[role="alert"],[aria-invalid="true"]')];
    if (errors.some(n => visible(n) && (n.getAttribute('aria-invalid') === 'true' || has(n.textContent))) || row.el.getAttribute('aria-invalid') === 'true' || row.el.validity?.valid === false) return '网页字段校验未通过';
    const actual = row.isOngoing ? checked(row.check) ? '至今' : '' : read(row.el);
    return same(actual, row.isOngoing ? '至今' : row.acceptedValue || row.value) ? '' : '读回内容不一致或被页面清空';
  }
  async function write(row, resume) {
    if (!row.path || ['manual', 'unmapped'].includes(row.capability) || row.dataStatus !== 'present') return row.dataStatus === 'missing' ? '简历中缺少此项独立资料，请在编辑简历中补充' : row.reason;
    if (!visible(row.el) || row.el.disabled || row.el.readOnly || row.el.classList.contains('phoenix-select--disabled')) return '控件未启用或不可见';
    if (row.key === 'idCard') {
      const type = clean(row.item.querySelector('.mobile-type-button')?.textContent);
      if (has(resume.base?.idType) && type && type !== clean(resume.base.idType)) return '证件类型与简历不一致，请先选择正确类型';
      if ((!type || type === '身份证') && !/^\d{17}[\dXx]$/.test(row.value)) return '身份证号码格式不正确';
    }
    if (row.isOngoing) {
      if (!row.check || !visible(row.check)) return '未找到本条目的至今选项';
      if (!checked(row.check)) row.check.click();
      return await until(() => checked(row.check)) ? '' : '至今选项未被页面接受';
    }
    if (row.el.matches('.phoenix-select')) {
      const result = await A().exclusive(() => A().fill(row.el, row.value));
      if (result === 'ok') row.acceptedValue = read(row.el);
      return result === 'ok' ? '' : `选择未完成：${result}`;
    }
    if (row.el.matches('.phoenix-radio-group')) {
      const options = [...row.el.querySelectorAll('.phoenix-radio')].filter(n => clean(n.querySelector('.phoenix-radio__radio-text')?.textContent) === clean(row.value) && !n.classList.contains('phoenix-radio--disabled'));
      if (options.length !== 1) return '没有唯一匹配的单选项';
      options[0].click();
      return await until(() => same(read(row.el), row.value)) ? '' : '单选项未被页面接受';
    }
    if (!row.el.matches('input,textarea')) return '尚未适配此控件';
    row.el.focus();
    const proto = row.el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(row.el, row.value);
    row.el.dispatchEvent(new Event('input', { bubbles: true }));
    row.el.dispatchEvent(new Event('change', { bubbles: true }));
    row.el.blur();
    return '';
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (!['PREVIEW', 'FILL'].includes(mode) || !match(document)) return { ok: false, error: '未识别到北森简历表单' };
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    busy = true;
    try {
      const report = { mode, adapter: 'beisen', matched: 0, filled: 0, skipped: 0, created: 0, dropdownFailed: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      const rows = describe(document, resume), blocked = new Set(), written = [];
      const issue = (row, reason) => report.issues.push({ label: `${row.section} / 第 ${row.slot + 1} 条 / ${row.label}`, reason });
      // Never attach the rest of a resume record to an already populated, different person/school/company.
      for (const row of rows) {
        if (!specs[row.section]?.collection) continue;
        if (row.existing && (!row.value || !same(row.before, row.value))) blocked.add(row.form);
      }
      for (const row of rows) {
        if (row.path) report.matched++;
        if (mode === 'PREVIEW') { if (row.path && row.el) highlight(row.el, { label: row.source }); continue; }
        if (row.existing) { report.skipped++; if (row.value && !same(row.before, row.value)) issue(row, '已有内容与简历资料不同，请核对后清空需要重填的项'); continue; }
        if (blocked.has(row.form)) { report.skipped++; issue(row, '本条已有内容与对应简历条目不一致，已停止补填，避免混入其他人的资料'); continue; }
        let error;
        try { error = await write(row, resume); await pause(40); error ||= verify(row); } catch (_) { error = '控件操作异常，请核对后重试'; }
        if (error) { issue(row, error); if (row.capability === 'dynamic' && row.value) report.dropdownFailed++; }
        else written.push(row);
      }
      if (mode === 'FILL') {
        await pause(200);
        for (const row of written) {
          const error = verify(row);
          if (error) issue(row, error);
          else { report.filled++; highlight(row.el, { label: row.source }); }
        }
      }
      report.audit = scan(document, resume);
      report.requiredMissing = report.audit.rows.filter(r => r.required && !r.existing).length;
      report.pendingCount = report.audit.rows.filter(r => !r.existing).length + report.issues.filter(i => i.reason.startsWith('已有内容')).length;
      return report;
    } finally { busy = false; }
  }
  const adapter = { id: 'beisen', name: '北森 / 中央结算 Phoenix', schema, match, scan, run, describe, entries };
  const adapters = globalThis.ResumeSiteAdapters ||= [];
  const old = adapters.findIndex(a => a.id === adapter.id);
  if (old < 0) adapters.push(adapter); else adapters[old] = adapter;
})();
