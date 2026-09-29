/* Structure-based Hotjob adapter. Never submits the form or overwrites existing values. */
(function () {
  'use strict';
  const P = globalThis.ResumePageAudit;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const visible = n => n && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const norm = s => String(s || '').replace(/\s/g, '').toLowerCase();
  let busy = false;
  const equal = (a, b) => norm(a) === norm(b);
  function set(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function until(fn, ms = 1800) {
    const end = Date.now() + ms;
    do { const found = fn(); if (found) return found; await pause(80); } while (Date.now() < end);
    return null;
  }
  function close(el) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    document.body.click();
  }
  async function select(el, value) {
    const lists = () => [...document.querySelectorAll('.ant-select-dropdown')].filter(visible);
    close(el); await pause(80);
    const before = new Set(lists());
    el.click();
    const list = await until(() => {
      const id = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
      const owned = id && document.getElementById(id);
      if (visible(owned)) return owned;
      const added = lists().filter(n => !before.has(n));
      if (added.length !== 1) return null;
      const a = el.getBoundingClientRect(), b = added[0].getBoundingClientRect();
      return Math.abs(a.left - b.left) < Math.max(a.width, 100) && Math.abs(a.bottom - b.top) < 160 ? added[0] : null;
    });
    try {
      if (!list) return '无法确定该字段所属的下拉弹层';
      const find = () => {
        const options = [...list.querySelectorAll('[role="option"],.ant-select-dropdown-menu-item,.ant-select-item-option')]
          .filter(n => visible(n) && !n.matches('[aria-disabled="true"],.ant-select-dropdown-menu-item-disabled,.ant-select-item-option-disabled') && equal(n.textContent, value));
        return options.length === 1 ? options[0] : null;
      };
      let target = await until(find, 700);
      if (!target) {
        const search = el.querySelector('input:not([readonly])');
        if (search && visible(search)) { set(search, value); target = await until(find); }
      }
      if (!target) return '没有唯一匹配的真实选项，请核对简历与下拉选项';
      target.click();
      const selected = () => equal(el.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent, value);
      return await until(selected) ? '' : '下拉选择未被页面接受';
    } finally { close(el); }
  }
  async function date(el, value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日期需提供完整年月日，不自动补造日期';
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return '日期无效';
    const before = new Set([...document.querySelectorAll('.ant-calendar')].filter(visible));
    el.click();
    try {
      const panel = await until(() => {
        const panels = [...document.querySelectorAll('.ant-calendar')].filter(n => visible(n) && !before.has(n));
        return panels.length === 1 ? panels[0] : null;
      });
      const input = panel && [...panel.querySelectorAll('.ant-calendar-input')].find(n => visible(n) && !n.readOnly && !n.disabled);
      if (!input) return '此日期组件没有可提交的输入框，需要人工选择';
      input.focus(); set(input, value);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      return await until(() => equal(el.value, value)) ? '' : '日期未提交成功';
    } finally { close(el); }
  }
  async function write(row) {
    const { els, value, item } = row;
    if (!item.isConnected) return '页面已重建字段，请重新填写';
    if (P.read(item, els) !== row.before) return '字段内容已变化，本次跳过以保护已有内容';
    if (row.capability === 'manual' || row.capability === 'unmapped') return row.reason;
    if (row.dataStatus !== 'present') return row.dataStatus === 'invalid' ? row.reason : '简历资料缺失';
    const radios = els.filter(n => n.type === 'radio');
    if (radios.length) {
      const hits = radios.filter(n => !n.disabled && equal(n.closest('label')?.textContent, value));
      if (hits.length !== 1) return '没有唯一匹配的单选项';
      hits[0].click();
    } else if (els.every(n => n.type === 'checkbox') && row.section === '语言能力' && row.label === '英语能力') {
      const targets = P.languageChoices(value).map(v => els.filter(n => !n.disabled && equal(n.closest('label')?.textContent, v)));
      if (targets.some(hits => hits.length !== 1)) return '英语能力没有唯一匹配的考试选项';
      for (const [target] of targets) if (!target.checked) target.click();
      row.expected = els.filter(n => targets.some(([target]) => n === target)).map(n => n.closest('label').textContent.trim()).join('、');
    } else if (els.length > 1) {
      if (!['base.household', 'base.origin', 'base.homeCity', 'base.currentCity', 'base.nativePlace', 'base.expectedCity'].includes(row.path) || !els.every(n => n.matches('[role="combobox"]'))) return '组合控件需要进一步适配';
      const parts = value.split(/\s*[\/／>]\s*/).filter(Boolean).filter(p => !['中国', '中华人民共和国'].includes(p));
      if (parts.length < els.length) return '请按省/市/区补充完整地址层级';
      for (let i = 0; i < els.length; i++) {
        if (!els[i].isConnected) return '地址联动重建了控件，请重新检查';
        const current = P.read(item, [els[i]]);
        if (current) {
          if (!equal(current, parts[i])) return '已有地址与简历不一致，请人工核对，不覆盖';
          continue;
        }
        const error = await select(els[i], parts[i]);
        if (error) return error;
        await pause(300);
      }
      row.expected = parts.slice(0, els.length).join(' / ');
    } else {
      const el = els[0];
      if (el.matches('[role="combobox"]')) return select(el, value);
      if (el.matches('.ant-calendar-picker-input')) return date(el, value);
      if (el.readOnly || el.disabled || /请选择/.test(el.placeholder || '')) return '需通过组件选项选择，不能直接写入文本';
      if (el.tagName === 'SELECT') {
        const options = [...el.options].filter(o => !o.disabled && equal(o.text, value));
        if (options.length !== 1) return '下拉没有唯一匹配项';
        el.value = options[0].value; el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (['INPUT', 'TEXTAREA'].includes(el.tagName) && !['file', 'checkbox', 'password'].includes(el.type)) {
        el.focus(); set(el, value); el.blur();
      } else return '控件尚未适配';
    }
    return '';
  }
  function verify(row) {
    if (!row.item.isConnected || row.els.some(n => !n.isConnected)) return '页面重建了字段，请重新检查';
    const alert = row.item.querySelector('.has-error .ant-form-explain,[role="alert"]');
    if (visible(alert) && alert.textContent.trim()) return '页面校验未通过';
    if (row.els.some(n => n.validity && !n.validity.valid)) return '字段格式校验未通过';
    return equal(P.read(row.item), row.expected || row.value) ? '' : '读回不一致或被联动清空';
  }
  async function expand(resume, report) {
    for (const section of document.querySelectorAll('.form-cell')) {
      const title = section.querySelector('.tit p')?.textContent.trim();
      const collection = P.sections[title]?.collection;
      if (!collection) continue;
      const target = Math.min(resume.collections?.[collection]?.length || 0, 50);
      const count = () => section.querySelectorAll('.form-cell-inner').length;
      for (let i = count(); i < target; i++) {
        const button = section.querySelector('.add-more-btn');
        if (!visible(button)) break;
        const previous = count();
        button.click();
        if (!await until(() => count() > previous)) {
          report.issues.push({ label: title, reason: '添加条目未成功，可能需要先完成已有条目' }); break;
        }
        report.created++;
      }
    }
  }
  async function run(mode, resume, highlight) {
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    busy = true;
    try {
      const report = { mode, adapter: 'hotjob', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      const rows = P.items(document).map(item => P.describe(item, resume, true));
      const written = [];
      for (const row of rows) {
        if (row.path || row.custom) report.matched++;
        if (mode === 'PREVIEW') { if (row.els[0] && row.path) highlight(row.els[0], { label: row.source }); continue; }
        if (row.existing) { report.skipped++; continue; }
        const error = await write(row);
        await pause(80);
        const failure = error || verify(row);
        if (failure) report.issues.push({ label: `${row.section} / ${row.index + 1} / ${row.label}`, reason: failure });
        else written.push(row);
      }
      // Final pass catches controls cleared by later linked fields.
      if (mode === 'FILL') {
        await pause(350);
        for (const row of written) {
          const error = verify(row);
          if (error) report.issues.push({ label: row.label, reason: error });
          else { report.filled++; if (row.els[0]) highlight(row.els[0], { label: row.label }); }
        }
        const audit = P.scan(document, resume);
        report.requiredMissing = audit.rows.filter(r => r.required && !r.existing).length;
        report.pendingCount = audit.rows.filter(r => !r.existing).length;
        await chrome.storage.local.set({ latestPageAudit: audit });
      }
      return report;
    } finally { busy = false; }
  }
  globalThis.ResumeHotjob = { run };
})();
