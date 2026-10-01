/**
 * 简历助手 —— 编辑简历页逻辑
 *
 * 支持：基础字段编辑、多段经历增/删/改、自定义字段增/删、AI 兜底配置、示例/清空、保存。
 */
(function () {
  'use strict';

  const RS = globalThis.ResumeShared;
  const $ = (s) => document.querySelector(s);

  let resume = null;
  const openCollections = new Set(['education']);
  let educationSite = 'datang';

  // ---------------------------------------------------------------------------
  // 输入控件构造
  // ---------------------------------------------------------------------------
  function createInput(def, value, dataPath) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = def.label;
    wrap.appendChild(label);

    let el;
    if (def.type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'textarea';
    } else if (def.type === 'select') {
      el = document.createElement('select');
      el.className = 'select';
      el.add(new Option('未填写', ''));
      if (value && !(def.options || []).includes(value)) el.add(new Option(value, value));
      (def.options || []).forEach((o) => {
        const op = document.createElement('option');
        op.value = o;
        op.textContent = o;
        el.appendChild(op);
      });
    } else {
      el = document.createElement('input');
      el.className = 'input';
      el.type = def.type || 'text';
      // Preserve previously saved month-only dates instead of clearing them on save.
      if (def.type === 'date' && value && /^\d{4}-\d{2}$/.test(value)) el.type = 'month';
      else if (def.type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) el.type = 'text';
    }
    el.value = value != null ? value : '';
    if (dataPath) el.dataset.field = dataPath;
    wrap.appendChild(el);
    return { wrap, el };
  }

  // ---------------------------------------------------------------------------
  // 基础字段
  // ---------------------------------------------------------------------------
  function renderBase() {
    const grid = $('#base-fields');
    grid.innerHTML = '';
    RS.BASE_FIELD_DEFS.forEach((def) => {
      const { wrap } = createInput(def, resume.base[def.key], `base.${def.key}`);
      grid.appendChild(wrap);
    });
  }

  // ---------------------------------------------------------------------------
  // 集合（多段经历）
  // ---------------------------------------------------------------------------
  function entryTitle(c, idx, entry) {
    const nameKey = c.fields.find((f) => f.key === 'name' || f.key === 'school' || f.key === 'company');
    const value = nameKey ? entry[nameKey.key] : entry[c.fields[0].key];
    return value ? `条目 ${idx + 1}：${value}` : `条目 ${idx + 1}（空白）`;
  }

  function createEntry(c, idx) {
    const entry = (resume.collections[c.key] || [])[idx];
    const box = document.createElement('div');
    box.className = 'entry';

    const header = document.createElement('div');
    header.className = 'entry-header';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = entryTitle(c, idx, entry);
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.textContent = '删除';
    del.title = '删除该条目';
    del.addEventListener('click', () => {
      collectFromDOM();
      resume.collections[c.key].splice(idx, 1);
      renderCollections();
    });
    header.appendChild(title);
    header.appendChild(spacer);
    header.appendChild(del);

    const grid = document.createElement('div');
    grid.className = 'grid';
    c.fields.forEach((f) => {
      const { wrap } = createInput(f, entry[f.key], `${c.key}[${idx}].${f.key}`);
      grid.appendChild(wrap);
    });

    box.appendChild(header);
    box.appendChild(grid);
    return box;
  }

  function educationChecklist() {
    const panel = document.createElement('div');
    panel.className = 'education-checklist';
    const note = document.createElement('p');
    note.textContent = '教育资料检查：选择投递网站，查看填写顺序。此处只检查资料准备情况，各网站其他必填项请通过网页预检核对。';
    const site = document.createElement('select'); site.className = 'select'; site.setAttribute('aria-label', '教育经历填写规则');
    site.add(new Option('大唐：高中 → 最高学历向下', 'datang'));
    site.add(new Option('中信：高中 → 逐级至最高学历', 'citic'));
    site.value = educationSite;
    const check = document.createElement('button');
    check.className = 'icon-btn'; check.textContent = '检查高中至最高学历资料';
    const add = document.createElement('button');
    add.className = 'icon-btn'; add.textContent = '＋ 补充高中经历'; add.dataset.action = 'add-high-school';
    const result = document.createElement('div'); result.className = 'education-check-result'; result.setAttribute('aria-live', 'polite');
    const refresh = () => {
      const plan = globalThis.ResumeEducationPlan.check(resume, educationSite);
      result.replaceChildren();
      add.disabled = !plan.highSchoolMissing;
      const summary = document.createElement('p');
      summary.textContent = (plan.highSchoolMissing ? '缺少高中经历。' : '') +
        (plan.highestUnset ? '请在实际最高学历的条目中将“所有教育类型最高学历标识”设为“是”（只能一条）。' : '') +
        (plan.complete ? '已检查的准备项齐全；仍需核对网站编辑表单。' : '') +
        ' 建议网页填写顺序：' + (plan.order.map(item => `第 ${item.index + 1} 条（${item.degree || '学历未填'}）`).join(' → ') || '请先添加教育经历') + '。';
      result.append(summary);
      for (const issue of plan.issues) {
        const row = document.createElement('p');
        row.append(`第 ${issue.index + 1} 条：${issue.reason} `);
        const button = document.createElement('button'); button.className = 'icon-btn'; button.textContent = '去补充';
        button.addEventListener('click', () => locateAuditField(issue));
        row.append(button); result.append(row);
      }
    };
    check.addEventListener('click', () => { collectFromDOM(); refresh(); });
    site.addEventListener('change', () => { educationSite = site.value; collectFromDOM(); refresh(); });
    add.addEventListener('click', () => {
      collectFromDOM();
      const entries = resume.collections.education;
      let index = entries.findIndex(e => String(e.degree).trim() === '高中');
      if (index < 0) {
        const def = RS.COLLECTION_DEFS.find(c => c.key === 'education');
        index = entries.length;
        entries.push({ ...Object.fromEntries(def.fields.map(f => [f.key, ''])), degree: '高中' });
      }
      openCollections.add('education'); renderCollections();
      const field = document.querySelector(`[data-field="education[${index}].school"]`);
      field?.focus(); field?.scrollIntoView({ block: 'center' });
      toast('已准备高中条目，请填写真实资料后保存简历。');
    });
    panel.append(note, site, check, add, result); refresh();
    return panel;
  }

  function renderCollections() {
    const container = $('#collections');
    container.innerHTML = '';
    RS.COLLECTION_DEFS.forEach((c) => {
      if (!resume.collections[c.key]) resume.collections[c.key] = [];

      const card = document.createElement('div');
      card.className = 'collection-card';

      const header = document.createElement('div');
      header.className = 'collection-header';

      const toggle = document.createElement('button');
      toggle.className = 'collapsible-toggle';
      toggle.textContent = openCollections.has(c.key) ? '▾' : '▸';
      toggle.addEventListener('click', () => {
        if (openCollections.has(c.key)) openCollections.delete(c.key);
        else openCollections.add(c.key);
        body.classList.toggle('hidden', !openCollections.has(c.key));
        toggle.textContent = openCollections.has(c.key) ? '▾' : '▸';
      });

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = c.label;

      const count = document.createElement('span');
      count.className = 'count';
      const updateCount = () => { count.textContent = `${resume.collections[c.key].length} 条`; };
      updateCount();

      const spacer = document.createElement('span');
      spacer.className = 'spacer';

      const add = document.createElement('button');
      add.className = 'icon-btn';
      add.textContent = '＋ 添加';
      add.title = `新增一条${c.label}`;
      add.addEventListener('click', () => {
        collectFromDOM();
        const empty = {};
        c.fields.forEach((f) => { empty[f.key] = ''; });
        resume.collections[c.key].push(empty);
        openCollections.add(c.key);
        updateCount();
        body.classList.remove('hidden');
        toggle.textContent = '▾';
        renderCollections(); // 简化：整体重绘
      });

      header.appendChild(toggle);
      header.appendChild(name);
      header.appendChild(count);
      header.appendChild(spacer);
      header.appendChild(add);

      const body = document.createElement('div');
      body.className = 'entries';
      resume.collections[c.key].forEach((_, idx) => {
        body.appendChild(createEntry(c, idx));
      });
      if (resume.collections[c.key].length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.textContent = '还没有条目，点击右上角"＋ 添加"。';
        body.appendChild(empty);
      }
      if (!openCollections.has(c.key)) body.classList.add('hidden');

      card.appendChild(header);
      if (c.key === 'education' && globalThis.ResumeEducationPlan) card.appendChild(educationChecklist());
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // 自定义字段
  // ---------------------------------------------------------------------------
  function buildCustomRow(k, v) {
    const row = document.createElement('div');
    row.className = 'custom-row';

    const keyInput = document.createElement('input');
    keyInput.className = 'input';
    keyInput.placeholder = '字段名，如：接受调剂';
    keyInput.value = k || '';
    keyInput.dataset.customKind = 'key';

    const valInput = document.createElement('input');
    valInput.className = 'input';
    valInput.placeholder = '字段值，如：是 / 上海';
    valInput.value = v || '';
    valInput.dataset.customKind = 'value';

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      row.remove();
    });

    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(del);
    return row;
  }

  function renderCustom() {
    const list = $('#custom-fields');
    list.innerHTML = '';
    (resume.custom || []).forEach((row) => {
      list.appendChild(buildCustomRow(row.key, row.value));
    });
  }

  function addCustom() {
    const list = $('#custom-fields');
    list.appendChild(buildCustomRow('', ''));
  }

  function collectCustom() {
    const rows = [...document.querySelectorAll('.custom-row')];
    return rows
      .map((r) => ({
        key: r.querySelector('[data-custom-kind="key"]').value.trim(),
        value: r.querySelector('[data-custom-kind="value"]').value,
      }))
      .filter((x) => x.key);
  }

  // ---------------------------------------------------------------------------
  // AI 配置
  // ---------------------------------------------------------------------------
  function renderAI(cfg) {
    $('#ai-enabled').checked = !!cfg.enabled;
    $('#ai-model').value = cfg.model || 'deepseek-chat';
    $('#ai-key').value = cfg.apiKey || '';
    $('#ai-send-full-resume').checked = !!cfg.sendFullResume;
    $('#feedback-auto-report').checked = !!cfg.autoReport;
    $('#feedback-endpoint').value = cfg.feedbackEndpoint || 'http://127.0.0.1:3742/api/feedback';
  }

  function collectAI() {
    return {
      enabled: $('#ai-enabled').checked,
      model: $('#ai-model').value,
      apiKey: $('#ai-key').value.trim(),
      sendFullResume: $('#ai-send-full-resume').checked,
      autoReport: $('#feedback-auto-report').checked,
      feedbackEndpoint: $('#feedback-endpoint').value.trim() || 'http://127.0.0.1:3742/api/feedback',
    };
  }

  // ---------------------------------------------------------------------------
  // 保存 & 加载
  // ---------------------------------------------------------------------------
  function readInputValue(el) {
    return el.value;
  }

  function collectFromDOM() {
    // base
    document.querySelectorAll('[data-field^="base."]').forEach((el) => {
      const key = el.dataset.field.slice('base.'.length);
      resume.base[key] = readInputValue(el);
    });
    // collections
    document.querySelectorAll('[data-field]').forEach((el) => {
      const path = el.dataset.field;
      if (!path.includes('[')) return; // 非集合字段
      const m = /^(.+)\[(\d+)\]\.(.+)$/.exec(path);
      if (!m) return;
      const [, coll, idxStr, field] = m;
      const idx = Number(idxStr);
      if (!resume.collections[coll]) resume.collections[coll] = [];
      if (!resume.collections[coll][idx]) resume.collections[coll][idx] = {};
      resume.collections[coll][idx][field] = readInputValue(el);
    });
    // custom
    resume.custom = collectCustom();
  }

  async function save() {
    collectFromDOM();
    await chrome.storage.local.set({
      resume,
      aiConfig: collectAI(),
    });
    toast('已保存到本机浏览器。');
  }

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2329;color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
  }

  function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resume'], (res) => {
        // 首次使用空白简历，保留浏览器中已经保存的资料。
        resume = res.resume || RS.emptyResume();
        if (!resume.base) resume.base = {};
        if (!resume.collections) resume.collections = {};
        if (!resume.custom) resume.custom = [];
        migrateResume(resume);
        resolve();
      });
    });
  }

  // 补齐缺少的集合，不根据私人简历的顺序重分已有资料。
  function migrateResume(r) {
    if (!r.collections) r.collections = {};
    if (!Array.isArray(r.collections.honor)) r.collections.honor = [];
  }

  async function renderAll() {
    renderBase();
    renderCollections();
    renderCustom();
    const cfgRes = await new Promise((r) => chrome.storage.local.get(['aiConfig'], (x) => r(x)));
    renderAI(cfgRes.aiConfig || {});
  }

  async function init() {
    $('#audit-file').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 5_000_000) { $('#audit-status').textContent = '文件不能超过 5 MB'; return; }
      $('#audit-html').value = await file.text();
    });
    $('#btn-audit-html').addEventListener('click', async () => {
      try {
        collectFromDOM();
        const report = globalThis.ResumePageAudit.fromHTML($('#audit-html').value, resume);
        renderAudit(report);
        await chrome.storage.local.set({ latestPageAudit: report });
      } catch (error) { $('#audit-status').textContent = error.message; }
    });
    $('#btn-sample').addEventListener('click', async () => {
      resume = RS.sampleResume();
      if (!resume.custom) resume.custom = [];
      await renderAll();
      toast('已填入空白模板（尚未保存，请点"保存简历"写入本机）。');
    });
    $('#btn-clear-all').addEventListener('click', async () => {
      resume = RS.emptyResume();
      await renderAll();
      toast('已清空（尚未保存）。');
    });
    $('#btn-add-custom').addEventListener('click', addCustom);
    $('#btn-check-feedback').addEventListener('click', async () => {
      $('#feedback-status').textContent = '正在检测本机反馈服务…';
      const result = await chrome.runtime.sendMessage({ type: 'CHECK_FEEDBACK_SERVICE' });
      $('#feedback-status').textContent = result && result.ok
        ? `本机反馈服务已连接${result.protocolVersion < 2 ? '（旧版服务，请重启 node feedback-server.js）' : ''}。报告送达后仍需分析和修复。`
        : (result && result.error) || '检测失败。';
    });
    const refreshFeedbackQueue = async () => {
      const stored = await chrome.storage.local.get(['feedbackOutbox', 'feedbackQueueStatus']);
      $('#feedback-queue-status').textContent = `待发送 ${(stored.feedbackOutbox || []).length} 条。${stored.feedbackQueueStatus?.error || ''}`;
    };
    $('#btn-retry-feedback').addEventListener('click', async () => {
      $('#feedback-status').textContent = '正在重试…';
      try {
        const result = await chrome.runtime.sendMessage({ type: 'RETRY_FEEDBACK' });
        $('#feedback-status').textContent = result.error || result.reason || `本轮已送达 ${result.sent || 0} 条，待发送 ${result.pending || 0} 条。`;
      } catch (_) { $('#feedback-status').textContent = '无法联系后台，请重新打开插件。'; }
      await refreshFeedbackQueue();
    });
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area === 'local' && (changes.feedbackOutbox || changes.feedbackQueueStatus)) refreshFeedbackQueue();
    });
    await refreshFeedbackQueue();
    $('#btn-save').addEventListener('click', save);
    $('#btn-save-bottom').addEventListener('click', save);

    await load();
    await renderAll();
    const { latestPageAudit } = await chrome.storage.local.get('latestPageAudit');
    if (latestPageAudit) renderAudit(latestPageAudit);
  }

  function locateAuditField(row) {
    collectFromDOM();
    const match = /^(\w+)\[(\d+)\]\.(\w+)$/.exec(row.path || '');
    if (match) {
      const [, key, index] = match;
      const def = RS.COLLECTION_DEFS.find(c => c.key === key);
      if (!def || Number(index) > 49) return;
      resume.collections[key] ||= [];
      while (resume.collections[key].length <= Number(index)) resume.collections[key].push(Object.fromEntries(def.fields.map(f => [f.key, ''])));
      openCollections.add(key); renderCollections();
    }
    let input = [...document.querySelectorAll('[data-field]')].find(el => el.dataset.field === row.path);
    if (!row.path && row.customKey) {
      resume.custom ||= [];
      let index = resume.custom.findIndex(c => c.key === row.customKey);
      if (index < 0) { index = resume.custom.length; resume.custom.push({ key: row.customKey, value: '' }); }
      renderCustom();
      input = $('#custom-fields').children[index]?.querySelector('textarea, input:last-of-type');
    }
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' }); input?.focus();
    toast('补充真实资料后保存简历，再重新检查网页。');
  }

  function renderAudit(report) {
    if (/中信/.test(report.adapter) && educationSite !== 'citic') { collectFromDOM(); educationSite = 'citic'; renderCollections(); }
    const names = { ready: '字段已适配', dynamic: '动态待验证', manual: '人工处理', unmapped: '尚未映射' };
    const data = { present: '资料已有', missing: '资料缺失', invalid: '资料需修正', unknown: '尚待核对', notApplicable: '不适用' };
    $('#audit-status').textContent = `${report.adapter}：${report.total} 项；缺资料 ${report.counts.missing}，需修正 ${report.counts.invalid}，动态待验证 ${report.counts.dynamic}，人工 ${report.counts.manual}。${report.limitation} 保存简历不会自动更新本报告，请重新检查。`;
    const container = $('#audit-results'); container.replaceChildren();
    const table = document.createElement('table'); table.className = 'audit-table';
    const head = document.createElement('tr');
    for (const text of ['网页字段', '资料 / 控件', '简历填写位置', '说明']) { const th = document.createElement('th'); th.textContent = text; head.append(th); }
    table.append(head);
    for (const row of report.rows) {
      const tr = document.createElement('tr');
      const values = [`${row.section} / 第 ${row.index + 1} 条 / ${row.label}${row.required ? '（必填）' : ''}`,
        `${data[row.dataStatus]} · ${names[row.capability]}${row.existing ? ' · 网页已有内容' : row.partial ? ' · 网页部分已填' : ''}`, row.source || '—', row.reason];
      values.forEach((text, index) => {
        const td = document.createElement('td'); td.textContent = text;
        if (index === 2 && row.capability !== 'manual' && row.dataStatus !== 'notApplicable' && (row.path || row.customKey)) {
          const button = document.createElement('button'); button.className = 'btn ghost small'; button.textContent = '去补充';
          button.addEventListener('click', () => locateAuditField(row)); td.append(document.createElement('br'), button);
        }
        tr.append(td);
      });
      table.append(tr);
    }
    container.append(table);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
