/* Region-scoped component executor. Model output is data, never selectors/code.
 * Every write uses a retained element and a bounded, owned option popup. */
(function () {
  'use strict';
  const A = globalThis.ResumeControlAdapters;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const text = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const norm = v => text(v).toLowerCase().replace(/\s/g, '');
  const visible = el => !!el?.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const own = el => /^resume-ai-/.test(el.getRootNode().host?.id || '') || !!el.closest('#resume-assist-stack');
  const selectors = 'input,textarea,select,.phoenix-select,[role="combobox"],[role="radio"],[role="checkbox"],[aria-haspopup="listbox"],[contenteditable="true"],iframe,input[type="file"],canvas';
  function roots() {
    const result = [document];
    for (let i = 0; i < result.length; i++) for (const el of result[i].querySelectorAll('*')) {
      if (el.shadowRoot && !/^resume-ai-/.test(el.id)) result.push(el.shadowRoot);
    }
    return result;
  }
  function canonical(el) { return el.closest('.phoenix-select,[role="combobox"],[aria-haspopup="listbox"]') || el; }
  function inRect(el, rect) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function refs(el, attribute) {
    return (el.getAttribute(attribute) || '').split(/\s+/).filter(Boolean)
      .map(id => el.getRootNode().getElementById?.(id)).filter(Boolean);
  }
  function label(el) {
    return text(refs(el, 'aria-labelledby').map(n => n.textContent).join(' ') || el.getAttribute('aria-label') ||
      [...(el.labels || [])].map(n => n.textContent).join(' ') || el.getAttribute('data-label'));
  }
  function container(el) {
    return el.closest('[class*="form-item"],[class*="formItem"],[class*="form_item"],.field,fieldset,[role="group"],[role="radiogroup"]') || el.parentElement;
  }
  function descriptive(el) {
    const c = container(el);
    if (!c || c === document.body || c.querySelectorAll(selectors).length > 12) return '';
    const clone = c.cloneNode(true);
    clone.querySelectorAll('input,textarea,select,script,style,[contenteditable],.phoenix-select,[role="combobox"],.resume-assistant-badge').forEach(n => n.remove());
    return text(clone.textContent).slice(0, 900);
  }
  function optionLabel(el) { return label(el) || text(el.textContent) || (el.value !== 'on' ? text(el.value) : '选中'); }
  function kind(el) {
    const role = el.getAttribute('role');
    if (el.type === 'radio' || role === 'radio') return 'radio';
    if (el.type === 'checkbox' || role === 'checkbox') return 'checkbox';
    if (el.tagName === 'SELECT') return el.multiple ? 'multiselect' : 'select';
    if (/cascad/i.test(el.className || '')) return 'cascader';
    if (A.root(el)) return /date|calendar/i.test(el.className + ' ' + el.innerHTML) ? 'date-picker' : 'select';
    if (role === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox' || el.hasAttribute('list')) return 'combobox';
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.tagName === 'INPUT') return el.type || 'text';
    return 'unsupported';
  }
  function checked(el) { return el.checked === true || el.getAttribute('aria-checked') === 'true'; }
  function describe(el, members) {
    const c = container(el);
    const fieldLabel = c?.querySelector('legend,[class*="label"],[class*="Label"]');
    const grouped = members.length > 1;
    const title = (grouped ? text(c?.querySelector('legend')?.textContent || c?.getAttribute('aria-label') || fieldLabel?.textContent) : label(el)) ||
      text(fieldLabel?.textContent) || text(el.previousElementSibling?.matches('label') ? el.previousElementSibling.textContent : '') || el.placeholder || el.name || '未命名字段';
    const headings = [...el.getRootNode().querySelectorAll('h1,h2,h3,h4,legend,[class*="section-title"]')];
    const heading = headings.filter(n => !own(n) && n.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
    const context = text([descriptive(el), ...refs(el, 'aria-describedby').map(n => n.textContent), el.placeholder].filter(Boolean).join(' · ')).slice(0, 1200);
    const limits = [...context.matchAll(/(?:最多|不超过|限|上限)\s*(\d+)\s*[个字字符]|(\d+)\s*字(?:以内|之内)/g)].map(m => Number(m[1] || m[2])).filter(n => n > 0);
    if (el.maxLength > 0) limits.push(el.maxLength);
    return { label: title.slice(0, 200), context, section: text(heading?.textContent).slice(0, 200),
      maxLength: limits.length ? Math.min(...limits) : 0,
      required: !!el.required || el.getAttribute('aria-required') === 'true' || /^\s*\*/.test(title),
    };
  }
  function read(f) {
    const el = f.el;
    if (f.kind === 'radio') return f.members.filter(checked).map(optionLabel).join('、');
    if (f.kind === 'checkbox') return checked(el);
    if (el.tagName === 'SELECT') {
      const values = [...el.selectedOptions].filter(o => o.value !== '' && !/^请选择|^Select/i.test(text(o.text))).map(o => text(o.text));
      return el.multiple ? values : values[0] || '';
    }
    if (A.root(el)) return A.read(el) || '';
    const value = el.value ?? text(el.querySelector('[class*="selection-item"],[class*="selected-value"]')?.textContent || el.textContent);
    return /^(请选择|Select|Please select)$/i.test(text(value)) ? '' : text(value);
  }
  function filled(f) {
    const v = read(f);
    return Array.isArray(v) ? v.length > 0 : v === true || typeof v === 'string' && !!v;
  }
  function scan(rect) {
    const all = [...new Set(roots().flatMap(r => [...r.querySelectorAll(selectors)]).map(canonical))]
      .filter(el => !own(el) && visible(el) && !el.closest('.phoenix-selectList,.phoenix-date-picker,.constant-main-selector-container,[role="listbox"]') &&
        !['hidden', 'submit', 'button', 'reset', 'image'].includes(el.type));
    const chosen = all.filter(el => inRect(el, rect));
    const seen = new Set(), fields = [], occurrences = new Map();
    for (const el of chosen) {
      if (seen.has(el)) continue;
      const k = kind(el);
      let members = [el];
      if (k === 'radio') members = all.filter(n => kind(n) === 'radio' && n.getRootNode() === el.getRootNode() &&
        (el.name ? n.name === el.name && n.form === el.form : n.closest('[role="radiogroup"],fieldset') && n.closest('[role="radiogroup"],fieldset') === el.closest('[role="radiogroup"],fieldset')));
      if (!members.length) members = [el];
      members.forEach(n => seen.add(n));
      const info = describe(el, members);
      const key = info.section + '\n' + info.label;
      let entryIndex = (occurrences.get(key) || 0) + 1; occurrences.set(key, entryIndex);
      const cardSelector = '[data-entry-index],.experience-item,.experience-card,.education-item,.education-card,[class*="entry-card"],[class*="resume-card"]';
      const card = el.closest(cardSelector);
      if (card?.parentElement) {
        const siblings = [...card.parentElement.children].filter(n => n.matches(cardSelector));
        entryIndex = siblings.indexOf(card) + 1;
      }
      const f = { ...info, id: `region-${fields.length + 1}`, el, members, kind: k, entryIndex, options: [], optionStatus: '', blocked: '' };
      if (!['text','email','tel','url','number','textarea','date','month','datetime-local','select','multiselect','radio','checkbox','combobox','cascader','date-picker'].includes(k)) f.blocked = '暂不自动操作此类型（文件、签名、富文本或内嵌页面等）';
      if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.readOnly && !['combobox','select','date-picker','cascader'].includes(k)) f.blocked = '字段只读或已禁用';
      if (/验证码|签名|承诺|声明|隐私|协议|同意条款|captcha|signature|terms|consent/i.test(info.label + ' ' + (k === 'checkbox' ? info.context : ''))) f.blocked = '需由本人完成，不自动填写';
      if (members.some(n => !chosen.includes(n))) f.blocked = '单选组未完整框选，请将所有选项一起圈入';
      f.before = JSON.stringify(read(f));
      f.options = localOptions(f);
      fields.push(f);
    }
    return fields;
  }
  function localOptions(f) {
    if (f.kind === 'radio') return f.members.filter(n => !n.disabled).map(optionLabel);
    if (f.kind === 'checkbox') return ['true', 'false'];
    if (f.el.tagName === 'SELECT') return [...f.el.options].filter(n => !n.disabled && n.value !== '').map(n => text(n.text));
    if (f.el.list) return [...f.el.list.options].map(n => n.value);
    return [];
  }
  async function until(fn, ms = 1500) {
    const end = Date.now() + ms;
    do { const value = fn(); if (value) return value; await pause(70); } while (Date.now() < end);
    return null;
  }
  function click(el) {
    for (const type of ['mousedown','mouseup','click']) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
  function popups(el) {
    const linked = [...refs(el, 'aria-controls'), ...refs(el, 'aria-owns')].filter(visible);
    return linked.length ? linked : [];
  }
  function popupOptions(popup) {
    return [...popup.querySelectorAll('[role="option"],[role="treeitem"],.el-select-dropdown__item,.ant-select-item-option,.el-cascader-node')]
      .filter(n => visible(n) && n.getAttribute('aria-disabled') !== 'true' && !n.classList.contains('is-disabled'));
  }
  function popupLabel(n) { return text(n.getAttribute('aria-label') || n.querySelector('.ant-select-item-option-content,.el-cascader-node__label')?.textContent || n.textContent); }
  function closePopup(el) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    el.blur?.(); document.body.click();
  }
  async function openPopup(el) {
    closePopup(el); await pause(80);
    const popupSelector = '[role="listbox"],[role="tree"],.el-select-dropdown,.ant-select-dropdown,.el-cascader__dropdown';
    const before = new Set(roots().flatMap(r => [...r.querySelectorAll(popupSelector)]).filter(visible));
    el.scrollIntoView({ block: 'center' }); el.focus?.(); click(el);
    return until(() => {
      const linked = popups(el);
      if (linked.length === 1) return linked[0];
      // With no explicit ARIA ownership, accept only a single newly visible
      // popup anchored next to the clicked field; never arbitrary page options.
      const r = el.getBoundingClientRect();
      const opened = roots().flatMap(root => [...root.querySelectorAll(popupSelector)]).filter(n => {
        if (!visible(n) || before.has(n) || own(n)) return false;
        const b = n.getBoundingClientRect();
        return b.right >= r.left && b.left <= r.right && Math.min(Math.abs(b.top - r.bottom), Math.abs(b.bottom - r.top)) < 120;
      });
      return opened.length === 1 ? opened[0] : null;
    });
  }
  async function options(f) {
    if (f.blocked) return [];
    const local = localOptions(f);
    if (local.length || !['select','combobox','cascader','date-picker'].includes(f.kind)) return local;
    if (A.root(f.el)) return A.options(f.el);
    return A.exclusive(async () => {
      try {
        const popup = await openPopup(f.el);
        if (!popup) { f.optionStatus = '未能可靠定位选项弹层'; return []; }
        await until(() => popupOptions(popup).length);
        return [...new Set(popupOptions(popup).map(popupLabel))].slice(0, 200);
      } finally { closePopup(f.el); }
    });
  }
  function match(nodes, value, getText = popupLabel) {
    const exact = nodes.filter(n => norm(getText(n)) === norm(value));
    if (exact.length === 1) return exact[0];
    if (exact.length) return null;
    const alias = nodes.filter(n => A.equivalent(getText(n), value));
    return alias.length === 1 ? alias[0] : null;
  }
  async function fillPopup(f, value, alive) {
    let popup = await openPopup(f.el);
    if (!popup) return '未能可靠定位选项弹层';
    const path = Array.isArray(value) ? value : [value];
    if (path.length > 1 && f.kind !== 'cascader') return '此组件不支持多级路径';
    for (let i = 0; i < path.length; i++) {
      if (!alive()) return '操作已停止';
      await until(() => popupOptions(popup).length);
      let option = match(popupOptions(popup), path[i]);
      if (!option && path.length === 1) {
        const input = f.el.matches('input:not([readonly])') ? f.el : popup.querySelector('input:not([readonly])');
        if (input) {
          setValue(input, String(path[i]));
          option = await until(() => match(popupOptions(popup), path[i]));
        }
      }
      if (!option) return '没有唯一匹配选项（可能未加载、重名或建议不在选项内）';
      if (!alive()) return '操作已停止';
      click(option); await pause(180);
      popup = popups(f.el)[0] || popup;
    }
    return '';
  }
  function same(actual, expected) {
    if (Array.isArray(actual) || Array.isArray(expected)) return JSON.stringify(actual) === JSON.stringify(expected);
    if (typeof expected === 'boolean') return actual === expected;
    return norm(actual) === norm(expected) || A.equivalent(actual, expected);
  }
  async function write(f, value, overwrite = false, alive = () => true) {
    if (f.blocked) return f.blocked;
    if (!f.el.isConnected || f.members.some(n => !n.isConnected)) return '字段已重建，请重新框选';
    if (f.el.disabled || f.el.getAttribute('aria-disabled') === 'true' || f.members.some(n => n.disabled || n.getAttribute('aria-disabled') === 'true')) return '字段已禁用';
    if (JSON.stringify(read(f)) !== f.before) return '页面内容已变化，请重新核对或重新框选';
    if (filled(f) && !overwrite) return '已有内容，未授权覆盖';
    if (value === '' || value == null) return '缺少可填写的答案';
    if (f.maxLength && typeof value === 'string' && value.length > f.maxLength) return `超过 ${f.maxLength} 字限制`;
    if (f.kind === 'checkbox' && typeof value !== 'boolean') return '复选框须为 true 或 false';
    if (!['checkbox','multiselect','cascader'].includes(f.kind) && typeof value !== 'string') return '该字段需要文字答案';
    if (['date','month','datetime-local'].includes(f.kind)) {
      const pattern = f.kind === 'month' ? /^\d{4}-\d{2}$/ : f.kind === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      if (!pattern.test(value)) return '日期精度或格式不符，不能自动补造日期';
    }
    return A.exclusive(async () => {
      if (!alive()) return '操作已停止';
      if (!f.el.isConnected || JSON.stringify(read(f)) !== f.before) return '排队期间字段发生变化，请重新核对';
      const el = f.el;
      let error = '';
      try {
        if (A.root(el)) {
          const result = await A.fill(el, Array.isArray(value) ? value.join('/') : value);
          if (result !== 'ok') error = result;
        } else if (f.kind === 'radio') {
          const candidate = match(f.members.filter(n => !n.disabled && n.getAttribute('aria-disabled') !== 'true'), value, optionLabel);
          if (!candidate) return '单选组没有唯一匹配选项';
          if (!checked(candidate)) click(candidate);
        } else if (f.kind === 'checkbox') {
          if (checked(el) !== value) click(el);
        } else if (el.tagName === 'SELECT') {
          const wanted = el.multiple ? value : [value];
          if (!Array.isArray(wanted)) return '多选下拉须提供选项数组';
          const selected = wanted.map(v => match([...el.options].filter(n => !n.disabled && n.value !== ''), v, n => text(n.text)));
          if (selected.some(n => !n)) return '下拉没有唯一匹配选项';
          for (const o of el.options) o.selected = selected.includes(o);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (f.kind === 'combobox' && el.list) {
          if (!localOptions(f).includes(value)) return '联想列表中没有该选项';
          setValue(el, value);
        } else if (['combobox','select','cascader'].includes(f.kind)) {
          error = await fillPopup(f, value, alive);
        } else {
          if (el.readOnly) return '字段已变为只读';
          el.focus(); setValue(el, value); el.blur();
        }
      } catch (_) { error = '组件操作异常，答案已保留'; }
      finally { if (['combobox','cascader'].includes(f.kind)) closePopup(el); }
      await pause(450);
      f.before = JSON.stringify(read(f));
      if (error) return error;
      if (!el.isConnected) return '页面重建了字段，请重新框选核验';
      const expected = f.kind === 'cascader' && Array.isArray(value) ? value.join('/') : value;
      if (!same(read(f), expected)) return '页面未接受完整答案，不能计为成功';
      if (el.validity && !el.validity.valid) return el.validationMessage || '原生校验未通过';
      if (el.getAttribute('aria-invalid') === 'true') return '页面标记字段无效';
      const err = container(el)?.querySelector('[role="alert"],[class*="error-message"],.el-form-item__error,.ant-form-item-explain-error');
      if (visible(err) && text(err.textContent)) return text(err.textContent).slice(0, 160);
      return '';
    });
  }
  function describeForAI(f) {
    return { id: f.id, label: f.label, context: f.context, section: f.section, entryIndex: f.entryIndex,
      kind: f.kind, required: f.required, maxLength: f.maxLength, options: f.options, optionStatus: f.optionStatus };
  }
  globalThis.ResumeAreaControls = { scan, options, write, read, filled, describeForAI, same };
})();
