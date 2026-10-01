/* Captured at injection time: an old tab must not claim to run a new script. */
(function () {
  'use strict';
  const version = chrome.runtime.getManifest().version;
  async function record(mode, summary, issues) {
    const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
    const diagnostic = ResumeFeedbackFormat.sanitize({ id, createdAt: new Date().toISOString(), mode,
      page: { title: document.title, url: location.href }, summary: { ...summary, extensionVersion: version }, issues });
    try {
      return await chrome.runtime.sendMessage({ type: 'REPORT_FEEDBACK', payload: { diagnostic } });
    } catch (_) {
      // Keep evidence if the worker cannot be reached. Reloading an invalidated
      // extension context may still be required; do not claim a successful send.
      diagnostic.delivery = { status: 'failed', reason: '无法联系扩展后台，请刷新招聘网页后重试' };
      try { await chrome.storage.local.set({ latestFillDiagnostic: diagnostic }); } catch (_) {}
      return { error: diagnostic.delivery.reason };
    }
  }
  globalThis.ResumeFeedback = { record };
})();
