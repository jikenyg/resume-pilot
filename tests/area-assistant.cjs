const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
async function workerTest() {
  let listen, body, count = 0;
  const config = { apiKey: 'fake', sendFullResume: false };
  const sandbox = { AbortController, setTimeout, clearTimeout, URL,
    chrome: { storage: { local: { get(keys, cb) { cb({ aiConfig: config, resume: { base: { name: 'Fixture' }, collections: {} } }); } } }, runtime: { onMessage: { addListener(f) { listen = f; } } } },
    fetch: async (url, opts) => {
      count++; body = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ mappings: [
        { id: 'one', value: true, reason: 'fixture' }, { id: 'two', value: ['河北','唐山'] }, { id: 'outside', value: 'ignored' },
      ] }) } }], usage: { total_tokens: 100 } }) };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8'), sandbox);
  const payload = { fields: [{ id: 'one', kind: 'checkbox' }, { id: 'two', kind: 'cascader' }, { id: 'three', kind: 'date' }] };
  const call = () => new Promise(r => listen({ type: 'AI_AREA_GENERATE', payload }, {}, r));
  assert.match((await call()).error, /允许发送/); assert.equal(count, 0);
  config.sendFullResume = true;
  const result = await call();
  assert.equal(result.mappings.length, 3);
  assert.equal(result.mappings[0].value, true);
  assert.equal(result.mappings[2].value, '');
  assert.equal(result.usage.total_tokens, 100);
  assert.equal(JSON.parse(body.messages[1].content).fields.length, 3);
  console.log('PASS: area AI authorization, typed results, missing result and unknown id filtering');
}
(async () => {
  await workerTest();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(`<style>body{margin:10px;font:14px sans-serif}#area{width:600px}.field{margin:5px;padding:3px;min-height:42px}label,legend{display:inline-block;width:130px}input:not([type=radio]):not([type=checkbox]),textarea,select,[role=combobox]{width:300px;min-height:26px}fieldset{margin:5px}#outside{position:absolute;left:650px;top:10px}[role=listbox]{background:#eef;border:1px solid;padding:8px;width:280px}[role=option]{padding:3px}</style>
    <form id="area"><h2>教育经历</h2>
      <div class="field"><label for="name">姓名</label><input id="name"></div>
      <div class="field"><label for="keep">已填写</label><input id="keep" value="preserve"></div>
      <div class="field"><label for="desc">描述</label><textarea id="desc" maxlength="12"></textarea></div>
      <div class="field"><label for="degree">学历</label><select id="degree"><option value="">请选择</option><option value="ms">硕士研究生</option></select></div>
      <div class="field"><label for="skills">技能</label><select id="skills" multiple><option>JS</option><option>Java</option></select></div>
      <fieldset><legend>性别</legend><label><input type="radio" name="gender" value="m">男</label><label><input type="radio" name="gender" value="f">女</label></fieldset>
      <div class="field"><label for="overseas">海外经历</label><input id="overseas" type="checkbox"></div>
      <div class="field"><label for="start">开始时间</label><input id="start" type="date"></div>
      <div class="field"><label for="month">毕业月份</label><input id="month" type="month"></div>
      <div class="field"><label id="school-label">学校</label><div id="school" tabindex="0" role="combobox" aria-labelledby="school-label" aria-controls="schools">请选择</div></div>
      <div class="field"><label id="origin-label">籍贯</label><div id="origin" class="cascader" tabindex="0" role="combobox" aria-labelledby="origin-label" aria-controls="regions">请选择</div></div>
      <div class="field"><label for="missing">成绩</label><input id="missing" type="number"></div>
      <div class="field"><label for="consent">同意隐私协议</label><input id="consent" type="checkbox"></div>
      <div class="field"><label for="file">附件</label><input id="file" type="file"></div>
      <button type="submit">提交</button></form><input id="outside" value="outside untouched">`);
    await page.evaluate(() => {
      window.listeners = []; window.calls = []; window.saved = {}; window.submits = 0;
      document.querySelector('form').onsubmit = e => { e.preventDefault(); window.submits++; };
      const school = document.querySelector('#school'), origin = document.querySelector('#origin');
      function popup(id, labels, onSelect) {
        document.getElementById(id)?.remove();
        const p = document.createElement('div'); p.id = id; p.setAttribute('role', 'listbox'); p.style.cssText = 'position:fixed;left:620px;top:700px;z-index:100';
        for (const text of labels) {
          const item = document.createElement('div'); item.setAttribute('role','option'); item.textContent = text;
          item.onclick = e => { e.stopPropagation(); onSelect(text); };
          p.append(item);
        }
        document.body.append(p);
      }
      school.onclick = () => popup('schools', ['测试大学','另一所大学'], text => { school.textContent = text; document.getElementById('schools').remove(); });
      origin.onclick = () => popup('regions', ['河北','北京'], first => popup('regions', ['唐山','石家庄'], second => { origin.textContent = first + '/' + second; document.getElementById('regions').remove(); }));
      document.body.addEventListener('click', e => { if (e.target === document.body) document.querySelectorAll('[role=listbox]').forEach(n => n.remove()); });
      window.chrome = { storage: { local: { get(k, cb) { cb({}); }, async set(v) { Object.assign(window.saved, v); } } }, runtime: {
        onMessage: { addListener(f) { window.listeners.push(f); } },
        sendMessage: async msg => {
          window.calls.push(msg);
          const values = { '姓名':'Test', '描述':'获奖经历', '学历':'硕士研究生', '技能':['JS','Java'], '性别':'女', '海外经历':true, '开始时间':'2024-09-01', '毕业月份':'2027-07', '学校':'测试大学', '籍贯':['河北','唐山'] };
          return { mappings: msg.payload.fields.map(f => ({ id: f.id, value: values[f.label] ?? '', reason:'fixture' })), usage:{total_tokens:99} };
        },
      } };
    });
    for (const file of ['shared/schema.js','shared/keywords.js','content/control-adapters.js','content/content.js','content/text-assistant.js','content/area-controls.js','content/area-assistant.js']) await page.addScriptTag({path:path.join(root,file)});
    const box = await page.locator('#area').boundingBox();
    const rect = {left:box.x, top:box.y, right:box.x+box.width, bottom:box.y+box.height};
    const fields = await page.evaluate(r => ResumeAreaControls.scan(r).map(f => ({label:f.label, kind:f.kind, blocked:f.blocked})), rect);
    assert.equal(fields.length, 14);
    assert.equal(fields.filter(f => f.kind === 'radio').length, 1);
    assert.ok(fields.find(f => f.label === '同意隐私协议').blocked);
    assert.ok(fields.find(f => f.label === '附件').blocked);
    const replies = await page.evaluate(() => { const res=[]; window.listeners.forEach(fn => fn({type:'AI_AREA_START'},{},r=>res.push(r))); return res; });
    assert.deepEqual(replies, [{ok:true}]);
    await page.mouse.move(rect.left,rect.top); await page.mouse.down(); await page.mouse.move(rect.right,rect.bottom,{steps:8}); await page.mouse.up();
    const panel = page.locator('#resume-ai-area-host');
    assert.equal(await panel.locator('.row').count(),14);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await panel.locator('#generate').click();
    await page.waitForFunction(()=>document.querySelector('#resume-ai-area-host').shadowRoot.querySelector('#status').textContent.includes('已生成整组建议'));
    assert.equal(await page.inputValue('#name'),'');
    const call = await page.evaluate(()=>window.calls[0]);
    assert.equal(call.payload.fields.length,11,'existing and blocked fields excluded from AI request');
    assert.equal(call.payload.fields.find(f=>f.label==='学校').options.includes('测试大学'),true,'owned popup outside region was read');
    assert.equal(JSON.stringify(call).includes('preserve'),false);
    if (process.env.RA_SCREENSHOT) await page.screenshot({path:process.env.RA_SCREENSHOT});
    await panel.locator('#apply').click();
    await page.waitForFunction(()=>document.querySelector('#resume-ai-area-host').shadowRoot.querySelector('#status').textContent.includes('本轮结束'),{},{timeout:20000});
    assert.equal(await page.inputValue('#name'),'Test');
    assert.equal(await page.inputValue('#keep'),'preserve');
    assert.equal(await page.inputValue('#degree'),'ms');
    assert.equal(await page.locator('input[value=f]').isChecked(),true);
    assert.equal(await page.locator('#overseas').isChecked(),true);
    assert.equal(await page.inputValue('#start'),'2024-09-01');
    assert.equal(await page.inputValue('#month'),'2027-07');
    assert.equal(await page.locator('#school').textContent(),'测试大学');
    assert.equal(await page.locator('#origin').textContent(),'河北/唐山');
    assert.equal(await page.inputValue('#missing'),'');
    assert.equal(await page.locator('#consent').isChecked(),false);
    assert.equal(await page.inputValue('#outside'),'outside untouched');
    assert.equal(await page.evaluate(()=>window.submits),0);
    const diagnostic = await page.evaluate(()=>window.saved.latestAreaDiagnostic);
    assert.equal(diagnostic.summary.success,10);
    assert.equal(diagnostic.summary.missing,1);
    assert.equal(diagnostic.summary.unsupported,2);
    assert.equal(JSON.stringify(diagnostic).includes('获奖经历'),false);
    // Individual retry: invalid date precision must not create a day.
    const testResult = await page.evaluate(async r=>{
      const fs=ResumeAreaControls.scan(r); const date=fs.find(f=>f.el.id==='start');
      const rejected=await ResumeAreaControls.write(date,'2025-09',true);
      const f=fs.find(f=>f.el.id==='desc');
      const length=await ResumeAreaControls.write(f,'x'.repeat(13),true);
      document.querySelector('#name').value='Changed after scan';
      const changed=await ResumeAreaControls.write(fs.find(f=>f.el.id==='name'),'Wrong',true);
      return {rejected,length,changed};
    },rect);
    assert.match(testResult.rejected,/精度/); assert.match(testResult.length,/超过/); assert.match(testResult.changed,/变化/);
    const missingRow = panel.locator('.row').nth(11);
    await missingRow.locator('.answer').fill('400');
    await missingRow.locator('.retry').click();
    await page.waitForFunction(()=>document.querySelector('#resume-ai-area-host').shadowRoot.querySelector('#status').textContent.includes('本轮结束'));
    assert.equal(await page.inputValue('#missing'),'400','manual correction can retry a single missing row');
    assert.ok((await page.evaluate(()=>window.saved.latestAreaDiagnostic.fields)).some(f=>f.label==='姓名' && f.state==='failed'),'final audit detects changes in earlier successes');
    // A partial radio selection must not silently uncheck an outside member.
    const firstRadio = await page.locator('input[value=m]').boundingBox();
    const partial = await page.evaluate(r=>ResumeAreaControls.scan(r).map(f=>f.blocked),{left:firstRadio.x-2,top:firstRadio.y-2,right:firstRadio.x+firstRadio.width+2,bottom:firstRadio.y+firstRadio.height+2});
    assert.match(partial[0],/完整框选/);
    await page.keyboard.press('Escape'); assert.equal(await panel.count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: rectangle, complete inventory, native text/select/multiselect/radio/checkbox/date/month, owned portal, cascader, preview, existing protection, consent safety, missing fields, report and guards');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
