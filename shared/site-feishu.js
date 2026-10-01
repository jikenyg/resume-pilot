/* Feishu ATSX career forms. DOM bindings and control contracts verified against
 * the supplied satellite-company form and its public 6177 / 8825 bundles. */
(function () {
  'use strict';
  const schema = {
    base: [{ key: 'feishuNoWorkExperience', label: '飞书招聘：明确没有工作经历', type: 'select', options: ['是', '否'] }],
    collections: [
      { key: 'portfolio', label: '作品', entryLabel: '作品', fields: [{ key: 'link', label: '作品链接', type: 'text' }, { key: 'description', label: '作品描述', type: 'textarea' }] },
      { key: 'socialAccount', label: '社交账号', entryLabel: '账号', fields: [{ key: 'platform', label: '平台（按网页选项）', type: 'text' }, { key: 'link', label: '账号链接', type: 'text' }] },
    ],
  };
  const specs = {
    '基本信息': { fields: { name: 'name', mobile: 'phone', email: 'email' } },
    '教育经历': { prefix: 'education', collections: ['education'], fields: { school: 'school', degree: 'degree', fieldOfStudy: 'major', period: ['startDate', 'endDate'] } },
    '工作经历': { prefix: 'career', collections: ['work'], fields: { company: 'company', title: 'position', period: ['startDate', 'endDate'], desc: 'description' } },
    '实习经历': { prefix: 'internship', collections: ['internship'], fields: { company: 'company', title: 'position', period: ['startDate', 'endDate'], desc: 'description' } },
    '项目经历': { prefix: 'project', collections: ['project'], fields: { name: 'name', role: 'role', period: ['startDate', 'endDate'], link: 'link', desc: 'description' } },
    '作品': { prefix: 'works', collections: ['portfolio'], fields: { link: 'link', desc: 'description' } },
    '获奖': { prefix: 'award', collections: ['award', 'honor'], fields: { title: 'name', date: 'date', desc: 'description' } },
    '语言能力': { prefix: 'language', collections: ['language'], fields: { language: 'name', proficiency: 'proficiency' } },
    '社交账号': { prefix: 'sns', collections: ['socialAccount'], fields: { snsType: 'platform', link: 'link' } },
    '自我评价': { fields: { selfEvaluation: 'selfEval' } },
  };
  const norm = v => String(v ?? '').replace(/[\s*＊]/g, '').trim();
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const pause = ms => new Promise(r => setTimeout(r, ms));
  function hidden(n) { for (; n?.nodeType === 1; n = n.parentElement) if (n.hidden || n.getAttribute('aria-hidden') === 'true' || n.matches('.resumeEditForm-hiddenField,.createFormSection-hidden') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true; return false; }
  const visible = n => !!n && !hidden(n) && !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const sections = root => [...root.querySelectorAll('form.atsx-form .createFormSection-container')].filter(n => !hidden(n));
  const title = section => norm(section.querySelector('.createFormSection-title')?.textContent);
  const records = section => [...section.querySelectorAll('.resumeEditForm-item')].filter(n => !hidden(n));
  const match = root => !!root.querySelector('form.atsx-form .resumeEditForm-education') && !!root.querySelector('form.atsx-form .createFormSection-container');
  const entries = (section, resume) => (specs[section]?.collections || []).flatMap(collection => (resume.collections?.[collection] || []).map((data, index) => ({ data, index, collection }))).filter(e => Object.values(e.data).some(has));
  const fieldId = item => item.querySelector('.atsx-form-item-label label')?.getAttribute('for') || item.getAttribute('data-cy') || '';
  const labelOf = item => norm(item.querySelector('.customResumeForm-fieldName,.atsx-form-item-label label')?.textContent);
  const control = item => item.querySelector('.atsx-select,.atsx-date-picker,input:not([type="hidden"]),textarea,select');
  const aliases = [['硕士', '硕士研究生'], ['博士', '博士研究生'], ['本科', '大学本科'], ['大专', '专科', '大学专科']];
  const equal = (a, b) => norm(a) === norm(b) || aliases.some(g => g.some(v => norm(v) === norm(a)) && g.some(v => norm(v) === norm(b)));
  function date(value, precision = 'month') {
    const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
    if (!m || precision !== 'year' && !m[2]) return '';
    if (m[3]) { const d = new Date(value + 'T00:00:00Z'); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) return ''; }
    return precision === 'year' ? m[1] : precision === 'date' ? m[3] ? value : '' : `${m[1]}-${m[2]}`;
  }
  function read(el, part) {
    if (!el) return '';
    if (el.matches('.atsx-date-picker-period-month')) {
      const label = el.querySelectorAll('.atsx-date-picker-period-month-label')[part];
      if (label?.querySelector('.atsx-date-picker-period-month-label-toToday')) return '至今';
      return date(norm(label?.textContent));
    }
    if (el.matches('.atsx-select')) {
      // The school control is explicitly mode=combobox: free text is its value.
      if (el.classList.contains('atsx-select-combobox')) return el.querySelector('input')?.value.trim() || '';
      return el.querySelector('.atsx-select-selection-selected-value')?.textContent.trim() || '';
    }
    if (el.matches('.atsx-date-picker')) return el.querySelector('input:not(.atsx-date-picker-period-hidden-input)')?.value.trim() || '';
    if (el.type === 'checkbox') return el.checked ? '是' : '否';
    if (el.type === 'file') return el.files?.length ? '已上传' : '';
    if (el.matches('input,textarea,select')) return String(el.value || '').trim();
    return el.textContent.trim();
  }
  function describe(root, resume = {}) {
    const rows = [];
    for (const sectionEl of sections(root)) {
      const section = title(sectionEl), spec = specs[section], list = entries(section, resume), recs = records(sectionEl);
      for (const item of sectionEl.querySelectorAll('.atsx-form-item')) {
        if (hidden(item)) continue;
        const binding = fieldId(item), bind = /^(\w+)\[\d+\]\.(\w+)$/.exec(binding), record = item.closest('.resumeEditForm-item');
        const slot = Math.max(0, recs.indexOf(record)), source = spec?.collections ? list[slot] : { data: resume.base || {}, index: 0 };
        const label = labelOf(item);
        let keys = spec?.fields[spec.prefix ? bind?.[1] === spec.prefix ? bind[2] : '' : binding];
        // Tenant-defined numeric ids: only the exact local self-evaluation label is allowed.
        if (section === '自我评价' && label === '自我评价') keys = 'selfEval';
        const el = control(item) || item.querySelector('[class*="phoneNumber"]');
        for (const [part, key] of (Array.isArray(keys) ? keys : [keys]).entries()) {
          const kind = Array.isArray(keys) ? 'period' : key === 'date' ? 'date' : key === 'phone' && !item.querySelector('input') ? 'locked' : 'field';
          const index = source?.index ?? slot, path = key ? spec.collections ? `${source?.collection || spec.collections[0]}[${index}].${key}` : `base.${key}` : '';
          const raw = String(source?.data?.[key] ?? '');
          const precision = kind === 'date' ? (/YYYY-MM-DD|yyyy-mm-dd/.test(el?.querySelector('input')?.placeholder || '') ? 'date' : /YYYY-MM|yyyy-mm/.test(el?.querySelector('input')?.placeholder || '') ? 'month' : 'year') : 'month';
          const value = kind === 'period' ? key === 'endDate' && /^(至今|present|current)$/i.test(raw) ? '至今' : date(raw) : kind === 'date' ? date(raw, precision) : raw;
          let before = read(el, part);
          if (kind === 'locked') { before = before.replace(/[\s+\-()]/g, ''); if (/^86\d{11}$/.test(before)) before = before.slice(2); }
          const row = { item, el, record, sectionEl, binding, part, key, slot, index, kind, value, before, path, section, label: kind === 'period' ? `${label} / ${part ? '结束' : '开始'}` : label,
            required: !!item.querySelector('.atsx-form-item-required'), existing: has(before), source: `${section} / ${label}`, dataStatus: has(raw) ? 'present' : 'missing', capability: 'ready', reason: '按区块、条目和绑定字段对应' };
          if (!el || el.type === 'file') { row.capability = 'manual'; row.reason = '附件需要手动上传'; }
          else if (kind === 'locked') { row.capability = 'manual'; row.reason = '手机号由登录账号提供，请在网站核对'; }
          else if (!path) { row.capability = 'unmapped'; row.reason = '未建立精确映射，请手动填写'; }
          else if (el.matches('.atsx-select,.atsx-date-picker')) { row.capability = 'dynamic'; row.reason = '通过控件提交并读回验证'; }
          const invalid = message => { row.dataStatus = 'invalid'; row.reason = message; };
          if (has(raw) && ['period', 'date'].includes(kind) && !value) invalid('日期不完整或不存在，不补造年月日');
          if (key === 'email' && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) invalid('邮箱格式不正确');
          if (el?.maxLength > 0 && value.length > el.maxLength) invalid(`超过网页 ${el.maxLength} 字上限`);
          if (kind === 'period') {
            const data = source?.data || {}, start = date(data.startDate || ''), end = /^(至今|present|current)$/i.test(data.endDate || '') ? '至今' : date(data.endDate || '');
            if (has(raw) && (!start || !end)) invalid('起止时间需要同时提供有效开始和结束年月，或明确至今');
            if (start && end && end !== '至今' && start > end) invalid('开始时间晚于结束时间');
          }
          if (row.existing && value && !equal(before, value)) invalid(kind === 'locked' ? '登录手机号与简历不同，请本人核对账号' : '网页已有内容与简历不同，请核对后清空需要重填的项');
          rows.push(row);
        }
      }
      if (section === '附件简历' && !sectionEl.querySelector('.atsx-form-item')) rows.push({ sectionEl, item: sectionEl, el: sectionEl.querySelector('input[type="file"]'), section, label: '附件简历', path: '', slot: 0, index: 0, source: '', value: '', before: '', required: true, existing: !!sectionEl.querySelector('.atsx-upload-list-item'), dataStatus: 'missing', capability: 'manual', reason: '附件简历需要手动上传' });
      const checkbox = section === '工作经历' && sectionEl.querySelector('.noExperience-container input[type="checkbox"]');
      if (checkbox) {
        const value = String(resume.base?.feishuNoWorkExperience || ''), existing = checkbox.checked;
        rows.push({ sectionEl, item: checkbox.closest('.noExperience-container'), el: checkbox, section, label: '没有工作经历', binding: 'noExperience', slot: 0, index: 0, kind: 'noExperience', path: 'base.feishuNoWorkExperience', source: '本人明确的工作经历声明', value, before: read(checkbox), existing, required: false,
          dataStatus: value && !['是', '否'].includes(value) || value === '是' && list.length ? 'invalid' : value ? 'present' : 'missing', capability: 'manual', reason: existing && list.length ? '网页勾选了没有工作经历，请本人核对并取消勾选后重填' : '此操作会移除工作条目，请本人在网页核对后选择' });
      }
    }
    return rows;
  }
  function scan(root, resume) {
    const rows = describe(root, resume).map(({ item, el, record, sectionEl, value, before, binding, key, part, slot, kind, ...row }) => row);
    for (const section of sections(root)) {
      const name = title(section), missing = entries(name, resume).length - records(section).length;
      if (missing > 0) rows.push({ section: name, label: `还有 ${missing} 条待展开`, path: '', source: '', required: false, existing: false, dataStatus: 'present', capability: 'dynamic', reason: '填写时使用本区块添加按钮展开' });
    }
    return { adapter: '飞书招聘 / 商业卫星', total: rows.length, rows, canGuaranteeComplete: false, limitation: '已适配 ATSX 表单；远程选项和保存校验仍需在网站核对。', counts: Object.fromEntries(['missing', 'invalid', 'dynamic', 'manual', 'unmapped'].map(k => [k, rows.filter(r => r.dataStatus === k || r.capability === k).length])) };
  }
  const until = async fn => { for (let i = 0; i < 40; i++) { const value = fn(); if (value) return value; await pause(50); } return null; };
  function click(el) { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); el.click(); }
  function set(el, value) { el.focus(); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  function close() { click(document.body); document.activeElement?.blur?.(); }
  async function select(el, value) {
    if (el.classList.contains('atsx-select-disabled')) return '选择器未启用';
    const box = el.querySelector('[role="combobox"]'); if (!box) return '未找到选择器';
    click(box);
    const input = el.querySelector('input');
    if (el.classList.contains('atsx-select-combobox')) {
      if (!input || input.disabled || input.readOnly) return '学校输入未启用';
      set(input, value); input.blur(); close(); await pause(180);
      return equal(read(el), value) ? '' : '学校名称未被页面接受';
    }
    const owned = () => {
      const id = box.getAttribute('aria-controls') || box.getAttribute('aria-owns');
      const popup = id && document.getElementById(id);
      return popup && visible(popup) ? popup : null;
    };
    if (!await until(owned)) { close(); return '未找到当前字段所属选项列表'; }
    if (input && visible(input) && !input.readOnly && !input.disabled) set(input, value);
    const option = await until(() => {
      const options = [...(owned()?.querySelectorAll('.atsx-select-dropdown-menu-item,[role="option"]') || [])].filter(n => visible(n) && !n.className.includes('disabled') && n.getAttribute('aria-disabled') !== 'true' && equal(n.textContent, value));
      return options.length === 1 ? options[0] : null;
    });
    if (!option) { close(); return '没有唯一匹配的选项'; }
    click(option); const ok = await until(() => equal(read(el), value)); close(); return ok ? '' : '页面未接受选项';
  }
  async function period(el, values) {
    const base = el.getAttribute('data-cy');
    if (!base) return '日期组件缺少归属标识';
    for (let part = 0; part < 2; part++) {
      if (read(el, part) === values[part]) continue;
      const label = el.querySelectorAll('.atsx-date-picker-period-month-label')[part];
      if (!label) return '未找到起止年月控件';
      click(label);
      const panel = () => [...document.querySelectorAll('.atsx-date-picker-period-month-panel')].find(n => n.getAttribute('data-cy') === base + (part ? 'EndDropdown' : 'BeginDropdown') && visible(n));
      if (!await until(panel)) { close(); return '未找到当前字段的年月选项'; }
      const [year, month] = values[part] === '至今' ? ['-', ''] : values[part].split('-');
      for (const [column, value] of [[0, year], [1, month]]) {
        if (!value) continue;
        const list = panel()?.querySelectorAll('.atsx-date-picker-period-month-panel-list')[column];
        const opts = [...(list?.querySelectorAll('.atsx-date-picker-period-month-panel-list-item') || [])].filter(n => n.getAttribute('data-cy') === value && !n.className.includes('disabled'));
        if (opts.length !== 1) { close(); return value === '-' ? '当前日期不允许至今' : '年月选项不存在'; }
        opts[0].scrollIntoView({ block: 'nearest' }); click(opts[0]); await pause(45);
      }
    }
    close(); return await until(() => values.every((v, i) => read(el, i) === v)) ? '' : '起止年月未被页面完整接受';
  }
  function validation(row) {
    if (!row.item?.isConnected || !row.el?.isConnected) return '页面重建了字段，请重新检查';
    if (row.item.querySelector('.has-error,[aria-invalid="true"]') || row.el.validity?.valid === false) return '网页字段校验未通过';
    return equal(read(row.el, row.part), row.value) ? '' : '读回内容不一致或被页面清空';
  }
  async function expand(resume, report) {
    for (const name of sections(document).map(title)) {
      const desired = Math.min(entries(name, resume).length, 50);
      const section = () => sections(document).find(n => title(n) === name);
      if (name === '工作经历' && section()?.querySelector('.noExperience-container input:checked')) continue;
      while (section() && records(section()).length < desired) {
        const buttons = [...section().querySelectorAll('.createFormSection-addBtn,.formOperate-addBtn')].filter(visible);
        if (buttons.length !== 1) { report.issues.push({ label: name, reason: '未找到唯一添加按钮，请手动展开' }); break; }
        const before = records(section()).length; click(buttons[0]);
        if (!await until(() => section() && records(section()).length === before + 1)) { report.issues.push({ label: name, reason: '新增条目未出现，已停止重试' }); break; }
        report.created++;
      }
    }
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (!['PREVIEW', 'FILL'].includes(mode) || !match(document)) return { ok: false, error: '未识别到飞书招聘简历' };
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    busy = true;
    try {
      const report = { mode, adapter: 'feishu', matched: 0, filled: 0, skipped: 0, created: 0, dropdownFailed: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      const key = r => JSON.stringify([r.section, r.slot, r.binding, r.part]), recordKey = r => JSON.stringify([r.section, r.slot]);
      const rows = describe(document, resume), blocked = new Set(), done = new Set(), written = [];
      const issue = (r, reason) => report.issues.push({ label: `${r.section} / 第 ${r.slot + 1} 条 / ${r.label}`, reason });
      for (const r of rows) if (r.record && r.existing && (!r.value || !equal(r.before, r.value))) blocked.add(recordKey(r));
      for (const original of rows) {
        let row = describe(document, resume).find(r => key(r) === key(original));
        if (!row || done.has(key(row))) continue;
        if (row.path) report.matched++;
        if (mode === 'PREVIEW') { if (row.path && row.el) highlight(row.el, { label: row.source }); continue; }
        if (row.dataStatus === 'invalid') { issue(row, row.reason); continue; }
        if (row.capability === 'manual') { if (!row.existing || row.kind === 'noExperience' && row.value !== row.before) issue(row, row.reason); continue; }
        if (row.existing) { report.skipped++; continue; }
        if (blocked.has(recordKey(row))) { issue(row, '本条已有内容与简历条目不同，停止补填以免混入其他经历'); continue; }
        if (row.capability === 'unmapped' || !row.value) { issue(row, row.capability === 'unmapped' ? row.reason : '简历缺少本项独立资料'); continue; }
        if (!visible(row.el) || row.el.disabled || row.el.readOnly) { issue(row, '控件未启用或不可见'); continue; }
        let error = '', group = [row];
        try {
          if (row.kind === 'period') {
            group = describe(document, resume).filter(r => r.item === row.item);
            if (group.length !== 2 || group.some(r => r.dataStatus !== 'present' || !r.value)) error = '起止年月资料不完整';
            else error = await period(row.el, group.map(r => r.value));
            group.forEach(r => done.add(key(r)));
          } else if (row.el.matches('.atsx-select')) error = await select(row.el, row.value);
          else {
            const input = row.el.matches('.atsx-date-picker') ? row.el.querySelector('input:not(.atsx-date-picker-period-hidden-input)') : row.el;
            if (!input?.matches('input:not([type="file"]),textarea') || input.disabled || input.readOnly) error = '日期或输入控件需要手动填写';
            else { if (row.kind === 'date') click(input); set(input, row.value); if (row.kind === 'date') input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })); input.blur(); close(); }
          }
          await pause(80);
          for (const r of group) {
            const current = describe(document, resume).find(n => key(n) === key(r)) || r;
            const problem = error || validation(current);
            if (problem) { issue(r, problem); if (r.capability === 'dynamic') report.dropdownFailed++; }
            else if (!r.existing) written.push(current);
          }
        } catch (_) { issue(row, '控件操作异常，请核对后重试'); }
      }
      if (mode === 'FILL') {
        await pause(160); const current = new Map(describe(document, resume).map(r => [key(r), r]));
        for (const old of written) { const row = current.get(key(old)) || old, error = validation(row); if (error) issue(row, error); else { report.filled++; highlight(row.el, { label: row.source }); } }
      }
      report.audit = scan(document, resume);
      report.requiredMissing = report.audit.rows.filter(r => r.required && !r.existing).length;
      report.pendingCount = report.audit.rows.filter(r => !r.existing || r.dataStatus === 'invalid').length;
      return report;
    } finally { busy = false; }
  }
  const adapter = { id: 'feishu', name: '飞书招聘 / 商业卫星', schema, match, describe, scan, run };
  const registry = globalThis.ResumeSiteAdapters ||= [], old = registry.findIndex(a => a.id === adapter.id);
  if (old < 0) registry.push(adapter); else registry[old] = adapter;
})();
