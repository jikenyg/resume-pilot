const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/citic-school.public.html'), 'utf8');
const scripts = ['shared/site-pipechina.js','shared/site-recruit2.js','shared/site-moka.js','shared/site-citic.js','shared/schema.js','shared/keywords.js','shared/education-plan.js','shared/page-audit.js'];
const control = (prefix, key, tag = 'input', extra = '', content = '') => `<td><div>${key}</div><${tag} key="0" way-data="${prefix}.${key}" ${extra}>${content}${tag === 'input' ? '' : `</${tag}>`}</td>`;
const choices = '<option value="">请选择</option><option value="1">是</option><option value="0">否</option>';
const education = `<div way-repeat="jyjl"><table><tr>${control('jyjl','xl','select','required','<option value="">请选择</option><option value="h">高中</option><option value="b">本科</option><option value="m">硕士研究生</option>')}${control('jyjl','byyx','select','required','<option value="">请选择</option><option value="h">测试高中</option><option value="b">测试本科</option><option value="m">测试硕士</option>')}${control('jyjl','rxsj','input','required')}${control('jyjl','bysj','input','required')}${control('jyjl','highested','select','required',choices)}</tr></table></div>`;
(async () => {
 const browser = await chromium.launch({ channel:'msedge',headless:true });
 try {
  const page = await browser.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.abort());
  for(const file of scripts) await page.addScriptTag({path:path.join(root,file)});
  const stats=await page.evaluate(html=>{
    const template=document.createElement('template');template.innerHTML=html;
    const resume=ResumeShared.emptyResume(); const adapter=ResumeSiteAdapters.find(a=>a.id==='citic');
    const report=ResumePageAudit.fromHTML(html,resume);
    const bad=report.rows.filter(r=>r.path && (r.path.startsWith('base.') ? !ResumeShared.BASE_FIELD_DEFS.some(f=>`base.${f.key}`===r.path) : !ResumeShared.COLLECTION_DEFS.find(c=>c.key===r.path.split('[')[0])?.fields.some(f=>r.path.endsWith('.'+f.key))));
    return {total:report.total,unmapped:report.rows.filter(r=>r.capability==='unmapped'),bad,paths:report.rows.map(r=>r.path),counts:report.counts,labels:report.rows.map(r=>r.label),matched:adapter.match(template.content),guarantee:report.canGuaranteeComplete};
  },fixture);
  assert.ok(stats.matched);assert.ok(stats.total>110);assert.equal(stats.guarantee,false);assert.deepEqual(stats.bad,[]);assert.deepEqual(stats.unmapped,[]);
  for(const path of ['base.expectedAnnualSalaryWan','base.firstEmployment','base.emergencyName','education[0].department','education[0].degreeCountry','familyMember[0].age','base.citic_jglzcs','base.citic_ZFJGTHQK','training[0].name']) assert.ok(stats.paths.includes(path),path);
  const shell=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):'<iframe id="myFram" src="/CustStyle/zpmhys/addSchoolResume4.html?token=secret"></iframe><input id="loginEmail">';
  const outer=await page.evaluate(html=>ResumePageAudit.fromHTML(html,ResumeShared.emptyResume()),shell);
  assert.equal(outer.rows.length,1);assert.equal(outer.rows[0].dataStatus,'unknown');assert.ok(!JSON.stringify(outer).includes('secret'));
  await page.setContent(`<form id="jbxxform"><table><tr>${control('grjbxx','a0101')}${control('grjbxx','urgentConcatName')}</tr></table></form><form id="jyjlform">${education}<span id="add" way-action-push="jyjl">+添加教育经历</span><button id="save">保存</button></form><form id="qwxzform"><input id="a0205"></form><form id="qtzyxxform"><table><tr>${control('qtzyxx','whygqs','select','',choices)}</tr></table></form><input id="loginEmail"><input id="password" type="password">`);
  await page.evaluate(()=>{
    window.resume=ResumeShared.emptyResume();resume.base={name:'测试本人',emergencyName:'测试联系人',expectedSalary:'20000/月',expectedAnnualSalaryWan:'25'};
    resume.collections.education=[
      {degree:'硕士',school:'测试硕士',startDate:'2024-09-01',endDate:'2027-06-30',highestEducation:'是'},
      {degree:'本科',school:'测试本科',startDate:'2020-09-01',endDate:'2024-06-30',highestEducation:'否'},
      {degree:'高中',school:'测试高中',startDate:'2017-09-01',endDate:'2020-06-30',highestEducation:'否'}];
    window.adapter=ResumeSiteAdapters.find(a=>a.id==='citic');window.clicks=0;window.saves=0;
    document.querySelector('#save').onclick=e=>{e.preventDefault();saves++;};
    document.querySelector('#add').onclick=()=>{
      const records=document.querySelectorAll('[way-repeat="jyjl"]'); const clone=records[0].cloneNode(true);
      for(const el of clone.querySelectorAll('[way-data]')){el.setAttribute('key',String(records.length));el.value='';}
      document.querySelector('#add').before(clone);clicks++;
    };
  });
  const preview=await page.evaluate(()=>adapter.run('PREVIEW',resume));
  assert.equal(preview.filled,0);assert.equal(await page.evaluate(()=>clicks),0);assert.equal(await page.locator('[way-data="grjbxx.a0101"]').inputValue(),'');
  const result=await page.evaluate(()=>adapter.run('FILL',resume));
  assert.equal(result.created,2);assert.equal(await page.evaluate(()=>clicks),2);assert.equal(await page.evaluate(()=>saves),0);
  assert.equal(await page.locator('[way-data="grjbxx.a0101"]').inputValue(),'测试本人');
  assert.equal(await page.locator('[way-data="grjbxx.urgentConcatName"]').inputValue(),'测试联系人');
  assert.deepEqual(await page.locator('[way-data="jyjl.xl"]').evaluateAll(els=>els.map(e=>e.selectedOptions[0].textContent)),['高中','本科','硕士研究生']);
  assert.equal(await page.locator('[way-data="qtzyxx.whygqs"]').inputValue(),'','Never infer declarations');
  assert.equal(await page.locator('#a0205').inputValue(),'25');assert.equal(await page.locator('#loginEmail').inputValue(),'');
  assert.ok(!JSON.stringify(result.audit).includes('测试本人'));
  assert.equal((await page.evaluate(()=>adapter.run('FILL',resume))).created,0);
  assert.equal(await page.evaluate(()=>clicks),2);
  // An existing degree must protect a record even when its school is empty.
  await page.evaluate(()=>{const record=document.querySelector('[way-repeat="jyjl"]');record.querySelector('[way-data="jyjl.xl"]').value='m';record.querySelector('[way-data="jyjl.byyx"]').value='';});
  await page.evaluate(()=>adapter.run('FILL',resume));
  assert.equal(await page.locator('[way-data="jyjl.byyx"]').first().inputValue(),'');
  // Missing high school, invalid full dates and duplicate highest flags are surfaced.
  const invalid=await page.evaluate(()=>{
    resume.collections.education=resume.collections.education.slice(0,2);resume.collections.education[0].startDate='2024-09';resume.collections.education[1].highestEducation='是';
    return adapter.scan(document,resume);
  });
  assert.ok(invalid.rows.some(r=>r.label==='高中经历缺失'));
  assert.ok(invalid.rows.some(r=>r.dataStatus==='invalid'&&r.reason.includes('完整有效')));
  // Cascading selects: real change events load children; existing province is preserved.
  await page.setContent(`<form id="jbxxform"><table><tr><td><input way-data="grjbxx.origin" style="display:none"><select class="dwAreaChange" id="province"><option value="p">省甲</option></select><select class="dwAreaChange" id="city"><option value="00">请选择市</option></select></td></tr></table></form><form id="jyjlform"><span way-action-push="jyjl">添加</span></form>`);
  await page.evaluate(()=>{
    resume=ResumeShared.emptyResume();resume.base.studentOrigin='省甲/市乙';
    document.querySelector('#province').onchange=()=>{throw Error('Existing province must not be changed');};
    document.querySelector('#city').add(new Option('市乙','c'));
    document.querySelector('#city').onchange=()=>{document.querySelector('[way-data="grjbxx.origin"]').value='p/c';};
  });
  const cascade=await page.evaluate(()=>adapter.run('FILL',resume));
  assert.equal(await page.locator('#city').inputValue(),'c');assert.equal(cascade.filled,1);
  assert.ok(!JSON.stringify(cascade.audit).includes('p/c'), 'No hidden model values in report');
  await page.evaluate(()=>{document.querySelector('#city').value='00';document.querySelector('#city').onchange=null;document.querySelector('[way-data="grjbxx.origin"]').value='';});
  const unsynced=await page.evaluate(()=>adapter.run('FILL',resume));assert.equal(unsynced.filled,0);assert.ok(unsynced.issues.some(i=>i.reason.includes('绑定值')));
  // No child selection if an existing parent conflicts with the saved address.
  await page.evaluate(()=>{document.querySelector('#city').value='00';resume.base.studentOrigin='省丙/市乙';});
  await page.evaluate(()=>adapter.run('FILL',resume));assert.equal(await page.locator('#city').inputValue(),'00');
  // Later reactions clearing an earlier value are not reported as a successful fill.
  await page.setContent(`<form id="jbxxform"><table><tr>${control('grjbxx','a0101')}${control('grjbxx','email')}</tr></table></form><form id="jyjlform"><span way-action-push="jyjl">添加</span></form>`);
  await page.evaluate(()=>{resume=ResumeShared.emptyResume();resume.base={name:'测试姓名',email:'test@example.invalid'};document.querySelector('[way-data="grjbxx.email"]').onchange=()=>{document.querySelector('[way-data="grjbxx.a0101"]').value='';};});
  const cleared=await page.evaluate(()=>adapter.run('FILL',resume));assert.equal(cleared.filled,1);assert.ok(cleared.issues.some(i=>i.reason.includes('联动')));
  // A conditional detail field revealed by a declared answer is discovered during this run.
  await page.setContent(`<form id="jbxxform"><input way-data="grjbxx.a0101"></form><form id="jyjlform"><span way-action-push="jyjl">添加</span></form><form id="qtzyxxform"><table><tr>${control('qtzyxx','whygqs','select','',choices)}<td id="detail" hidden><input way-data="qtzyxx.whygqscw"></td></tr></table></form>`);
  await page.evaluate(()=>{resume=ResumeShared.emptyResume();resume.base.citic_whygqs='是';resume.base.citic_whygqscw='本人确认的测试关系';document.querySelector('[way-data="qtzyxx.whygqs"]').onchange=()=>{document.querySelector('#detail').hidden=false;};});
  await page.evaluate(()=>adapter.run('FILL',resume));assert.equal(await page.locator('[way-data="qtzyxx.whygqscw"]').inputValue(),'本人确认的测试关系');
  // Award/honor records keep their original data paths; missing parents are preparation issues.
  const combined=await page.evaluate(()=>{
    resume.collections.award=[{name:'竞赛'}];resume.collections.honor=[{name:'荣誉'}];
    return {entries:adapter.entries('jcqk',resume).map(e=>[e.collection,e.index]),parents:adapter.scan(document,resume).rows.filter(r=>r.section==='家庭关系').map(r=>r.path)};
  });
  assert.deepEqual(combined.entries,[['award',0],['honor',0]]);assert.deepEqual(combined.parents,['familyMember[0].relation','familyMember[1].relation']);
  await page.addScriptTag({path:path.join(root,'popup/frame-router.js')});
  await page.setContent('<iframe id="myFram" src="/CustStyle/zpmhys/addSchoolResume4.html"></iframe><input id="loginEmail">');
  const routing=await page.evaluate(async()=>{
    window.ResumeAssistant={};window.chrome={scripting:{executeScript:async({func})=>[{frameId:0,documentId:'outer',result:func()}]}};
    const outer=(await ResumeFrameRouter.list(1))[0];
    return {shell:outer.shell,adapter:outer.adapter,chosen:ResumeFrameRouter.choose([outer,{frameId:8,documentId:'inner',ready:true,controls:12,adapter:'citic'}]).frameId};
  });
  assert.deepEqual(routing,{shell:true,adapter:'citic',chosen:8});
  assert.deepEqual(errors,[]);
  console.log('PASS CITIC: public template '+stats.total+' audit items; exact paths, outer-frame exclusion, high-school-first expansion, repeat protection, cascades, declarations, salary units, date validation and final readback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message.slice(0,2000));process.exitCode=1;});
