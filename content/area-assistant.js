/* Screenshot-like region selection; DOM context, not a screenshot, goes to AI. */
(function () {
  'use strict';
  const C = globalThis.ResumeAreaControls;
  let host, ui, fields = [], epoch = 0, busy = false, stopped = false;
  const $ = s => ui.querySelector(s);
  const hasValue = v => typeof v === 'boolean' || Array.isArray(v) || typeof v === 'string' && !!v.trim();
  const display = v => typeof v === 'string' ? v : JSON.stringify(v ?? '');
  function status(s) { if (ui) $('#status').textContent = s; }
  function close() { epoch++; stopped = true; host?.remove(); host = ui = null; document.removeEventListener('keydown', key, true); }
  function key(e) { if (e.isTrusted && e.key === 'Escape') { e.preventDefault(); close(); } }
  function setBusy(value) {
    busy = value;
    for (const n of ui.querySelectorAll('#generate,#apply,#reselect,.row input,.row textarea,.row button,#instruction')) n.disabled = value;
    $('#stop').hidden = !value;
  }
  function stats() {
    const counts = { total: fields.length, success: 0, failed: 0, missing: 0, protected: 0, unsupported: 0, pending: 0 };
    for (const f of fields) {
      if (f.state === 'success') counts.success++;
      else if (f.state === 'failed') counts.failed++;
      else if (f.blocked) counts.unsupported++;
      else if (f.state === 'missing') counts.missing++;
      else if (C.filled(f) && !f.overwrite) counts.protected++;
      else counts.pending++;
    }
    $('#summary').textContent = `共 ${counts.total} 项 · 成功 ${counts.success} · 失败 ${counts.failed} · 无答案 ${counts.missing} · 保护已有 ${counts.protected} · 需人工 ${counts.unsupported} · 其余 ${counts.pending}`;
    return counts;
  }
  function report() {
    const safeReason = f => {
      if (f.blocked) return f.blocked;
      const message = f.message || '';
      if (/变化|重建/.test(message)) return '字段已变化或重建';
      if (/唯一匹配|没有该选项/.test(message)) return '没有唯一匹配选项';
      if (/弹层/.test(message)) return '未可靠定位弹层';
      if (/精度|格式/.test(message)) return '类型或格式不符';
      if (/超过/.test(message)) return '超出字段字数上限';
      if (/授权|已有内容/.test(message)) return '保护已有内容';
      if (/答案为空|未获得答案/.test(message)) return '没有可用答案';
      if (/AI 服务/.test(message)) return 'AI 服务请求失败，请检查配置与网络';
      if (f.state === 'success') return '已写入并核验';
      if (f.state === 'failed') return '组件执行或页面校验未通过';
      return f.state === 'ready' ? '已生成建议，待确认' : '待处理';
    };
    return { version: chrome.runtime.getManifest?.().version || 'unknown', mode: 'area', timestamp: new Date().toISOString(),
      page: location.origin + location.pathname, summary: stats(),
      fields: fields.map(f => ({ id: f.id, label: f.label, section: f.section, kind: f.kind, entryIndex: f.entryIndex,
        required: f.required, state: f.state || 'pending', reason: safeReason(f),
        optionCount: f.options.length, selected: !!f.selected })) };
  }
  function saveReport() {
    // Never store resume, suggested values, API key or model reasoning here.
    const diagnostic = report();
    chrome.storage.local.set({ latestAreaDiagnostic: diagnostic }).catch(() => {});
    const problems = diagnostic.fields.filter(f => ['failed','missing'].includes(f.state) || fields.find(x => x.id === f.id)?.blocked);
    globalThis.ResumeFeedback?.record('area', { matched: fields.length, filled: diagnostic.summary.success,
      pending: problems.length }, problems.map(f => ({ label: f.label, reason: f.reason, component: { kind: f.kind } })));
  }
  function sync() {
    for (const f of fields) {
      const row = f.row;
      f.selected = row.querySelector('.choose').checked && !f.blocked;
      f.overwrite = row.querySelector('.overwrite').checked;
      f.label = row.querySelector('.label').value.trim() || f.label;
      const raw = row.querySelector('.answer').value;
      if (['checkbox','multiselect','cascader'].includes(f.kind)) {
        try { f.value = JSON.parse(raw); } catch (_) { f.value = raw; }
      } else f.value = raw;
    }
  }
  function row(f) {
    const el = document.createElement('section'); el.className = 'row'; f.row = el;
    el.innerHTML = `<div class="line"><input class="choose" type="checkbox" aria-label="选择此字段"><input class="label" aria-label="字段名称"></div>
      <div class="meta"></div><details><summary>字段说明及选项</summary><div class="context"></div></details>
      <textarea class="answer" rows="2" placeholder="生成后预览，也可手动编辑答案" aria-label="建议答案"></textarea>
      <label class="overwrite-label"><input class="overwrite" type="checkbox">允许覆盖这一项的已有内容</label>
      <div class="result" role="status"></div><button class="retry">填入 / 重试此项</button>`;
    el.querySelector('.label').value = f.label;
    el.querySelector('.meta').textContent = `${f.section || '未识别区块'} · 第 ${f.entryIndex} 条 · ${f.kind}${f.required ? ' · 必填' : ''}${f.maxLength ? ` · 限 ${f.maxLength} 字` : ''}`;
    el.querySelector('.context').textContent = f.context || '说明不足时，请修正字段名或补充要求。';
    el.querySelector('.choose').checked = !f.blocked && !C.filled(f);
    el.querySelector('.choose').disabled = !!f.blocked;
    el.querySelector('.retry').disabled = !!f.blocked;
    el.querySelector('.result').textContent = f.blocked || (C.filled(f) ? '已有内容，默认保护' : '待生成建议');
    el.querySelector('.overwrite').onchange = () => {
      if (el.querySelector('.overwrite').checked && !f.blocked) el.querySelector('.choose').checked = true;
      sync(); stats();
    };
    el.querySelector('.retry').onclick = () => apply([f]);
    return el;
  }
  function updateRow(f) {
    f.row.querySelector('.result').textContent = f.message || '';
    f.row.dataset.state = f.state || '';
  }
  async function generate() {
    if (busy) return;
    sync();
    const chosen = fields.filter(f => f.selected && !f.blocked && (!C.filled(f) || f.overwrite));
    if (!chosen.length) { status('请勾选需要补填的字段。已有内容需要逐项授权覆盖。'); return; }
    if (chosen.length > 50) { status('单次最多处理 50 项，请缩小选区或取消部分勾选。'); return; }
    const id = ++epoch; stopped = false; setBusy(true);
    const alive = () => id === epoch && !!ui && !stopped;
    try {
      for (let i = 0; i < chosen.length; i++) {
        if (!alive()) return;
        const f = chosen[i];
        status(`读取组件选项 ${i + 1}/${chosen.length}：${f.label}`);
        if (!f.el.isConnected) { f.message = '字段已重建，请重新框选'; f.state = 'failed'; updateRow(f); continue; }
        f.options = await C.options(f);
        if (!alive()) return;
        f.row.querySelector('.context').textContent = `${f.context}\n可选项：${f.options.join(' / ') || '未读取到（文本/日期无需选项，动态组件可能尚未适配）'}`;
      }
      if (!alive()) return;
      status('正在结合整组选区与简历生成建议，不会立即写入网页…');
      const response = await chrome.runtime.sendMessage({ type: 'AI_AREA_GENERATE', payload: {
        instruction: $('#instruction').value, fields: chosen.filter(f => f.el.isConnected).map(C.describeForAI),
      } });
      if (!alive()) return;
      if (!response || response.error) {
        for (const f of chosen) { f.state = 'failed'; f.message = 'AI 服务请求失败，请检查配置与网络'; updateRow(f); }
        saveReport(); status(response?.error || 'AI 服务未响应'); return;
      }
      for (const f of chosen) {
        const matches = (response.mappings || []).filter(m => m.id === f.id);
        const m = matches.length === 1 ? matches[0] : null;
        f.value = m?.value ?? '';
        f.state = hasValue(f.value) ? 'ready' : 'missing';
        f.message = hasValue(f.value) ? '建议已生成，请核对后填入' : '未获得答案，请补充资料或明确对应经历';
        f.row.querySelector('.answer').value = display(f.value);
        updateRow(f);
        // Reasons are shown to the user but are not persisted in diagnostics.
        if (m?.reason) f.row.querySelector('.result').textContent += `：${m.reason}`;
      }
      stats(); saveReport();
      status(`已生成整组建议，请逐项核对。${response.usage?.total_tokens ? `本次 ${response.usage.total_tokens} tokens。` : ''} 布尔值用 true/false，多选和级联路径用 JSON 数组。`);
    } catch (_) { if (alive()) {
      for (const f of chosen) { f.state = 'failed'; f.message = 'AI 服务请求失败，请检查配置与网络'; updateRow(f); }
      saveReport(); status('生成失败，请检查 API 配置和网络后重试。');
    } }
    finally {
      if (id === epoch && ui) {
        setBusy(false); for (const f of fields.filter(f => f.blocked)) { f.row.querySelector('.choose').disabled = true; f.row.querySelector('.retry').disabled = true; }
        if (stopped) status('已停止；已发送的模型请求可能仍计费。');
      }
    }
  }
  async function apply(only) {
    if (busy) return;
    sync();
    const chosen = only || fields.filter(f => f.selected);
    const id = ++epoch; stopped = false; setBusy(true);
    const alive = () => id === epoch && !!ui && !stopped;
    try {
      for (const f of chosen) {
        if (!alive()) break;
        if (f.blocked) continue;
        if (!hasValue(f.value)) { f.state = 'missing'; f.message = '答案为空，未写入'; updateRow(f); continue; }
        status(`填写并核验：${f.label}`);
        const error = await C.write(f, f.value, f.overwrite, alive);
        if (id !== epoch || !ui) return;
        f.state = error ? 'failed' : 'success';
        // Do not include answer text in the exported failure report.
        f.message = error ? '未完成：' + error : '已写入并核验';
        if (!error) { f.selected = false; f.overwrite = false; f.row.querySelector('.choose').checked = false; f.row.querySelector('.overwrite').checked = false; }
        updateRow(f); stats();
      }
      if (id !== epoch || !ui) return;
      // Dependent fields can be cleared by later selections. Recheck all
      // previously successful rows after the batch, without another write.
      for (const f of fields.filter(f => f.state === 'success')) {
        const expected = f.kind === 'cascader' && Array.isArray(f.value) ? f.value.join('/') : f.value;
        if (!f.el.isConnected || !C.same(C.read(f), expected)) {
          f.state = 'failed'; f.message = '后续操作使字段变化，请重新核对'; updateRow(f);
        }
      }
      stats(); saveReport();
      status(stopped ? '已停止后续填写，已完成的操作不会撤销。' : '本轮结束。请检查每项结果；未提交申请。可导出不含答案和简历值的诊断。');
    } catch (_) {
      if (id === epoch && ui) {
        for (const f of chosen.filter(f => f.state !== 'success')) { f.state = 'failed'; f.message = '组件执行异常'; updateRow(f); }
        saveReport(); status('填写发生异常，诊断已记录，请核对页面。');
      }
    } finally {
      if (id === epoch && ui) { setBusy(false); for (const f of fields.filter(f => f.blocked)) { f.row.querySelector('.choose').disabled = true; f.row.querySelector('.retry').disabled = true; } }
    }
  }
  function show(rect) {
    fields = C.scan(rect);
    $('#cover').hidden = true; $('#panel').hidden = false;
    const list = $('#fields'); list.replaceChildren(...fields.map(row));
    stats();
    status(fields.length ? '请核对识别清单。默认只选空白字段；可修正字段名、指定使用哪段经历，再生成建议。' : '选区未发现可识别字段。请围住控件中心重新框选；嵌套或特殊组件可能无法读取。');
  }
  function select() {
    if (busy) return;
    epoch++; fields = []; $('#panel').hidden = true; $('#cover').hidden = false; $('#box').hidden = true;
    const cover = $('#cover');
    let from = null;
    cover.onpointerdown = e => {
      if (e.button !== 0) return;
      from = { x: e.clientX, y: e.clientY }; cover.setPointerCapture(e.pointerId);
      $('#box').hidden = false;
    };
    const bounds = e => ({ left: Math.min(from.x, e.clientX), right: Math.max(from.x, e.clientX), top: Math.min(from.y, e.clientY), bottom: Math.max(from.y, e.clientY) });
    cover.onpointermove = e => {
      if (!from) return;
      const r = bounds(e); Object.assign($('#box').style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' });
    };
    cover.onpointerup = e => {
      if (!from) return;
      const rect = bounds(e); from = null;
      if (rect.right - rect.left < 8 || rect.bottom - rect.top < 8) { $('#box').hidden = true; return; }
      show(rect);
    };
    cover.onpointercancel = () => { from = null; $('#box').hidden = true; };
    cover.onwheel = e => e.preventDefault();
  }
  function start() {
    close(); globalThis.ResumeTextAssistant?.close(); busy = false; stopped = false;
    host = document.createElement('div'); host.id = 'resume-ai-area-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    ui = host.attachShadow({ mode: 'open' });
    ui.innerHTML = `<style>
      :host{all:initial;font:14px/1.5 system-ui,sans-serif;color:#233047}*{box-sizing:border-box}[hidden]{display:none!important}
      #cover{position:fixed;inset:0;cursor:crosshair;pointer-events:auto;background:#44208012;touch-action:none}#tip{position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#352055;color:white;padding:9px 16px;border-radius:8px;pointer-events:none}#box{position:fixed;border:2px solid #8759e8;background:#8759e822;pointer-events:none}
      #panel{pointer-events:auto;position:fixed;right:12px;top:16px;bottom:16px;width:min(460px,96vw);background:white;border:1px solid #ded5f6;border-radius:12px;box-shadow:0 8px 30px #0003;display:flex;flex-direction:column}
      header,.tools,footer{padding:10px 14px}header{display:flex;align-items:center;justify-content:space-between}h3{margin:0;font-size:17px}button{border:0;background:#eee8fa;color:#463068;border-radius:6px;padding:8px 10px;cursor:pointer}button.primary{background:#7143bf;color:white}button:disabled{opacity:.5;cursor:default}
      .tools{border-bottom:1px solid #e2e6ed}#status{font-size:12px;margin:6px 0;white-space:pre-wrap}#summary{font-size:12px;color:#5d467f}#fields{overflow:auto;flex:1;padding:0 12px}.row{border:1px solid #e2e6ed;border-radius:8px;padding:10px;margin:10px 0}.row[data-state=success]{border-color:#43a174}.row[data-state=failed]{border-color:#d67265}
      input:not([type=checkbox]),textarea{font:inherit;border:1px solid #ccd2dd;border-radius:5px;padding:6px;width:100%}.line{display:flex;gap:6px;align-items:center}.meta,details,.result,.overwrite-label,.note{font-size:12px;color:#657085;overflow-wrap:anywhere}.context{white-space:pre-wrap}.answer{margin-top:6px;resize:vertical}.overwrite-label{display:block}.result{margin:6px 0}.row button{font-size:12px}.label{font-weight:600}footer{display:flex;gap:6px;border-top:1px solid #e2e6ed}#instruction{margin:6px 0}
      </style><div id="cover"><div id="tip">拖动框选当前可见页面的一片区域 · 控件中心在选区内即纳入 · Esc 退出</div><div id="box" hidden></div></div>
      <div id="panel" hidden><header><h3>AI 选区补填</h3><button id="close">关闭</button></header><div class="tools">
      <button id="reselect">重新框选</button><button id="stop" hidden>停止后续操作</button>
      <input id="instruction" placeholder="可选：使用第二段教育经历；不要改已填内容" maxlength="600">
      <div class="note">生成时发送选区字段说明/选项与授权简历至 DeepSeek，消耗 token。不上传截图或现有表单值。签名、协议、验证码需本人处理。</div>
      <div id="status" role="status"></div><div id="summary"></div></div><div id="fields"></div>
      <footer><button id="generate">生成整组建议</button><button id="apply" class="primary">填写勾选项</button><button id="export">导出诊断</button></footer></div>`;
    document.documentElement.append(host);
    $('#close').onclick = close; $('#reselect').onclick = select;
    $('#generate').onclick = generate; $('#apply').onclick = () => apply();
    $('#stop').onclick = () => { stopped = true; status('正在停止；当前组件动作可能仍会完成，不再开始后续字段。'); };
    $('#export').onclick = () => {
      const blob = new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `resume-area-diagnostic-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    document.addEventListener('keydown', key, true); select();
  }
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg?.type !== 'AI_AREA_START') return false;
    start(); respond({ ok: true }); return false;
  });
  globalThis.ResumeAreaAssistant = { close };
})();
