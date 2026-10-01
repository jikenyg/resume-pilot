/* MV3 durable outbox. Serialize mutations across concurrent tabs and alarms. */
(function () {
  'use strict';
  const ALARM = 'resume-feedback-retry', LIMIT = 100;
  const read = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  let serial = Promise.resolve();
  function exclusive(work) { const next = serial.then(work, work); serial = next.catch(() => {}); return next; }
  const endpointFor = cfg => cfg.feedbackEndpoint || 'http://127.0.0.1:3742/api/feedback';
  function allowed(value) {
    try { const u = new URL(value); return u.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname) && !u.username && !u.password; } catch (_) { return false; }
  }
  async function request(url, init = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
      return { ok: response.ok, status: response.status, body: await response.json() };
    }
    finally { clearTimeout(timer); }
  }
  async function saveHistory(diagnostic) {
    const stored = await read(['fillDiagnostics']);
    const history = (stored.fillDiagnostics || []).filter(d => d.id !== diagnostic.id);
    history.unshift(diagnostic);
    await chrome.storage.local.set({ latestFillDiagnostic: diagnostic, fillDiagnostics: history.slice(0, 20) });
  }
  async function updateDelivery(id, delivery) {
    const stored = await read(['fillDiagnostics', 'latestFillDiagnostic']);
    const patch = { fillDiagnostics: (stored.fillDiagnostics || []).map(d => d.id === id ? { ...d, delivery } : d) };
    if (stored.latestFillDiagnostic?.id === id) patch.latestFillDiagnostic = { ...stored.latestFillDiagnostic, delivery };
    await chrome.storage.local.set(patch);
  }
  async function flush(force = false) {
    const stored = await read(['feedbackOutbox', 'aiConfig']);
    const cfg = stored.aiConfig || {}, queue = stored.feedbackOutbox || [];
    if (!cfg.autoReport) { await chrome.alarms.clear(ALARM); return { skipped: true, pending: queue.length, reason: '自动上报未开启，队列已暂停' }; }
    const endpoint = endpointFor(cfg);
    if (!allowed(endpoint)) {
      const result = { error: '反馈地址只能是本机 HTTP 地址，不允许凭据或重定向', pending: queue.length };
      await chrome.storage.local.set({ feedbackQueueStatus: { ...result, checkedAt: new Date().toISOString() } });
      for (const item of queue) await updateDelivery(item.diagnostic.id, { status: 'queued', reason: result.error });
      return result;
    }
    let sent = 0, lastError = '';
    // A bounded batch keeps the service worker responsive. Future alarms drain the rest.
    for (const item of queue.filter(q => force || q.nextAttempt <= Date.now()).slice(0, 5)) {
      try {
        const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.diagnostic) });
        const body = response.body;
        if (!response.ok || !body.ok || typeof body.filename !== 'string') throw Error('receiver');
        queue.splice(queue.indexOf(item), 1); sent++;
        await chrome.storage.local.set({ feedbackOutbox: queue });
        await updateDelivery(item.diagnostic.id, { status: 'sent', filename: body.filename, sentAt: new Date().toISOString() });
      } catch (_) {
        item.attempts = (item.attempts || 0) + 1;
        item.nextAttempt = Date.now() + Math.min(30, 2 ** Math.min(item.attempts - 1, 5)) * 60000;
        lastError = '本机服务未接收，报告已保留，将自动重试；请运行 node feedback-server.js';
        await chrome.storage.local.set({ feedbackOutbox: queue });
        await updateDelivery(item.diagnostic.id, { status: 'queued', reason: lastError, attempts: item.attempts });
        break;
      }
    }
    if (queue.length) await chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
    else await chrome.alarms.clear(ALARM);
    const result = { ok: !lastError, sent, pending: queue.length, ...(lastError ? { error: lastError } : {}) };
    await chrome.storage.local.set({ feedbackQueueStatus: { ...result, checkedAt: new Date().toISOString() } });
    return result;
  }
  async function record(raw) {
    const diagnostic = ResumeFeedbackFormat.sanitize(raw);
    if (!diagnostic.id) diagnostic.id = crypto.randomUUID();
    if (!diagnostic.createdAt) diagnostic.createdAt = new Date().toISOString();
    if (!diagnostic.summary.extensionVersion) diagnostic.summary.extensionVersion = chrome.runtime.getManifest().version;
    const stored = await read(['feedbackOutbox', 'aiConfig']), queue = stored.feedbackOutbox || [];
    const cfg = stored.aiConfig || {};
    if (!diagnostic.issues.length && !diagnostic.summary.pending && !diagnostic.summary.requiredMissing && !diagnostic.summary.dropdownFailed) {
      diagnostic.delivery = { status: 'not-needed', reason: '本次未发现需要上报的问题' };
    } else if (!cfg.autoReport) {
      diagnostic.delivery = { status: 'disabled', reason: '已保留本机诊断，自动上报未开启' };
    } else if (queue.length >= LIMIT) {
      diagnostic.delivery = { status: 'failed', reason: '待发送队列已满（100 条），请恢复服务并重试；本次保留在最近诊断中' };
    } else {
      diagnostic.delivery = { status: 'queued', reason: '等待本机服务接收' };
      if (!queue.some(q => q.diagnostic.id === diagnostic.id)) queue.push({ diagnostic: ResumeFeedbackFormat.sanitize(diagnostic), attempts: 0, nextAttempt: 0 });
      await chrome.storage.local.set({ feedbackOutbox: queue });
      await chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
    }
    await saveHistory(diagnostic);
    // Persist before returning. Delivery is asynchronous and cannot hold up form filling.
    return { ok: false, queued: diagnostic.delivery.status === 'queued', skipped: ['disabled','not-needed'].includes(diagnostic.delivery.status), reason: diagnostic.delivery.reason, status: diagnostic.delivery.status };
  }
  globalThis.ResumeFeedbackQueue = {
    record: raw => exclusive(() => record(raw)), flush: force => exclusive(() => flush(force)), allowed,
    health: async () => {
      const { aiConfig = {} } = await read(['aiConfig']);
      const endpoint = endpointFor(aiConfig);
      if (!allowed(endpoint)) return { error: '反馈地址只能是本机 HTTP 地址' };
      const url = new URL(endpoint); url.pathname = '/health'; url.search = ''; url.hash = '';
      try { const response = await request(url.toString()); const body = response.body;
        return response.ok && body.ok ? { ok: true, protocolVersion: body.protocolVersion || 1 } : { error: '反馈服务响应异常' };
      } catch (_) { return { error: '无法连接本机反馈服务，请运行 node feedback-server.js' }; }
    },
  };
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) ResumeFeedbackQueue.flush().catch(() => {}); });
  chrome.runtime.onStartup.addListener(() => ResumeFeedbackQueue.flush().catch(() => {}));
  chrome.runtime.onInstalled.addListener(() => ResumeFeedbackQueue.flush().catch(() => {}));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.aiConfig) ResumeFeedbackQueue.flush(true).catch(() => {});
  });
})();
