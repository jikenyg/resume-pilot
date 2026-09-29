// Independent integration acceptance. Optional arguments are the three local HTML snapshots.
// Snapshots are parsed in inert templates; no applicant values or site scripts are executed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const sources = process.argv.slice(2);
const ids = ['pipechina', 'recruit2', 'moka'];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
    await page.addInitScript(() => {
      const saved = {};
      const listeners = [];
      window.chrome = {
        storage: { local: {
          get: async (keys, callback) => {
            if (!saved.resume && globalThis.ResumeShared) {
              saved.resume = ResumeShared.emptyResume();
              saved.resume.base.name = 'ACCEPTANCE_PRIVATE_SENTINEL';
              for (const def of ResumeShared.COLLECTION_DEFS) saved.resume.collections[def.key] = [Object.fromEntries(def.fields.map(f => [f.key, '']))];
            }
            const result = Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, saved[k]]));
            callback?.(result); return result;
          },
          set: async value => Object.assign(saved, value),
        } },
        runtime: {
          onMessage: { addListener: fn => listeners.push(fn) },
          sendMessage: async () => ({ skipped: true }),
          getManifest: () => ({ version: 'acceptance-test' }),
        },
      };
      window.acceptanceStorage = saved;
    });
    await page.goto('file:///' + path.join(root, 'options/options.html').replaceAll('\\', '/'));
    await page.waitForSelector('[data-field="base.name"]');
    const setup = await page.evaluate(() => ({
      ids: (globalThis.ResumeSiteAdapters || []).map(a => a.id),
      base: ResumeShared.BASE_FIELD_DEFS.map(d => d.key),
      collections: ResumeShared.COLLECTION_DEFS.map(d => ({ key: d.key, fields: d.fields.map(f => f.key) })),
      inputs: [...document.querySelectorAll('[data-field]')].map(n => n.dataset.field),
    }));
    for (const id of ids) assert.ok(setup.ids.includes(id), `Editor did not load ${id}`);
    assert.equal(new Set(setup.ids).size, setup.ids.length, 'Duplicate adapter registrations');
    assert.equal(new Set(setup.base).size, setup.base.length, 'Duplicate base fields');
    assert.equal(new Set(setup.collections.map(c => c.key)).size, setup.collections.length, 'Duplicate collections');
    for (const c of setup.collections) {
      assert.equal(new Set(c.fields).size, c.fields.length, `Duplicate fields in ${c.key}`);
      for (const f of c.fields) assert.ok(setup.inputs.includes(`${c.key}[0].${f}`), `Editor omitted ${c.key}.${f}`);
    }
    for (const f of setup.base) assert.ok(setup.inputs.includes(`base.${f}`), `Editor omitted base.${f}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    for (const id of ids) assert.ok(manifest.content_scripts[0].js.includes(`shared/site-${id}.js`), `Content scripts omitted ${id}`);
    assert.notEqual(manifest.version, '0.3.0', 'Integrated release version was not bumped');

    for (let i = 0; i < sources.length; i++) {
      const html = fs.readFileSync(sources[i], 'utf8');
      const report = await page.evaluate(({ html, expectedId }) => {
        const template = document.createElement('template'); template.innerHTML = html;
        const matches = ResumeSiteAdapters.filter(a => a.match(template.content)).map(a => a.id);
        const resume = ResumeShared.emptyResume(); resume.base.name = 'ACCEPTANCE_PRIVATE_SENTINEL';
        const report = ResumePageAudit.fromHTML(html, resume);
        const badPaths = report.rows.filter(row => {
          if (!row.path) return false;
          if (row.path.startsWith('base.')) return !ResumeShared.BASE_FIELD_DEFS.some(f => `base.${f.key}` === row.path);
          const m = /^(\w+)\[(\d+)\]\.(\w+)$/.exec(row.path);
          return !m || !ResumeShared.COLLECTION_DEFS.find(c => c.key === m[1])?.fields.some(f => f.key === m[3]);
        }).map(r => ({ label: r.label, path: r.path }));
        const parsed = JSON.parse(JSON.stringify(report));
        return { matches, report: parsed, badPaths, expectedId };
      }, { html, expectedId: ids[i] });
      assert.deepEqual(report.matches, [ids[i]], `Ambiguous or missing adapter detection for snapshot ${i + 1}`);
      assert.equal(report.report.canGuaranteeComplete, false, 'Static HTML must not guarantee full execution');
      assert.ok(report.report.total > 0, 'No fields were inventoried');
      assert.equal(report.report.total, report.report.rows.length);
      if (ids[i] === 'pipechina') assert.equal(report.report.rows.filter(r => r.capability === 'ready').length, 0, 'Display-only PipeChina snapshot cannot expose ready edit controls');
      assert.deepEqual(report.badPaths, [], 'Mapped fields missing from editor schema');
      assert.ok(!JSON.stringify(report.report).includes('ACCEPTANCE_PRIVATE_SENTINEL'), 'Report leaked a resume value');
      // Exercise the user-facing import and "go complete" navigation, not only scan().
      // Use the actual file-import UI for large snapshots (avoids typing megabytes).
      await page.locator('#audit-file').setInputFiles(sources[i]);
      await page.waitForFunction(length => document.querySelector('#audit-html').value.length === length, html.replace(/\r\n?/g, '\n').length);
      await page.locator('#btn-audit-html').click();
      await page.waitForFunction(() => document.querySelectorAll('.audit-table tr').length > 1);
      assert.ok(!(await page.locator('#audit-results').innerText()).includes('undefined'), 'Unknown audit enum rendered to user');
      const target = report.report.rows.find(r => r.path && r.capability !== 'manual' && /\[1\]/.test(r.path)) ||
        report.report.rows.find(r => r.path && r.capability !== 'manual');
      if (target) {
        const rowName = `${target.section} / 第 ${target.index + 1} 条 / ${target.label}`;
        const tableRow = page.locator('.audit-table tr').filter({ hasText: rowName }).first();
        await tableRow.getByRole('button', { name: '去补充', exact: true }).click();
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.field), target.path, `Navigation failed for ${target.path}`);
      }
      console.log(JSON.stringify({ site: ids[i], adapter: report.report.adapter, total: report.report.total, counts: report.report.counts }));
    }
    assert.deepEqual(requests, [], 'Offline preflight attempted a network request');
    assert.deepEqual(errors, [], 'Editor runtime errors');
    assert.equal(await page.locator('[data-field="base.name"]').inputValue(), 'ACCEPTANCE_PRIVATE_SENTINEL', 'Preflight changed editor values');
    console.log('PASS: integrated script loading, schema uniqueness, editor field availability, snapshot routing, valid mapped paths, offline/no-value-report boundaries.');
  } finally { await browser.close(); }
})().catch(error => { console.error(String(error.message || error).split('Call log:')[0]); process.exitCode = 1; });
