/* Separate Hotjob template. Keeps legacy section mappings and all other sites intact. */
(function () {
  'use strict';
  const f = (key, label, type = 'text') => ({ key, label, type });
  const yn = (key, label) => ({ key, label, type: 'select', options: ['是', '否'] });
  const schema = {
    base: [f('formerName', '曾用名（无则本人填写无）'), f('acceptableCompany', '可接受调剂公司'), f('expectedWorkNature', '期望工作性质'), yn('companyRelatives', '是否有亲属在本次应聘公司任职'), f('hobbiesAndSpecialties', '特长与爱好（合并栏）', 'textarea'), f('applicationDeclaration', '本次应聘个人声明（本人确认后填写原文）', 'textarea')],
    extendCollections: {
      education: [f('city', '学校城市（省/市）'), yn('overseasEducation', '是否为海外及港澳台教育经历')],
      internship: [f('city', '实习地点（省/市）'), f('department', '所在部门'), yn('overseasExperience', '是否为海外及港澳台实习经历')],
      work: [f('city', '工作地点（省/市）'), yn('overseasExperience', '是否为海外及港澳台工作经历')],
      skill: [f('category', '技能上级类别'), f('duration', '技能使用时间（按网页选项）'), { key: 'section', label: '技能所属区块', type: 'select', options: ['计算机技能', '其他技能'] }],
      familyMember: [f('phone', '联系电话')],
    },
  };
  const specs = {
    '基本信息': { fields: { 姓名: 'name', 曾用名: 'formerName', '国籍/地区': 'country', 证件类型: 'idType', 证件号码: 'idCard', 性别: 'gender', 出生日期: 'birthDate', 健康状况: 'health', 民族: 'nationality', '身高(CM)': 'height', 婚姻状况: 'maritalStatus', 政治面貌: 'politicalStatus', 现居住地: 'nativePlace', 户口所在地: 'household', 籍贯: 'origin', 最高学历: 'educationDegree', 最高学位: 'academicDegree', 最高学历毕业时间: 'graduationDate', 最高学历毕业院校: 'school', 专业: 'major', 移动电话: 'phone', 电子邮箱: 'email', 通信地址: 'address', 邮编: 'postalCode', 是否接受分公司岗位调剂: 'acceptAdjustment', 可接受调剂公司: 'acceptableCompany', 微信: 'wechat', 是否通过基金从业资格考试: 'fundQualification', 是否通过证券从业资格考试: 'securitiesQualification' } },
    '求职意向': { fields: { 期望工作性质: 'expectedWorkNature', 期望工作地点: 'expectedCity', 期望薪酬: 'expectedSalary' } },
    '教育经历': { collection: 'education', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 学历: 'degree', 城市: 'city', 是否为海外及港澳台教育经历: 'overseasEducation', 学校: 'school', 学校名称: 'school', 毕业院校: 'school', 专业: 'major', 学位: 'academicDegree', 专业描述: 'description' } },
    '实习经历': { collection: 'internship', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 企业名称: 'company', 实习地点: 'city', 所在部门: 'department', 职位名称: 'position', 工作描述: 'description', 是否为海外及港澳台实习经历: 'overseasExperience' } },
    '工作经历': { collection: 'work', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 企业名称: 'company', 公司名称: 'company', 工作地点: 'city', 所在部门: 'department', 职位名称: 'position', 工作描述: 'description', 是否为海外及港澳台工作经历: 'overseasExperience' } },
    '项目经验': { collection: 'project', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 项目名称: 'name', 项目描述: 'description', 承担职责: 'responsibilities', 项目职责: 'responsibilities' } },
    '奖励活动': { collection: 'award', fields: { 奖励名称: 'name', 奖项名称: 'name', 获奖名称: 'name', 获奖时间: 'date', 获得时间: 'date', 获奖级别: 'level', 奖励级别: 'level', 描述: 'description', 奖励描述: 'description' } },
    '英语能力': { collection: 'language', fields: { 英语证书名称: 'certificate', 成绩: 'score', 获得时间: 'date' } },
    '其他外语能力': { collection: 'language', fields: { 语种: 'name', 外语语种: 'name', 证书名称: 'certificate', 掌握程度: 'proficiency', 成绩: 'score', 获得时间: 'date' } },
    '计算机技能': { collection: 'skill', fields: { 技能类别: 'name', 使用时间: 'duration', 掌握程度: 'level' } },
    '其他技能': { collection: 'skill', fields: { 技能名称: 'name', 掌握程度: 'level', 使用时间: 'duration' } },
    '培训经历': { collection: 'training', fields: { 培训名称: 'name', 培训机构: 'organization', 开始时间: 'startDate', 结束时间: 'endDate', 详细描述: 'description', 培训内容: 'description' } },
    '证书': { collection: 'certificate', fields: { 证书名称: 'name', 获得时间: 'date', 颁发机构: 'authority', 证书描述: 'description' } },
    '家庭关系': { collection: 'familyMember', fields: { 关系: 'relation', 姓名: 'name', 工作单位: 'company', 职位: 'position', 联系电话: 'phone' } },
    '其他信息': { fields: { 是否有亲属在本公司任职: 'companyRelatives' } },
    '特长与爱好': { fields: { 特长与爱好: 'hobbiesAndSpecialties' } },
    '自我评价': { fields: { 评价内容: 'selfEval' } },
    '个人声明': { fields: { '本人承诺以上信息真实无误，如存在不实或隐瞒事项，同意公司取消应聘资格。': 'applicationDeclaration' } },
  };
  const norm = v => String(v ?? '').replace(/[\s*＊?？]/g, '').replace(/（/g, '(').replace(/）/g, ')');
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const P = () => globalThis.ResumePageAudit;
  const H = () => globalThis.ResumeHotjob;
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const visible = n => !!n && !P().hidden(n) && !!n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const aliases = [['硕士', '硕士研究生'], ['博士', '博士研究生'], ['本科', '大学本科'], ['大专', '专科', '大学专科'], ['四级', 'CET-4', '大学英语四级', '大学英语四级考试'], ['六级', 'CET-6', '大学英语六级', '大学英语六级考试']];
  const alternatives = v => aliases.find(g => g.some(a => norm(a) === norm(v))) || [];
  const same = (a, b) => norm(a) === norm(b) || alternatives(b).some(v => norm(a) === norm(v));
  const title = section => norm(section.querySelector('.tit p')?.textContent);
  function match(root) {
    const names = [...root.querySelectorAll('.form-cell')].map(title);
    return !!root.querySelector('.resume-operation-wrap') && names.includes('基本信息') && names.includes('英语能力') && !!root.querySelector('[id="11_100101_0"],[id="11_400_0"]');
  }
  function entries(section, resume) {
    const collection = specs[section]?.collection;
    let list = (section === '奖励活动' ? ['award', 'honor'] : [collection]).flatMap(key => (resume.collections?.[key] || []).map((data, index) => ({ data, index, collection: key })));
    list = list.filter(e => Object.values(e.data).some(has));
    if (section === '计算机技能') list = list.filter(e => e.data.section !== '其他技能');
    if (section === '其他技能') list = list.filter(e => e.data.section === '其他技能');
    if (section === '英语能力') list = list.filter(e => /^(英语|英文|english)$/i.test(e.data.name || '') || !e.data.name && /CET|英语|四级|六级/.test(e.data.certificate || e.data.level || ''));
    if (section === '其他外语能力') list = list.filter(e => has(e.data.name) && !/^(英语|英文|english)$/i.test(e.data.name));
    if (section === '教育经历') {
      const level = v => ({ 高中: 0, 中专: 0, 大专: 1, 专科: 1, 本科: 2, 硕士: 3, 硕士研究生: 3, 博士: 4, 博士研究生: 4 }[norm(v)] ?? 99);
      list.sort((a, b) => level(a.data.degree) - level(b.data.degree) || String(a.data.startDate || '').localeCompare(String(b.data.startDate || '')));
    }
    if (section === '工作经历') list.sort((a, b) => String(b.data.startDate || '').localeCompare(String(a.data.startDate || '')));
    return list;
  }
  function describe(root, resume) {
    return P().items(root).map(item => {
      const row = P().describe(item, resume, false), section = norm(row.section), label = norm(row.label), spec = specs[section], key = spec?.fields[label], slot = row.index;
      const source = spec?.collection ? entries(section, resume)[slot] : { data: resume.base || {}, index: 0 };
      const index = source?.index ?? slot;
      let value = String(source?.data?.[key] ?? '');
      let path = key ? spec.collection ? `${source?.collection || spec.collection}[${index}].${key}` : `base.${key}` : '';
      if (section === '英语能力' && key === 'certificate' && !value && alternatives(source?.data?.level).length) { value = source.data.level; path = `language[${index}].level`; }
      if (key === 'acceptAdjustment') value = ({ 是: '接受', 否: '不接受' })[value] || value;
      if (key === 'hobbiesAndSpecialties' && !value) value = [resume.base?.specialty, resume.base?.hobby].filter(has).filter((v, i, a) => a.indexOf(v) === i).join('；');
      const parts = section === '计算机技能' && key === 'name' ? [source?.data?.category, source?.data?.name].filter(has) : null;
      if (parts && row.els.length > 1) value = parts.join('/');
      Object.assign(row, { section, label, key, slot, index, path, value, source: `${section}${spec?.collection ? ` / 简历第 ${index + 1} 条` : ''} / ${label}`, dataStatus: has(value) ? 'present' : 'missing' });
      if (path && row.capability === 'unmapped') { row.capability = row.els.some(n => n.matches('[role="combobox"],.ant-calendar-picker-input') || /请选择/.test(n.placeholder || '')) ? 'dynamic' : 'ready'; row.reason = '按区块、条目和本地字段对应'; }
      const invalid = reason => { row.dataStatus = 'invalid'; row.reason = reason; };
      if (value && /Date$|^date$/.test(key)) { const date = new Date(value + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('需要完整有效年月日，不自动补造日期'); }
      if (value && ['height', 'score'].includes(key) && !/^\d+(\.\d+)?$/.test(value)) invalid('需要独立数字资料');
      if (value && key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid('邮箱格式不正确');
      const counter = row.item.textContent.match(/\d+\s*\/\s*(\d+)\s*$/);
      const limits = [...row.els.map(n => n.maxLength).filter(n => n > 0), ...(counter ? [+counter[1]] : [])];
      if (value && limits.length && value.length > Math.min(...limits)) invalid('内容超过网页字数限制，请精简对应资料');
      if (key === 'idCard' && value && (!resume.base?.idType || /身份证/.test(resume.base.idType)) && !/^\d{17}[\dXx]$/.test(value)) invalid('身份证号码格式不正确');
      if (row.existing && value && !matchesRow(row)) invalid('网页已有内容与简历不同，请核对后清空需要重填的项');
      return row;
    });
  }
  function matchesRow(row) {
    if (row.els.length > 1 && row.els.every(n => n.matches('[role="combobox"]'))) {
      const parts = row.value.split(/\s*[\/／>]\s*/).filter(Boolean).filter(p => !['中国', '中华人民共和国'].includes(p));
      return parts.length >= row.els.length && row.els.every((n, i) => same(P().read(row.item, [n]), parts[i]));
    }
    return same(row.before, row.value);
  }
  function scan(root, resume) {
    const rows = describe(root, resume).map(({ item, els, value, before, key, slot, ...row }) => row);
    for (const section of root.querySelectorAll('.form-cell')) {
      const name = title(section), count = section.querySelectorAll('.form-cell-inner').length, wanted = entries(name, resume).length;
      if (!count && section.querySelector('.add-more-btn') || wanted > count) rows.push({ section: name, label: count ? `还有 ${wanted - count} 条待展开` : '尚未展开的条目', required: false, existing: false, path: '', source: '', dataStatus: 'unknown', capability: 'dynamic', reason: '有对应简历资料时展开；新增字段须重新检查' });
      if (name === '教育经历' && /高中/.test(section.querySelector('.tit-remark')?.textContent || '') && !(resume.collections?.education || []).some(e => /高中/.test(e.degree))) rows.push({ section: name, label: '高中经历缺失', required: true, existing: false, path: '', source: '教育经历', dataStatus: 'missing', capability: 'manual', reason: '网页要求从高中填起，请补充真实资料' });
    }
    return { adapter: 'Hotjob / 扩展招聘表单', total: rows.length, canGuaranteeComplete: false, limitation: '远程字典、尚未展开或条件显示的字段及服务端保存仍需核对。', rows, counts: Object.fromEntries(['missing', 'invalid', 'dynamic', 'manual', 'unmapped'].map(k => [k, rows.filter(r => r.dataStatus === k || r.capability === k).length])) };
  }
  async function until(fn) { for (let i = 0; i < 25; i++) { const v = fn(); if (v) return v; await pause(80); } return null; }
  async function lookup(row) {
    const el = row.els[0];
    const panels = () => [...document.querySelectorAll('.ant-modal,.ant-select-dropdown,.ant-popover')].filter(visible);
    const old = new Set(panels()); el.click();
    const panel = await until(() => { const added = panels().filter(n => !old.has(n)); return added.length === 1 ? added[0] : null; });
    if (!panel) return '院校或专业选择器未打开，请人工选择';
    try {
      const searches = [...panel.querySelectorAll('input:not([readonly]):not([disabled])')].filter(visible);
      const search = searches.find(n => /搜索|名称|关键字/.test(n.placeholder || '')) || (searches.length === 1 ? searches[0] : null);
      if (search) { search.focus(); H().set(search, row.value); }
      const target = await until(() => {
        const matches = [...panel.querySelectorAll('[role="option"],li,span,div')].filter(n => visible(n) && same(n.textContent, row.value) && ![...n.children].some(c => same(c.textContent, row.value)) && !n.matches('[aria-disabled="true"]'));
        return matches.length === 1 ? matches[0] : null;
      });
      if (!target) return '选择器没有唯一匹配的院校或专业';
      target.click();
      if (!same(el.value, row.value)) {
        const confirm = [...panel.querySelectorAll('button')].find(n => visible(n) && !n.disabled && /^(确定|确认)$/.test(n.textContent.trim()));
        if (confirm) confirm.click();
      }
      return await until(() => same(el.value, row.value)) ? '' : '选择未被页面接受';
    } finally { if (visible(panel)) panel.querySelector('.ant-modal-close')?.click(); }
  }
  async function write(row) {
    if (row.capability === 'manual' || row.capability === 'unmapped' || row.dataStatus !== 'present') return row.dataStatus === 'missing' ? '缺少对应资料，请在编辑简历中补充' : row.reason;
    if (row.els.some(n => !visible(n) || n.disabled || n.closest('.ant-select-disabled'))) return '控件尚未启用';
    if (P().read(row.item, row.els) !== row.before) return '字段内容已变化，已跳过';
    if (row.els.length > 1 && row.els.every(n => n.matches('[role="combobox"]'))) {
      const parts = row.value.split(/\s*[\/／>]\s*/).filter(Boolean).filter(p => !['中国', '中华人民共和国'].includes(p));
      if (parts.length < row.els.length) return '缺少上级类别或地区，请按上级/下级补充资料';
      for (let i = 0; i < row.els.length; i++) {
        const current = P().controls(row.item)[i];
        if (!current?.isConnected) return '联动控件已重建，请重新检查';
        const before = P().read(row.item, [current]);
        if (before && !same(before, parts[i])) return '已有上级选项冲突，未覆盖';
        if (!before) { const error = await H().select(current, parts[i], alternatives(parts[i])); if (error) return error; }
        await pause(150);
      }
      row.els = P().controls(row.item); row.expected = P().read(row.item, row.els); return '';
    }
    if (row.els.length === 1 && row.els[0].matches('[role="combobox"]')) {
      const error = await H().select(row.els[0], row.value, alternatives(row.value));
      if (!error) row.expected = P().read(row.item, row.els);
      return error;
    }
    if (['school', 'major'].includes(row.key) && row.els.length === 1 && row.els[0].tagName === 'INPUT') return lookup(row);
    return H().write(row);
  }
  async function expand(resume, report) {
    for (const section of document.querySelectorAll('.form-cell')) {
      const target = Math.min(entries(title(section), resume).filter(e => Object.values(e.data).some(has)).length, 50);
      const count = () => section.querySelectorAll('.form-cell-inner').length;
      while (count() < target) {
        const button = section.querySelector('.add-more-btn'), before = count();
        if (!visible(button)) break;
        button.click();
        if (!await until(() => count() > before)) { report.issues.push({ label: title(section), reason: '新增未产生条目，请先完成已有条目' }); break; }
        report.created++;
      }
    }
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (busy || !['PREVIEW', 'FILL'].includes(mode) || !match(document)) return { ok: false, error: '表单未就绪或正在填写' };
    busy = true;
    try {
      const report = { mode, adapter: 'hotjob-extended', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' }, written = [], attempted = new Set();
      if (mode === 'FILL') await expand(resume, report);
      for (let pass = 0; pass < 3; pass++) {
        const rows = describe(document, resume), blocked = new Set();
        for (const r of rows) if (specs[r.section]?.collection && r.existing && (!r.value || !matchesRow(r)) && !written.some(w => w.item === r.item)) blocked.add(`${r.section}:${r.slot}`);
        for (const row of rows) {
          const id = `${row.item.id}:${row.label}`;
          if (attempted.has(id)) continue;
          attempted.add(id); if (row.path) report.matched++;
          const issue = reason => report.issues.push({ label: `${row.section} / 第 ${row.slot + 1} 条 / ${row.label}`, reason });
          if (mode === 'PREVIEW') { if (row.path && row.els[0]) highlight(row.els[0], { label: row.source }); continue; }
          if (row.existing) { report.skipped++; if (row.dataStatus === 'invalid') issue(row.reason); continue; }
          if (blocked.has(`${row.section}:${row.slot}`)) { report.skipped++; issue('本条已有资料与简历不一致，停止补填以避免混入其他条目'); continue; }
          let error;
          try { error = await write(row); await pause(50); error ||= H().verify(row); } catch (_) { error = '控件操作未完成，请重新检查'; }
          if (error) { issue(error); if (row.capability === 'dynamic' && row.value) report.dropdownFailed++; } else written.push(row);
        }
        if (mode === 'PREVIEW') break;
      }
      await pause(200);
      for (const row of written) { const error = H().verify(row); if (error) report.issues.push({ label: row.source, reason: error }); else { report.filled++; highlight(row.els[0], { label: row.source }); } }
      report.audit = scan(document, resume);
      report.requiredMissing = report.audit.rows.filter(r => r.required && !r.existing).length;
      report.pendingCount = report.audit.rows.filter(r => !r.existing || r.dataStatus === 'invalid').length;
      return report;
    } finally { busy = false; }
  }
  const adapter = { id: 'hotjob-extended', name: 'Hotjob / 扩展招聘表单', schema, match, scan, run, describe, entries };
  const adapters = globalThis.ResumeSiteAdapters ||= [];
  const index = adapters.findIndex(a => a.id === adapter.id);
  if (index < 0) adapters.push(adapter); else adapters[index] = adapter;
})();
