/* Discover read-only metadata in isolated worlds; never broadcast a mutation to all frames. */
(function () {
  'use strict';
  function inspect() {
    const visible = el => {
      const style = getComputedStyle(el);
      return el.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const controls = [...document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]),textarea,select,[contenteditable="true"],[role="combobox"]')].filter(visible).length;
    const adapter = globalThis.ResumePageAudit?.adapterFor?.(document);
    return {
      ready: !!globalThis.ResumeAssistant,
      controls,
      adapter: adapter?.id || (globalThis.ResumePageAudit?.supported?.(document) ? 'hotjob' : ''),
      adapterName: adapter?.name || '',
      shell: !!globalThis.ResumeEducationPlan?.shell(document) || !!adapter?.shell?.(document),
      datang: !!globalThis.ResumeEducationPlan?.isDatangURL(location.href),
      // Never return search/hash: recruitment URLs can contain session credentials.
      location: location.origin + location.pathname,
    };
  }
  async function list(tabId) {
    const frames = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: inspect });
    return frames.filter(f => f.result?.ready).map(f => ({ frameId: f.frameId, documentId: f.documentId, ...f.result }));
  }
  function choose(frames, requested) {
    if (requested) {
      const exact = frames.find(f => f.frameId === requested.frameId && f.documentId === requested.documentId);
      if (!exact) throw Error('所选页面已跳转，请刷新页面列表后重新选择');
      return exact;
    }
    const candidates = frames.filter(f => !f.shell && (f.datang || f.adapter || f.controls > 0));
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) throw Error('发现多个表单页面，请在“目标页面”中选择要填写的页面');
    const main = frames.find(f => f.frameId === 0);
    if (main) return main;
    throw Error('当前页面未加载插件，请刷新招聘页面后重试');
  }
  async function send(tabId, frame, message) {
    return chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId, ...(frame.documentId ? { documentId: frame.documentId } : {}) });
  }
  globalThis.ResumeFrameRouter = { list, choose, send };
})();
