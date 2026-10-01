// Extract only sanitized form structure from a user-supplied snapshot; never execute it.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const sections = new Set();
      for (const form of doc.querySelectorAll('.ux-standard-form')) {
        for (let n = form.parentElement; n; n = n.parentElement) {
          if ([...n.children].some(c => c.id.includes('_Recruitment_') && !c.querySelector('.form-item') && !c.id.endsWith('_addButton'))) { sections.add(n); break; }
        }
      }
      return [...sections].map((section, index) => {
        const copy = section.cloneNode(true);
        copy.querySelectorAll('script,style,link,img,iframe,svg,.phoenix-select__tipEle,.phoenix-select__tagItem,.form-item__error').forEach(n => n.remove());
        for (const n of copy.querySelectorAll('*')) {
          for (const a of [...n.attributes]) if (/^on|src|href|value|checked/i.test(a.name)) n.removeAttribute(a.name);
          if (n.id.includes('_Recruitment_')) n.id = `fixture_Recruitment_section${index}` + (n.id.endsWith('_addButton') ? '_addButton' : '');
          if (n.hasAttribute('name')) n.removeAttribute('name');
          if (n.matches('textarea,.phoenix-select__calcEle')) n.textContent = '';
          if (n.matches('input')) n.value = '';
        }
        return copy.outerHTML;
      }).join('\n');
    }, fs.readFileSync(process.argv[2], 'utf8'));
    if (process.argv[3]) fs.writeFileSync(process.argv[3], '<!-- Sanitized supplied Beisen form DOM; no applicant data or remote code. -->\n' + result);
    console.log(`Sanitized form structure: ${result.length} characters`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
