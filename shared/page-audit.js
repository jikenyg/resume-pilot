/* Local-only structural preflight. Imported HTML stays in an inert template.
 * The same section/label/index resolver is used by the Hotjob fill path. */
(function () {
  'use strict';
  const RS = globalThis.ResumeShared;
  const clean = s => String(s || '').replace(/[\s*＊?？]/g, '').trim();
  const sections = {
    '个人基本信息': { name: ['姓名'], acceptAdjustment: ['接受调剂'], interviewCity: ['期望面试城市'],
      gender: ['性别'], height: ['身高（cm）', '身高(cm)'], birthDate: ['出生日期'], country: ['国籍/地区'],
      nationality: ['民族'], maritalStatus: ['婚姻状况'], politicalStatus: ['政治面貌'], idType: ['证件类型'],
      idCard: ['证件号码'], household: ['户口所在地'], origin: ['籍贯城市'], homeCity: ['家庭所在城市'],
      currentCity: ['目前所在地'], educationDegree: ['最高学历'], academicDegree: ['最高学位'],
      school: ['最高学历毕业院校'], nativePlace: ['现居住地'], major: ['最高学历专业'],
      phone: ['手机'], email: ['电子邮箱'], wechat: ['微信'], address: ['通信地址'], postalCode: ['邮编'] },
    '教育信息': { collection: 'education', startDate: ['开始时间'], endDate: ['结束时间'], school: ['学校'], degree: ['学历'], academicDegree: ['学位'], major: ['专业'] },
    '求职意向': { expectedCity: ['期望工作地点'], expectedFunction: ['期望职能'], expectedSalary: ['期望薪酬'] },
    '自我评价': { selfEval: ['评价内容'] },
    '语言能力': { collection: 'language', level: ['英语能力'], score: ['成绩'], date: ['获得时间'] },
    '计算机技能': { collection: 'skill', name: ['技能类别'], level: ['掌握程度'] },
    '奖励活动': { scholarships: ['校内外奖金'], studentWork: ['学生工作'] },
    '家庭关系': { collection: 'familyMember', name: ['姓名'], relation: ['关系'], company: ['工作单位'], politicalStatus: ['政治面貌'], position: ['职位'] },
    '资格证书': { fundQualification: ['是否通过基金从业资格考试'], securitiesQualification: ['是否通过证券从业资格考试'] },
    '项目经验': { collection: 'project', startDate: ['开始时间'], endDate: ['结束时间'], name: ['项目名称'], description: ['项目描述'], responsibilities: ['项目职责'] },
    '情况说明': { regulatorExperience: ['本人是否具有证监会系统从业经历'], familyRegulatorExperience: ['家庭关系中是否有证监会系统工作经历者'] },
  };
  const selector = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]),textarea,select,[role="combobox"],[contenteditable="true"],iframe,canvas';
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  function languageChoices(value) {
    const aliases = [
      ['大学英语四级考试', '四级', 'CET-4', 'CET4', 'CET-4（四级）'],
      ['大学英语六级考试', '六级', 'CET-6', 'CET6', 'CET-6（六级）'],
      ['大学生英语专业四级考试', '专四', 'TEM-4'],
      ['大学生英语专业八级考试', '专八', 'TEM-8'],
      ['雅思考试', '雅思', 'IELTS'], ['托福考试', '托福', 'TOEFL'],
    ];
    return String(value || '').split(/[、,，;；]/).map(s => s.trim()).filter(Boolean)
      .map(s => aliases.find(group => group.some(a => clean(a).toLowerCase() === clean(s).toLowerCase()))?.[0] || s);
  }
  const supported = root => !!root.querySelector('.form-cell .ant-form-item') && !!root.querySelector('.resume-operation-wrap');
  // The same registry selects the offline scanner and the live fill path.
  const adapterFor = root => (globalThis.ResumeSiteAdapters || []).find(adapter => adapter.match(root)) || null;
  function hidden(el) {
    for (let n = el; n?.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true;
    }
    return false;
  }
  function items(root) {
    if (supported(root)) return [...root.querySelectorAll('.form-cell [id]')].filter(n => /^\d+_\d+_\d+$/.test(n.id) && !hidden(n));
    const seen = new Set();
    return [...root.querySelectorAll(selector)].filter(n => !hidden(n)).map(n => n.closest('.ant-form-item,.form-item,fieldset') || n)
      .filter(n => !seen.has(n) && seen.add(n));
  }
  function controls(item) {
    const nodes = item.matches(selector) ? [item] : [...item.querySelectorAll(selector)];
    return [...new Set(nodes.filter(n => !n.matches('.ant-select-search__field')).map(n => n.closest('[role="combobox"]') || n))]
      .filter(n => !hidden(n) || n.type === 'file');
  }
  function resolve(section, label, index, resume) {
    const spec = sections[section];
    let field = spec && Object.keys(spec).find(k => Array.isArray(spec[k]) && spec[k].some(l => clean(l) === clean(label)));
    let collection = spec?.collection;
    if (section === '语言能力' && clean(label) === '其他语言能力') { field = 'otherLanguages'; collection = null; }
    if (section === '资格证书' && clean(label) === '证书名称') { field = 'name'; collection = 'certificate'; }
    if (section === '个人基本信息' && clean(label) === '年龄') {
      const date = resume.base?.birthDate;
      const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
      const today = new Date();
      const parsed = parts && new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
      const valid = parsed && parsed.getFullYear() === +parts[1] && parsed.getMonth() === +parts[2] - 1 && parsed.getDate() === +parts[3] && parsed <= today;
      const age = valid ? today.getFullYear() - +parts[1] - ((today.getMonth() + 1) * 100 + today.getDate() < +parts[2] * 100 + +parts[3] ? 1 : 0) : '';
      return { path: 'base.birthDate', value: String(age), source: '基础信息 / 出生日期（计算周岁）' };
    }
    if (field) {
      const def = collection ? RS.COLLECTION_DEFS.find(c => c.key === collection) : null;
      const fieldDef = (def?.fields || RS.BASE_FIELD_DEFS).find(f => f.key === field);
      return { path: collection ? `${collection}[${index}].${field}` : `base.${field}`,
        value: collection ? resume.collections?.[collection]?.[index]?.[field] : resume.base?.[field],
        source: `${def ? `${def.label} / 第 ${index + 1} 条` : '基础信息'} / ${fieldDef?.label || field}` };
    }
    // Explicit exact custom labels are safe; never fuzzy-match a family name to the applicant.
    const key = `${section} / 第${index + 1}条 / ${label}`;
    const custom = (resume.custom || []).find(c => c.key === key);
    return { path: '', customKey: key, value: custom?.value, source: `自定义字段 / ${key}`, custom: !!custom };
  }
  function read(item, els = controls(item)) {
    const choices = els.filter(n => ['radio', 'checkbox'].includes(n.type));
    if (choices.length) return choices.filter(n => n.checked).map(n => n.closest('label')?.textContent.trim() || '').join('、');
    return els.map(el => {
      if (el.type === 'file') return el.files?.length ? '已上传' : '';
      if (el.matches('[role="combobox"]')) return el.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent.trim() || '';
      if (el.tagName === 'SELECT') return el.value ? el.selectedOptions[0]?.textContent.trim() : '';
      return el.value || '';
    }).filter(Boolean).join(' / ');
  }
  function describe(item, resume, targeted) {
    const section = item.closest('.form-cell')?.querySelector('.tit p')?.textContent.trim() || '未识别区块';
    const label = clean(item.querySelector('.ant-form-item-label label,label')?.textContent || item.labels?.[0]?.textContent || item.getAttribute('aria-label') || item.getAttribute('placeholder') || item.name || '未命名字段');
    const index = Number(item.id?.match(/^\d+_\d+_(\d+)$/)?.[1] || 0);
    const els = controls(item);
    const resolved = targeted ? resolve(section, label, index, resume) : { path: '', source: '此结构尚无经过验证的预检适配', value: '' };
    let value = String(resolved.value ?? '');
    const languageChecks = section === '语言能力' && label === '英语能力' && els.length > 0 && els.every(n => n.type === 'checkbox');
    if (languageChecks) value = languageChoices(value).join('、');
    const required = !!item.querySelector('.ant-form-item-required,[required],[aria-required="true"]') || item.required === true;
    let capability = 'ready', reason = '已建立字段对应关系；实际填写后仍需验收';
    if (!els.length || els.some(n => ['file', 'password'].includes(n.type) || n.type === 'checkbox' && !languageChecks || n.matches('iframe,canvas,[contenteditable]')) || /照片|附件|上传|签名|验证码|协议/.test(label)) {
      capability = 'manual'; reason = '上传、附件或特殊控件需要人工处理';
    } else if (!resolved.path && !resolved.custom) {
      capability = 'unmapped'; reason = '未建立字段映射，补充自定义资料后重新检查';
    } else if (els.some(n => n.disabled || n.getAttribute('aria-disabled') === 'true')) {
      capability = 'manual'; reason = '字段已禁用';
    } else if (els.some(n => n.matches('[role="combobox"],.ant-calendar-picker-input') || n.readOnly || /请选择/.test(n.placeholder || '')) || els.length > 1 && !els.every(n => n.type === 'radio') && !languageChecks) {
      capability = 'dynamic'; reason = els.length > 1 && !els.every(n => n.type === 'radio') ? '组合/联动控件，需要在真实页面验证' : '动态选项或日期提交，需要在真实页面验证';
    }
    let dataStatus = has(value) ? 'present' : 'missing';
    if (languageChecks && value && languageChoices(value).some(v => !els.some(n => clean(n.closest('label')?.textContent) === clean(v)))) {
      dataStatus = 'invalid'; reason = '英语等级与网页可选考试不匹配，请核对';
    }
    const max = els.map(n => n.maxLength).filter(n => n > 0);
    if (value && max.length && value.length > Math.min(...max)) { dataStatus = 'invalid'; reason = '简历内容超过页面字数上限，请精简'; }
    if (resolved.path === 'base.idCard' && value && (!resume.base?.idType || /身份证/.test(resume.base.idType)) && !/^\d{17}[\dXx]$/.test(value)) { dataStatus = 'invalid'; reason = '身份证号码格式不正确，请核对'; }
    if (resolved.path?.endsWith('.score') && value && !/^\d+(\.\d+)?$/.test(value)) { dataStatus = 'invalid'; reason = '成绩需要独立的数字分数'; }
    if (section === '语言能力' && resolved.path?.startsWith('language[') && resume.collections?.language?.[index]?.name && !/^(英语|英文|english)$/i.test(resume.collections.language[index].name.trim())) {
      dataStatus = 'invalid'; reason = '网页要求英语能力，请将对应条目设为英语，不能使用其他语种成绩';
    }
    const before = read(item, els);
    const existing = els.some(n => ['radio', 'checkbox'].includes(n.type)) ? !!before : els.length > 0 && els.every(n => !!read(item, [n]));
    return { item, els, section, label, index, required, ...resolved, value, dataStatus, capability, reason, before, existing, partial: !!before && !existing };
  }
  function scan(root, resume) {
    if (globalThis.ResumeEducationPlan?.shell(root)) {
      const row = { section: '大唐简历', label: '内嵌页面尚未包含在代码中', index: 0, required: false,
        path: '', source: '编辑简历 → 教育经历 → 检查高中至最高学历资料', dataStatus: 'unknown', capability: 'dynamic',
        reason: '当前只有外层导航和 iframe，无法判断内部字段是否能填。请在网页点铅笔或“＋”展开编辑，再用插件“下载当前表单代码”。已有高中用铅笔补齐，新增才用“＋”。', existing: false };
      return { adapter: '大唐 / 外层页面（缺少实际表单）', total: 1, canGuaranteeComplete: false,
        limitation: '尚未读到实际简历表单，缺资料数量未知；0 不代表资料齐全。',
        counts: { missing: 0, invalid: 0, dynamic: 1, manual: 0, unmapped: 0 }, rows: [row] };
    }
    const adapter = adapterFor(root);
    if (adapter) return adapter.scan(root, resume);
    const targeted = supported(root);
    const rows = items(root).map(item => describe(item, resume, targeted));
    // Empty/addable sections contain no field DOM; do not silently count them as covered.
    for (const section of root.querySelectorAll('.form-cell')) {
      const title = section.querySelector('.tit p')?.textContent.trim() || '未命名区块';
      if (!rows.some(r => r.item?.closest('.form-cell') === section) && section.querySelector('.add-more-btn')) rows.push({
        section: title, label: '尚未展开的条目', index: 0, required: false, dataStatus: 'unknown', capability: 'dynamic',
        reason: '点击添加后才会生成字段，需要重新检查', source: '', path: '', existing: false,
      });
    }
    const publicRows = rows.map(({ item, els, value, before, custom, ...row }) => row);
    return { adapter: targeted ? 'Hotjob / Ant Design' : '通用结构（只盘点，未验证映射）',
      total: publicRows.length, canGuaranteeComplete: false,
      limitation: '仅检查当前 HTML 中的字段。隐藏步骤、点击后出现的字段、服务端校验和上传无法据此保证完成。',
      counts: { missing: publicRows.filter(r => r.dataStatus === 'missing').length, invalid: publicRows.filter(r => r.dataStatus === 'invalid').length,
        dynamic: publicRows.filter(r => r.capability === 'dynamic').length, manual: publicRows.filter(r => r.capability === 'manual').length,
        unmapped: publicRows.filter(r => r.capability === 'unmapped').length }, rows: publicRows };
  }
  function fromHTML(html, resume) {
    if (!html.trim() || html.length > 5_000_000) throw Error('请提供不超过 5 MB 的网页 HTML');
    const template = document.createElement('template');
    template.innerHTML = html; // Never attach or clone this template into the live page.
    const report = scan(template.content, resume);
    if (!report.total) throw Error('没有发现表单字段，请复制开发者工具 Elements 中展开后的表单 HTML');
    return report;
  }
  globalThis.ResumePageAudit = { supported, adapterFor, items, controls, describe, read, scan, fromHTML, sections, hidden, languageChoices };
})();
