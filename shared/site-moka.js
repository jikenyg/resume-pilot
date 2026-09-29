/* Moka Sugar UI adapter. Classic script; registration is its only load-time effect. */
(function () {
  'use strict';
  const cls = prefix => `[class^="${prefix}"],[class*=" ${prefix}"]`;
  const FIELD = cls('apply-field-') + ',' + cls('field-');
  const BLOCK = cls('apply-block-') + ',' + cls('basic-block-');
  const ENTRY = cls('apply-fields-');
  const SELECT = cls('sd-Select-container-');
  const DISPLAY = cls('sd-Input-display-value-');
  const clean = s => String(s ?? '').replace(/[\s*＊]/g, '');
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const schema = {
    base: [
      { key: 'workExperience', label: '工作经验/年限（按站点选项）', type: 'text' },
      { key: 'recentCompany', label: '最近公司', type: 'text' },
      { key: 'currentSalary', label: '当前薪资', type: 'text' },
    ],
    collections: [],
    extendCollections: {
      language: [
        { key: 'proficiency', label: '语言掌握程度（非考试等级）', type: 'text' },
        { key: 'listeningSpeaking', label: '听说能力', type: 'text' },
        { key: 'readingWriting', label: '读写能力', type: 'text' },
      ],
      ...Object.fromEntries(['work', 'internship', 'project'].map(key => [key, [
        { key: 'isCurrent', label: '是否持续至今', type: 'select', options: ['是', '否'] },
      ]])),
    },
  };
  schema.extendCollections.project.push({ key: 'dutySummary', label: '项目职责（简短，Moka 单行）', type: 'text' });
  const specs = {
    '基础信息': { fields: { 姓名: 'name', 手机号码: 'phone', 邮箱: 'email' } },
    '个人信息': { fields: { 性别: 'gender', 工作经验: 'workExperience', 最高学历: 'educationDegree', 所在地: 'currentCity', 最近公司: 'recentCompany', 证件号码: 'idCard', 证件类型: 'idType', '出生日期(年龄)': 'birthDate' } },
    '求职意向': { fields: { 当前薪资: 'currentSalary', 期望薪资: 'expectedSalary', 期望城市: 'expectedCity' } },
    '工作经历': { collection: 'work', fields: { 公司名称: 'company', 职位名称: 'position', 工作职责: 'description' } },
    '实习经历': { collection: 'internship', fields: { 公司名称: 'company', 职位名称: 'position', 工作职责: 'description' } },
    '教育背景': { collection: 'education', fields: { 学校名称: 'school', 专业名称: 'major', 学历: 'degree' } },
    '项目经验': { collection: 'project', fields: { 项目名称: 'name', 职责: 'dutySummary', 项目描述: 'description', 项目中职责: 'responsibilities' } },
    '语言能力': { collection: 'language', fields: { 语言类型: 'name', 掌握程度: 'proficiency', 听说: 'listeningSpeaking', 读写: 'readingWriting' } },
    '自我描述': { fields: { 自我描述: 'selfEval' } },
    '获奖经历': { collection: 'award', fields: { 获奖时间: 'date', 奖项名称: 'name' } },
  };
  function hidden(node) {
    for (let n = node; n?.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true;
    }
    return false;
  }
  const visible = n => !!n && !hidden(n) && !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  function title(block) {
    if (block?.matches(cls('basic-block-'))) return '基础信息';
    return clean(block?.querySelector(`${cls('blockTitle-')}`)?.querySelector(cls('text-'))?.textContent || '未知区块');
  }
  function match(root) {
    return !!root.querySelector(BLOCK) && !!root.querySelector(SELECT) && !!root.querySelector(FIELD);
  }
  function read(el) {
    if (el.matches(SELECT)) return (el.querySelector(DISPLAY)?.textContent || '').trim();
    if (el.type === 'checkbox') return el.checked ? '是' : '';
    if (el.tagName === 'SELECT') return el.value ? (el.selectedOptions[0]?.textContent || '').trim() : '';
    return String(el.value || '').trim();
  }
  function controls(item) {
    return [...new Set([...item.querySelectorAll('input:not([type="hidden"]),textarea,select')]
      .map(n => n.closest(SELECT) || n))].filter(n => !hidden(n));
  }
  function makeRow(item, els, section, index, label, key, resume, kind = 'field') {
    const collection = specs[section]?.collection;
    const entry = collection ? resume.collections?.[collection]?.[index] : resume.base;
    const path = key ? collection ? `${collection}[${index}].${key}` : `base.${key}` : '';
    const legacyCurrent = entry?.endDate === '至今';
    const value = String(key === 'isCurrent' && !has(entry?.isCurrent) && legacyCurrent ? '是' : key === 'endDate' && legacyCurrent ? '' : entry?.[key] ?? '');
    const required = !!item.querySelector('[required],[aria-required="true"],[class*="required"]') || /[*＊]/.test(item.firstElementChild?.textContent || '');
    const before = els.map(read);
    let capability = 'ready', reason = '已映射；填写后读回并检查页面校验';
    if (!key) { capability = 'unmapped'; reason = '此字段尚无明确对应资料'; }
    else if (!els.length || els.some(n => n.matches('input[type="file"],input[type="password"]') || n.disabled || n.querySelector('input:disabled'))) {
      capability = 'manual'; reason = '上传、禁用或特殊字段需要人工处理';
    } else if (els.some(n => n.matches(SELECT) || n.readOnly) || kind === 'month') {
      capability = 'dynamic'; reason = kind === 'month' ? '年月组合需在真实页面选择；不会把搜索文字当成日期' : '自定义选项/日期需在真实页面确认；只接受可归属的真实选项';
    }
    let dataStatus = has(value) ? 'present' : key ? 'missing' : 'unknown';
    const bad = text => { dataStatus = 'invalid'; reason = text; };
    if (value && kind === 'month' && !/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value)) bad('日期需提供有效年月，不自动补造月份');
    if (value && /Date$/.test(key || '') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + 'T00:00:00Z');
      if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) bad('日期不存在，请核对');
    }
    if (value && key === 'birthDate' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad('出生日期需提供完整有效年月日');
    if (value && key === 'idCard' && (!resume.base?.idType || /身份证/.test(resume.base.idType)) && !/^\d{17}[\dXx]$/.test(value)) bad('身份证号码格式不正确，请核对真实号码');
    if (value && key === 'isCurrent' && !['是', '否'].includes(value)) bad('是否至今需明确填写是或否');
    for (const el of els) if (el.maxLength > 0 && value.length > el.maxLength) bad('内容超过页面字数上限');
    const ongoing = kind === 'month' && key === 'endDate' && (entry?.isCurrent === '是' || legacyCurrent && !has(entry?.isCurrent));
    if (ongoing && !value) { dataStatus = 'notApplicable'; reason = '明确持续至今，结束年月不适用'; }
    if (ongoing && value) bad('已选择至今但同时存在结束日期，请核对');
    if (legacyCurrent && entry?.isCurrent === '否' && ['endDate', 'isCurrent'].includes(key)) bad('结束时间写至今但是否至今选择否，请核对');
    const existing = before.length > 0 && before.every(has);
    return { item, els, value, before, key, kind, ongoing, section, label, index, required, path,
      source: path ? `${section} / ${label}` : '', dataStatus, capability, reason, existing, partial: before.some(has) && !existing };
  }
  function describe(root, resume) {
    const rows = [];
    for (const item of root.querySelectorAll(FIELD)) {
      if (hidden(item)) continue;
      const block = item.closest(BLOCK);
      if (!block) continue;
      const section = title(block), spec = specs[section];
      const entry = item.closest(ENTRY);
      const entries = [...block.querySelectorAll(ENTRY)].filter(n => n.closest(BLOCK) === block);
      const index = spec?.collection ? Math.max(0, entries.indexOf(entry)) : 0;
      const label = clean(item.firstElementChild?.textContent || '未命名字段');
      const els = controls(item);
      const identityKey = ['work', 'internship'].includes(spec?.collection) ? 'company' : spec?.collection === 'education' ? 'school' : 'name';
      const identityLabel = Object.keys(spec?.fields || {}).find(k => spec.fields[k] === identityKey);
      const identityItem = spec?.collection && entry && [...entry.querySelectorAll(FIELD)].find(n => clean(n.firstElementChild?.textContent) === identityLabel);
      const identityValue = identityItem && controls(identityItem).map(read).filter(has).join('');
      const expectedIdentity = resume.collections?.[spec?.collection]?.[index]?.[identityKey];
      const conflict = has(identityValue) && has(expectedIdentity) && clean(identityValue) !== clean(expectedIdentity);
      const add = (label, key, subset, kind) => {
        const row = makeRow(item, subset, section, index, label, key, resume, kind);
        if (conflict) { row.capability = 'manual'; row.reason = '网页已有条目名称与本条简历不一致，请核对顺序后再填，避免混合经历'; }
        rows.push(row);
      };
      if (spec?.collection && ['起止时间', '就读时间'].includes(label)) {
        const dates = els.filter(n => n.matches(SELECT) || n.matches('input:not([type="checkbox"])'));
        add(label + ' / 开始', 'startDate', dates.slice(0, 2), 'month');
        add(label + ' / 结束', 'endDate', dates.slice(2, 4), 'month');
        const checks = els.filter(n => n.type === 'checkbox');
        if (checks.length) add('是否至今', 'isCurrent', checks, 'ongoing');
      } else if (section === '个人信息' && label === '证件号码') {
        add('证件类型', 'idType', els.filter(n => n.matches(SELECT)));
        add(label, 'idCard', els.filter(n => !n.matches(SELECT)));
      } else add(label, spec?.fields[label], els, label === '获奖时间' ? 'month' : 'field');
    }
    const specialSeen = new Set();
    for (const el of root.querySelectorAll('input[type="file"],input[type="checkbox"],[role="checkbox"],[class*="upload"],[class*="Upload"],[class*="avatar"],[class*="Avatar"]')) {
      if (hidden(el) || el.closest(FIELD) || el.closest(cls('account-'))) continue;
      let owner = el.closest('label,[role="checkbox"]') || el;
      for (let n = owner.parentElement; n && /avatar|upload/i.test(n.className || ''); n = n.parentElement) owner = n;
      if (specialSeen.has(owner)) continue;
      const label = /同意|隐私|协议/.test(owner.textContent || '') ? '隐私协议/同意' : /avatar|Avatar/.test(el.className || '') ? '头像/照片' : el.type === 'file' || /上传|附件|upload/i.test(el.textContent + el.className) ? '附件/简历上传' : '需要人工确认的勾选项';
      specialSeen.add(owner);
      rows.push({ section: '附件与确认', label, index: specialSeen.size - 1, required: !!el.required || el.getAttribute('aria-required') === 'true',
        path: '', source: '', dataStatus: 'unknown', capability: 'manual', reason: '请人工上传文件或阅读后确认，不自动处理', existing: false, partial: false });
    }
    for (const block of root.querySelectorAll(BLOCK)) {
      if (hidden(block)) continue;
      const section = title(block), collection = specs[section]?.collection;
      if (!collection) continue;
      const count = [...block.querySelectorAll(ENTRY)].filter(n => n.querySelector(FIELD)).length;
      const expected = resume.collections?.[collection]?.length || 0;
      if (count === 0 || expected > count) rows.push({ section, label: '尚未展开的条目', index: count, required: false,
        path: `${collection}[${count}].${collection === 'education' ? 'school' : ['work', 'internship'].includes(collection) ? 'company' : 'name'}`,
        source: `${section} / 添加条目`, dataStatus: 'unknown', capability: 'dynamic',
        reason: `当前展开 ${count} 条；新增条目出现后需重新检查`, existing: false, partial: false });
    }
    return rows;
  }
  function scan(root, resume = {}) {
    const rows = describe(root, resume).map(({ section, label, index, required, path, source, dataStatus, capability, reason, existing, partial }) =>
      ({ section, label, index, required, path, source, dataStatus, capability, reason, existing, partial }));
    return { adapter: 'Moka / Sugar UI', total: rows.length, canGuaranteeComplete: false,
      limitation: '只检查当前 HTML。下拉真实选项、日期提交、添加后的字段、隐藏步骤、验证码及服务端校验仍需真实页面验收；不自动保存或投递。',
      counts: { missing: rows.filter(r => r.dataStatus === 'missing').length, invalid: rows.filter(r => r.dataStatus === 'invalid').length,
        dynamic: rows.filter(r => r.capability === 'dynamic').length, manual: rows.filter(r => r.capability === 'manual').length,
        unmapped: rows.filter(r => r.capability === 'unmapped').length }, rows };
  }
  async function until(fn, ms = 800) {
    const end = Date.now() + ms;
    do { const found = fn(); if (found) return found; await pause(60); } while (Date.now() < end);
    return null;
  }
  function set(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const monthPart = value => String(value || '').replace(/[年月\s]/g, '').replace(/^0+(?=\d)/, '');
  async function choose(el, value, normalize = clean) {
    el.click();
    const owner = el.closest(cls('sd-Dropdown-container-'));
    try {
      const list = await until(() => {
        const input = el.querySelector('input');
        const id = el.getAttribute('aria-controls') || input?.getAttribute('aria-controls') || input?.getAttribute('aria-owns');
        if (id) { const n = document.getElementById(id); if (visible(n)) return n; }
        const local = owner && [...owner.querySelectorAll('[role="listbox"]')].filter(visible);
        return local?.length === 1 ? local[0] : null;
      });
      if (!list) return '未能确定此下拉所属选项，请人工选择';
      const hits = [...list.querySelectorAll('[role="option"]')].filter(n => visible(n) && n.getAttribute('aria-disabled') !== 'true' && !n.disabled && normalize(n.textContent) === normalize(value));
      if (hits.length !== 1) return '没有唯一匹配的真实选项，请核对并人工选择';
      hits[0].click();
      return await until(() => normalize(read(el)) === normalize(value)) ? '' : '选择未被页面接受';
    } finally { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
  }
  async function write(row, resume) {
    if (!row.item?.isConnected || row.els.some(n => !n.isConnected)) return '页面已重建字段，请重新检查';
    if (row.els.some((n, i) => read(n) !== row.before[i])) return '字段内容已变化，已保留';
    if (row.capability === 'manual' || row.capability === 'unmapped') return row.reason;
    if (row.dataStatus !== 'present') return row.dataStatus === 'invalid' ? row.reason : '请先补充此项真实资料';
    if (row.kind === 'month') {
      if (row.els.length !== 2 || row.els.some(n => !n.matches(SELECT))) return '年月控件结构不明确，请人工选择';
      const parts = row.value.slice(0, 7).split('-');
      for (let i = 0; i < 2; i++) {
        if (row.els.some(n => !n.isConnected)) return '年月联动重建了控件，请重新检查';
        if (has(read(row.els[i]))) return '年月内容已变化，保留现有选择';
        const error = await choose(row.els[i], parts[i], monthPart);
        if (error) return error;
        await pause(80);
      }
      return '';
    }
    if (row.els.some(n => n.readOnly)) return '只读日期弹层结构未提供，需人工选择';
    if (row.key === 'idCard') {
      const typeControl = row.item.querySelector(SELECT);
      if (!typeControl || !resume.base?.idType || clean(read(typeControl)) !== clean(resume.base.idType)) return '请先确认网页证件类型与简历一致';
    }
    if (row.kind === 'ongoing') {
      if (row.value === '否') return '未勾选至今不等于已确认结束，请人工核对结束年月';
      const dates = controls(row.item).filter(n => n.matches(SELECT));
      if (dates.slice(2).some(n => has(read(n)))) return '已有结束日期，不能切换至今清空它';
      if (row.els.length !== 1) return '至今控件不唯一';
      row.els[0].click(); return '';
    }
    if (row.els.length !== 1) return '组合控件需人工确认';
    const el = row.els[0];
    if (el.matches(SELECT)) return choose(el, row.value);
    if (el.tagName === 'SELECT') {
      const options = [...el.options].filter(n => !n.disabled && clean(n.textContent) === clean(row.value));
      if (options.length !== 1) return '下拉没有唯一匹配项';
      set(el, options[0].value); return '';
    }
    if (!el.matches('textarea,input') || el.tagName === 'INPUT' && !['text', 'tel', 'email', 'number', 'url', 'date', 'month', 'search'].includes(el.type)) return '控件尚未支持';
    el.focus(); set(el, row.value); el.blur(); return '';
  }
  function verify(row) {
    if (!row.item.isConnected || row.els.some(n => !n.isConnected)) return '页面重建了字段，请重新检查';
    if (row.els.some(n => n.validity && !n.validity.valid)) return '字段格式校验未通过';
    if ([...row.item.querySelectorAll('[role="alert"],[aria-invalid="true"],[class*="error-message"],[class*="errorMessage"]')].some(n => visible(n) && (n.getAttribute('aria-invalid') === 'true' || has(n.textContent)))) return '页面校验未通过';
    if (row.kind === 'month') {
      const expected = row.value.slice(0, 7).split('-');
      return row.els.length === 2 && row.els.every((n, i) => monthPart(read(n)) === monthPart(expected[i])) ? '' : '年月读回不一致或被联动清空';
    }
    return row.els.length === 1 && clean(read(row.els[0])) === clean(row.value) ? '' : '读回不一致或被联动清空';
  }
  async function expand(resume, report) {
    for (const block of document.querySelectorAll(BLOCK)) {
      const collection = specs[title(block)]?.collection;
      if (!collection || !visible(block)) continue;
      const count = () => [...block.querySelectorAll(ENTRY)].filter(n => n.querySelector(FIELD)).length;
      const target = Math.min(50, resume.collections?.[collection]?.length || 0);
      for (let i = count(); i < target; i++) {
        const buttons = [...block.querySelectorAll('button[type="button"]')].filter(n => visible(n) && !n.disabled && clean(n.textContent) === '添加');
        if (buttons.length !== 1) break;
        const before = count(); buttons[0].click();
        if (!await until(() => count() === before + 1)) { report.issues.push({ label: title(block), reason: '添加未产生唯一新条目，请人工处理' }); break; }
        report.created++;
      }
    }
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (!['PREVIEW', 'FILL'].includes(mode)) return { ok: false, error: '不支持的操作' };
    if (!match(document)) return { ok: false, error: '不是已识别的 Moka 表单' };
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    busy = true;
    try {
      const report = { mode, adapter: 'moka', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      const written = [];
      for (const row of describe(document, resume)) {
        if (row.path) report.matched++;
        if (mode === 'PREVIEW') { if (row.path && row.els?.[0]) highlight(row.els[0], { label: row.source }); continue; }
        if (row.existing || row.partial) { report.skipped++; continue; }
        if (row.ongoing && row.dataStatus === 'notApplicable') { report.skipped++; continue; }
        const error = await write(row, resume);
        await pause(30);
        const failure = error || verify(row);
        if (failure) { report.issues.push({ label: `${row.section} / ${row.index + 1} / ${row.label}`, reason: failure }); if (row.capability === 'dynamic') report.dropdownFailed++; }
        else written.push(row);
      }
      if (mode === 'FILL') {
        await pause(300);
        for (const row of written) {
          const error = verify(row);
          if (error) report.issues.push({ label: `${row.section} / ${row.index + 1} / ${row.label}`, reason: error });
          else { report.filled++; highlight(row.els[0], { label: row.source }); }
        }
      }
      const audit = scan(document, resume);
      report.requiredMissing = audit.rows.filter(r => r.required && !r.existing && r.dataStatus !== 'notApplicable').length;
      report.pendingCount = audit.rows.filter(r => !r.existing && r.dataStatus !== 'notApplicable').length;
      report.audit = audit;
      return report;
    } finally { busy = false; }
  }
  const adapters = globalThis.ResumeSiteAdapters ||= [];
  const adapter = { id: 'moka', name: 'Moka / Sugar UI', schema, match, scan, run };
  const old = adapters.findIndex(a => a.id === adapter.id);
  if (old < 0) adapters.push(adapter); else adapters[old] = adapter;
})();
