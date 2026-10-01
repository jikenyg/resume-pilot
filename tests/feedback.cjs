// Synthetic diagnostics only; exercise actual receiver plus restartable MV3 storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { createFeedbackServer } = require('../feedback-server');
const { sanitize } = require('../shared/feedback-format');
const root = path.resolve(__dirname, '..');
const sample = (id = randomUUID()) => ({ id, createdAt: '2026-09-29T00:00:00Z', mode: 'area',
  page: { title: 'Synthetic form', url: 'https://example.test/form?token=secret#private' },
  summary: { extensionVersion: 'test-version', filled: 0 },
  issues: [{ label: '毕业时间', reason: '页面校验未通过', value: 'PRIVATE_VALUE', component: { kind: 'date' } }],
  resume: 'PRIVATE_RESUME', apiKey: 'PRIVATE_KEY' });

function worker(store, network) {
  const listeners = {}, alarms = new Map();
  const event = name => ({ addListener(fn) { listeners[name] = fn; } });
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, crypto: { randomUUID },
    fetch: network,
    chrome: { storage: { local: {
      get(keys, callback) { const result = Object.fromEntries(keys.filter(k => k in store).map(k => [k, structuredClone(store[k])])); callback(result); },
      async set(values) { Object.assign(store, structuredClone(values)); },
    }, onChanged: event('changed') },
    runtime: { getManifest: () => ({ version: '0.5.1' }), onStartup: event('startup'), onInstalled: event('installed') },
    alarms: { async create(name, config) { alarms.set(name, config); }, async clear(name) { alarms.delete(name); }, onAlarm: event('alarm') } },
  });
  for (const file of ['shared/feedback-format.js', 'background/feedback-queue.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return { api: context.ResumeFeedbackQueue, alarms, listeners };
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-feedback-test-'));
  const server = createFeedbackServer({ dir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/feedback`;
  try {
    const store = { aiConfig: { autoReport: true, feedbackEndpoint: endpoint } };
    let offline = true, calls = 0, loseResponse = false;
    const network = async (...args) => {
      calls++;
      if (offline) throw Error('offline');
      const response = await fetch(...args);
      if (loseResponse) { loseResponse = false; throw Error('response lost after persist'); }
      return response;
    };
    let w = worker(store, network);
    assert.equal((await w.api.record(sample())).queued, true);
    assert.equal(store.feedbackOutbox.length, 1, 'persist before network');
    await w.api.flush();
    assert.equal(store.latestFillDiagnostic.delivery.status, 'queued');
    assert.equal(store.feedbackOutbox[0].attempts, 1);
    const firstCalls = calls;
    await w.api.flush();
    assert.equal(calls, firstCalls, 'backoff avoids repeated attempts');
    assert.equal(w.alarms.size, 1);
    assert.equal(JSON.stringify(store).includes('PRIVATE_'), false, 'values/key/resume excluded before durable storage');
    assert.equal(store.latestFillDiagnostic.page.url, 'https://example.test/form');
    assert.equal(store.latestFillDiagnostic.summary.extensionVersion, 'test-version', 'keep injected script version');

    // Worker restart uses the same durable storage and no old JS closures.
    w = worker(store, network); offline = false; loseResponse = true;
    await w.api.flush(true);
    assert.equal(fs.readdirSync(dir).length, 1);
    assert.equal(store.feedbackOutbox.length, 1);
    await w.api.flush(true);
    assert.equal(fs.readdirSync(dir).length, 1, 'ambiguous network retry is idempotent');
    assert.equal(store.latestFillDiagnostic.delivery.status, 'sent');
    assert.equal(store.feedbackOutbox.length, 0);
    assert.equal(w.alarms.size, 0);

    await Promise.all(Array.from({ length: 8 }, () => w.api.record(sample())));
    assert.equal(store.feedbackOutbox.length, 8, 'concurrent tabs do not lose reports');
    assert.equal(new Set(store.feedbackOutbox.map(x => x.diagnostic.id)).size, 8);
    store.aiConfig.autoReport = false;
    const beforeDisable = calls;
    await w.api.flush(true);
    assert.equal(calls, beforeDisable);
    assert.equal(store.feedbackOutbox.length, 8, 'disabling pauses, never discards');
    const disabled = await w.api.record(sample());
    assert.equal(disabled.status, 'disabled');
    store.aiConfig.autoReport = true;
    await w.api.flush(true); await w.api.flush(true);
    assert.equal(store.feedbackOutbox.length, 0);
    assert.equal(store.latestFillDiagnostic.delivery.status, 'disabled', 'old retry cannot overwrite a newer report');
    assert.equal((await w.api.health()).protocolVersion, 2);

    const success = sample(); success.issues = [];
    assert.equal((await w.api.record(success)).status, 'not-needed');
    assert.equal(store.feedbackOutbox.length, 0, 'successful forms need no upload');
    store.aiConfig.feedbackEndpoint = 'https://example.test/steal';
    await w.api.record(sample());
    const beforeInvalid = calls;
    assert.match((await w.api.flush(true)).error, /本机/);
    assert.equal(calls, beforeInvalid, 'invalid destination never contacted');
    assert.equal(w.api.allowed('http://user:password@127.0.0.1:3742/'), false);

    store.feedbackOutbox = Array.from({ length: 100 }, () => ({ diagnostic: sanitize(sample()), attempts: 0, nextAttempt: 0 }));
    assert.equal((await w.api.record(sample())).status, 'failed');
    assert.equal(store.feedbackOutbox.length, 100, 'queue overflow never silently evicts');

    const post = body => fetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
    const duplicate = sample();
    assert.equal((await post(duplicate)).status, 201);
    assert.equal((await (await post(duplicate)).json()).duplicate, true);
    duplicate.issues[0].reason = 'changed';
    assert.equal((await post(duplicate)).status, 409, 'ID collision never overwrites evidence');
    assert.equal((await post(null)).status, 400);
    assert.equal((await post({ huge: 'X'.repeat(530000) })).status, 413);
    const redacted = sanitize({ ...sample(), issues: [{ label: 'person@example.test 13800138000', reason: '没有可用答案', value: 'SECRET' }] });
    assert.equal(redacted.issues[0].label, '[邮箱] [号码]');
    assert.equal(redacted.issues[0].category, 'missing-data');
    assert.equal(JSON.stringify(redacted).includes('SECRET'), false);
    assert.ok(fs.readdirSync(dir).every(name => name.endsWith('.json')));
    console.log('PASS: durable/concurrent/restarted feedback queue; offline backoff; disable; overflow; redaction; receiver health, idempotency, conflicts and body limits');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    // This uniquely created test-only directory never contains user feedback.
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
