// Local inert extraction of form structure; no remote resources or applicant values.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const html = await page.evaluate(source => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      const sections = [...doc.querySelectorAll('.form-cell')].map(section => {
        const copy = section.cloneNode(true);
        copy.querySelectorAll('script,style,img,svg,iframe,link,.resume-assistant-badge,.ant-select-selection-selected-value,.ant-select-selection-item,.ant-form-explain').forEach(n => n.remove());
        for (const n of copy.querySelectorAll('*')) {
          for (const a of [...n.attributes]) if (/^on|src|href|value|checked|title/i.test(a.name)) n.removeAttribute(a.name);
          n.classList.remove('resume-assistant-matched', 'has-error', 'ant-radio-checked');
          if (n.matches('input')) n.value = '';
          if (n.matches('textarea,.ant-select-search__field__mirror')) n.textContent = '';
        }
        return copy.outerHTML;
      });
      return '<div class="resume-operation-wrap">' + sections.join('\n') + '</div>';
    }, fs.readFileSync(process.argv[2], 'utf8'));
    fs.writeFileSync(process.argv[3], '<!-- Sanitized Hotjob form structure. -->\n' + html);
    console.log('Sanitized form characters:', html.length);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
