/* Component adapters. Phoenix DOM verified against Beisen's public form bundles.
 * No React internals, website-specific user data, or whole-page text matching. */
(function () {
  'use strict';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const cache = new WeakMap();
  let queue = Promise.resolve();
  function exclusive(work) {
    const next = queue.then(work, work);
    queue = next.catch(() => {});
    return next;
  }
  function root(el) { return el && el.closest && el.closest('.phoenix-select'); }
  function read(el) {
    const host = root(el);
    if (!host) return null;
    // calcEle and input.value can contain search text; neither proves selection.
    return [...host.querySelectorAll('.phoenix-select__tipEle, .phoenix-select__tagItem')]
      .map(node => node.textContent.trim()).filter(Boolean).join('、');
  }
  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  function close() {
    for (const panel of document.querySelectorAll('.constant-main-selector-container')) {
      if (!visible(panel)) continue;
      const cancel = [...panel.querySelectorAll('button,.phoenix-button,[role="button"]')].find(n => /^(取消|关闭)$/.test(n.textContent.trim()));
      if (cancel) click(cancel);
    }
    click(document.body);
  }
  function lists() { return [...document.querySelectorAll('.phoenix-selectList, .phoenix-date-picker, .constant-main-selector-container')].filter(visible); }
  async function until(get, timeout = 1200) {
    const end = Date.now() + timeout;
    do { const result = get(); if (result) return result; await pause(50); } while (Date.now() < end);
    return null;
  }
  function optionNodes(list) {
    return [...list.querySelectorAll('.phoenix-selectList__listItem, .list-item-container')]
      .filter(node => visible(node) && !node.classList.contains('phoenix-selectList__listItem--disabled') && node.getAttribute('aria-disabled') !== 'true');
  }
  function optionText(node) { return (node.querySelector('.phoenix-selectList__singleLabel, .item-text-label') || node).textContent.trim(); }
  function matching(nodes, value) {
    const exact = nodes.filter(node => normalize(optionText(node)) === normalize(value));
    if (exact.length === 1) return exact[0];
    const aliases = { '硕士': ['硕士研究生'], '博士': ['博士研究生'], '本科': ['大学本科'], '大专': ['大学专科', '专科'], '六级': ['CET-6'], '四级': ['CET-4'] };
    const alternate = nodes.filter(node => (aliases[value] || []).includes(optionText(node)));
    return alternate.length === 1 ? alternate[0] : null;
  }
  function dateParts(value) {
    const match = /^(\d{4})[-/年.](\d{1,2})(?:[-/月.](\d{1,2})日?)?$/.exec(String(value).trim());
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = match[3] ? Number(match[3]) : null;
    if (month < 1 || month > 12 || (day != null && (day < 1 || day > new Date(year, month, 0).getDate()))) return null;
    return [match[1], String(month).padStart(2, '0'), day == null ? null : String(day).padStart(2, '0')];
  }
  function sameDate(actual, expected) {
    const a = dateParts(actual), b = dateParts(expected);
    return !!a && !!b && a.join('-') === b.join('-');
  }
  async function fillDate(host, picker, value) {
    const parts = dateParts(value);
    if (!parts) return '日期格式无效或缺少必要日期';
    const input = picker.querySelector('input.phoenix-calendar-input');
    if (!input || input.readOnly || input.disabled) return '日期组件没有可编辑的日期输入框';
    // The public Phoenix calendar exposes date input + Enter -> onSelect.
    // Do not modify the search input on the outer select shell.
    const separator = /\//.test(input.placeholder || input.value) ? '/' : '-';
    const formatted = parts.filter(Boolean).join(separator);
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, formatted);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await pause(100);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    if (!await until(() => sameDate(read(host), value))) return '日期未被页面接受';
    close();
    await pause(120);
    return sameDate(read(host), value) ? 'ok' : '日期被页面清空';
  }
  async function open(el) {
    const host = root(el);
    if (!host || host.classList.contains('phoenix-select--disabled')) return null;
    // Close any previous popup before taking the baseline. Do not reuse another field's list.
    close();
    await pause(80);
    const before = new Set(lists());
    host.scrollIntoView({ block: 'center' });
    click(host);
    return until(() => lists().find(list => !before.has(list)));
  }
  async function options(el) {
    return exclusive(async () => {
      try {
        const list = await open(el);
        if (!list) return [];
        if (list.matches('.phoenix-date-picker')) return [];
        await until(() => optionNodes(list).length);
        const values = optionNodes(list).map(optionText);
        cache.set(root(el), values);
        return values;
      } finally { close(); }
    });
  }
  async function fill(el, value) {
    const host = root(el);
    if (!host) return 'unknown';
    if (normalize(read(host)) === normalize(value)) return 'ok';
    try {
      const list = await open(host);
      if (!list) return 'dropdown-fail';
      if (list.matches('.phoenix-date-picker')) return await fillDate(host, list, value);
      await until(() => optionNodes(list).length);
      cache.set(host, optionNodes(list).map(optionText));
      const parts = String(value).split(/[\/／>]/).map(s => s.trim()).filter(Boolean);
      if (list.matches('.constant-main-selector-container') && parts.length > 1) {
        for (const part of parts.slice(0, -1)) {
          const parent = await until(() => matching(optionNodes(list), part));
          if (!parent) return '层级选项未找到：请核对地区或专业路径';
          const label = parent.querySelector('.item-text-label');
          if (!label) return '层级选项缺少导航标签';
          click(label);
          await pause(150);
        }
      }
      const choice = list.matches('.constant-main-selector-container') ? parts.at(-1) || value : value;
      let target = matching(optionNodes(list), choice);
      if (!target) {
        const search = [...list.querySelectorAll('input')].find(node => visible(node) && !node.readOnly && !node.disabled);
        if (search) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(search, String(choice));
          search.dispatchEvent(new Event('input', { bubbles: true }));
          target = await until(() => matching(optionNodes(list), choice));
        }
      }
      if (!target) return 'no-match';
      const expected = optionText(target);
      if (list.matches('.constant-main-selector-container')) {
        // Tree labels navigate, icons select; flat single-choice lists may
        // commit immediately. Confirmation stays inside this owned popup.
        const icon = target.querySelector('.icon-container svg,.phoenix-radio,.phoenix-checkbox');
        if (icon) {
          if (!/RadioChecked|CheckboxChecked|--checked/.test(icon.getAttribute('class') || '')) click(icon);
        } else click(target.querySelector('.item-text-label') || target);
        await pause(100);
        const accepted = () => equivalentSelection(read(host), expected, parts);
        const confirm = [...list.querySelectorAll('button,.phoenix-button,[role="button"]')]
          .find(node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true' && !/--disabled/.test(node.className || '') && /^(确定|确认|保存)$/.test(node.textContent.trim()));
        if (confirm) click(confirm);
        else if (!await until(accepted)) return '选择器未提交选项，且未找到可用确认按钮';
      } else click(target); // exactly once: a second click can toggle a multiselect off.
      close();
      const selected = await until(() => equivalentSelection(read(host), expected, parts));
      if (!selected) return 'dropdown-fail';
      await pause(120);
      return equivalentSelection(read(host), expected, parts) ? 'ok' : 'dropdown-fail';
    } finally { close(); }
  }
  function equivalentSelection(actual, expected, parts) {
    return normalize(actual) === normalize(expected) || parts.length > 1 && normalize(actual) === normalize(parts.join('/'));
  }
  globalThis.ResumeControlAdapters = { root, read, fill, options, exclusive,
    cachedOptions: el => cache.get(root(el)) || [],
    equivalent: (actual, expected) => sameDate(actual, expected) || !!matching([{ textContent: actual, querySelector: () => null }], expected),
  };
})();
