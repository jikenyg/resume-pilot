// Offline, value-free DOM inventory of a user-provided page snapshot.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const report = await page.evaluate(html => {
      const t = document.createElement('template'); t.innerHTML = html;
      const root = t.content;
      const brief = el => ({ tag: el.tagName, id: el.id, class: el.className, name: el.getAttribute('name'), type: el.getAttribute('type') });
      return {
        fields: [...root.querySelectorAll('form')].map(form=>({id:form.id, repeats:[...form.querySelectorAll('[way-repeat],[way-scope]')].map(n=>({tag:n.tagName,id:n.id,class:n.className,attrs:[...n.attributes].map(a=>[a.name,a.value])})), controls:[...form.querySelectorAll('input,select,textarea')].filter(n=>!['button','file'].includes(n.type)).map(n=>{const td=n.closest('td')?.cloneNode(true);td?.querySelectorAll('input,select,textarea,button,script').forEach(x=>x.remove());return {tag:n.tagName,id:n.id,name:n.name,way:n.getAttribute('way-data'),label:td?.textContent.trim().replace(/\s+/g,' ').slice(0,120),class:n.className,style:n.getAttribute('style'),parent:n.parentElement.className,scope:n.closest('[way-repeat]')?.getAttribute('way-repeat')};})})),
        compact: [...root.querySelectorAll('form')].map(form=>({ id: form.id, controls:[...form.querySelectorAll('input,select,textarea')].map(n=>({ tag:n.tagName,id:n.id,name:n.name,type:n.type,attrs:[...n.attributes].filter(a=>/way|data-|change|blur|read|disabled/.test(a.name)).map(a=>[a.name,a.value]), label:(n.closest('td')?.querySelector('span')?.textContent || n.closest('td')?.textContent || '').trim().replace(/\s+/g,' ').slice(0,180), options:n.tagName==='SELECT'?[...n.options].map(o=>({text:o.textContent.trim(),value:o.value})):undefined })), additions:[...form.querySelectorAll('[onclick]')].map(n=>({tag:n.tagName,id:n.id,class:n.className,text:n.textContent.trim().slice(0,60),action:n.getAttribute('onclick')})) })),
        frames: [...root.querySelectorAll('iframe')].map(n=>({ ...brief(n), src: (n.getAttribute('src') || '').split(/[?#]/)[0], srcdoc: n.hasAttribute('srcdoc'), parent: brief(n.parentElement) })),
        forms: [...root.querySelectorAll('form,[id*="resume"],[id*="Resume"],[id*="portal"],[id*="Portal"]')].map(brief),
        scriptSources: [...root.querySelectorAll('script[src]')].map(n=>n.getAttribute('src').split(/[?#]/)[0]),
        controls: [...root.querySelectorAll('input,select,textarea')].map(el => ({ ...brief(el), placeholder: el.getAttribute('placeholder'), required: el.getAttribute('required'), readonly: el.hasAttribute('readonly'), ancestors: [el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement].filter(Boolean).map(brief), labels: [...(el.closest('tr,.form-group,.form-item') || el.parentElement).querySelectorAll('label')].map(n=>n.textContent.trim()), options: el.tagName === 'SELECT' ? [...el.options].map(o=>({text:o.textContent.trim(),value:o.value})) : undefined })),
        labels: [...root.querySelectorAll('label')].map(n=>({text:n.textContent.trim(),for:n.htmlFor, parent:brief(n.parentElement)})),
        buttons: [...root.querySelectorAll('button,a')].map(n=>({text:n.textContent.trim(),...brief(n)})).filter(n=>n.text.length<80),
        headings: [...root.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="Title"]')].map(n=>({text:n.textContent.trim(),...brief(n)})).filter(n=>n.text.length<120),
      };
    }, fs.readFileSync(process.argv[2], 'utf8'));
    if(process.argv.includes('--fields')) for(const form of report.fields){console.log(JSON.stringify({id:form.id,repeats:form.repeats}));for(const field of form.controls)console.log(JSON.stringify(field));}
    else console.log(JSON.stringify(process.argv.includes('--compact') ? report.compact : process.argv.includes('--summary') ? { frames: report.frames, forms: report.forms, scriptSources: report.scriptSources } : report, null, process.argv.includes('--compact') ? 0 : 2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
