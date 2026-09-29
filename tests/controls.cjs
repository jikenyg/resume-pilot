// Run with Node and playwright available in NODE_PATH. All data is synthetic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>.phoenix-select{width:280px;height:32px;border:1px solid} .phoenix-select__calcEle{display:none}</style>
      <label>最高学历</label><div id="educationDegree" class="phoenix-select"><span class="phoenix-select__calcEle">硕士</span><div class="phoenix-select__placeHolder">请选择</div><ul><li><input class="phoenix-select__input"></li></ul></div>
      <label>健康状况</label><div id="health" class="phoenix-select"><div class="phoenix-select__placeHolder">请选择</div><input class="phoenix-select__input"></div>
      <label>出生日期</label><div id="birthDate" class="phoenix-select"><div class="phoenix-select__placeHolder">请选择</div><input class="phoenix-select__input"></div>
      <label>姓名</label><input id="name"><select id="native"><option>请选择</option><option>本科</option></select>
      <div id="ariaSelect" role="combobox" tabindex="0">请选择</div>
      <input id="idCard" placeholder="证件号码"><input id="score" placeholder="英语等级成绩">
      <button id="unrelated">硕士</button>`);
    await page.evaluate(() => {
      window.allowDegree = true;
      window.acceptSelection = true;
      window.changes = [];
      document.querySelector('#ariaSelect').onclick = () => {
        const list = document.createElement('div');
        list.setAttribute('role', 'listbox');
        for (const text of ['A', 'B']) {
          const option = document.createElement('div');
          option.setAttribute('role', 'option');
          option.textContent = text;
          option.onclick = () => { document.querySelector('#ariaSelect').textContent = text; list.remove(); };
          list.append(option);
        }
        document.body.append(list);
      };
      document.querySelector('#unrelated').onclick = () => { throw Error('clicked unrelated page text'); };
      for (const host of document.querySelectorAll('.phoenix-select')) {
        host.addEventListener('click', () => {
          document.querySelectorAll('.phoenix-selectList, .phoenix-date-picker').forEach(n => n.remove());
          if (host.id === 'birthDate') {
            const picker = document.createElement('div');
            picker.className = 'phoenix-date-picker';
            picker.innerHTML = '<input class="phoenix-calendar-input" placeholder="YYYY/MM/DD">';
            picker.querySelector('input').onkeydown = event => {
              if (event.key !== 'Enter') return;
              host.querySelector('.phoenix-select__tipEle')?.remove();
              const selected = document.createElement('span');
              selected.className = 'phoenix-select__tipEle';
              selected.textContent = event.target.value;
              host.append(selected);
              picker.remove();
            };
            document.body.append(picker);
            return;
          }
          const list = document.createElement('div');
          list.className = 'phoenix-selectList';
          // Same li + label + onClick contract as the public Phoenix selectList implementation.
          const values = host.id === 'health' ? ['健康', '其他'] : window.allowDegree ? ['本科', '硕士研究生', '博士研究生'] : ['本科'];
          for (const value of values) {
            const item = document.createElement('li');
            item.className = 'phoenix-selectList__listItem';
            const label = document.createElement('div');
            label.className = 'phoenix-selectList__singleLabel';
            label.textContent = value;
            item.append(label);
            item.onclick = event => {
              event.stopPropagation();
              if (window.acceptSelection) {
                host.querySelector('.phoenix-select__tipEle')?.remove();
                const selected = document.createElement('span');
                selected.className = 'phoenix-select__tipEle';
                selected.textContent = value;
                host.append(selected);
                window.changes.push([host.id, value]);
              }
              list.remove();
            };
            list.append(item);
          }
          document.body.append(list);
        });
      }
      document.body.addEventListener('click', event => {
        if (event.target === document.body) document.querySelectorAll('.phoenix-selectList, .phoenix-date-picker').forEach(n => n.remove());
      });
      window.chrome = {
        storage: { local: {
          get(keys, callback) { callback(window.testStorage || {}); },
          async set(values) { Object.assign(window.testStorage, values); },
        } },
        runtime: { onMessage: { addListener() {} }, async sendMessage(message) {
          if (message.type === 'AI_MATCH') return { mappings: message.payload.fields.filter(field => /学历/.test(field.label)).map(field => ({ pageField: field.id, value: '硕士研究生', confidence: 0.99 })) };
          return { skipped: true };
        } },
      };
      window.testStorage = { aiConfig: { enabled: false } };
    });
    for (const file of ['shared/schema.js', 'shared/keywords.js', 'content/control-adapters.js', 'content/content.js', 'content/area-controls.js']) {
      await page.addScriptTag({ path: path.join(root, file) });
    }
    assert.equal(await page.evaluate(() => ResumeControlAdapters.read(document.querySelector('#educationDegree'))), '', 'hidden measurement text must not count as selected');
    assert.deepEqual(await page.evaluate(() => ResumeControlAdapters.options(document.querySelector('#educationDegree'))), ['本科', '硕士研究生', '博士研究生']);
    const count = await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { educationDegree: '硕士', health: '健康', native: '本科', name: 'Test Applicant' } }));
    assert.equal(count, 4, 'Phoenix aliases and other controls remain usable');
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { ariaSelect: 'B' } })), 1, 'generic ARIA dropdown retained');
    assert.deepEqual(await page.evaluate(() => window.changes), [['educationDegree', '硕士研究生'], ['health', '健康']]);
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { health: '不存在的选项' } })), 0);
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { idCard: '123', score: '六级' } })), 0, 'all write paths reject invalid sources');
    assert.equal(await page.inputValue('#idCard'), '');
    assert.equal(await page.inputValue('#score'), '');
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { birthDate: '2000-02-29' } })), 1, 'calendar uses its own date input');
    assert.equal(await page.evaluate(() => ResumeControlAdapters.read(document.querySelector('#birthDate'))), '2000/02/29');
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { birthDate: '2001-02-29' } })), 0, 'reject impossible date');
    await page.evaluate(() => {
      document.querySelector('#educationDegree .phoenix-select__tipEle').remove();
      window.allowDegree = false;
      const resume = ResumeShared.emptyResume();
      resume.base.educationDegree = '硕士';
      window.testStorage.resume = resume;
    });
    await page.evaluate(() => ResumeAssistant.run('FILL'));
    const row = page.locator('#resume-assist-pending .ra-confirm-row').filter({ hasText: '最高学历' });
    assert.equal(await row.count(), 1, 'deduplicate Phoenix root and input');
    await row.locator('button').click();
    await page.waitForFunction(() => document.querySelector('#resume-assist-pending .ra-src')?.textContent.includes('未写入'));
    assert.equal(await row.count(), 1, 'failed retry remains visible');
    await page.evaluate(() => { window.allowDegree = true; });
    await row.locator('button').click();
    await page.waitForFunction(() => !document.querySelector('#resume-assist-pending .ra-confirm-row'));
    assert.equal(await page.evaluate(() => ResumeControlAdapters.read(document.querySelector('#educationDegree'))), '硕士研究生');
    await page.evaluate(() => { window.acceptSelection = false; });
    assert.equal(await page.evaluate(() => ResumeAssistant.applyProfile({ fields: { health: '其他' } })), 0, 'a click without committed state is not success');
    await page.evaluate(() => {
      document.querySelector('#educationDegree .phoenix-select__tipEle').remove();
      window.allowDegree = true;
      window.testStorage.aiConfig = { enabled: true, apiKey: 'test-only' };
    });
    await page.evaluate(() => ResumeAssistant.run('FILL'));
    const aiRow = page.locator('#resume-assist-confirm .ra-confirm-row').filter({ hasText: '最高学历' });
    assert.equal(await aiRow.count(), 1);
    await aiRow.locator('[data-a="ok"]').click();
    await page.waitForFunction(() => document.querySelector('#resume-assist-confirm .ra-src')?.textContent.includes('未写入'));
    assert.equal(await aiRow.count(), 1, 'AI confirmation cannot discard a failed row');
    await page.evaluate(() => { window.acceptSelection = true; });
    await page.locator('#resume-assist-confirm [data-act="all"]').click();
    await page.waitForFunction(() => !document.querySelector('#resume-assist-confirm'));
    assert.equal(await page.evaluate(() => ResumeControlAdapters.read(document.querySelector('#educationDegree'))), '硕士研究生');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'constantTest'; host.className = 'phoenix-select';
      host.textContent = '请选择'; document.body.append(host);
      host.onclick = () => {
        const panel = document.createElement('div');
        panel.className = 'constant-main-selector-container';
        panel.innerHTML = '<div class="list-item-container"><span class="icon-container"><svg class="RadioUnchecked" width="20" height="20"></svg></span><span class="item-text-label">测试选项</span></div><div class="selector-footer-button"><button>取消</button><button>确定</button></div>';
        let checked = false;
        panel.querySelector('svg').onclick = () => { checked = true; };
        const buttons = panel.querySelectorAll('button');
        buttons[0].onclick = () => panel.remove();
        buttons[1].onclick = () => {
          if (checked) host.innerHTML = '<span class="phoenix-select__tipEle">测试选项</span>';
          panel.remove();
        };
        document.body.append(panel);
      };
    });
    assert.equal(await page.evaluate(() => ResumeControlAdapters.fill(document.querySelector('#constantTest'), '测试选项')), 'ok', 'tree selector requires icon selection AND scoped confirmation');
    assert.equal(await page.evaluate(() => ResumeControlAdapters.equivalent('CET-6', '六级')), true);
    assert.deepEqual(await page.evaluate(async () => {
      const all = ResumeAreaControls.scan({ left: -100000, top: -100000, right: 100000, bottom: 100000 });
      const date = all.find(f => f.el.id === 'birthDate');
      const degree = all.find(f => f.el.id === 'educationDegree');
      return [await ResumeAreaControls.write(date, '2004-02-29', true), await ResumeAreaControls.write(degree, '本科', true)];
    }), ['', ''], 'area writes reuse Phoenix date and select adapters');
    assert.deepEqual(errors, []);
    console.log('PASS: Phoenix select/date, aliases, hidden/search values, no-match, invalid data, retry and AI confirmation failure/success; native select, ARIA select and text regression');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
