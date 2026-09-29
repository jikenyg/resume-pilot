/* 招聘官网快照适配：经典脚本；载入时只注册，不读写页面或存储。 */
(function () {
  'use strict';
  const field = (key, label, type = 'text') => ({ key, label, type });
  const choice = (key, label, options = ['是', '否']) => ({ key, label, type: 'select', options });
  const schema = {
    base: [
      choice('hasChildren', '有无子女', ['无', '有']), field('childrenCount', '子女数量', 'number'),
      field('preEnrollmentHousehold', '入学前户口所在地（省/市/区）'), choice('householdType', '户口性质', ['非农业户口', '农业户口']),
      choice('overseasStudent', '是否留学生'), field('majorRankTotal', '专业排名/总人数'),
      choice('overseasStudyProcedure', '近期是否办理出国留学手续'), choice('postgraduateExam', '是否考研或考博'),
      choice('huanengRelatives', '是否有四类亲属关系在华能从业'),
      field('cet4Score', 'CET-4 分数'), field('cet6Score', 'CET-6 分数'),
      field('otherLanguageScore', '其他外语等级分数'), field('languageExplanation', '外语水平说明'),
      choice('computerLevel', '计算机等级（官网选项）', ['计算机二级', '计算机三级', '计算机四级', '其他']), field('computerExplanation', '计算机等级说明'),
      field('otherSkills', '其他技能'),
    ],
    collections: [
      { key: 'socialPractice', label: '社会活动及在校实践活动', entryLabel: '活动', fields: [
        field('startDate', '开始时间', 'date'), field('endDate', '结束时间', 'date'),
        choice('practiceType', '实践方式', ['全职', '兼职', '在校活动']), field('description', '工作描述（招聘官网限150字）', 'textarea'),
      ] },
      { key: 'publication', label: '发表文章及专业研究', entryLabel: '文章', fields: [
        field('date', '发布时间', 'date'), field('name', '文章名称'), field('journal', '刊物名称'),
        field('description', '发表及研究情况（招聘官网限150字）', 'textarea'),
      ] },
    ],
    extendCollections: {
      education: [field('duration', '学制'), choice('trainingMode', '培养方式', ['国家统招', '定向培养', '委托培养', '自费', '其他']), field('courses', '所学主要课程', 'textarea'), field('researchDirection', '研究方向', 'textarea')],
      familyMember: [field('birthDate', '出生日期', 'date'), choice('status', '成员状态', ['正常', '已退休', '已故']), choice('huanengEmployment', '是否在华能系统从业'), field('employeeNumber', '华能工号')],
      work: [choice('employmentType', '聘用方式', ['全职', '兼职', '在校活动'])], internship: [choice('employmentType', '聘用方式', ['全职', '兼职', '在校活动'])],
      award: [choice('nature', '获奖性质（与级别分开）', ['个人', '集体']), field('organization', '颁奖单位')],
      honor: [choice('nature', '获奖性质（与级别分开）', ['个人', '集体'])],
    },
  };
  const sections = {
    '基本信息': { fields: { 姓名: 'name', 性别: 'gender', 民族: 'nationality', 出生日期: 'birthDate', 身高: 'height', 体重: 'weight', 政治面貌: 'politicalStatus', 身份证号: 'idCard', 联系电话: 'phone', 婚姻状况: 'maritalStatus', 有无子女: 'hasChildren', 子女数量: 'childrenCount', 籍贯: 'origin', 入学前户口所在地: 'preEnrollmentHousehold', 户口性质: 'householdType', 是否留学生: 'overseasStudent', 毕业学历: 'educationDegree', 毕业院校: 'school', 毕业时间: 'graduationDate', 学位: 'academicDegree', 专业: 'major', '专业排名/总人数': 'majorRankTotal', 近期是否办理出国留学手续: 'overseasStudyProcedure', 是否考研或考博: 'postgraduateExam', 是否服从调剂: 'acceptAdjustment', Email: 'email', 通信地址: 'address' } },
    '受教育情况': { collections: ['education'], fields: { '入学时间-毕业时间': ['startDate', 'endDate'], 学制: 'duration', 学习阶段: 'degree', 毕业院校: 'school', 专业: 'major', 所获学位: 'academicDegree', 培养方式: 'trainingMode', 所学主要课程: 'courses', '研究方向（研究生以上必须填写）': 'researchDirection' } },
    '家庭及社会关系': { collections: ['familyMember'], fields: { 与本人关系: 'relation', 姓名: 'name', 出生日期: 'birthDate', 工作单位: 'company', 职务: 'position', 状态: 'status', 是否在华能系统从业: 'huanengEmployment', 工号: 'employeeNumber' } },
    '在华能从业四类关系情况': { fields: { '是否有配偶、直系血亲、三代以内旁系血亲、近姻亲关系在华能从业': 'huanengRelatives' } },
    '个人技能及兴趣': { fields: { 外语水平: 'language', 'CET-4分数': 'cet4Score', 'CET-6分数': 'cet6Score', 其他等级分数: 'otherLanguageScore', 计算机水平: 'computerLevel', 其他技能: 'otherSkills', 兴趣爱好: 'hobby', 特长: 'specialty' } },
    '工作经历（实习经历）': { collections: ['work', 'internship'], fields: { '入职时间-离职时间': ['startDate', 'endDate'], 机构名称: 'company', 聘用方式: 'employmentType', 职位: 'position', 工作描述: 'description' } },
    '社会活动及在校实践活动': { collections: ['socialPractice'], fields: { '开始时间-结束时间': ['startDate', 'endDate'], 实践方式: 'practiceType', 工作描述: 'description' } },
    '在校期间获奖情况': { collections: ['award', 'honor'], fields: { 获奖时间: 'date', 获奖名称: 'name', 获奖性质: 'nature', 颁奖单位: 'organization', 奖项描述: 'description' } },
    '发表文章及专业研究': { collections: ['publication'], fields: { 发布时间: 'date', 文章名称: 'name', 刊物名称: 'journal', 发表及研究情况: 'description' } },
  };
  const clean = s => String(s ?? '').replace(/[\s*＊:：]/g, '').trim();
  const has = v => v !== undefined && v !== null && String(v).trim() !== '';
  const eq = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function hidden(el) {
    for (let n = el; n?.nodeType === 1; n = n.parentElement) if (n.hidden || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true;
    return false;
  }
  const visible = n => !!n && !hidden(n) && n.getClientRects().length > 0;
  function title(module) {
    const node = module.closest('.block')?.querySelector(':scope > .title');
    const text = node ? [...node.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') : '';
    return clean(text);
  }
  function match(root) {
    return !!root.querySelector('.basicInfoForm .el-form-item') && !!root.querySelector('.contents.resume') &&
      [...root.querySelectorAll('.basicInfo,.commonModule')].some(n => title(n) === '受教育情况');
  }
  const modules = root => [...root.querySelectorAll('.basicInfo,.commonModule')].filter(n => !hidden(n));
  const forms = module => [...module.querySelectorAll('form')].filter(n => !hidden(n));
  function entries(spec, resume) {
    return (spec?.collections || []).flatMap(collection => (resume.collections?.[collection] || []).map((entry, index) => ({ collection, index, entry })));
  }
  function controls(item) {
    return [...item.querySelectorAll('.el-select,.el-cascader,.el-date-editor,input,textarea,select')].filter(n => {
      if (n.matches('input,textarea,select') && n.closest('.el-select,.el-cascader,.el-date-editor')) return false;
      return !hidden(n) || n.type === 'file';
    });
  }
  function read(el) {
    if (!el) return '';
    if (el.matches('.el-select')) return el.querySelector('.el-select__placeholder:not(.is-transparent),.el-select__selected-item:not(.el-select__input-wrapper):not(.is-transparent)')?.textContent.trim() || '';
    if (el.matches('.el-cascader,.el-date-editor')) return el.querySelector('input')?.value || '';
    if (el.type === 'file') return el.files?.length ? '已上传' : '';
    if (['checkbox', 'radio'].includes(el.type)) return el.checked ? '已选择' : '';
    if (el.tagName === 'SELECT') return el.value ? el.selectedOptions[0]?.textContent.trim() || '' : '';
    return el.value || '';
  }
  function definition(collection, key) {
    const shared = globalThis.ResumeShared;
    const defs = collection ? [...(shared?.COLLECTION_DEFS.find(d => d.key === collection)?.fields || []), ...(schema.collections.find(d => d.key === collection)?.fields || []), ...(schema.extendCollections[collection] || [])] : [...(shared?.BASE_FIELD_DEFS || []), ...schema.base];
    return defs.find(d => d.key === key);
  }
  function describe(item, el, section, spec, ordinal, mapped, resume, suffix = '') {
    const label = clean(item.querySelector('.el-form-item__label')?.textContent) || (el?.type === 'file' ? '照片' : '未命名字段');
    const entry = entries(spec, resume)[ordinal];
    const collection = spec?.collections ? entry?.collection || spec.collections[0] : null;
    const index = spec?.collections ? entry?.index ?? ordinal : 0;
    const def = definition(collection, mapped);
    const path = mapped ? collection ? `${collection}[${index}].${mapped}` : `base.${mapped}` : '';
    let value = String((mapped ? collection ? entry?.entry?.[mapped] : resume.base?.[mapped] : '') ?? '');
    if (mapped === 'educationDegree' || mapped === 'degree') value = ({ 大专: '大学专科', 本科: '大学本科', 硕士: '硕士研究生', 博士: '博士研究生' })[value] || value;
    const input = el?.matches('.el-select,.el-cascader,.el-date-editor') ? el.querySelector('input') : el;
    const before = read(el);
    let required = item.classList.contains('is-required') || !!input?.required || input?.getAttribute('aria-required') === 'true';
    if (mapped === 'researchDirection' && /硕士|博士|研究生/.test(String(entry?.entry?.degree || ''))) required = true;
    let capability = 'ready', reason = '已建立字段映射；填写后读回核对';
    if (!el || el.type === 'file' || ['checkbox', 'password'].includes(el.type)) { capability = 'manual'; reason = '照片、协议或特殊控件需本人处理'; }
    else if (!path) { capability = 'unmapped'; reason = '未建立精确字段映射，不自动猜测'; }
    else if (el.matches('.el-cascader')) { capability = 'manual'; reason = '地区/专业级联字典需在真实页面逐级选择，不能只写显示文本'; }
    else if (input?.disabled || el.matches('[aria-disabled="true"]') || el.querySelector('.is-disabled')) { capability = 'dynamic'; reason = '字段当前禁用，需先完成关联字段后重新检查'; }
    else if (el.matches('.el-select,.el-date-editor') || input?.readOnly) { capability = 'dynamic'; reason = '需真实页面提供动态选项或接受日期提交'; }
    let dataStatus = has(value) ? 'present' : 'missing';
    const invalid = message => { dataStatus = 'invalid'; reason = message; };
    if (value && input?.maxLength > 0 && value.length > input.maxLength) invalid(`资料超过页面 ${input.maxLength} 字限制，请自行精简`);
    if (value && (def?.type === 'date' || /Date$/.test(mapped || '') || mapped === 'date')) {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z');
      if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid('日期需真实且完整的 YYYY-MM-DD，不自动补造年月日');
    }
    if (path === 'base.idCard' && value && !/^\d{17}[\dXx]$/.test(value)) invalid('身份证号格式不正确，请核对真实证件');
    if (path === 'base.email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid('邮箱格式不正确');
    if (value && ['cet4Score', 'cet6Score'].includes(mapped) && (!/^\d+$/.test(value) || +value > 710)) invalid('CET 分数应为 0 至 710 的整数');
    if (value && mapped === 'childrenCount' && !/^\d+$/.test(value)) invalid('子女数量应为非负整数');
    if (value && mapped === 'majorRankTotal' && !/^\d+\s*[/／]\s*\d+$/.test(value)) invalid('请填写排名/总人数，不自动把百分比换算为人数');
    return { item, el, input, value, before, section, label: label + suffix, index, ordinal, required, path,
      source: path ? `${collection || '基础信息'}${collection ? ` / 第${index + 1}条` : ''} / ${def?.label || mapped}` : '',
      dataStatus, capability, reason, existing: !!before, partial: false };
  }
  function extra(section, label, path, reason, required = false) {
    return { section, label, path, source: path, index: 0, required, dataStatus: 'unknown', capability: 'dynamic', reason, existing: false, partial: false };
  }
  function rowsFor(root, resume) {
    const rows = [];
    for (const module of modules(root)) {
      const section = title(module) || '未识别区块', spec = sections[section];
      const fs = forms(module);
      for (const [ordinal, form] of fs.entries()) {
        const firstRow = rows.length;
        let previousLabel = '';
        for (const item of [...form.querySelectorAll('.el-form-item')].filter(n => !hidden(n))) {
          const label = clean(item.querySelector('.el-form-item__label')?.textContent);
          let mapped = spec && Object.prototype.hasOwnProperty.call(spec.fields, label) ? spec.fields[label] : undefined;
          if (section === '个人技能及兴趣' && label === '说明') mapped = previousLabel === '计算机水平' ? 'computerExplanation' : previousLabel === '其他等级分数' ? 'languageExplanation' : undefined;
          const els = controls(item);
          if (Array.isArray(mapped)) {
            mapped.forEach((key, i) => rows.push(describe(item, els[i], section, spec, ordinal, key, resume, i ? ' / 结束' : ' / 开始')));
          } else rows.push(describe(item, els.length === 1 ? els[0] : null, section, spec, ordinal, mapped, resume));
          previousLabel = label;
        }
        // Positional mapping must not attach a different record's details to an
        // already populated school, company, relative, award, or date interval.
        const formRows = rows.slice(firstRow);
        if (spec?.collections && formRows.some(r => r.existing && r.value && /\.(school|company|name|degree|startDate|endDate)$/.test(r.path) && !eq(r.before, r.value))) {
          for (const row of formRows) {
            row.capability = 'manual';
            row.reason = '本条经历的已有标识与对应简历条目不一致，请先核对顺序；不把其他经历填入本条';
          }
        }
      }
      if (spec?.collections && (!fs.length || entries(spec, resume).length > fs.length)) {
        const target = entries(spec, resume)[fs.length];
        rows.push(extra(section, '尚未生成的经历条目', `${target?.collection || spec.collections[0]}[${target?.index ?? fs.length}].${Object.values(spec.fields).find(v => typeof v === 'string')}`, '网页条目少于简历条目或区块尚未展开；新增后须重新检查'));
      }
      if (section === '在华能从业四类关系情况' && !eq(resume.base?.huanengRelatives, '否')) rows.push(extra(section, '选择有亲属关系后出现的明细', 'base.huanengRelatives', '快照尚无关系明细；回答后新增字段必须重新预检，不从家庭成员推断声明', true));
    }
    for (const el of root.querySelectorAll('.contents.resume input[type="checkbox"]')) {
      if (el.closest('.el-form-item') || hidden(el)) continue;
      rows.push({ section: '声明与协议', label: '我已阅读并同意', index: 0, required: true, path: '', source: '', dataStatus: 'unknown', capability: 'manual', reason: '阅读条款后由本人勾选，不代替本人同意', existing: el.checked, partial: false, el });
    }
    return rows;
  }
  function publicRow(row) {
    const { section, label, index, required, path, source, dataStatus, capability, reason, existing, partial } = row;
    return { section, label, index, required, path, source, dataStatus, capability, reason, existing, partial };
  }
  function scan(root, resume = {}) {
    const rows = rowsFor(root, resume).map(publicRow);
    return { adapter: 'recruit2', total: rows.length, canGuaranteeComplete: false,
      limitation: '仅核对当前快照结构。照片、协议、级联字典需人工处理；动态选项、关系明细、保存后的服务端校验及条目顺序必须在真实页面复核。',
      counts: { missing: rows.filter(r => r.dataStatus === 'missing').length, invalid: rows.filter(r => r.dataStatus === 'invalid').length, dynamic: rows.filter(r => r.capability === 'dynamic').length, manual: rows.filter(r => r.capability === 'manual').length, unmapped: rows.filter(r => r.capability === 'unmapped').length }, rows };
  }
  async function until(fn, timeout = 1200) {
    const end = Date.now() + timeout;
    do { const result = fn(); if (result) return result; await pause(50); } while (Date.now() < end);
    return null;
  }
  function setInput(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function select(row) {
    const el = row.el;
    const before = new Set([...document.querySelectorAll('.el-select__popper')].filter(visible));
    const trigger = el.querySelector('.el-select__wrapper') || el;
    trigger.click();
    try {
      const panel = await until(() => {
        const id = el.querySelector('[aria-controls]')?.getAttribute('aria-controls');
        const owned = id && document.getElementById(id);
        if (visible(owned)) return owned;
        const added = [...document.querySelectorAll('.el-select__popper')].filter(n => visible(n) && !before.has(n));
        if (added.length !== 1) return null;
        const a = el.getBoundingClientRect(), b = added[0].getBoundingClientRect();
        return Math.abs(a.left - b.left) < 80 && Math.min(Math.abs(a.bottom - b.top), Math.abs(a.top - b.bottom)) < 100 ? added[0] : null;
      });
      if (!panel) return '无法确定当前字段所属的下拉选项，需人工选择';
      const option = () => {
        const hits = [...panel.querySelectorAll('.el-select-dropdown__item,[role="option"]')].filter(n => visible(n) && !n.matches('.is-disabled,[aria-disabled="true"]') && eq(n.textContent, row.value));
        return hits.length === 1 ? hits[0] : null;
      };
      let target = await until(option, 250);
      if (!target && row.input && !row.input.readOnly && !row.input.disabled) {
        row.input.focus(); setInput(row.input, row.value); target = await until(option);
      }
      if (!target) return '没有唯一、完整匹配的真实选项，请按官网选项核对资料';
      target.click();
      return await until(() => eq(read(el), row.value)) ? '' : '下拉选择未被页面接受';
    } finally {
      row.input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      row.input?.blur();
    }
  }
  function verify(row) {
    if (!row.el?.isConnected || !row.item?.isConnected) return '页面重建了字段，请重新检查';
    if (row.input?.validity && !row.input.validity.valid) return '浏览器格式校验未通过';
    if ([...row.item.querySelectorAll('.el-form-item__error,[role="alert"]')].some(n => visible(n) && n.textContent.trim())) return '页面字段校验未通过';
    return eq(read(row.el), row.value) ? '' : '读回不一致或被后续联动清空';
  }
  async function write(row) {
    if (!row.el?.isConnected || !row.item?.isConnected) return row.reason || '字段尚未出现';
    if (!visible(row.el)) return '字段当前不可见，请展开后重新检查';
    if (!eq(read(row.el), row.before)) return '字段内容已变化，本次跳过以保护已有内容';
    if (['manual', 'unmapped'].includes(row.capability)) return row.reason;
    if (row.dataStatus !== 'present') return row.dataStatus === 'invalid' ? row.reason : '简历资料缺失';
    if (row.input?.disabled || row.el.querySelector('.is-disabled')) return '字段当前禁用，需完成联动条件后重新检查';
    if (row.el.matches('.el-select')) return select(row);
    if (row.input?.readOnly) return '控件只读，需人工选择';
    if (row.el.matches('.el-date-editor')) {
      if (!row.input) return '日期输入框不可用';
      row.input.focus(); setInput(row.input, row.value);
      row.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      row.input.blur();
    } else if (row.el.tagName === 'SELECT') {
      const options = [...row.el.options].filter(n => !n.disabled && eq(n.textContent, row.value));
      if (options.length !== 1) return '没有唯一匹配的下拉选项';
      row.el.value = options[0].value; row.el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (row.el.matches('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="password"]),textarea')) {
      row.el.focus(); setInput(row.el, row.value); row.el.blur();
    } else return '控件类型尚未适配';
    return '';
  }
  async function expand(resume, report) {
    for (const module of modules(document)) {
      const section = title(module), spec = sections[section];
      if (!spec?.collections) continue;
      const target = entries(spec, resume).length;
      for (let i = forms(module).length; i < Math.min(target, 50); i++) {
        const button = module.querySelector(':scope > .addBtn');
        if (!visible(button) || clean(button.textContent) !== '新增') break;
        const count = forms(module).length; button.click();
        if (!await until(() => forms(module).length > count)) { report.issues.push({ label: section, reason: '新增未生成条目，需先核对当前条目或手工添加' }); break; }
        report.created++;
      }
    }
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (!['FILL', 'PREVIEW'].includes(mode)) return { ok: false, error: '不支持的操作' };
    if (!match(document)) return { ok: false, error: '当前页面不符合招聘官网结构' };
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    busy = true;
    try {
      const report = { mode, adapter: 'recruit2', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      const rows = rowsFor(document, resume), written = [];
      for (const row of rows) {
        if (row.path) report.matched++;
        if (mode === 'PREVIEW') { if (row.el && row.path) highlight(row.el, { label: row.source }); continue; }
        if (row.existing) { report.skipped++; continue; }
        const error = await write(row);
        await pause(35);
        const failure = error || verify(row);
        if (failure) { report.issues.push({ label: `${row.section} / 第${row.ordinal === undefined ? row.index + 1 : row.ordinal + 1}条 / ${row.label}`, reason: failure }); if (row.el?.matches('.el-select')) report.dropdownFailed++; }
        else written.push(row);
      }
      if (mode === 'FILL') {
        await pause(300);
        for (const row of written) {
          const error = verify(row);
          if (error) report.issues.push({ label: `${row.section} / ${row.label}`, reason: error });
          else { report.filled++; highlight(row.el, { label: row.label }); }
        }
      }
      const audit = scan(document, resume);
      report.requiredMissing = audit.rows.filter(r => r.required && !r.existing).length;
      report.pendingCount = audit.rows.filter(r => !r.existing).length;
      report.audit = audit;
      return report;
    } finally { busy = false; }
  }
  const adapters = globalThis.ResumeSiteAdapters ||= [];
  const adapter = { id: 'recruit2', name: '招聘官网 / Element Plus', schema, match, scan, run };
  const previous = adapters.findIndex(a => a.id === adapter.id);
  if (previous >= 0) adapters[previous] = adapter; else adapters.push(adapter);
})();
