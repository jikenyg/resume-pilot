/* Opt-in, single-target text filling. No full-page run, arbitrary model actions,
 * automatic submit, or fallback to another similarly named field. */
(function () {
  'use strict';
  let host, ui, target, before = '', selecting = false, generation = 0;
  let highlighted, oldOutline;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const tidy = value => String(value || '').replace(/\s+/g, ' ').trim();
  const $ = selector => ui.querySelector(selector);
  function supported(el) {
    return el && el.isConnected && el.getClientRects().length && !el.disabled && !el.readOnly &&
      (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'email', 'tel', 'url'].includes(el.type))) &&
      !el.closest('[role="combobox"], .phoenix-select, [aria-haspopup="listbox"], [aria-haspopup="dialog"]') &&
      el.getAttribute('role') !== 'combobox' && !el.hasAttribute('list');
  }
  function unmark() {
    if (highlighted) {
      highlighted.style.outline = oldOutline;
      highlighted = null;
    }
  }
  function mark(el) {
    unmark();
    if (!el) return;
    highlighted = el; oldOutline = el.style.outline;
    el.style.outline = '3px solid #8759e8';
  }
  function status(message) { $('#status').textContent = message; }
  function described(el, attr) {
    const root = el.getRootNode();
    return (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean)
      .map(id => root.getElementById?.(id)?.textContent || '').join(' ');
  }
  function metadata(el) {
    const labels = [...(el.labels || [])].map(n => n.textContent).join(' ');
    let label = tidy(described(el, 'aria-labelledby') || el.getAttribute('aria-label') || labels);
    let field = el.parentElement;
    // Stop before a container shared with other inputs. Only collect local
    // descriptive text, never values from the rest of the form.
    for (let depth = 0; field && depth < 3; depth++) {
      if (field.parentElement && field.parentElement !== document.body &&
          field.parentElement.querySelectorAll('input,textarea,select').length === 1) field = field.parentElement;
      else break;
    }
    let local = '';
    if (field && field !== document.body && field.querySelectorAll('input,textarea,select').length === 1) {
      const copy = field.cloneNode(true);
      copy.querySelectorAll('input,textarea,select,script,style,[contenteditable]').forEach(n => n.remove());
      local = tidy(copy.textContent).slice(0, 700);
      if (!label) label = tidy(field.querySelector('label,legend,[class*="label"],[class*="Label"]')?.textContent);
    }
    if (!label) {
      const sibling = el.previousElementSibling;
      if (sibling && !sibling.matches('input,textarea,select') && tidy(sibling.textContent).length < 120) label = tidy(sibling.textContent);
    }
    const root = el.getRootNode();
    const headings = [...root.querySelectorAll('h1,h2,h3,h4,legend')];
    const heading = headings.filter(n => n.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
    const context = tidy([heading?.textContent, local, described(el, 'aria-describedby'), el.placeholder].filter(Boolean).join(' · ')).slice(0, 1200);
    const limits = [...context.matchAll(/(?:最多|不超过|限|上限)\s*(\d+)\s*[个字字符]|(\d+)\s*字(?:以内|之内)/g)]
      .map(m => Number(m[1] || m[2])).filter(n => n > 0);
    if (el.maxLength >= 0) limits.push(el.maxLength);
    return { label: label || el.placeholder || el.name || '未识别字段，请填写字段名', context,
      maxLength: limits.length ? Math.min(...limits) : 0, type: el.type || 'textarea' };
  }
  function close() {
    generation++;
    selecting = false; target = null; unmark();
    document.removeEventListener('click', choose, true);
    document.removeEventListener('pointerover', hover, true);
    document.removeEventListener('keydown', key, true);
    host?.remove(); host = null; ui = null;
  }
  function pathTarget(event) { return event.composedPath().find(n => n?.matches?.('input,textarea')); }
  function ownEvent(event) { return event.composedPath().includes(host); }
  function key(event) { if (event.isTrusted && event.key === 'Escape') { event.preventDefault(); close(); } }
  function hover(event) {
    if (!selecting || ownEvent(event)) return;
    const el = pathTarget(event);
    mark(supported(el) ? el : null);
  }
  function choose(event) {
    if (!selecting || ownEvent(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const el = pathTarget(event);
    if (!supported(el)) { status('请选择可编辑的普通文本框或多行文本框；本版暂不处理下拉、日期、富文本及 iframe 内的字段。'); return; }
    selecting = false; target = el; before = el.value; mark(el);
    const info = metadata(el);
    $('#label').value = info.label;
    $('#context').textContent = info.context || '未找到说明，可在下方补充要求。';
    $('#limit').textContent = info.maxLength ? `字数上限：${info.maxLength}` : '未检测到明确字数上限';
    $('#editor').hidden = false;
    $('#generate').disabled = false;
    $('#overwrite-wrap').hidden = !before;
    $('#overwrite').checked = false;
    $('#answer').value = ''; $('#answer').disabled = false; $('#apply').disabled = true;
    status('已选定一个文本框。核对字段名与说明，然后点击“生成答案”。');
  }
  function pick() {
    generation++; selecting = true; target = null; unmark();
    $('#editor').hidden = true;
    status('请点击网页中要补填的文本框。按 Esc 退出。');
  }
  async function generate() {
    if (!supported(target)) { status('原文本框已失效或不可编辑，请重新选择。'); return; }
    const id = ++generation;
    const info = metadata(target);
    const payload = { ...info, label: $('#label').value.trim(), instruction: $('#instruction').value.trim() };
    if (!payload.label) { status('请先填写字段名称。'); return; }
    $('#generate').disabled = true; $('#apply').disabled = true; $('#answer').value = ''; $('#answer').disabled = true;
    status('正在理解所选字段并生成答案…');
    try {
      const result = await chrome.runtime.sendMessage({ type: 'AI_TEXT_GENERATE', payload });
      if (id !== generation || !ui) return;
      if (!result || result.error) { status(result?.error || 'AI 服务没有响应。'); return; }
      $('#answer').value = typeof result.value === 'string' ? result.value : '';
      $('#apply').disabled = !$('#answer').value.trim();
      status(`${result.reason || (result.value ? '请核对答案后确认填入。' : '简历中没有足够依据，请补充资料或说明。')}${result.usage?.total_tokens ? ` · 本次 ${result.usage.total_tokens} tokens` : ''}`);
    } catch (_) {
      if (id === generation && ui) status('请求失败，请检查 API 配置；插件更新后需刷新网页。');
    } finally { if (id === generation && ui) { $('#generate').disabled = false; $('#answer').disabled = false; } }
  }
  async function apply() {
    const el = target, id = generation;
    if (!supported(el)) { status('原文本框已失效或不可编辑，请重新选择。'); return; }
    const value = $('#answer').value;
    if (!value.trim()) { status('答案为空，不会清空网页字段。'); return; }
    const max = metadata(el).maxLength;
    if (max && value.length > max) { status(`答案有 ${value.length} 个字符，超过上限 ${max}，请缩短后再填入。`); return; }
    if (el.value !== before) {
      before = el.value; $('#overwrite-wrap').hidden = !before; $('#overwrite').checked = false;
      status('选中后网页内容发生变化，已停止写入。请检查原框内容，确认后再填入。'); return;
    }
    if (before && !$('#overwrite').checked) { status('该框已有内容，请勾选“允许替换这个框的现有内容”。'); return; }
    $('#apply').disabled = true;
    try {
      el.focus();
      const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      el.blur();
      await wait(600);
      if (id !== generation || !ui) return;
      before = el.value;
      $('#overwrite-wrap').hidden = !before; $('#overwrite').checked = false;
      if (!supported(el) || el.value !== value) { status('未验证成功：页面拒绝、修改了内容或重建了文本框。答案已保留，请重新选择或手动复制。'); return; }
      if (!el.validity.valid || el.getAttribute('aria-invalid') === 'true') {
        status(`内容已写入，但页面校验未通过：${el.validationMessage || '请检查字段格式'}`); return;
      }
      status('已写入并核对文本一致。仅修改所选文本框，未提交表单；请确认内容符合申请要求。');
    } catch (_) { if (id === generation && ui) status('写入失败，答案已保留供复制。'); }
    finally { if (id === generation && ui) $('#apply').disabled = false; }
  }
  function start() {
    close();
    globalThis.ResumeAreaAssistant?.close();
    host = document.createElement('div'); host.id = 'resume-ai-text-host';
    host.style.cssText = 'position:fixed;right:16px;top:60px;z-index:2147483647;width:min(380px,95vw);';
    ui = host.attachShadow({ mode: 'open' });
    ui.innerHTML = `<style>
      :host{all:initial;font:14px/1.5 system-ui,sans-serif;color:#243047}*{box-sizing:border-box}
      .panel{background:#fff;border:1px solid #ded5f6;border-radius:12px;box-shadow:0 8px 32px #0003;padding:16px;max-height:85vh;overflow:auto}
      header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}h3{margin:0;font-size:17px}
      button{cursor:pointer;border:0;border-radius:6px;padding:9px 12px;background:#eee9f9;color:#35244d}button.primary{background:#7043bc;color:white}button:disabled{opacity:.5;cursor:default}
      label{display:block;margin:10px 0 4px}input:not([type=checkbox]),textarea{font:inherit;width:100%;border:1px solid #ccd2dc;border-radius:5px;padding:7px}textarea{resize:vertical}
      .note{font-size:12px;color:#657085;white-space:pre-wrap;overflow-wrap:anywhere}#status{background:#f5f1fc;padding:9px;border-radius:6px;margin:10px 0;white-space:pre-wrap}footer{display:flex;gap:8px;margin-top:10px}[hidden]{display:none!important}
      </style><div class="panel"><header><h3>AI 点选补填 · 文本</h3><button id="close" title="关闭">✕</button></header>
      <button id="pick">重新选择文本框</button><div id="status" role="status"></div>
      <div id="editor" hidden><label for="label">字段名称（可修正）</label><input id="label" maxlength="200">
      <p id="context" class="note"></p><p id="limit" class="note"></p>
      <label for="instruction">补充要求（可选，如“使用第二段实习”）</label><textarea id="instruction" rows="2" maxlength="600"></textarea>
      <details class="note"><summary>发送授权简历至 DeepSeek · 消耗 API token</summary>点击生成将发送所选字段说明、补充要求和已授权的完整简历。不会发送整页表单或当前框的已有值。关闭面板不保证取消已经发出的请求。</details>
      <button id="generate" class="primary">生成答案</button><label for="answer">答案预览（可编辑或复制）</label><textarea id="answer" rows="3"></textarea>
      <label id="overwrite-wrap" hidden><input id="overwrite" type="checkbox">允许替换这个框的现有内容</label>
      <footer><button id="apply" class="primary" disabled>确认填入这一个框</button></footer></div></div>`;
    document.documentElement.append(host);
    $('#close').onclick = close; $('#pick').onclick = pick;
    $('#generate').onclick = generate; $('#apply').onclick = apply;
    $('#answer').oninput = () => { $('#apply').disabled = !$('#answer').value.trim(); };
    document.addEventListener('click', choose, true);
    document.addEventListener('pointerover', hover, true);
    document.addEventListener('keydown', key, true);
    pick();
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'AI_TEXT_START') return false;
    start(); respond({ ok: true }); return false;
  });
  globalThis.ResumeTextAssistant = { close };
})();
