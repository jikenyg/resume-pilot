/**
 * 简历助手 —— 内容脚本（升级版）
 *
 * 职责：
 *   1. 扫描当前页面里的表单控件（input/textarea/select/radio/checkbox/自定义下拉）
 *   2. 从控件抠出"提示文本"（label/name/id/placeholder/aria/周边文本）
 *   3. 判断控件所属区块（教育/实习/项目/获奖…），限定候选字段范围
 *   4. 用第一层关键词匹配定位到简历字段，拿到值
 *   5. 填入控件：文本/原生select/单选框/复选框/自定义下拉（点击弹层→选中）
 *   6. 自动点击"＋添加"为多段经历创建新的表单并逐段回填
 *   7. 高亮已识别字段，生成填充诊断报告
 *
 * 与 popup 通过 chrome.runtime 消息通信：
 *   { type:'FILL' }                  一键填充（含自动添加多段经历）
 *   { type:'PREVIEW' }               只高亮、不改值
 *   { type:'SET_SELECTION', payload } 切换集合条目后重新填充
 *   { type:'CLEAR' }                 清除高亮
 */
(function () {
  'use strict';

  const RS = globalThis.ResumeShared;
  const adapters = globalThis.ResumeControlAdapters;
  if (!RS) {
    console.warn('[简历助手] shared 脚本未加载，content 脚本中止。');
    return;
  }

  let currentResume = null;
  let selection = { collection: null, index: 0 };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // 带"类型/性质"字样的字段（如"学历类型"）不应被学历/学位值误填
  const TYPE_SENSITIVE = new Set(['educationDegree', 'education.degree']);
  function isTypeMismatch(res, hintText) {
    if (!res) return false;
    if (TYPE_SENSITIVE.has(res.entry.key) && /类型|性质/.test(hintText)) return true;
    // “英语等级成绩 / 雅思分数”不是“英语等级”。没有明确分数时不把“六级”
    // 这种等级文字塞进只接受整数的输入框。
    if ((res.entry.key === 'languageLevel' || res.entry.key === 'language.level') && /成绩|分数|score|雅思|托福/.test(hintText)) return true;
    if (/^(language|language\.name)$/.test(res.entry.key) && /等级|分数|成绩/.test(hintText)) return true;
    if (/^(major|education\.major)$/.test(res.entry.key) && /排名/.test(hintText)) return true;
    if (TYPE_SENSITIVE.has(res.entry.key) && /学位/.test(hintText)) return true;
    if (res.entry.key === 'phone' && /紧急|联系人/.test(hintText)) return true;
    return false;
  }

  function sourceValueError(fieldKey, value) {
    if (fieldKey === 'idCard') {
      const id = String(value || '').trim();
      // 中国居民身份证通常为 18 位；兼容历史 15 位格式。其他长度不写入页面，
      // 避免“脚本填了但页面必然报错”被误统计为成功。
      if (!/^(\d{15}|\d{17}[\dXx])$/.test(id)) return '简历中的身份证号码格式不合法，未写入页面';
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // 读取简历 + 选择状态
  // ---------------------------------------------------------------------------
  function loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resume'], (res) => {
        currentResume = res.resume || RS.emptyResume();
        migrateResume(currentResume);
        selection = currentResume.selection || { collection: null, index: 0 };
        resolve(currentResume);
      });
    });
  }

  // 旧结构升级：把混在"竞赛获奖"里的荣誉称号拆到独立"荣誉称号"模块；缺荣誉称号时用预置补齐
  function migrateResume(r) {
    if (!r.collections) r.collections = {};
    const aw = r.collections.award;
    if (Array.isArray(aw) && !Array.isArray(r.collections.honor)) {
      if (aw.length > 9 && aw.length <= 22) {
        r.collections.honor = aw.slice(9).map((h) => ({ name: h.name, level: h.level || '', date: h.date || '', organization: h.description || h.organization || '', description: '' }));
        r.collections.award = aw.slice(0, 9);
      } else {
        r.collections.honor = [];
      }
    }
    if (!Array.isArray(r.collections.honor)) r.collections.honor = [];
  }

  // ---------------------------------------------------------------------------
  // 控件识别
  // ---------------------------------------------------------------------------
  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
  }

  function isFormControl(el) {
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'email', 'tel', 'password', 'number', 'date', 'search', 'url'].includes(t) ||
        el.type === 'radio' || el.type === 'checkbox';
    }
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return false;
  }

  // 富文本编辑器并不一定是 textarea。常见招聘系统会把它实现成
  // <div contenteditable> 或 role=textbox，因此要把它们也当作输入控件扫描。
  function isRichTextControl(el) {
    if (!el) return false;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    return ['textbox', 'searchbox', 'spinbutton'].includes(role);
  }

  // 判断是否为"自定义下拉/选择器"触发器（非原生 select）
  function isSelectLook(el) {
    if (!el) return false;
    if (el.readOnly) return true;
    const role = (el.getAttribute('role') || '');
    if (/combobox|select/i.test(role)) return true;
    // aria-haspopup 单独出现的情况很多（例如帮助菜单），只有同时具备
    // 下拉状态、受控列表或明显的选择器类名时，才认定为表单选择器。
    const hasPopup = el.hasAttribute('aria-haspopup');
    const hasSelectAria = el.hasAttribute('aria-expanded') || el.hasAttribute('aria-controls') || el.hasAttribute('aria-owns');
    const cls = (typeof el.className === 'string' ? el.className : '') || '';
    const looksLikeSelect = /select|dropdown|picker|chooser|cascader|autocomplete|phoenix-date/i.test(cls);
    if (looksLikeSelect) return true;
    if (hasPopup && hasSelectAria) return true;
    return false;
  }

  function isSelectTrigger(el) {
    return el.tagName === 'SELECT' || isSelectLook(el);
  }

  const CONTROL_SELECTOR = [
    'input', 'textarea', 'select', '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
    '[role="textbox"]', '[role="searchbox"]', '[role="spinbutton"]', '[role="combobox"]',
    '[aria-autocomplete]', '[aria-haspopup][aria-expanded]', '[aria-haspopup][aria-controls]',
    '[class*="select-view"]', '[class*="select-trigger"]', '[class*="dropdown"]',
    '[class*="cascader"]', '[class*="autocomplete"]',
    // 主流招聘站常见的组件库选择器外壳；只用于“发现”，仍会经过
    // isSelectLook 过滤，避免把普通展示节点当成表单字段。
    '.ant-select-selector', '.ant-cascader-picker', '.el-select', '.el-cascader',
    '.arco-select-view', '.semi-select-selection', '.t-select__wrap',
    '[class*="phoenix-select"]', '[class*="phoenix-date"]', '[class*="phoenix-cascader"]',
    'input[readonly]',
  ].join(', ');

  // document.querySelectorAll 不会进入 Web Component 的 Shadow DOM。招聘站的
  // 日期、城市和级联选择器常被封在开放 Shadow Root 里，所以递归扫描所有开放根。
  function queryControlsAcrossOpenRoots() {
    const roots = [document];
    const seenRoots = new Set();
    const nodes = [];
    while (roots.length) {
      const root = roots.pop();
      if (!root || seenRoots.has(root)) continue;
      seenRoots.add(root);
      root.querySelectorAll(CONTROL_SELECTOR).forEach((el) => nodes.push(el));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && el.shadowRoot.mode === 'open') roots.push(el.shadowRoot);
      });
    }
    return nodes;
  }

  function phoenixControlRoot(el) {
    const select = adapters && adapters.root(el);
    if (select) return select;
    let node = el;
    for (let depth = 0; depth < 5 && node && node !== document.body; depth++) {
      const cls = typeof node.className === 'string' ? node.className : '';
      // __content / __option 通常是展开后挂在 body 的菜单，不属于待填写控件；
      // inputWrapper / switchArrow 只是选择器内部的装饰节点，不能各自当成一个字段。
      if (/phoenix-(select|date|cascader)/i.test(cls) && !/__(content|option|item|placeholder|inputWrapper|switchArrow|clear|loading)/i.test(cls)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function canonicalControl(el) {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/phoenix-(select|date|cascader)/i.test(cls)) return phoenixControlRoot(el);
    return el;
  }

  function isUtilityControl(el) {
    const own = ownHint(el);
    if (/搜索职位|职位关键词|search\s*(job|position)?/i.test(own)) return true;
    return !!el.closest('header, nav, [role="navigation"], [role="search"]');
  }

  function collectControls() {
    const nodes = queryControlsAcrossOpenRoots();
    const out = [];
    const seen = new Set();
    for (const raw of nodes) {
      if (/^resume-ai-/.test(raw.getRootNode().host?.id || '') || raw.closest('#resume-assist-stack, .phoenix-selectList, .phoenix-date-picker')) continue;
      const el = canonicalControl(raw);
      if (!el) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.type === 'hidden') continue;
      if (!(isFormControl(el) || isRichTextControl(el) || isSelectTrigger(el))) continue;
      if (!isVisible(el)) continue;
      if (isUtilityControl(el)) continue;
      out.push(el);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 提示文本提取
  // ---------------------------------------------------------------------------
  function ownHint(el) {
    const bits = [];
    if (el.id) bits.push(el.id);
    if (el.name) bits.push(el.name);
    if (el.placeholder) bits.push(el.placeholder);
    if (el.getAttribute('aria-label')) bits.push(el.getAttribute('aria-label'));
    if (el.getAttribute('aria-description')) bits.push(el.getAttribute('aria-description'));
    if (el.getAttribute('aria-placeholder')) bits.push(el.getAttribute('aria-placeholder'));
    if (el.getAttribute('data-label')) bits.push(el.getAttribute('data-label'));
    if (el.getAttribute('data-testid')) bits.push(el.getAttribute('data-testid'));
    if (el.title) bits.push(el.title);
    if (el.getAttribute('autocomplete')) bits.push(el.getAttribute('autocomplete'));

    // aria-labelledby 指向的标签文本
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      lb.split(/\s+/).forEach((id) => {
        const root = el.getRootNode();
        const n = (root && typeof root.getElementById === 'function' && root.getElementById(id)) || document.getElementById(id);
        if (n) bits.push(n.textContent.trim());
      });
    }
    const describedBy = el.getAttribute('aria-describedby');
    if (describedBy) {
      describedBy.split(/\s+/).forEach((id) => {
        const root = el.getRootNode();
        const n = (root && typeof root.getElementById === 'function' && root.getElementById(id)) || document.getElementById(id);
        if (n) bits.push(n.textContent.trim());
      });
    }
    return bits.join(' ');
  }

  function associatedLabel(el) {
    const bits = [];
    if (el.id) {
      const root = el.getRootNode();
      const label = (root && root.querySelector && root.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
        document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) bits.push(label.textContent.trim());
    }
    const wrap = el.closest('label');
    if (wrap) bits.push(wrap.textContent.trim());
    return bits.join(' ');
  }

  function parentAcrossShadow(el) {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode && el.getRootNode();
    return root && root.host ? root.host : null;
  }

  // 很多招聘站（包括 Phoenix 一类组件）把“姓名/最高学历”等标签放在
  // input 外两三层的 form-item 容器内，而不是直接与 input 相邻。
  // 只取容器中的短标签节点，避免把整张表单的大段文本误当作字段提示。
  function formItemLabel(el) {
    const bits = [];
    let node = parentAcrossShadow(el);
    for (let depth = 0; depth < 6 && node && node !== document.body; depth++) {
      const cls = typeof node.className === 'string' ? node.className : '';
      const role = node.getAttribute && node.getAttribute('role') || '';
      const looksLikeField = /form[-_]?item|formitem|field|control|row|group|phoenix/i.test(cls) ||
        /group/i.test(role) || node.tagName === 'FIELDSET';
      if (looksLikeField && node.querySelectorAll) {
        const labelNodes = node.querySelectorAll(
          'label, legend, dt, [data-label], [class*="label"], [class*="Label"], [class*="title"], [class*="Title"]'
        );
        labelNodes.forEach((candidate) => {
          if (candidate.contains(el) && candidate !== el) return;
          const text = (candidate.getAttribute('data-label') || candidate.textContent || '').trim().replace(/\s+/g, ' ');
          if (text && text.length <= 80) bits.push(text);
        });
        // 有些站点用裸文本节点作为标签，例如“* 姓名”。仅在表单项容器上读取，
        // 并限制长度，避免引入整页文案。
        const directText = Array.from(node.childNodes || [])
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent.trim()).filter(Boolean).join(' ');
        if (directText && directText.length <= 80) bits.push(directText);
      }
      node = parentAcrossShadow(node);
    }
    return [...new Set(bits)].join(' ');
  }

  function nearbyText(el) {
    const bits = [];
    let prev = el.previousElementSibling;
    let hops = 0;
    while (prev && hops < 3) {
      const t = (prev.textContent || '').trim();
      if (t && t.length <= 30) bits.push(t);
      prev = prev.previousElementSibling;
      hops++;
    }
    // ShadowRoot 内的控件没有 parentElement，需要沿宿主元素继续向上找。
    const parent = parentAcrossShadow(el);
    if (parent) {
      const direct = (parent.childNodes && Array.from(parent.childNodes)
        .filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')).trim();
      if (direct) bits.push(direct);
    }
    return bits.join(' ');
  }

  function extractHints(el) {
    const hints = [];
    const o = ownHint(el);
    const l = associatedLabel(el);
    const f = formItemLabel(el);
    const n = nearbyText(el);
    if (o) hints.push(o);
    if (l) hints.push(l);
    if (f) hints.push(f);
    if (n) hints.push(n);
    return hints;
  }

  // ---------------------------------------------------------------------------
  // 区块识别（限定候选范围）
  // ---------------------------------------------------------------------------
  function sectionFromClassOrId(el) {
    let node = el;
    for (let i = 0; i < 6 && node && node !== document.body; i++) {
      const cls = (typeof node.className === 'string' ? node.className : '') || '';
      const id = node.id || '';
      const sec = RS.detectSectionFromClass(id + ' ' + cls);
      if (sec) return sec;
      node = node.parentElement;
    }
    return null;
  }

  function sectionFromAncestorText(el) {
    let node = el;
    for (let i = 0; i < 8 && node && node !== document.body; i++) {
      const tag = node.tagName;
      const cls = (typeof node.className === 'string' ? node.className : '') || '';
      const containerLike = /form|group|block|section|item|wrap|field/i.test(tag + ' ' + cls) ||
        tag === 'FIELDSET' || tag === 'SECTION' || tag === 'LEGEND';
      if (containerLike) {
        const txt = (node.textContent || '').trim().slice(0, 120);
        const sec = RS.detectSection(txt);
        if (sec) return sec;
      }
      node = node.parentElement;
    }
    return null;
  }

  function determineScope(el) {
    const scope = new Set();
    RS.BASE_FIELD_DEFS.forEach((d) => scope.add(d.key));
    let section = sectionFromClassOrId(el) || sectionFromAncestorText(el);
    if (section) {
      const def = RS.COLLECTION_DEFS.find((c) => c.key === section);
      if (def) def.fields.forEach((f) => scope.add(section + '.' + f.key));
    } else {
      RS.COLLECTION_DEFS.forEach((c) => c.fields.forEach((f) => scope.add(c.key + '.' + f.key)));
    }
    return { scope, section };
  }

  // ---------------------------------------------------------------------------
  // 填充引擎：文本 / 原生select / 单选 / 复选 / 日期
  // ---------------------------------------------------------------------------
  function nativeValueSetter(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function fillText(el, value) {
    nativeValueSetter(el, value);
    return 'ok';
  }

  function fillRichText(el, value) {
    // 先提供浏览器原生 input 事件，供 React/Vue/富文本编辑器同步状态。
    // 不使用 execCommand，避免改写页面撤销栈或触发不可预期的格式化行为。
    el.focus();
    el.textContent = String(value == null ? '' : value);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return 'ok';
  }

  function fillSelect(el, value) {
    const v = String(value || '').trim();
    if (!v) return 'empty';
    const opts = Array.from(el.options);
    const nv = RS.normalize(v);
    let target =
      opts.find((o) => o.text.trim() === v) ||
      opts.find((o) => o.value === v) ||
      opts.find((o) => RS.normalize(o.text) === nv) ||
      opts.find((o) => nv && RS.normalize(o.text).includes(nv)) ||
      opts.find((o) => v && RS.normalize(o.text).includes(v));
    if (!target) return 'no-match';
    el.value = target.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }

  function fillRadio(el, value) {
    const v = String(value || '').trim();
    if (v === '') return 'empty';
    const name = el.name;
    const radios = name ? document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`) : [el];
    const nv = RS.normalize(v);
    let target = null;
    for (const r of radios) {
      const rv = r.value.trim();
      if (rv === v || RS.normalize(rv) === nv || (r.parentElement && (r.parentElement.textContent || '').includes(v))) { target = r; break; }
    }
    if (!target) return 'no-match';
    target.checked = true;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new Event('click', { bubbles: true }));
    return 'ok';
  }

  function fillCheckbox(el, value) {
    const truthy = /^(1|true|是|有|同意|yes)$/i.test(String(value || '').trim());
    if (el.checked !== truthy) {
      el.checked = truthy;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('click', { bubbles: true }));
    }
    return 'ok';
  }

  function toMonth(d) {
    const m = /^(\d{4})[-/.](\d{1,2})/.exec(String(d || ''));
    return m ? `${m[1]}-${m[2].padStart(2, '0')}` : String(d || '');
  }

  // 按输入框 placeholder 的格式（YYYY / YYYY-MM / YYYY-MM-DD）把简历日期转成对应格式
  function dateForField(value, ph) {
    const v = String(value || '');
    const m = /^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?/.exec(v);
    if (!m) return v;
    const y = m[1];
    const mo = (m[2] || '').padStart(2, '0');
    const d = (m[3] || '').padStart(2, '0');
    const n = RS.normalize(ph || '');
    if (n === 'yyyy') return y;
    if (n === 'yyyymm') return mo ? `${y}-${mo}` : y;
    if (n === 'yyyymmdd' || n.includes('yyyymmdd')) return (mo && d) ? `${y}-${mo}-${d}` : (mo ? `${y}-${mo}` : y);
    return mo ? `${y}-${mo}` : y;
  }

  // ---------------------------------------------------------------------------
  // 自定义下拉：点击打开 → 在弹层里找选项 → 点击选中
  // ---------------------------------------------------------------------------
  function looksLikeOption(c) {
    if (!c) return false;
    if (c.getAttribute && c.getAttribute('role') === 'option') return true;
    if (c.tagName === 'LI') return true;
    const cls = (typeof c.className === 'string' ? c.className : '') || '';
    return /option|select-item|select-option|dropdown-item/i.test(cls);
  }

  function clickSequence(node) {
    if (!node) return;
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    node.click();
  }

  function selectClickTarget(el) {
    // Phoenix 的事件通常绑在内部 input/wrapper，而不是最外层 div。
    return el.querySelector && el.querySelector('.phoenix-select__input, input, [role="combobox"], [class*="inputWrapper"]') || el;
  }

  function findOption(rv, v) {
    const sels = [
      '[role="option"]', '[data-value]', '[class*="select-option"]', '[class*="select-item"]',
      '[class*="dropdown"] li', '[class*="dropdown"] [class*="item"]', 'ul[role="listbox"] li',
      '.arco-select-option', '.ant-select-item-option', '.el-select-dropdown__item',
      '[class*="picker"] li', '[class*="option-item"]', '[class*="cascader"] li',
      '[class*="phoenix-select__option"]', '[class*="phoenix-select__item"]', '[class*="phoenix-select__content"] li',
    ];
    let best = null;
    let bestScore = 0;
    const seen = new Set();
    for (const sel of sels) {
      let els;
      try { els = document.querySelectorAll(sel); } catch (e) { continue; }
      for (const c of els) {
        if (seen.has(c)) continue;
        seen.add(c);
        if (!isVisible(c)) continue;
        if (c.closest('#resume-assist-stack') || c.getAttribute('aria-disabled') === 'true' || c.disabled) continue;
        const t = (c.textContent || '').trim();
        if (!t) continue;
        const ntc = RS.normalize(t);
        let score = 0;
        if (ntc === rv) score = 1000;
        else if (ntc.includes(rv)) score = 500;
        else if (rv.includes(ntc)) score = 200;
        if (score > 0 && looksLikeOption(c)) score += 15;
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
    return best;
  }

  async function keyboardSelect(el, v, rv) {
    const editable = (el.tagName === 'INPUT' && !el.readOnly) ? el : el.querySelector('input');
    if (editable && !editable.readOnly) {
      nativeValueSetter(editable, v);
      // Phoenix 可搜索下拉需要先输入过滤词，选项才会渲染出来；输入后再找一次。
      await delay(240);
      const filtered = findOption(rv, v);
      if (filtered && filtered !== el && filtered !== editable) {
        clickSequence(filtered);
        await delay(300);
        if (hasSelectedValue(el, rv)) return 'ok';
      }
      editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      editable.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      await delay(250);
      return hasSelectedValue(el, rv) ? 'ok' : 'dropdown-fail';
    }
    // 没有匹配项时不能盲按两次向下键，这会选中任意值。
    document.body.click();
    return 'no-match';
  }

  // 自定义下拉的真实值常不在 input.value，而在控件容器的可见文案里。
  // 只有回读到目标值，才允许把一次点击/按键记成“填写成功”。
  function hasSelectedValue(el, rv) {
    const text = RS.normalize((el.value || el.textContent || '').trim());
    return !!rv && text.includes(rv);
  }

  async function fillDropdownSelect(el, value) {
    const v = String(value || '').trim();
    if (!v) return 'empty';
    const rv = RS.normalize(v);
    const shown = () => RS.normalize((el.value || el.textContent || '').trim());

    // 1) 打开下拉
    const trigger = selectClickTarget(el);
    trigger.focus();
    el.scrollIntoView({ block: 'center' });
    clickSequence(trigger);
    await delay(500);

    // 2) 找选项并点击
    const opt = findOption(rv, v);
    if (opt) {
      clickSequence(opt);
      await delay(420);
      if (shown().includes(rv)) return 'ok';
      return keyboardSelect(el, v, rv);
    }

    // 3) 可输入 combobox 直接输入回车，或键盘导航
    return keyboardSelect(el, v, rv);
  }

  // ---------------------------------------------------------------------------
  // 统一填充入口
  // ---------------------------------------------------------------------------
  async function fillControl(el, value) {
    return adapters.exclusive(() => fillControlUnlocked(el, value));
  }

  async function fillControlUnlocked(el, value) {
    if (!el || !el.isConnected) return '字段已变化，请重新识别';
    const hint = extractHints(el).join(' ');
    if (/身份证|证件号码/.test(hint)) {
      const error = sourceValueError('idCard', value);
      if (error) return error;
    }
    if (/成绩|分数/.test(hint) && /六级|四级|英语/.test(String(value))) return '此字段需要成绩，不能填入语种或等级';
    if (adapters.root(el)) return adapters.fill(el, value);
    const tag = el.tagName;
    if (tag === 'SELECT') return fillSelect(el, value);
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'radio') return fillRadio(el, value);
      if (t === 'checkbox') return fillCheckbox(el, value);
      if (el.readOnly || isSelectLook(el)) return fillDropdownSelect(el, value);
      return fillText(el, value);
    }
    if (tag === 'TEXTAREA') return fillText(el, value);
    if (isRichTextControl(el)) return fillRichText(el, value);
    if (isSelectLook(el)) return fillDropdownSelect(el, value);
    return 'unknown';
  }

  // ---------------------------------------------------------------------------
  // 高亮
  // ---------------------------------------------------------------------------
  function addHighlight(el, info) {
    removeHighlight(el);
    const mark = document.createElement('div');
    mark.className = 'resume-assistant-badge';
    mark.textContent = '✓ ' + (info.label || info.key);
    mark.dataset.resumeKey = info.key;
    el.parentElement && el.parentElement.appendChild(mark);
    el.classList.add('resume-assistant-matched');
    el.dataset.resumeMatched = '1';
  }

  function removeHighlight(el) {
    el.classList.remove('resume-assistant-matched');
    delete el.dataset.resumeMatched;
    const parent = el.parentElement;
    if (parent) {
      const badge = parent.querySelector('.resume-assistant-badge');
      if (badge) badge.remove();
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.resume-assistant-matched').forEach((el) => removeHighlight(el));
    document.querySelectorAll('.resume-assistant-badge').forEach((b) => b.remove());
  }

  // ---------------------------------------------------------------------------
  // 自动"＋添加"多段经历并按序回填
  // ---------------------------------------------------------------------------
  function findAddTriggerInside(root) {
    const els = root.querySelectorAll('button, a, [role="button"], [class*="btn"], [class*="add"]');
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (/^\+?\s*添加\s*$/.test(t) || /^\+?\s*add\s*$/i.test(t)) {
        if (isVisible(el)) return el;
      }
    }
    // 兜底：文本为"添加/＋添加"的元素
    const all = root.querySelectorAll('span, div, p, i, a, button');
    for (const el of all) {
      const t = (el.textContent || '').trim();
      if (t === '添加' || t === '+ 添加' || t === '＋添加' || t === '+ 添加' || t === '＋ 添加') {
        const clickable = el.closest('button, a, [role="button"]');
        if (clickable) return clickable;
      }
    }
    return null;
  }

  function findSectionFor(collKey) {
    const pats = (RS.SECTION_HINTS && RS.SECTION_HINTS[collKey]) || [];
    if (pats.length === 0) return null;
    const headings = document.querySelectorAll('h1,h2,h3,h4,div,span,label,p,li,section,dt,legend,strong');
    for (const el of headings) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim();
      if (!t || t.length > 14) continue;
      const tn = RS.normalize(t);
      const hit = pats.some((p) => {
        const np = RS.normalize(p);
        if (!np) return false;
        return tn === np || (np.length >= 3 && tn.includes(np));
      });
      if (!hit) continue;
      let node = el.parentElement;
      for (let up = 0; up < 8 && node && node !== document.body; up++) {
        const add = findAddTriggerInside(node);
        if (add) return { headingEl: el, container: node, addBtn: add };
        node = node.parentElement;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 集合精准填充：优先利用站点的"索引路径"字段名（education[0].school 等）
  // ---------------------------------------------------------------------------
  const COLLECTION_KEYS = new Set(RS.COLLECTION_DEFS.map((c) => c.key));

  const FIELD_PATH_RE = /^([a-z][a-zA-Z0-9]*)\[(\d+)\]\.(.+)$/i;
  function parseFieldPath(name) {
    const m = FIELD_PATH_RE.exec(name || '');
    if (!m) return null;
    return { collKey: m[1], index: Number(m[2]), field: m[3] };
  }

  function isCollectionControl(el) {
    const p = parseFieldPath(el.name || el.id || '');
    return !!(p && COLLECTION_KEYS.has(p.collKey));
  }

  function countIndexed(collKey) {
    let max = -1;
    for (const el of collectControls()) {
      const p = parseFieldPath(el.name || el.id || '');
      if (p && p.collKey === collKey) max = Math.max(max, p.index);
    }
    return max + 1;
  }

  function fieldAlias(collKey) {
    const map = {
      education: { fieldOfStudy: 'major' },
      internship: { title: 'position', desc: 'description' },
      project: { title: 'name', desc: 'description' },
      award: { title: 'name', desc: 'description' },
      certificate: { desc: 'description' },
      cadre: { desc: 'description' },
      language: { language: 'name', name: 'name' },
    };
    return map[collKey] || {};
  }

  async function fillIndexedFields(report, direct) {
    const controls = collectControls();
    const defByKey = {};
    RS.COLLECTION_DEFS.forEach((c) => { defByKey[c.key] = new Set(c.fields.map((f) => f.key)); });

    for (const el of controls) {
      const p = parseFieldPath(el.name || el.id || '');
      if (!p || !COLLECTION_KEYS.has(p.collKey)) continue;
      const entry = entriesFor(p.collKey)[p.index];
      if (!entry) continue;
      const amap = fieldAlias(p.collKey);
      const field = amap[p.field] || p.field;
      if (!defByKey[p.collKey].has(field)) continue;
      const value = entry[field];
      if (value == null || value === '') continue;
      direct.push({ el, value, label: p.collKey + '.' + field });
    }
  }

  // 起止时间 / 获奖时间（按 placeholder 格式）兜底：按集合条目顺序填日期字段
  async function fillSectionDates(container, collKey) {
    const entries = entriesFor(collKey);
    if (!entries.length) return;
    const def = RS.COLLECTION_DEFS.find((c) => c.key === collKey);
    const dateFields = (def ? def.fields : []).filter((f) => /date/i.test(f.key)).map((f) => f.key);
    if (!dateFields.length) return;
    const dateInputs = Array.from(container.querySelectorAll('input'))
      .filter((c) => isVisible(c) && (c.type === 'date' || /yyyy/i.test(c.placeholder || '')));
    let di = 0;
    for (let i = 0; i < entries.length && di < dateInputs.length; i++) {
      for (const df of dateFields) {
        if (di >= dateInputs.length) break;
        if (entries[i][df]) nativeValueSetter(dateInputs[di], dateForField(entries[i][df], dateInputs[di].placeholder));
        di++;
      }
    }
  }

  // 确保某集合的表单数量达到条目数（自动点"＋添加"）
  async function ensureCards(collKey, target) {
    const sec = findSectionFor(collKey);
    if (!sec) return false;
    let count = countIndexed(collKey);
    let guard = 0;
    while (count < target && sec.addBtn && sec.addBtn.isConnected && guard < target + 3) {
      sec.addBtn.click();
      await delay(500);
      count = countIndexed(collKey);
      guard++;
    }
    if (guard > 0) await delay(400);
    await fillSectionDates(sec.container, collKey);
    return true;
  }

  async function fillCollectionSections(report, direct) {
    let created = 0;
    for (const coll of RS.COLLECTION_DEFS) {
      const entries = entriesFor(coll.key);
      if (entries.length === 0) continue;
      const ok = await ensureCards(coll.key, entries.length);
      if (ok) created += entries.length;
    }
    await fillIndexedFields(report, direct);
    return created;
  }

  // 备用：部分站点奖项/荣誉区的字段不是 collection[i] 命名，改用"按标签+卡片顺序"填入单个奖项
  async function fillCardsByLabel(report) {
    let n = 0;
    for (const collKey of ['award', 'honor']) {
      const sec = findSectionFor(collKey);
      if (!sec) continue;
      const entries = entriesFor(collKey);
      if (!entries.length) continue;
      const def = RS.COLLECTION_DEFS.find((c) => c.key === collKey);
      const scope = new Set(def.fields.map((f) => collKey + '.' + f.key));
      const nameField = def.fields.find((f) => /name|school|company|title|organization/i.test(f.key)) || def.fields[0];
      const all = Array.from(sec.container.querySelectorAll('input, textarea, select, [role="combobox"], [aria-haspopup], [class*="select-view"], [class*="select-trigger"]'))
        .filter((c) => isVisible(c) && (isFormControl(c) || isSelectTrigger(c)));
      const groups = [];
      let cur = [];
      for (const el of all) {
        const hint = extractHints(el).join(' ');
        const isName = RS.normalize(hint).includes(RS.normalize(nameField.label)) || /奖项名称|荣誉名称|获奖名称/.test(hint);
        if (isName && cur.length > 0) { groups.push(cur); cur = []; }
        cur.push({ el, hint });
      }
      if (cur.length) groups.push(cur);

      for (let i = 0; i < groups.length && i < entries.length; i++) {
        const entry = entries[i];
        for (const item of groups[i]) {
          const res = RS.matchField(item.hint, scope, collKey + '.');
          if (!res) continue;
          const field = res.entry.key.slice(collKey.length + 1);
          let val = entry[field];
          if (val && /year|month/i.test(field)) {
            const dm = /^(\d{4})-(\d{1,2})/.exec(String(val) || '');
            val = /year/i.test(field) ? (dm ? dm[1] : '') : (dm ? dm[2] : '');
          }
          if (val == null || val === '') continue;
          const st = await fillControl(item.el, String(val));
          if (st === 'ok') {
            await delay(40);
            const verifyError = verifyWrittenValue(item.el, String(val));
            if (!verifyError) {
              n++;
              report.filled++;
              addHighlight(item.el, { label: collKey + '.' + field });
              report.collectionFilled++;
            } else {
              report.issues.push(issueForControl(item.el, `${collKey}.${field}`, `填写未验证通过：${verifyError}`));
            }
          }
        }
      }
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // 荣誉区自动并入证书（页面没有证书区时）
  // ---------------------------------------------------------------------------
  function certText() {
    const certs = (currentResume.collections && currentResume.collections.certificate) || [];
    const names = certs.map((c) => c.name).filter(Boolean);
    return names.length ? '证书：' + names.join('；') : '';
  }

  let _certFieldCache = null;
  let _honorSection = null;
  function hasCertificateField() {
    if (_certFieldCache !== null) return _certFieldCache;
    const certScope = new Set(['certificate.name', 'certificate.authority', 'certificate.date']);
    const found = collectControls().some((el) => {
      const h = extractHints(el).join(' ');
      if (!h) return false;
      return !!RS.matchField(h, certScope, 'certificate.') || /资格证书|资格证|certificate/i.test(h);
    });
    _certFieldCache = found;
    return found;
  }

  // 荣誉/获奖成果：直接填简历里的内容，不再并入"证书"（避免把教资/驾照/软著混进来）
  function maybeMergeCerts(honorVal) {
    return honorVal;
  }

  // 页面是否有独立的"荣誉称号"区块（有则竞赛/荣誉称号分开填；没有则合并到一起）
  function hasSeparateHonorSection() {
    if (_honorSection === null) _honorSection = !!findSectionFor('honor');
    return _honorSection;
  }

  // 某集合实际要填的条目
  function entriesFor(collKey) {
    const cols = currentResume.collections || {};
    if (collKey === 'award') {
      const aw = cols.award || [];
      if (hasSeparateHonorSection()) return aw; // 页面有独立荣誉区 → 竞赛单独填
      const hn = (cols.honor || []).map((h) => Object.assign({}, h, { description: h.description || h.organization || '' }));
      return aw.concat(hn); // 否则合并填入同一获奖区
    }
    if (collKey === 'honor') return hasSeparateHonorSection() ? (cols.honor || []) : [];
    return cols[collKey] || [];
  }

  // 把"竞赛获奖 + 荣誉称号"合并成一段文本（用于页面上只有一个非标准文本框/获奖情况输入框的情况）
  function combinedAwardText() {
    const aw = currentResume.collections.award || [];
    const hn = currentResume.collections.honor || [];
    const lines = [];
    aw.forEach((a, i) => {
      if (a.name) lines.push(`${i + 1}. ${a.name}${a.level ? '（' + a.level: ''}${a.date ? '，' + a.date : ''}${a.description ? '；' + a.description : ''}${a.level ? '）' : ''}`);
    });
    if (hn.length) {
      const hlines = hn.filter((h) => h.name).map((h, i) => `${i + 1}. ${h.name}${h.level ? '（' + h.level : ''}${h.date ? '，' + h.date : ''}${h.organization ? '；' + h.organization : ''}${h.level ? '）' : ''}`);
      if (hlines.length) lines.push('【荣誉称号】\n' + hlines.join('\n'));
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // AI 兜底：把规则无法解决的字段交给模型。模型既可映射已有字段，也可
  // 基于简历中的事实生成受页面选项和字数限制约束的文本建议。
  // ---------------------------------------------------------------------------
  function lookupResumeValue(field) {
    if (!field) return '';
    if (field.indexOf('.') === -1) return currentResume.base[field] || '';
    const idx = field.lastIndexOf('.');
    const coll = field.slice(0, idx);
    const f = field.slice(idx + 1);
    const selIdx = (selection && selection.collection === coll) ? selection.index : 0;
    const entry = (currentResume.collections[coll] || [])[selIdx];
    return entry ? (entry[f] || '') : '';
  }

  function controlKind(el) {
    if (el.tagName === 'SELECT' || isSelectLook(el)) return 'select';
    if (el.type === 'radio') return 'radio';
    if (el.type === 'checkbox') return 'checkbox';
    if (isRichTextControl(el)) return 'richtext';
    return (el.type || 'text').toLowerCase();
  }

  function optionTextFrom(root, selector) {
    if (!root || !root.querySelectorAll) return [];
    return Array.from(root.querySelectorAll(selector))
      .map((node) => (node.textContent || '').trim())
      .filter((text) => text && text.length <= 80);
  }

  function controlOptions(el) {
    if (adapters.root(el)) return adapters.cachedOptions(el);
    if (el.tagName === 'SELECT') {
      return Array.from(el.options || []).map((option) => (option.text || '').trim()).filter(Boolean);
    }
    const raw = el.getAttribute('data-options');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch (_) {
        return raw.split(/[|,，]/).map((v) => v.trim()).filter(Boolean);
      }
    }
    const ids = (el.getAttribute('aria-controls') || el.getAttribute('aria-owns') || '').split(/\s+/).filter(Boolean);
    const root = el.getRootNode();
    const options = [];
    ids.forEach((id) => {
      const list = (root && typeof root.getElementById === 'function' && root.getElementById(id)) || document.getElementById(id);
      options.push(...optionTextFrom(list, '[role="option"], option, li, [data-value]'));
    });
    return [...new Set(options)].slice(0, 80);
  }

  function visibleDropdownOptions() {
    const selectors = [
      '[role="option"]', '[data-value]', '[class*="select-option"]', '[class*="select-item"]',
      '[class*="phoenix-select__option"]', '[class*="phoenix-select__item"]',
      '[class*="phoenix-select__content"] li', '[class*="dropdown"] li', 'ul[role="listbox"] li',
    ];
    const seen = new Set();
    const values = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (seen.has(node) || !isVisible(node)) return;
        seen.add(node);
        const text = (node.textContent || '').trim();
        if (text && text.length <= 80 && !/^请选择$/.test(text)) values.push(text);
      });
    });
    return [...new Set(values)].slice(0, 80);
  }

  // Phoenix 等组件只有展开后才把真实选项挂到 DOM。AI 必须看到这些选项，
  // 否则即使知道“硕士/中共党员”，也无法保证返回的是站点允许的精确值。
  async function optionsForAI(el) {
    if (adapters.root(el)) return adapters.options(el);
    const existing = controlOptions(el);
    if (existing.length || !isSelectLook(el)) return existing;
    try {
      const trigger = selectClickTarget(el);
      trigger.focus();
      clickSequence(trigger);
      await delay(500);
      return visibleDropdownOptions();
    } finally {
      document.body.click();
      await delay(50);
    }
  }

  function fieldForAI(candidate) {
    const el = candidate.el;
    const maxLength = Number(el.maxLength || el.getAttribute('maxlength') || 0);
    return {
      id: candidate.id,
      label: candidate.label || candidate.hint || '未命名字段',
      hint: candidate.hint || '',
      kind: controlKind(el),
      options: controlOptions(el),
      maxLength: Number.isFinite(maxLength) && maxLength > 0 ? maxLength : 0,
      required: el.required || el.getAttribute('aria-required') === 'true',
    };
  }

  async function enrichFieldForAI(candidate) {
    const field = fieldForAI(candidate);
    field.options = await optionsForAI(candidate.el);
    return field;
  }

  function resumeSchemaForAI() {
    const fields = [];
    RS.BASE_FIELD_DEFS.forEach((field) => fields.push({ key: field.key, label: field.label }));
    RS.COLLECTION_DEFS.forEach((collection) => collection.fields.forEach((field) => {
      fields.push({ key: `${collection.key}.${field.key}`, label: `${collection.label}-${field.label}` });
    }));
    (currentResume.custom || []).forEach((field) => {
      if (field.key) fields.push({ key: `custom.${field.key}`, label: field.key });
    });
    return fields;
  }

  function normalizedAIValue(candidate, mapping) {
    const field = candidate.field || fieldForAI(candidate);
    let value = typeof mapping.value === 'string' ? mapping.value.trim() : '';
    // 兼容旧版“只返回 resumeField”的接口，仍可从本地取得原值。
    if (!value && mapping.resumeField) value = String(lookupResumeValue(mapping.resumeField) || '').trim();
    if (!value) return { value: '', error: 'AI 未给出可填写内容' };
    if (field.options.length) {
      const matched = field.options.find((option) => RS.normalize(option) === RS.normalize(value));
      if (!matched) return { value: '', error: 'AI 返回值不在页面选项中' };
      value = matched;
    }
    if (field.maxLength && value.length > field.maxLength) {
      return { value: '', error: `AI 返回内容超过页面 ${field.maxLength} 字限制` };
    }
    return { value };
  }

  async function askAI(candidates) {
    const cfg = await new Promise((r) => chrome.storage.local.get(['aiConfig'], (x) => r(x.aiConfig || {})));
    if (!cfg.enabled || !cfg.apiKey) return { disabled: true };
    const fields = [];
    for (const candidate of candidates) {
      candidate.field = await enrichFieldForAI(candidate);
      fields.push(candidate.field);
    }
    const resumeData = { base: currentResume.base, collections: currentResume.collections, custom: currentResume.custom || [] };
    return chrome.runtime.sendMessage({ type: 'AI_MATCH', payload: { fields, resumeData, resumeSchema: resumeSchemaForAI() } });
  }

  async function resolveAI(candidates) {
    if (!candidates.length) return { items: [], status: 'none' };
    const res = await askAI(candidates);
    if (!res) return { items: candidates.map((c) => ({ ...c, value: '' })), status: 'failed' };
    if (res.disabled) return { items: candidates.map((c) => ({ ...c, value: '', aiSkipped: true })), status: 'disabled' };
    if (res.error) return { items: candidates.map((c) => ({ ...c, value: '', aiError: res.error })), status: 'error' };
    const byId = {};
    (res.mappings || []).forEach((m) => { byId[m.pageField] = m; });
    const items = candidates.map((c) => {
      const m = byId[c.id];
      if (!m) return { ...c, value: '', aiSkipped: true };
      const checked = normalizedAIValue(c, m);
      if (!checked.value) return { ...c, value: '', aiSkipped: true, aiError: checked.error };
      return {
        ...c, value: checked.value, resumeField: m.resumeField || '', confidence: m.confidence,
        needsConfirm: true, source: m.resumeField || 'AI 基于简历生成', reason: m.reason || '',
      };
    });
    return { items, status: 'mapped' };
  }

  function needsAIRefinement(el, value) {
    const maxLength = Number(el.maxLength || el.getAttribute('maxlength') || 0);
    if (Number.isFinite(maxLength) && maxLength > 0 && String(value || '').length > maxLength) return true;
    const options = controlOptions(el);
    return options.length > 0 && !options.some((option) => RS.normalize(option) === RS.normalize(value));
  }

  // ---------------------------------------------------------------------------
  // 批量确认面板
  // ---------------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  async function applyAction(it) {
    if (!it.el || !it.el.isConnected) return '目标字段已变化，请重新识别';
    const sourceError = sourceValueError(it.resumeField, it.value);
    if (sourceError) return sourceError;
    const st = await fillControl(it.el, it.value);
    await delay(150);
    const error = st === 'ok' ? verifyWrittenValue(it.el, it.value) : st;
    if (!error) addHighlight(it.el, { label: it.label || it.source || it.resumeField || 'AI' });
    return error || '';
  }

  async function applyRow(it, row, button) {
    if (it._busy || it._removed) return;
    it._busy = true;
    button.disabled = true;
    button.textContent = '填写中…';
    try {
      const error = await applyAction(it);
      if (!error) {
        it._removed = true;
        row.remove();
        renderPendingPanel(collectPending());
        return;
      }
      const message = error === 'dropdown-fail' ? '未能打开选项或页面未接受选择' :
        error === 'no-match' ? '当前选项中没有匹配值，请核对建议内容' : error;
      row.querySelector('.ra-src').textContent = `未写入：${message}`;
      removeHighlight(it.el);
    } catch (error) {
      row.querySelector('.ra-src').textContent = `填写失败：${error.message || '请重新识别页面'}`;
    } finally {
      it._busy = false;
      button.disabled = false;
      button.textContent = '重试';
    }
  }

  function buildConfirmRow(it) {
    const row = document.createElement('div');
    row.className = 'ra-confirm-row';
    row.innerHTML =
      `<div class="ra-row-info"><b>${escapeHtml(it.label || '字段')}</b>` +
      `<span class="ra-src">来源：${escapeHtml(it.source || it.resumeField || (it.reason ? '' : 'AI 识别'))}${it.confidence != null ? '（置信度 ' + Math.round(it.confidence * 100) + '%）' : ''}</span></div>` +
      `<textarea class="ra-row-val" rows="2">${escapeHtml(it.value || '')}</textarea>` +
      `<div class="ra-row-btns"><button class="ra-btn primary" data-a="ok">确认</button><button class="ra-btn" data-a="skip">跳过</button></div>`;
    it.row = row;
    row.querySelector('[data-a="ok"]').addEventListener('click', async () => {
      it.value = row.querySelector('.ra-row-val').value;
      await applyRow(it, row, row.querySelector('[data-a="ok"]'));
    });
    row.querySelector('[data-a="skip"]').addEventListener('click', () => { row.remove(); it._removed = true; });
    return row;
  }

  function ensurePanelStack() {
    let s = document.getElementById('resume-assist-stack');
    if (!s) {
      s = document.createElement('div');
      s.id = 'resume-assist-stack';
      document.body.appendChild(s);
    }
    return s;
  }

  function removeConfirmPanel() {
    const b = document.getElementById('resume-assist-confirm');
    if (b) b.remove();
  }

  function removePendingPanel() {
    const b = document.getElementById('resume-assist-pending');
    if (b) b.remove();
  }

  function renderConfirmPanel(items) {
    removeConfirmPanel();
    if (!items || !items.length) return;
    const box = document.createElement('div');
    box.id = 'resume-assist-confirm';
    box.className = 'ra-panel';
    box.innerHTML =
      `<div class="ra-confirm-head"><span>⚠ 以下由 AI / 自动合并生成，请确认后再填入</span>` +
      `<button class="ra-confirm-close" data-act="close">✕</button></div>` +
      `<div class="ra-confirm-body"></div>` +
      `<div class="ra-confirm-foot"><button class="ra-btn primary" data-act="all">全部确认</button>` +
      `<button class="ra-btn" data-act="cancel">取消</button></div>`;
    ensurePanelStack().appendChild(box);
    const body = box.querySelector('.ra-confirm-body');
    items.forEach((it) => body.appendChild(buildConfirmRow(it)));
    box.querySelector('[data-act="close"]').addEventListener('click', removeConfirmPanel);
    box.querySelector('[data-act="all"]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        for (const it of items) {
          if (it._removed) continue;
          it.value = it.row.querySelector('.ra-row-val').value;
          await applyRow(it, it.row, it.row.querySelector('[data-a="ok"]'));
        }
        if (items.every(it => it._removed)) removeConfirmPanel();
      } finally { button.disabled = false; }
    });
    box.querySelector('[data-act="cancel"]').addEventListener('click', removeConfirmPanel);
  }

  // ---------------------------------------------------------------------------
  // "待填清单"：填充后仍为空的字段 + 简历建议值，让你照着填
  // ---------------------------------------------------------------------------
  function dateFieldsOf(collKey) {
    const def = RS.COLLECTION_DEFS.find((c) => c.key === collKey);
    return (def ? def.fields : []).filter((f) => /date/i.test(f.key)).map((f) => f.key);
  }

  // 获奖/荣誉区的"年/月"下拉：按卡片顺序取该奖项的年份/月份作为建议值
  function sectionDateSuggest(el, collKey) {
    const sec = findSectionFor(collKey);
    if (!sec || !sec.container.contains(el)) return null;
    const entries = entriesFor(collKey);
    if (!entries.length) return null;
    const def = RS.COLLECTION_DEFS.find((c) => c.key === collKey);
    if (!def) return null;
    const nameField = def.fields.find((f) => /name|school|company|title|organization/i.test(f.key)) || def.fields[0];
    const all = Array.from(sec.container.querySelectorAll('input, textarea, select, [role="combobox"], [aria-haspopup], [class*="select-view"], [class*="select-trigger"]'))
      .filter((c) => isVisible(c) && (isFormControl(c) || isSelectTrigger(c)));
    const cards = [];
    let cur = [];
    for (const c of all) {
      const h = extractHints(c).join(' ');
      const isName = RS.normalize(h).includes(RS.normalize(nameField.label)) || /奖项名称|荣誉名称|获奖名称/.test(h);
      if (isName && cur.length > 0) { cards.push(cur); cur = []; }
      cur.push(c);
    }
    if (cur.length) cards.push(cur);
    const cardIdx = cards.findIndex((card) => card.includes(el));
    if (cardIdx < 0 || cardIdx >= entries.length) return null;
    const entry = entries[cardIdx];
    const dm = /^(\d{4})-(\d{1,2})/.exec(String(entry.date || ''));
    if (!dm) return null;
    const hint = extractHints(el).join(' ');
    if (/年/.test(hint)) return { label: collKey + ' 奖项时间·年', value: dm[1] };
    if (/月/.test(hint)) return { label: collKey + ' 奖项时间·月', value: dm[2] };
    return null;
  }

  function suggestFor(el) {
    // 1) 集合控件（索引路径）
    const p = parseFieldPath(el.name || el.id || '');
    if (p && COLLECTION_KEYS.has(p.collKey)) {
      const entry = entriesFor(p.collKey)[p.index];
      if (entry) {
        const amap = fieldAlias(p.collKey);
        const field = amap[p.field] || p.field;
        return { label: p.collKey + '.' + field, value: entry[field] };
      }
    }
    // 2) 日期输入：找所在区块，按顺序取该集合的日期字段
    if (el.tagName === 'INPUT' && (el.type === 'date' || /yyyy/i.test(el.placeholder || ''))) {
      for (const coll of RS.COLLECTION_DEFS) {
        const sec = findSectionFor(coll.key);
        if (!sec || !sec.container.contains(el)) continue;
        const dateInputs = Array.from(sec.container.querySelectorAll('input'))
          .filter((c) => isVisible(c) && (c.type === 'date' || /yyyy/i.test(c.placeholder || '')));
        const gi = dateInputs.indexOf(el);
        const dfs = dateFieldsOf(coll.key);
        if (gi < 0 || !dfs.length) break;
        const entry = entriesFor(coll.key)[Math.floor(gi / dfs.length)];
        const field = dfs[gi % dfs.length];
        if (entry) return { label: coll.label + '·' + field, value: entry[field] };
        break;
      }
      return { label: '日期', value: '' };
    }
    // 2b) 获奖/荣誉区"年/月"下拉建议
    const secNow = sectionFromAncestorText(el);
    if (secNow === 'award' || secNow === 'honor') {
      const ds = sectionDateSuggest(el, secNow);
      if (ds) return ds;
    }
    // 3) 基础字段标签匹配（获奖/荣誉/证书区的控件不再建议"荣誉汇总"大字段）
    const hint = extractHints(el).join(' ');
    if (hint) {
      const sec = sectionFromAncestorText(el);
      const baseScope = new Set(RS.BASE_FIELD_DEFS.map((d) => d.key));
      const res = RS.matchField(hint, baseScope, null);
      if (res) {
        if (isTypeMismatch(res, hint) || sourceValueError(res.entry.key, (currentResume.base || {})[res.entry.key])) return null;
        if ((sec === 'award' || sec === 'honor') && (res.entry.key === 'honorList' || res.entry.key === 'competitionResults')) return null;
        const v = (currentResume.base || {})[res.entry.key];
        if (v != null && v !== '') return { label: formItemLabel(el) || res.entry.label, value: v, resumeField: res.entry.key };
      }
    }
    return null;
  }

  function collectPending() {
    const out = [];
    for (const el of collectControls()) {
      if (controlValue(el)) continue; // 已填
      const sug = suggestFor(el);
      if (!sug) continue;
      out.push({ el, label: sug.label, value: sug.value, resumeField: sug.resumeField });
    }
    return out;
  }

  function renderPendingPanel(items) {
    removePendingPanel();
    if (!items || !items.length) return;
    const box = document.createElement('div');
    box.id = 'resume-assist-pending';
    box.className = 'ra-panel ra-warn';
    box.innerHTML =
      `<div class="ra-confirm-head"><span>📋 以下字段还没填（请照着填，或点"填入"）</span>` +
      `<button class="ra-confirm-close" data-act="close">✕</button></div>` +
      `<div class="ra-confirm-body"></div>`;
    ensurePanelStack().appendChild(box);
    const body = box.querySelector('.ra-confirm-body');
    items.forEach((it) => body.appendChild(buildPendingRow(it)));
    box.querySelector('[data-act="close"]').addEventListener('click', removePendingPanel);
  }

  function buildPendingRow(it) {
    const row = document.createElement('div');
    row.className = 'ra-confirm-row';
    row.innerHTML =
      `<div class="ra-row-info"><b>${escapeHtml(it.label || '字段')}</b></div>` +
      `<div class="ra-src">建议填入：${escapeHtml(it.value || '（无对应内容）')}</div>` +
      `<div class="ra-row-btns">` +
      (it.value ? `<button class="ra-btn primary" data-a="fill">填入</button>` : '') +
      `</div>`;
    if (it.value) {
      row.querySelector('[data-a="fill"]').addEventListener('click', async () => {
        const button = row.querySelector('[data-a="fill"]');
        await applyRow(it, row, button);
      });
    }
    return row;
  }

  function issueForControl(el, label, reason) {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 8).join(' ') : '';
    return {
      label: label || '未命名字段',
      reason: reason || '填写失败',
      hint: extractHints(el).join(' ').slice(0, 160),
      component: {
        tag: (el.tagName || '').toLowerCase(),
        kind: controlKind(el),
        role: el.getAttribute('role') || '',
        classHint: cls.slice(0, 240),
        maxLength: Number(el.maxLength || el.getAttribute('maxlength') || 0) || 0,
        inOpenShadowRoot: !!(el.getRootNode && el.getRootNode().host),
      },
      options: controlOptions(el).slice(0, 30),
    };
  }

  // 将未填/填错原因留在本机，后续可以据此判断是“组件没识别”、
  // “组件无法操作”还是“简历没有对应事实”，而不是只能靠用户回忆页面。
  async function saveFillDiagnostic(report) {
    const uniqueIssues = [];
    const seen = new Set();
    (report.issues || []).forEach((issue) => {
      const key = `${issue.label}|${issue.reason}|${issue.hint}`;
      if (!seen.has(key)) { seen.add(key); uniqueIssues.push(issue); }
    });
    let pageUrl = '';
    try {
      const url = new URL(location.href);
      // 查询参数经常带 userId、职位令牌等，诊断只需站点和页面路径。
      pageUrl = `${url.origin}${url.pathname}`;
    } catch (_) {
      pageUrl = location.origin || '';
    }
    const diagnostic = {
      createdAt: new Date().toISOString(),
      page: { title: document.title, url: pageUrl },
      summary: {
        extensionVersion: '0.4.0',
        matched: report.matched,
        filled: report.filled,
        dropdownFailed: report.dropdownFailed,
        requiredMissing: report.requiredMissing || 0,
        aiStatus: report.aiStatus || 'none',
        aiProposed: report.aiProposed || 0,
        aiNoAnswer: report.aiNoAnswer || 0,
        aiFieldsWithOptions: report.aiFieldsWithOptions || 0,
        pending: report.pendingCount || 0,
      },
      issues: uniqueIssues.slice(0, 60),
    };
    // 由后台发送，避免内容脚本跨域限制。报告不含简历值，仅包含上述脱敏诊断。
    const delivery = await chrome.runtime.sendMessage({ type: 'REPORT_FEEDBACK', payload: { diagnostic } })
      .catch(() => ({ error: '无法联系扩展后台' }));
    diagnostic.delivery = delivery && delivery.ok ? { status: 'sent', filename: delivery.filename || '' }
      : delivery && delivery.skipped ? { status: 'disabled', reason: delivery.reason || '' }
        : { status: 'failed', reason: (delivery && delivery.error) || '自动上报失败' };
    const old = await new Promise((resolve) => chrome.storage.local.get(['fillDiagnostics'], resolve));
    const history = Array.isArray(old.fillDiagnostics) ? old.fillDiagnostics : [];
    history.unshift(diagnostic);
    await chrome.storage.local.set({ fillDiagnostics: history.slice(0, 20), latestFillDiagnostic: diagnostic });
  }

  // ---------------------------------------------------------------------------
  // 主扫描 + 填充
  // ---------------------------------------------------------------------------
  let uidCounter = 0;
  const uid = () => 'itm' + (++uidCounter);

  async function run(mode) {
    await loadData();
    clearHighlights();
    if (globalThis.ResumeEducationPlan?.shell(document)) return { ok: false, error: '这是大唐外层导航页，实际简历在内嵌页面中。请刷新插件的页面列表并选择“大唐简历”；尚未加载时请等待页面加载完成。' };
    if (globalThis.ResumeEducationPlan?.isDatangURL(location.href) && !collectControls().length) return { ok: false, error: '当前大唐页面没有可填写控件。已有高中条目请点铅笔编辑；新增学历才点右上角“＋”，展开后再检查或下载当前表单代码。' };
    if (globalThis.ResumeEducationPlan?.isDatangURL(location.href)) return { ok: false, error: '已定位大唐实际简历页，但教育编辑／新增表单尚未适配。请在铅笔或“＋”打开的编辑状态点击“下载当前表单代码”，用于继续适配；当前不能保证正确区分高中、本科和研究生条目。' };
    const siteAdapter = globalThis.ResumePageAudit?.adapterFor(document);
    if (siteAdapter) {
      const report = await siteAdapter.run(mode, currentResume, addHighlight);
      if (mode === 'FILL' && report.ok !== false) {
        await chrome.storage.local.set({ latestPageAudit: siteAdapter.scan(document, currentResume) });
        await saveFillDiagnostic(report);
      }
      return report;
    }
    if (globalThis.ResumePageAudit?.supported(document)) {
      const report = await globalThis.ResumeHotjob.run(mode, currentResume, addHighlight);
      if (mode === 'FILL' && report.ok !== false) await saveFillDiagnostic(report);
      return report;
    }
    _certFieldCache = null;
    _honorSection = null;
    const report = { mode, matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, collectionFilled: 0, created: 0, aiProposed: 0, issues: [] };
    const fillMap = RS.buildFillMap(currentResume, selection);
    const controls = collectControls();
    const baseScope = new Set(RS.BASE_FIELD_DEFS.map((d) => d.key));
    const direct = [];
    const confirmItems = [];
    const aiCandidates = [];

    // 1) 基础信息 + 识别（集合控件跳过；获奖/荣誉/证书区块的控件交给集合步骤，避免把整段"荣誉汇总"塞进单个奖项）
    for (const el of controls) {
      if (isCollectionControl(el)) continue;
      const sec = sectionFromAncestorText(el);
      const hintText = extractHints(el).join(' ');
      // “荣誉情况（200 字内）”这类单框字段不适合机械地逐条填集合，改由 AI
      // 根据完整简历生成受字数限制的摘要；有索引的多条卡片仍交给集合填充。
      if (sec === 'award' || sec === 'honor' || sec === 'certificate') {
        if (hintText && (el.tagName === 'TEXTAREA' || isRichTextControl(el) || !isSelectTrigger(el))) {
          aiCandidates.push({ id: uid(), el, label: hintText, hint: hintText, section: sec });
        } else {
          report.skipped++;
        }
        continue;
      }
      if (!hintText) {
        report.skipped++;
        // 这类问题此前只会静默跳过，导致诊断无法反映真正的识别缺口。
        report.issues.push(issueForControl(el, '未提取字段标签', '无法从页面结构提取字段名称'));
        continue;
      }
      const res = RS.matchField(hintText, baseScope, null);
      if (!res) { report.skipped++; aiCandidates.push({ id: uid(), el, label: '未识别字段', hint: hintText }); continue; }
      if (isTypeMismatch(res, hintText)) { report.skipped++; continue; }
      // 含"排名"的字段绝不填专业/学校的名字（如"专业排名"不应变成"计算机科学与技术"）
      if (/排名/.test(hintText) && (res.entry.key === 'major' || res.entry.key === 'education.major' || res.entry.key === 'school')) { report.skipped++; continue; }
      const value = fillMap[res.entry.key];
      report.matched++;
      console.log('[JSONL] 匹配', hintText, '=>', res.entry.key, '=', value);
      if (value == null || value === '') { addHighlight(el, res.entry); continue; }
      const sourceError = sourceValueError(res.entry.key, value);
      if (sourceError) {
        report.issues.push(issueForControl(el, res.entry.label, sourceError));
        continue;
      }
      if (needsAIRefinement(el, value)) {
        aiCandidates.push({ id: uid(), el, label: res.entry.label, hint: hintText, resumeField: res.entry.key });
        continue;
      }
      if (res.entry.key === 'honorList') {
        // 页面上只有一个非标准"获奖情况"文本框 → 把竞赛+荣誉称号合并填入（进确认面板）
        const combined = combinedAwardText();
        if (combined && combined !== value) {
          confirmItems.push({ id: uid(), el, label: res.entry.label, value: combined, source: '竞赛获奖+荣誉称号', reason: '已合并填入文本框', needsConfirm: true });
          continue;
        }
      }
      direct.push({ el, value, label: res.entry.label, resumeField: res.entry.key });
    }

    // 2) 集合（自动"＋添加" + 逐条回填），仅 FILL
    if (mode === 'FILL') {
      report.created = await fillCollectionSections(report, direct);
      report.cardsFilled = await fillCardsByLabel(report);
    }

    // 3) 应用"直接填充"（原样、不需要确认的）
    if (mode === 'FILL') {
      for (const d of direct) {
        const st = await fillControl(d.el, d.value);
        if (st === 'ok') {
          // 页面框架可能异步清空值或在 blur 后触发格式校验；只有回读通过才计为已填。
          await delay(40);
          const verifyError = verifyWrittenValue(d.el, d.value);
          if (!verifyError) {
            report.filled++;
            addHighlight(d.el, { label: d.label });
          } else {
            report.issues.push(issueForControl(d.el, d.label, `填写未验证通过：${verifyError}`));
            // 过去这里直接结束：Phoenix 下拉“操作过但没有选中”不会再进入 AI，
            // 因而 AI 永远看不到它。选择器保留为待解析候选，并在展开后读取选项。
            if (isSelectLook(d.el)) {
              report.dropdownFailed++;
              aiCandidates.push({ id: uid(), el: d.el, label: d.label, hint: extractHints(d.el).join(' '), resumeField: d.resumeField });
            }
          }
        }
        else if (st === 'dropdown-fail' || st === 'no-match') {
          report.dropdownFailed++;
          aiCandidates.push({ id: uid(), el: d.el, label: d.label, hint: extractHints(d.el).join(' '), resumeField: d.resumeField });
          report.issues.push(issueForControl(d.el, d.label, st));
        } else {
          report.skipped++;
          report.issues.push(issueForControl(d.el, d.label, st || '填写失败'));
        }
      }
    }

    // 4) AI 兜底 + 批量确认（仅 FILL）
    if (mode === 'FILL') {
      let aiResult = { items: [], status: 'none' };
      // 集合填充可能已解决先前收集到的候选项；只把仍为空的控件发送给 AI，
      // 避免同一字段被“规则填一次、AI 又填一次”。
      const unresolvedAICandidates = aiCandidates.filter((candidate) => candidate.el && candidate.el.isConnected && !controlValue(candidate.el));
      if (unresolvedAICandidates.length) aiResult = await resolveAI(unresolvedAICandidates);
      report.aiProposed = aiResult.items.filter((a) => a.value).length;
      report.aiNoAnswer = aiResult.items.filter((a) => !a.value).length;
      report.aiFieldsWithOptions = unresolvedAICandidates.filter((candidate) => candidate.field && candidate.field.options && candidate.field.options.length).length;
      report.aiStatus = aiResult.status;
      report.unrecognized = unresolvedAICandidates.slice(0, 6).map((c) => c.hint).filter(Boolean);
      aiResult.items.filter((item) => !item.value).forEach((item) => {
        report.issues.push(issueForControl(item.el, item.label || item.hint || '未识别字段', item.aiError || 'AI 未能给出可填写内容'));
      });
      const items = [...confirmItems, ...aiResult.items].filter((it) => it.value != null && it.value !== '');
      if (items.length) renderConfirmPanel(items);
      // 仍需手动填的字段清单
      const pending = collectPending();
      if (pending.length) {
        renderPendingPanel(pending);
        report.pendingCount = pending.length;
        pending.forEach((item) => report.issues.push(issueForControl(
          item.el, item.label || '未填字段', item.value ? '等待确认或组件未写入' : '简历中无可用内容'
        )));
      }
      auditPageFill(report, new Set(items.map((item) => item.el)));
      await saveFillDiagnostic(report);
    }

    return report;
  }

  // ---------------------------------------------------------------------------
  // 保存 / 应用"本次填写"模板（同一套网申页面跨公司复用）
  // ---------------------------------------------------------------------------
  function controlSignature(el) {
    if (el.name || el.id) return (el.name || el.id).trim();
    // 无 name/id（很多自定义下拉是这种）→ 用可见标签作为稳定签名
    const label = extractHints(el).join(' ').trim();
    return label ? 'L:' + label : '';
  }

  function isEmptyPresentation(value) {
    const normalized = RS.normalize(value || '');
    return !normalized || /^(请选择|请输入|select|pleasechoose|placeholder)$/.test(normalized);
  }

  // 取控件“用户实际选择/填写”的值；未选中的 radio 和“请选择”不能算已填。
  function controlValue(el) {
    if (adapters.root(el)) return adapters.read(el);
    if (el.tagName === 'INPUT' && el.type === 'radio') return el.checked ? String(el.value || '').trim() : '';
    if (el.tagName === 'INPUT' && el.type === 'checkbox') return el.checked ? 'true' : '';
    if (el.tagName === 'SELECT') {
      const o = el.options && el.options[el.selectedIndex];
      const text = o ? (o.text || '').trim() : '';
      return isEmptyPresentation(text) ? '' : text;
    }
    let v = (el.value != null ? String(el.value) : '').trim();
    if (!v) v = (el.textContent || '').trim();
    return isEmptyPresentation(v) ? '' : v;
  }

  function formItemRoot(el) {
    let node = el;
    for (let depth = 0; depth < 7 && node && node !== document.body; depth++) {
      const cls = typeof node.className === 'string' ? node.className : '';
      if (/phoenix-form-item|form[-_]?item|formitem/i.test(cls)) return node;
      node = parentAcrossShadow(node);
    }
    return null;
  }

  function isRequiredControl(el) {
    if (el.required || el.getAttribute('aria-required') === 'true') return true;
    const root = formItemRoot(el);
    if (!root) return false;
    const cls = typeof root.className === 'string' ? root.className : '';
    if (/required/i.test(cls)) return true;
    return /^\s*\*/.test(formItemLabel(el));
  }

  function validationError(el) {
    const native = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') ? el :
      el.querySelector && el.querySelector('input, textarea, select');
    if (native && native.validity && !native.validity.valid) return native.validationMessage || '浏览器字段校验未通过';
    if (el.getAttribute('aria-invalid') === 'true' || (native && native.getAttribute('aria-invalid') === 'true')) return '页面标记为无效';
    const root = formItemRoot(el);
    if (root) {
      const error = root.querySelector('[class*="error"], [class*="invalid"], [role="alert"]');
      const text = error && (error.textContent || '').trim();
      if (text) return text.slice(0, 180);
    }
    return '';
  }

  function controlAuditKey(el) {
    if (el.tagName === 'INPUT' && el.type === 'radio' && el.name) return `radio:${el.name}`;
    return controlSignature(el) || `${el.tagName}:${extractHints(el).join(' ')}`;
  }

  function auditPageFill(report, awaitingConfirmation) {
    const seen = new Set();
    let requiredMissing = 0;
    for (const el of collectControls()) {
      const key = controlAuditKey(el);
      if (seen.has(key)) continue;
      seen.add(key);
      const label = extractHints(el).join(' ') || '未提取字段标签';
      const error = validationError(el);
      if (error) {
        report.issues.push(issueForControl(el, label, `页面校验失败：${error}`));
        continue;
      }
      if (isRequiredControl(el) && !controlValue(el)) {
        requiredMissing++;
        report.issues.push(issueForControl(
          el, label, awaitingConfirmation && awaitingConfirmation.has(el) ? '等待确认后写入' : '必填字段仍为空'
        ));
      }
    }
    report.requiredMissing = requiredMissing;
  }

  function verifyWrittenValue(el, expected) {
    const actual = controlValue(el);
    if (!actual) return '写入后字段仍为空';
    const expectedText = String(expected == null ? '' : expected).trim();
    if (adapters.root(el) && adapters.equivalent(actual, expectedText)) return validationError(el);
    if (expectedText && !RS.normalize(actual).includes(RS.normalize(expectedText)) &&
      !RS.normalize(expectedText).includes(RS.normalize(actual))) {
      return '写入后的显示值与目标值不一致';
    }
    return validationError(el);
  }

  // 保存本次填写：抓取页面上所有字段的当前值（含你手动填/改的）
  function collectFilledMap() {
    const map = {};
    for (const el of collectControls()) {
      const sig = controlSignature(el);
      if (!sig) continue;
      const v = controlValue(el);
      if (v) map[sig] = v;
    }
    return map;
  }

  function findControlBySignature(sig) {
    if (sig && sig.startsWith('L:')) {
      const want = sig.slice(2);
      // 精确标签匹配
      for (const el of collectControls()) {
        if (extractHints(el).join(' ').trim() === want) return el;
      }
      // 其次：标签包含匹配
      for (const el of collectControls()) {
        if (extractHints(el).join(' ').includes(want)) return el;
      }
      return null;
    }
    for (const el of collectControls()) {
      if ((el.name || el.id || '').trim() === sig) return el;
    }
    return null;
  }

  async function applyProfile(profile) {
    let n = 0;
    const fields = profile.fields || {};
    for (const sig in fields) {
      const el = findControlBySignature(sig);
      if (!el) continue;
      const st = await fillControl(el, fields[sig]);
      if (st === 'ok') n++;
    }
    return n;
  }

  function getProfiles() {
    return new Promise((r) => chrome.storage.local.get(['profiles'], (x) => r(x.profiles || [])));
  }

  // ---------------------------------------------------------------------------
  // 消息处理
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (['AI_TEXT_START', 'AI_AREA_START'].includes(msg?.type)) return false;
    (async () => {
      if (msg?.type === 'EXPORT_PAGE_HTML') {
        if (globalThis.ResumeEducationPlan?.shell(document)) throw Error('所选的是大唐外层导航页，请选择已加载的“大唐简历”内嵌页面再下载');
        if (globalThis.ResumePageAudit?.adapterFor(document)?.shell?.(document)) throw Error('所选的是外层门户，请在目标页面选择实际简历内嵌页再下载');
        const clone = document.documentElement.cloneNode(true);
        // Structural evidence only: exported files must not run website code or load external resources.
        clone.querySelectorAll('script,iframe,object,embed,link,base,style,meta[http-equiv]').forEach(el => el.remove());
        for (const el of [clone, ...clone.querySelectorAll('*')]) {
          for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || ['src', 'srcset', 'href', 'xlink:href', 'action', 'formaction', 'ping', 'srcdoc'].includes(attr.name) || attr.name === 'style' && /url\s*\(/i.test(attr.value)) el.removeAttribute(attr.name);
        }
        const html = '<!doctype html>\n' + clone.outerHTML;
        if (html.length > 5_000_000) throw Error('表单代码超过 5 MB，请只复制教育经历编辑区的 HTML');
        sendResponse({ ok: true, html });
      } else if (msg?.type === 'PAGE_AUDIT') {
        await loadData();
        const report = globalThis.ResumePageAudit.scan(document, currentResume);
        await chrome.storage.local.set({ latestPageAudit: report });
        sendResponse({ ok: true, report });
      } else if (msg && (msg.type === 'FILL' || msg.type === 'PREVIEW')) {
        const r = await run(msg.type);
        sendResponse(r);
      } else if (msg && msg.type === 'SET_SELECTION') {
        selection = msg.payload;
        sendResponse({ ok: true });
      } else if (msg && msg.type === 'CLEAR') {
        clearHighlights();
        sendResponse({ ok: true });
      } else if (msg && msg.type === 'SAVE_PROFILE') {
        const name = (msg.name || '').trim();
        const profiles = await getProfiles();
        const p = { id: 'p' + Date.now(), name, fields: collectFilledMap(), createdAt: Date.now() };
        profiles.push(p);
        await chrome.storage.local.set({ profiles });
        sendResponse({ ok: true, id: p.id });
      } else if (msg && msg.type === 'LIST_PROFILES') {
        sendResponse({ ok: true, profiles: await getProfiles() });
      } else if (msg && msg.type === 'APPLY_PROFILE') {
        const profiles = await getProfiles();
        const p = profiles.find((x) => x.id === msg.profileId);
        if (!p) sendResponse({ ok: false, error: '模板不存在' });
        else { const n = await applyProfile(p); sendResponse({ ok: true, filled: n }); }
      } else {
        sendResponse({ ok: false });
      }
    })().catch(error => sendResponse({ ok: false, error: error.message || '操作失败，请刷新网页重试' }));
    return true; // 异步
  });

  // 暴露到 window 方便调试
  globalThis.ResumeAssistant = {
    run,
    loadData,
    selection: () => selection,
    fillCollectionSections,
    collectFilledMap,
    applyProfile,
    getProfiles,
  };
})();
