// Read-only, value-free inventory to independently check supplied snapshots.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    for (const file of process.argv.slice(2)) {
      const result = await page.evaluate(html => {
        const template = document.createElement('template'); template.innerHTML = html;
        const doc = template.content;
        const labels = [...doc.querySelectorAll('label,[ng-bind-html*="field.label"],[class*="field-label"],[class*="fieldLabel"]')]
          .map(n => n.textContent.trim()).filter(s => s && s.length < 120);
        const classes = {};
        for (const n of doc.querySelectorAll('[class]')) for (const cls of n.classList) {
          if (/field|form-item|section|resume-|label|hcm-view/.test(cls)) classes[cls] = (classes[cls] || 0) + 1;
        }
        return {
          title: doc.querySelector('title')?.textContent,
          nativeControls: [...doc.querySelectorAll('input,textarea,select')].reduce((all, n) => {
            const key = n.tagName + ':' + (n.type || ''); all[key] = (all[key] || 0) + 1; return all;
          }, {}),
          labels: [...new Set(labels)], classes,
        };
      }, fs.readFileSync(file, 'utf8'));
      console.log(JSON.stringify(result));
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
