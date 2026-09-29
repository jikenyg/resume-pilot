/**
 * 简历助手本地反馈服务
 *
 * 接收扩展的脱敏填写诊断，并写入 feedback/inbox/。不接收简历正文、
 * API Key、Cookie 或页面填写值。仅监听 127.0.0.1，不暴露给局域网。
 *
 * 启动：node feedback-server.js
 * 可选：node feedback-server.js --dir D:\\somewhere\\feedback
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const argIndex = process.argv.indexOf('--dir');
const feedbackDir = argIndex >= 0 && process.argv[argIndex + 1]
  ? path.resolve(process.argv[argIndex + 1])
  : path.join(__dirname, 'feedback', 'inbox');
const port = Number(process.env.RESUME_ASSISTANT_FEEDBACK_PORT || 3742);
const maxBodyBytes = 512 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function cleanText(value, limit) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').slice(0, limit);
}

function cleanPageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return `${url.origin}${url.pathname}`.slice(0, 1000);
  } catch (_) {
    return cleanText(value, 1000).split('?')[0];
  }
}

// 只保留修复组件需要的页面结构和失败原因，避免把个人简历内容落盘。
function sanitizeDiagnostic(input) {
  const page = input && input.page || {};
  const summary = input && input.summary || {};
  const issues = Array.isArray(input && input.issues) ? input.issues : [];
  return {
    version: 1,
    receivedAt: new Date().toISOString(),
    sourceCreatedAt: cleanText(input && input.createdAt, 64),
    page: {
      title: cleanText(page.title, 200),
      url: cleanPageUrl(page.url),
    },
    summary: {
      extensionVersion: cleanText(summary.extensionVersion, 32),
      matched: Number(summary.matched) || 0,
      filled: Number(summary.filled) || 0,
      dropdownFailed: Number(summary.dropdownFailed) || 0,
      requiredMissing: Number(summary.requiredMissing) || 0,
      aiStatus: cleanText(summary.aiStatus, 80),
      aiProposed: Number(summary.aiProposed) || 0,
      aiNoAnswer: Number(summary.aiNoAnswer) || 0,
      aiFieldsWithOptions: Number(summary.aiFieldsWithOptions) || 0,
      pending: Number(summary.pending) || 0,
    },
    issues: issues.slice(0, 60).map((issue) => ({
      label: cleanText(issue && issue.label, 200),
      reason: cleanText(issue && issue.reason, 200),
      hint: cleanText(issue && issue.hint, 500),
      component: {
        tag: cleanText(issue && issue.component && issue.component.tag, 40),
        kind: cleanText(issue && issue.component && issue.component.kind, 60),
        role: cleanText(issue && issue.component && issue.component.role, 80),
        classHint: cleanText(issue && issue.component && issue.component.classHint, 240),
        maxLength: Number(issue && issue.component && issue.component.maxLength) || 0,
        inOpenShadowRoot: !!(issue && issue.component && issue.component.inOpenShadowRoot),
      },
      options: (Array.isArray(issue && issue.options) ? issue.options : []).slice(0, 30).map((option) => cleanText(option, 100)),
    })),
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, feedbackDir });
  if (req.method !== 'POST' || req.url !== '/api/feedback') return send(res, 404, { ok: false, error: 'Not found' });

  let body = '';
  let tooLarge = false;
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > maxBodyBytes) tooLarge = true;
  });
  req.on('end', () => {
    if (tooLarge) return send(res, 413, { ok: false, error: 'Feedback payload too large' });
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) { return send(res, 400, { ok: false, error: 'Invalid JSON' }); }
    const diagnostic = sanitizeDiagnostic(parsed);
    try {
      fs.mkdirSync(feedbackDir, { recursive: true });
      const filename = `feedback-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.json`;
      fs.writeFileSync(path.join(feedbackDir, filename), JSON.stringify(diagnostic, null, 2), 'utf8');
      return send(res, 201, { ok: true, filename });
    } catch (error) {
      return send(res, 500, { ok: false, error: `Write failed: ${error.message}` });
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Resume Assistant feedback server listening on http://127.0.0.1:${port}`);
  console.log(`Writing sanitized reports to ${feedbackDir}`);
});
