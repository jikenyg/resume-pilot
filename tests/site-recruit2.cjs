const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared/site-recruit2.js'), 'utf8');
const item = (label, control = '<input>', required = true) => `<div class="el-form-item${required ? ' is-required' : ''}"><label class="el-form-item__label">${label}：</label><div class="el-form-item__content">${control}</div></div>`;
const form = content => `<form class="commonForm">${content}</form>`;
const block = (title, content, basic = false) => `<div class="block"><div class="title">${title}* <span class="tip">辅助说明</span></div><div class="${basic ? 'basicInfo' : 'commonModule'}">${basic ? `<form class="basicInfoForm">${content}</form>` : content}</div></div>`;
const combo = (id, selected = '', extra = '') => `<div class="el-select"><div class="el-select__wrapper"><input readonly role="combobox" aria-controls="${id}" ${extra}><div class="el-select__placeholder${selected ? '' : ' is-transparent'}">${selected || '请选择'}</div></div></div>`;
const date = () => '<div class="el-date-editor"><input></div>';
const html = (base = '', education = '', rest = '') => `<div class="contents resume">${block('基本信息', base || item('姓名'), true)}${block('受教育情况', education || form(item('所学主要课程')))}${rest}</div>`;
let cases = 0;
(async () => {
  // A classic-script registration cannot access the DOM or Chrome storage.
  const context = vm.createContext({});
  vm.runInContext('Object.defineProperty(globalThis,"document",{get(){throw Error("load touched DOM")}}); Object.defineProperty(globalThis,"chrome",{get(){throw Error("load touched storage")}})', context);
  vm.runInContext(source, context); vm.runInContext(source, context);
  assert.equal(context.ResumeSiteAdapters.length, 1); cases++;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addScriptTag({ content: source });
    await page.addScriptTag({ path: path.join(root, 'shared/schema.js') });
    await page.evaluate(() => { window.adapter = ResumeSiteAdapters.find(a => a.id === 'recruit2'); window.resume = { base: {}, collections: {} }; });
    const inspect = async (markup, resume) => page.evaluate(({markup,resume}) => {
      const template = document.createElement('template'); template.innerHTML = markup;
      return { match: adapter.match(template.content), audit: adapter.scan(template.content, resume) };
    }, {markup,resume});
    const mapping = await inspect(html(item('姓名') + item('入学前户口所在地') + item('专业排名/总人数') + item('子女数量'),
      form(item('入学时间-毕业时间', date() + date()) + item('研究方向（研究生以上必须填写）', '<textarea></textarea>', false)) + form(item('毕业院校')),
      block('个人技能及兴趣', form(item('外语水平') + item('其他等级分数') + item('说明') + item('计算机水平') + item('说明'))) +
      block('家庭及社会关系', form(item('姓名') + item('出生日期',date()))) +
      block('工作经历（实习经历）', form(item('机构名称')) + form(item('机构名称'))) +
      block('在校期间获奖情况', form(item('获奖名称')) + form(item('获奖名称')))),
      { base: {name:'合成候选人',childrenCount:0,majorRankTotal:'前5%'}, collections: {education:[{degree:'硕士',startDate:'2024-09-01',endDate:'2027-07-01'}, {school:'合成乙校'}], familyMember:[{name:'合成家属'}],work:[{company:'合成甲公司'}],internship:[{company:'合成乙公司'}],award:[{name:'合成奖项'}],honor:[{name:'合成荣誉'}]} });
    assert.equal(mapping.match,true);
    const rows = mapping.audit.rows;
    assert.ok(rows.some(r=>r.path==='education[0].startDate'));
    assert.ok(rows.some(r=>r.path==='education[0].endDate'));
    assert.ok(rows.some(r=>r.path==='education[1].school'));
    assert.ok(rows.some(r=>r.path==='familyMember[0].name'));
    assert.ok(rows.some(r=>r.path==='familyMember[0].birthDate'));
    assert.ok(rows.some(r=>r.path==='internship[0].company'));
    assert.ok(rows.some(r=>r.path==='honor[0].name'));
    assert.ok(rows.find(r=>r.path==='education[0].researchDirection').required);
    assert.equal(rows.find(r=>r.path==='base.childrenCount').dataStatus,'present');
    assert.equal(rows.find(r=>r.path==='base.majorRankTotal').dataStatus,'invalid');
    assert.equal(rows.find(r=>r.path==='base.preEnrollmentHousehold').dataStatus,'missing');
    assert.equal(rows.filter(r=>r.path==='base.languageExplanation').length,1);
    assert.equal(rows.filter(r=>r.path==='base.computerExplanation').length,1);
    assert.equal(rows.filter(r=>r.path==='base.language').length,1);
    assert.equal(JSON.stringify(mapping).includes('合成候选人'),false);
    cases++;

    const invalid = await inspect(html(item('身份证号') + item('出生日期',date()) + item('通信地址','<input maxlength="4">') + item('性别',combo('gender','','disabled')) + item('籍贯','<div class="el-cascader"><input readonly></div>') + item('', '<input type="file">'), '',
      block('个人技能及兴趣', form(item('CET-4分数'))) + block('在华能从业四类关系情况', form(item('是否有配偶、直系血亲、三代以内旁系血亲、近姻亲关系在华能从业'))) + '<label><input type="checkbox">我已阅读并同意</label>'),
      {base:{idCard:'123',birthDate:'2025-02-29',address:'超过长度限制',cet4Score:'999'},collections:{}});
    assert.equal(invalid.audit.counts.invalid,4);
    assert.equal(invalid.audit.rows.find(r=>r.path==='base.gender').capability,'dynamic');
    assert.equal(invalid.audit.rows.find(r=>r.path==='base.origin').capability,'manual');
    assert.ok(invalid.audit.rows.some(r=>r.label==='选择有亲属关系后出现的明细'));
    assert.equal(invalid.audit.rows.find(r=>r.section==='声明与协议').capability,'manual'); cases++;

    // Fully synthetic live fixture. Nothing from the user snapshot is mounted.
    await page.setContent(html(item('姓名') + item('联系电话','<input value="保留已有号码">') + item('性别',combo('gender-options')) + item('出生日期',date()),
      form(item('毕业院校','<input>') + item('入学时间-毕业时间',date()+date())) + '<div class="addBtn">新 增</div>',
      block('个人技能及兴趣',form(item('其他等级分数')+item('说明')+item('计算机水平')+item('说明')))+
      '<label><input type="checkbox">我已阅读并同意</label><button type="button" id="submit">提交</button>'));
    await page.evaluate(() => {
      resume = {base:{name:'合成候选人',phone:'13800000000',gender:'女',birthDate:'2000-02-29',languageExplanation:'外语合成说明',computerExplanation:'计算机合成说明'},collections:{education:[{school:'合成甲校',startDate:'2020-09-01',endDate:'2024-06-01'},{school:'合成乙校',startDate:'2024-09-01',endDate:'2027-06-01'}]}};
      window.submits=0; document.querySelector('#submit').onclick=()=>submits++;
      document.querySelectorAll('form').forEach(f=>f.onsubmit=e=>{e.preventDefault();submits++;});
      document.querySelector('.el-select__wrapper').onclick = () => {
        if(document.getElementById('gender-options')) return;
        const panel=document.createElement('div'); panel.id='gender-options'; panel.innerHTML='<div class="el-select-dropdown__item">女</div><div class="el-select-dropdown__item">女博士</div>';
        panel.firstChild.onclick=()=>{ const s=document.querySelector('.el-select__placeholder');s.classList.remove('is-transparent');s.textContent='女';panel.remove();};document.body.append(panel);
      };
      document.querySelector('.addBtn').onclick=e=>{const f=e.target.previousElementSibling.cloneNode(true); f.querySelectorAll('input').forEach(n=>n.value=''); e.target.before(f);};
    });
    const preview=await page.evaluate(()=>adapter.run('PREVIEW',resume));
    assert.equal(preview.filled,0); assert.equal(await page.locator('.commonModule').first().locator('form').count(),1);
    assert.equal(await page.locator('.basicInfoForm input').first().inputValue(),'');
    const filled=await page.evaluate(()=>adapter.run('FILL',resume));
    assert.equal(filled.created,1);
    assert.equal(await page.locator('.basicInfoForm input').nth(1).inputValue(),'保留已有号码');
    assert.equal(await page.locator('.commonModule').first().locator('form').nth(1).locator('input').first().inputValue(),'合成乙校');
    assert.equal(await page.locator('.el-select__placeholder').textContent(),'女');
    assert.equal(await page.locator('[type=checkbox]').isChecked(),false);
    assert.equal(await page.evaluate(()=>submits),0);
    assert.equal(filled.filled,11);
    assert.equal((await page.evaluate(()=>adapter.run('FILL',resume))).filled,0); cases++;

    // A linked field can change while a prior field is being written.
    await page.setContent(html(item('姓名')+item('联系电话')));
    await page.evaluate(()=>{
      resume={base:{name:'合成候选人',phone:'13800000000'},collections:{}};
      const inputs=document.querySelectorAll('.basicInfoForm input');inputs[0].oninput=()=>inputs[1].value='页面新生成内容';
    });
    const raced=await page.evaluate(()=>adapter.run('FILL',resume));
    assert.equal(raced.filled,1);assert.ok(raced.issues.some(i=>i.reason.includes('内容已变化')));
    await page.evaluate(()=>{
      const inputs=document.querySelectorAll('.basicInfoForm input');inputs[0].oninput=null;inputs.forEach(n=>n.value='');inputs[1].oninput=()=>inputs[0].value='';
    });
    const cleared=await page.evaluate(()=>adapter.run('FILL',resume));
    assert.equal(cleared.filled,1);assert.ok(cleared.issues.some(i=>i.reason.includes('联动清空')));cases++;

    // Text equality alone cannot count a rejected widget as successfully written.
    await page.setContent(html(item('姓名')+item('性别',combo('dupe'))+item('出生日期',date())));
    await page.evaluate(()=>{
      resume={base:{name:'合成候选人',gender:'女',birthDate:'2000-02-29'},collections:{}};
      document.querySelector('.el-select__wrapper').onclick=()=>{
        const panel=document.createElement('div');panel.id='dupe';panel.innerHTML='<div role="option">女</div><div role="option">女</div>';document.body.append(panel);
      };
      document.querySelector('.el-date-editor input').onchange=e=>e.target.value='';
    });
    const rejected=await page.evaluate(()=>adapter.run('FILL',resume));
    assert.equal(rejected.filled,1);assert.ok(rejected.issues.some(i=>i.reason.includes('唯一')));assert.ok(rejected.issues.some(i=>i.reason.includes('读回')));cases++;

    await page.setContent(html(item('姓名','<input value="已填姓名">'),form(item('毕业院校','<input value="别的学校">')+item('所学主要课程'))));
    await page.evaluate(()=>{resume={base:{},collections:{education:[{school:'目标学校',courses:'不能串入别的学校的课程'}]}};});
    const conflict=await page.evaluate(()=>adapter.run('FILL',resume));
    assert.equal(conflict.filled,0);
    assert.equal(await page.locator('.commonForm input').nth(1).inputValue(),'');
    assert.ok(conflict.issues.some(i=>i.reason.includes('核对顺序')));cases++;

    const snapshotPath = process.argv[2];
    if (snapshotPath) {
      const requests=[];page.on('request',r=>requests.push(r.url()));
      const raw=fs.readFileSync(snapshotPath,'utf8');
      const actual=await page.evaluate(raw=>{
        const t=document.createElement('template');t.innerHTML=raw+'<script>globalThis.snapshotExecuted=true</script><img src="https://invalid.example/snapshot-probe">';
        const cascaders=[...t.content.querySelectorAll('.el-cascader')];
        const cascadeEvidence={count:cascaders.length,owned:cascaders.filter(n=>n.matches('[aria-controls],[aria-owns]')||n.querySelector('[aria-controls],[aria-owns]')).length,emptyPanels:[...t.content.querySelectorAll('.el-cascader__dropdown')].filter(n=>!n.querySelector('.el-cascader-node')).length};
        return {match:adapter.match(t.content),audit:adapter.scan(t.content,ResumeShared.sampleResume()),fieldItems:t.content.querySelectorAll('.el-form-item').length,executed:!!globalThis.snapshotExecuted,cascadeEvidence};
      },raw);
      assert.equal(actual.match,true);assert.equal(actual.executed,false);assert.equal(actual.audit.counts.unmapped,0);
      assert.equal(actual.audit.canGuaranteeComplete,false);assert.deepEqual(requests,[]);
      assert.deepEqual(actual.cascadeEvidence,{count:5,owned:0,emptyPanels:2});
      assert.ok(actual.audit.rows.every(r=>!('value'in r)&&!('before'in r)&&!('item'in r)&&!('el'in r)));
      const sections=Object.fromEntries([...new Set(actual.audit.rows.map(r=>r.section))].map(section=>[section,actual.audit.rows.filter(r=>r.section===section).length]));
      console.log(JSON.stringify({snapshot:{fieldItems:actual.fieldItems,total:actual.audit.total,counts:actual.audit.counts,sections,missingPaths:[...new Set(actual.audit.rows.filter(r=>r.dataStatus==='missing').map(r=>r.path))],invalid:actual.audit.rows.filter(r=>r.dataStatus==='invalid').map(r=>({path:r.path,reason:r.reason}))}},null,2));cases++;
    }
    assert.deepEqual(errors,[]);
    console.log(`site-recruit2: ${cases} grouped checks passed`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
