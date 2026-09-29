/**
 * 简历助手 —— 弹窗逻辑
 *
 * 功能：
 *   - 展示当前简历摘要
 *   - 选择要填充的"集合条目"（多段经历里的第几段）
 *   - "预览识别"：只高亮会填的字段，不改页面
 *   - "一键填充本页"：实际填值
 *   - "清除"：移除高亮
 *   - 跳转到编辑简历页
 */
(function () {
  'use strict';

  const RS = globalThis.ResumeShared;
  const $ = (s) => document.querySelector(s);

  let resume = null;
  let requestedFrame = null;
  let knownFrames = [];
  const router = globalThis.ResumeFrameRouter;

  function renderFrames(frames) {
    knownFrames = frames;
    const select = $('#frame-select');
    select.replaceChildren(new Option('自动定位表单', ''));
    frames.forEach(frame => select.add(new Option(
      `${frame.datang ? '大唐简历' : frame.frameId === 0 ? '主页面' : '内嵌页面'} · ${frame.controls} 个可见控件 · ${frame.location}`,
      String(frame.frameId)
    )));
    select.value = requestedFrame ? String(requestedFrame.frameId) : '';
    const datang = frames.some(frame => frame.datang || frame.shell);
    $('#frame-hint').textContent = datang
      ? '大唐：已有高中条目用铅笔编辑；“＋”新增下一段。先高中，再从最高学历往下填写。自动新增／保存尚待内层表单验证。'
      : '自动识别内嵌表单；多个表单时请手动选择。';
  }

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendToTab(tab, msg) {
    if (!tab || !tab.id) return { ok: false, error: '没有找到当前标签页' };
    try {
      const frames = await router.list(tab.id);
      renderFrames(frames);
      const frame = router.choose(frames, requestedFrame);
      return await router.send(tab.id, frame, msg);
    } catch (e) {
      return { ok: false, error: e.message || '当前页面未加载脚本，请刷新页面后重试' };
    }
  }

  function loadResume() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['resume'], (res) => {
        resume = res.resume || RS.emptyResume();
        resolve(resume);
      });
    });
  }

  function setStatus(text, isError) {
    const box = $('#status');
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    box.className = 'status' + (isError ? ' error' : '');
    box.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------------
  function renderSummary() {
    const name = resume.base.name || '（未填写姓名）';
    const school = resume.base.school;
    const major = resume.base.major;
    const sub = [resume.base.jobIntention, school, major].filter(Boolean).join(' · ');
    $('#resume-summary').textContent = name + (sub ? ' — ' + sub : '');
  }

  function renderCollectionSelect() {
    const sel = $('#collection-select');
    sel.innerHTML = '';
    let selectedValue = '';
    if (resume.selection && resume.selection.collection) {
      selectedValue = `${resume.selection.collection}[${resume.selection.index}]`;
    }
    // 第一项：不限定集合（只看基础字段 + 通用匹配）
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '不限定（自动识别区块）';
    sel.appendChild(defaultOpt);

    RS.COLLECTION_DEFS.forEach((c) => {
      const entries = (resume.collections && resume.collections[c.key]) || [];
      if (entries.length === 0) {
        const o = document.createElement('option');
        o.value = `${c.key}[-1]`;
        o.textContent = `${c.label}（暂无条目）`;
        o.disabled = true;
        sel.appendChild(o);
        return;
      }
      entries.forEach((entry, idx) => {
        const o = document.createElement('option');
        o.value = `${c.key}[${idx}]`;
        const titleKey = c.fields.find((f) => ['name', 'school', 'company', 'organization', 'role'].includes(f.key));
        const name = (titleKey && entry[titleKey.key]) || entry[c.fields[0].key] || `条目 ${idx + 1}`;
        o.textContent = `${c.label}${c.key === 'education' && entry.degree ? `（${entry.degree}）` : ''} · ${idx + 1}：${name || '(空白)'}`;
        sel.appendChild(o);
      });
    });

    sel.value = selectedValue || '';
  }

  function selectionFromValue(val) {
    if (!val) return { collection: null, index: 0 };
    const m = /^(.+)\[(-?\d+)\]$/.exec(val);
    if (!m) return { collection: null, index: 0 };
    return { collection: m[1], index: Number(m[2]) };
  }

  // ---------------------------------------------------------------------------
  // 事件
  // ---------------------------------------------------------------------------
  async function loadProfiles() {
    const r = await chrome.storage.local.get('profiles');
    const sel = $('#profile-select');
    sel.innerHTML = '';
    ((r && r.profiles) || []).forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.name}（${Object.keys(p.fields || {}).length}项）`;
      sel.appendChild(o);
    });
    if (!sel.options.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '（还没有保存的模板）';
      sel.appendChild(o);
    }
  }

  function renderLatestDiagnostic() {
    chrome.storage.local.get(['latestFillDiagnostic'], (res) => {
      const diagnostic = res.latestFillDiagnostic;
      const card = $('#diagnostic-card');
      if (!diagnostic) { card.hidden = true; return; }
      const summary = diagnostic.summary || {};
      const issues = diagnostic.issues || [];
      const delivery = diagnostic.delivery || {};
      const deliveryText = delivery.status === 'sent' ? '已自动上报到本机反馈队列'
        : delivery.status === 'failed' ? `自动上报失败：${delivery.reason}`
          : '自动上报未开启';
      const lines = [
        `填写脚本版本：${summary.extensionVersion || '旧版，请刷新招聘页面'}`,
        `已验证填入 ${summary.filled || 0} · 下拉失败 ${summary.dropdownFailed || 0} · 必填未填 ${summary.requiredMissing || 0} · 待处理 ${summary.pending || 0}`,
        deliveryText,
        ...issues.slice(0, 5).map((issue) => `• ${issue.label}：${issue.reason}`),
      ];
      $('#diagnostic-summary').textContent = lines.join('\n');
      card.hidden = false;
    });
  }

  async function init() {
    await loadResume();
    renderSummary();
    renderCollectionSelect();
    loadProfiles();
    renderLatestDiagnostic();
    const refreshFrames = async () => {
      try {
        const tab = await getActiveTab();
        requestedFrame = null;
        renderFrames(await router.list(tab.id));
      } catch (_) { setStatus('请刷新招聘网页后重新读取页面列表。', true); }
    };
    $('#btn-refresh-frames').addEventListener('click', refreshFrames);
    $('#frame-select').addEventListener('change', event => {
      requestedFrame = event.target.value === '' ? null : knownFrames.find(frame => String(frame.frameId) === event.target.value);
    });
    refreshFrames();
    $('#btn-export-html').addEventListener('click', async () => {
      const result = await sendToTab(await getActiveTab(), { type: 'EXPORT_PAGE_HTML' });
      if (!result?.ok) { setStatus(result?.error || '下载失败，请刷新网页后重试', true); return; }
      const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'resume-form-structure.html';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus('已下载所选页面的 HTML 结构（已移除脚本及外链）。可提供此文件用于继续适配。');
    });

    $('#btn-ai-area').addEventListener('click', async () => {
      const tab = await getActiveTab();
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'AI_AREA_START' }, { frameId: 0 });
        if (!result?.ok) throw new Error('无法启动');
        window.close();
      } catch (_) { setStatus('请重新加载插件并刷新网页，再启动选区补填。', true); }
    });

    $('#btn-ai-text').addEventListener('click', async () => {
      const tab = await getActiveTab();
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'AI_TEXT_START' }, { frameId: 0 });
        if (!result || !result.ok) throw new Error(result?.error || '无法启动');
        window.close();
      } catch (_) {
        setStatus('请重新加载插件并刷新网页后重试；本版从主页面选择文本框。', true);
      }
    });

    // AI 状态
    chrome.storage.local.get(['aiConfig'], (res) => {
      const cfg = res.aiConfig || {};
      $('#ai-status').textContent = cfg.enabled ? `AI 兜底开启（${cfg.model}）` : 'AI 兜底未开启';
    });

    $('#btn-options').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    $('#collection-select').addEventListener('change', async (e) => {
      const selection = selectionFromValue(e.target.value);
      // 持久化到 resume.selection
      resume.selection = selection;
      if (!resume.collections) resume.collections = {};
      await chrome.storage.local.set({ resume });
      const tab = await getActiveTab();
      await sendToTab(tab, { type: 'SET_SELECTION', payload: selection });
    });

    $('#btn-preview').addEventListener('click', async () => {
      const tab = await getActiveTab();
      const r = await sendToTab(tab, { type: 'PREVIEW' });
      if (r && r.ok === false) { setStatus(r.error, true); return; }
      setStatus(r ? `已识别 ${r.matched} 个字段（高亮展示，未改动页面）。` : '识别完成。');
    });

    $('#btn-audit').addEventListener('click', async () => {
      const result = await sendToTab(await getActiveTab(), { type: 'PAGE_AUDIT' });
      if (!result?.ok) { setStatus(result?.error || '请刷新网页后重试', true); return; }
      await chrome.runtime.openOptionsPage();
    });

    $('#btn-clear').addEventListener('click', async () => {
      const tab = await getActiveTab();
      const result = await sendToTab(tab, { type: 'CLEAR' });
      setStatus(result?.ok === false ? result.error : '已清除高亮。', result?.ok === false);
    });

    $('#btn-fill').addEventListener('click', async () => {
      const tab = await getActiveTab();
      const r = await sendToTab(tab, { type: 'FILL' });
      if (r && r.ok === false) { setStatus(r.error, true); return; }
      if (r) {
        const aiTxt = r.aiStatus === 'disabled' ? 'AI 未开启'
          : r.aiStatus === 'error' ? 'AI 请求失败'
          : r.aiStatus === 'mapped' ? 'AI 已识别'
          : 'AI 跳过';
        setStatus(
          `识别 ${r.matched} · 已验证填入 ${r.filled} · 下拉失败 ${r.dropdownFailed} · 必填未填 ${r.requiredMissing || 0} · 新增 ${r.created} 段 · ${aiTxt}${r.aiProposed != null ? `（提议 ${r.aiProposed}，未答 ${r.aiNoAnswer || 0}）` : ''} · 未识别 ${r.unrecognized && r.unrecognized.length || 0}。` +
          ((r.aiProposed || 0) > 0 ? ' 页面右下角已弹出确认面板，请确认后再填入。' : '') +
          ((r.pendingCount || 0) > 0 ? (r.adapter === 'hotjob' ? ` 还有 ${r.pendingCount} 项待检查，请打开“编辑简历”的预检报告查看；已有内容会保留。` : ` 还有 ${r.pendingCount} 项待填，页面右下角【待填清单】可照着填。`) : '') +
          (r.unrecognized && r.unrecognized.length ? ` 识别不了的字段：${r.unrecognized.join(' / ')}。` : '') +
          (r.aiStatus === 'disabled' ? ' 提示：在"编辑简历"里开启 AI 兜底并填 API Key，这些字段才会由 AI 填。' : '')
        );
        renderLatestDiagnostic();
      } else {
        setStatus('填充完成。');
      }
    });

    $('#btn-save-profile').addEventListener('click', async () => {
      const name = $('#profile-name').value.trim();
      if (!name) { setStatus('请先给模板起个名字。', true); return; }
      const tab = await getActiveTab();
      const r = await sendToTab(tab, { type: 'SAVE_PROFILE', name });
      if (r && r.ok) { setStatus('已保存模板：' + name); $('#profile-name').value = ''; await loadProfiles(); }
      else setStatus((r && r.error) || '保存失败，请先填充本页。', true);
    });

    $('#btn-apply-profile').addEventListener('click', async () => {
      const id = $('#profile-select').value;
      if (!id) { setStatus('请先选择一个模板。', true); return; }
      const tab = await getActiveTab();
      const r = await sendToTab(tab, { type: 'APPLY_PROFILE', profileId: id });
      if (r && r.ok) setStatus('已应用，填充 ' + r.filled + ' 项。');
      else setStatus((r && r.error) || '应用失败。', true);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
