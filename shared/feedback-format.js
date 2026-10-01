/* Allowlisted diagnostics shared by the extension and the local receiver. */
(function () {
  'use strict';
  const text = (value, limit = 200) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[邮箱]')
    .replace(/\b\d{11,18}[Xx]?\b/g, '[号码]').slice(0, limit);
  const count = value => Math.max(0, Math.min(100000, Number(value) || 0));
  function category(reason) {
    if (/无可用|没有可用|无答案|未获得答案|资料|缺少.*日期|答案为空/.test(reason)) return 'missing-data';
    if (/已有内容|保护|授权|待确认|停止/.test(reason)) return 'needs-review';
    if (/人工|上传|验证码|签名|协议/.test(reason)) return 'manual';
    if (/AI|网络|请求|服务|配置/.test(reason)) return 'service';
    return 'component';
  }
  function sanitize(input = {}) {
    input = input && typeof input === 'object' ? input : {};
    let url = '';
    try { const u = new URL(input.page?.url); if (/^https?:$/.test(u.protocol)) url = u.origin + u.pathname; } catch (_) {}
    const summary = input.summary || {};
    const issues = (Array.isArray(input.issues) ? input.issues : []).slice(0, 60).map(row => {
      row = row || {};
      const reason = text(row.reason), c = row.component || {};
      return { label: text(row.label), reason, category: category(reason), hint: text(row.hint, 500),
        component: { tag: text(c.tag, 40), kind: text(c.kind, 60), role: text(c.role, 80),
          classHint: text(c.classHint, 240), maxLength: count(c.maxLength), inOpenShadowRoot: !!c.inOpenShadowRoot },
        options: (Array.isArray(row.options) ? row.options : []).slice(0, 30).map(v => text(v, 100)) };
    });
    return { version: 2, id: /^[a-zA-Z0-9-]{8,80}$/.test(input.id || '') ? input.id : '',
      createdAt: text(input.createdAt, 64), mode: ['fill', 'area', 'text', 'profile'].includes(input.mode) ? input.mode : 'fill',
      page: { title: text(input.page?.title), url: text(url, 1000) },
      summary: { extensionVersion: text(summary.extensionVersion, 32),
        ...Object.fromEntries(['matched','filled','dropdownFailed','requiredMissing','aiProposed','aiNoAnswer','aiFieldsWithOptions','pending'].map(k => [k, count(summary[k])])),
        aiStatus: text(summary.aiStatus, 80) }, issues };
  }
  const api = { sanitize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.ResumeFeedbackFormat = api;
})();
