// Parse supplied HTML as inert data; retain form structure only.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const html = await page.evaluate(source => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      const form = doc.querySelector('form.atsx-form');
      if (!form) throw Error('ATSX form not found');
      form.querySelectorAll('script,style,link,img,iframe,svg,.resumeEditForm-hiddenField,.atsx-select-selection-selected-value,.atsx-form-explain').forEach(n => n.remove());
      for (const n of [form, ...form.querySelectorAll('*')]) {
        for (const a of [...n.attributes]) if (/^on|^(src|href|action|value|checked|data-__meta|data-__field)$/i.test(a.name)) n.removeAttribute(a.name);
        if (n.matches('textarea')) n.textContent = '';
        if (n.matches('input')) { n.value = ''; n.checked = false; }
        if (n.matches('[class*="phoneNumber"]')) n.textContent = '+86 138-0000-0000';
        if (n.matches('.atsx-select-search__field__mirror')) n.textContent = '';
        n.classList.remove('atsx-checkbox-checked');
      }
      return form.outerHTML;
    }, fs.readFileSync(process.argv[2], 'utf8'));
    fs.writeFileSync(process.argv[3], '<!-- Sanitized ATSX form. Synthetic account phone; no remote code or applicant data. -->\n' + html);
    console.log(`Sanitized ATSX form: ${html.length} characters`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
