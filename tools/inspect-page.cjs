const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const html = fs.readFileSync(process.argv[2], 'utf8');
    console.log(JSON.stringify(await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return [...doc.querySelectorAll('.form-cell')].map(section => ({
        section: section.querySelector('.tit p')?.textContent,
        items: [...section.querySelectorAll('[id]')].filter(n => /^\d+_\d+_\d+$/.test(n.id)).map(n => ({
          id: n.id, label: n.querySelector('label')?.textContent,
          required: !!n.querySelector('.ant-form-item-required'),
          controls: [...n.querySelectorAll('input,textarea,[role="combobox"]')].map(el => ({tag:el.tagName, type:el.type, placeholder:el.getAttribute('placeholder'), cls:el.className,
            option: ['checkbox', 'radio'].includes(el.type) ? el.closest('label')?.textContent.trim() : undefined }))
        }))
      }));
    }, html), null, 2));
  } finally { await browser.close(); }
})();
