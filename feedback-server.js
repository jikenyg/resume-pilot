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
const { randomUUID, createHash } = require('node:crypto');
const { sanitize } = require('./shared/feedback-format');

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

function createFeedbackServer({ dir = feedbackDir } = {}) {
return http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, service: 'resume-feedback', protocolVersion: 2 });
  if (req.method !== 'POST' || req.url !== '/api/feedback') return send(res, 404, { ok: false, error: 'Not found' });

  let body = '';
  let tooLarge = false;
  let size = 0;
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    size += Buffer.byteLength(chunk, 'utf8');
    if (size > maxBodyBytes) { tooLarge = true; body = ''; }
    else if (!tooLarge) body += chunk;
  });
  req.on('end', () => {
    if (tooLarge) return send(res, 413, { ok: false, error: 'Feedback payload too large' });
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) { return send(res, 400, { ok: false, error: 'Invalid JSON' }); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return send(res, 400, { ok: false, error: 'Expected diagnostic object' });
    const diagnostic = sanitize(parsed);
    if (!diagnostic.id) diagnostic.id = randomUUID();
    const digest = createHash('sha256').update(JSON.stringify(diagnostic)).digest('hex');
    try {
      fs.mkdirSync(dir, { recursive: true });
      const filename = `feedback-${diagnostic.id}.json`, destination = path.join(dir, filename);
      if (fs.existsSync(destination)) {
        const previous = JSON.parse(fs.readFileSync(destination, 'utf8'));
        if (previous.digest !== digest) return send(res, 409, { ok: false, error: 'Report ID conflict' });
        return send(res, 200, { ok: true, filename, duplicate: true });
      }
      // Publish complete JSON only; monitoring must never read a partial report.
      const temporary = destination + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify({ ...diagnostic, receivedAt: new Date().toISOString(), digest }, null, 2), 'utf8');
      fs.renameSync(temporary, destination);
      return send(res, 201, { ok: true, filename });
    } catch (error) {
      return send(res, 500, { ok: false, error: 'Cannot persist diagnostic' });
    }
  });
});
}

if (require.main === module) {
const server = createFeedbackServer();
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '端口已占用，请检查现有反馈服务；更新后需重启旧服务。' : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Resume Assistant feedback v2 listening on http://127.0.0.1:${port}`);
  console.log(`Writing sanitized reports to ${feedbackDir}`);
});
}
module.exports = { createFeedbackServer };
