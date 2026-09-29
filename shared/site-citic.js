/* CITIC public school-resume template. Match native way-data bindings, never login fields. */
(function () {
  'use strict';
  const field = (key, label, type = 'text') => ({ key, label, type, ...(type === 'select' ? { options: ['是', '否'] } : {}) });
  const schema = {
    base: [field('phoneCountryCode', '电话国家／地区代码（按网页选项）'), field('emergencyName', '紧急联络人姓名'), field('emergencyPhone', '紧急联络人手机号'), field('emergencyRelation', '紧急联络人与本人关系'), field('fertilityStatus', '生育状况'), field('jobInfoSource', '获取招聘信息渠道'), field('expectedAnnualSalaryWan', '中信：期望税前年薪（万元）'), field('firstEmployment', '是否初次就业（无劳动关系及社保记录）', 'select'), field('usedLanguages', '常用编程语言', 'textarea'), field('usedDatabases', '常用数据库', 'textarea')],
    collections: [{ key: 'training', label: '培训经历', entryLabel: '培训', fields: [field('name', '培训名称'), field('startDate', '开始时间', 'date'), field('endDate', '结束时间', 'date'), field('organization', '培训机构'), field('certificate', '获得证书'), field('description', '详细描述', 'textarea')] }],
    extendCollections: {
      education: [field('orientated', '是否定向／委培', 'select'), field('learningMode', '学习方式'), field('department', '所在院系'), field('majorCategory', '中信：专业类别（上级/下级）'), field('degreeCategory', '中信：学位类别（上级选项）'), field('degreeCountry', '学位授予国家或地区'), field('graduationMode', '毕业方式'), field('hasSecondDegree', '是否取得第二学位', 'select'), field('secondAcademicDegree', '第二学位'), field('secondMajor', '第二学位所学专业')],
      internship: [field('department', '所在部门')],
      work: [field('employmentType', '用工形式'), field('jobGrade', '职级'), field('administrativeTitle', '正式聘任的行政职务'), field('leavingReason', '离职原因')],
      project: [field('result', '项目成果', 'textarea')],
      language: [field('authority', '语言证书颁发机构')],
      certificate: [field('score', '证书成绩'), field('description', '详细描述', 'textarea')],
      award: [field('category', '奖惩类别（按网页选项）'), field('organization', '奖惩单位')],
      honor: [field('category', '奖惩类别（按网页选项）')],
      familyMember: [field('age', '年龄'), field('phone', '联系电话（无则本人填写“无”）'), field('overseasIdentity', '有无国（境）外身份', 'select'), field('identityCountry', '境外身份的具体国家地区'), field('department', '工作部门')],
    },
  };
  schema.base.push(field('studentOrigin', '生源地（高考户口所在地，省/市）'));
  schema.extendCollections.education.push(field('learningForm', '学习形式'), field('highestEducation', '是否最高学历', 'select'));
  // These are independent factual declarations, never inferred from the resume or defaulted to “否”.
  const declarations = {
    whygqs: ['中信系统员工（含离职、退休）是否有亲属关系', 'select'], whygqscw: ['中信员工亲属姓名与本人关系'],
    QTZKYWHZ: ['本人或过往单位是否曾与中信银行开展业务合作', 'select'], QTZKYWHZREMARK: ['与中信银行业务合作说明'],
    sfyblju: ['是否存在涉嫌违规违纪违法犯罪问题', 'select'], bljums: ['不良记录描述'],
    jgjgygqs: ['与监管机构员工是否有亲属关系', 'select'], jgjgygqscw: ['监管机构员工亲属姓名与本人关系'],
    sfhwgzjl: ['是否具有海外工作经历', 'select'], hwgzjlms: ['海外工作经历描述'],
    ywjwsf: ['本人有无国（境）外身份', 'select'], jtgjdq: ['本人境外身份具体国家或地区'],
    jglzcs: ['本人及家庭成员是否被追究刑事责任或采取留置措施', 'select'], lzgxxm: ['刑事责任／留置情况涉及的亲属姓名与关系'],
    sxbzxr: ['本人及家庭成员是否被列为失信被执行人', 'select'], sxrgxxm: ['失信情况涉及的亲属姓名与关系'],
    bgqtsx: ['是否有需要报告的其他事项', 'select'], qtsx: ['其他需要报告的事项'],
    ryjzxw: ['是否存在从业人员禁止行为', 'select'], jzxwms: ['从业禁止行为描述'],
    zfjgth: ['是否接受过纪检监察／检察／公安／行政执法机关谈话询问讯问', 'select'], ZFJGTHQK: ['有关机关谈话情况'],
    zdbl: ['中信：重大病史（按网页选项，多项用分号分隔）'],
  };
  for (const [key, [label, type]] of Object.entries(declarations)) schema.base.push(field('citic_' + key, '中信声明：' + label, type));
  const specs = {
    grjbxx: { title: '个人基本信息', fields: { a0101: 'name', nationality: 'country', a0213: 'height', a0188cate: 'phoneCountryCode', a0118: 'phone', a0102: 'gender', origin: 'studentOrigin', weight: 'weight', email: 'email', yxsfzjlx: 'idType', a5015: 'idCard', a0103: 'birthDate', a0111: 'household', healthStatus: 'health', urgentConcatName: 'emergencyName', nation: 'nationality', originplace: 'origin', a0105: 'maritalStatus', urgentPhone: 'emergencyPhone', a0210: 'politicalStatus', a0112: 'currentCity', fertilityStatus: 'fertilityStatus', urgentRelation: 'emergencyRelation', a0207: 'hobby', specialty: 'specialty', jobInfoSource: 'jobInfoSource', SFCSJY: 'firstEmployment' } },
    jyjl: { title: '教育经历', collection: 'education', identity: 'school', fields: { xxxs: 'learningForm', orientated: 'orientated', learnMode: 'learningMode', xl: 'degree', highested: 'highestEducation', byyx: 'school', byyxqt: 'school', rxsj: 'startDate', bysj: 'endDate', department: 'department', sxzy: 'major', tradeCategory: 'majorCategory', xw: 'academicDegree', degreeGranting: 'degreeCountry', graduteMode: 'graduationMode', secondDegree: 'hasSecondDegree', secondLearnMajor: 'secondAcademicDegree', secondMajor: 'secondMajor' } },
    sxjl: { title: '实习经历', collection: 'internship', identity: 'company', fields: { rzsj: 'startDate', lzsj: 'endDate', gzdw: 'company', rzbm: 'department', rzgw: 'position', gzms: 'description' } },
    zxjl: { title: '在校经历', collection: 'cadre', identity: 'organization', fields: { start_time: 'startDate', end_tme: 'endDate', dept_name: 'organization', jobs: 'role', job_description: 'description' } },
    gzjl: { title: '工作经历', collection: 'work', identity: 'company', fields: { rzsj: 'startDate', lzsj: 'endDate', gzdw: 'company', ygxs: 'employmentType', rzbm: 'department', rzgw: 'position', zj: 'jobGrade', zw: 'administrativeTitle', lzyy: 'leavingReason', gzms: 'description' } },
    xmjl: { title: '项目经历', collection: 'project', identity: 'name', fields: { startDate: 'startDate', endDate: 'endDate', projName: 'name', contents: 'description', resp: 'responsibilities', projectResult: 'result' } },
    yynl: { title: '语言能力', collection: 'language', identity: 'name', fields: { languages: 'name', languagesqt: 'name', test_type: 'level', testtypeqt: 'level', results: 'score', issuing_authority: 'authority' } },
    zyzgrz: { title: '职业资格认证', collection: 'certificate', identity: 'name', fields: { zyzgzs: 'name', QTZYZGZS: 'name', getTime: 'date', zsbfjg: 'authority', cj: 'score', xxms: 'description' } },
    pxjl: { title: '培训经历', collection: 'training', identity: 'name', fields: { training_name: 'name', start_time: 'startDate', end_time: 'endDate', pxjg: 'organization', hdzs: 'certificate', xxms: 'description' } },
    jcqk: { title: '奖惩情况', collection: 'award', identity: 'name', fields: { a85006: 'category', a813007: 'level', a85005: 'name', a85007: 'date', a813010: 'organization', a813014: 'description' } },
    jtgx: { title: '家庭关系', collection: 'familyMember', identity: 'name', fields: { ybrgx: 'relation', cyxm: 'name', age: 'age', phoneNumber: 'phone', ywjwsf: 'overseasIdentity', jtgjdq: 'identityCountry', gzdw: 'company', gzbm: 'department', gzzw: 'position' } },
    qtzyxx: { title: '其他重要信息', fields: Object.fromEntries(Object.keys(declarations).map(key => [key, 'citic_' + key])) },
  };
  const direct = { a0205: ['expectedAnnualSalaryWan', '期望税前年薪（万元）'], a0202: ['expectedCity', '期望工作地点'], used_language: ['usedLanguages', '常用编程语言'], used_database: ['usedDatabases', '常用数据库'], a0209: ['selfEval', '自我评价'], myZdbs: ['citic_zdbl', '重大病史'] };
  const clean = s => String(s ?? '').replace(/[\s*＊]/g, '');
  const has = s => String(s ?? '').trim() !== '';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const hidden = n => { for (; n?.nodeType === 1; n = n.parentElement) if (n.hidden || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true; return false; };
  const visible = n => !!n && !hidden(n) && (n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden');
  function shell(root) { return !!root.querySelector('iframe#myFram[src*="/CustStyle/zpmhys/addSchoolResume4.html"]'); }
  function match(root) { return shell(root) || !!root.querySelector('#jbxxform [way-data^="grjbxx."]') && !!root.querySelector('#jyjlform [way-action-push="jyjl"]'); }
  function binding(el) {
    const raw = el.getAttribute('way-data') || '';
    const m = /^(\w+)\.(?:(\d+)\.)?(\w+)$/.exec(raw.replace(/\[(\d+)\]/g, '.$1'));
    return m ? { prefix: m[1], field: m[3], index: m[2] === undefined ? null : +m[2] } : null;
  }
  function ordinal(el, bind, root) {
    if (bind.index !== null) return bind.index;
    const key = el.getAttribute('key');
    if (/^\d+$/.test(key || '')) return +key;
    const repeat = el.closest(`[way-repeat="${bind.prefix}"]`);
    const peers = [...root.querySelectorAll(`[way-repeat="${bind.prefix}"]`)];
    return repeat ? Math.max(0, peers.indexOf(repeat)) : 0;
  }
  const level = value => ({ 高中: 0, 中专: 0, 大专: 1, 专科: 1, 本科: 2, 硕士: 3, 硕士研究生: 3, 博士: 4, 博士研究生: 4 }[clean(value)] ?? 99);
  function entries(prefix, resume) {
    const collection = specs[prefix]?.collection;
    const list = (prefix === 'jcqk' ? ['award', 'honor'] : [collection]).flatMap(collection => (resume.collections?.[collection] || []).map((data, index) => ({ data, index, collection })));
    if (prefix === 'jyjl') list.sort((a, b) => level(a.data.degree) - level(b.data.degree) || a.index - b.index);
    return list;
  }
  function read(el) {
    if (el.tagName === 'SELECT') return [...el.selectedOptions].filter(o => o.value && !/^请选择|^选择|^--|^不限$/.test(o.textContent.trim())).map(o => o.textContent.trim()).join('；');
    if (el.type === 'file') return el.files?.length ? '已上传' : '';
    return String(el.value || '').trim();
  }
  const aliases = [['硕士', '硕士研究生'], ['博士', '博士研究生'], ['大专', '大学专科', '专科'], ['本科', '大学本科'], ['四级', 'CET-4', '大学英语四级'], ['六级', 'CET-6', '大学英语六级']];
  const same = (a, b) => clean(a) === clean(b) || aliases.some(g => g.some(x => clean(x) === clean(a)) && g.some(x => clean(x) === clean(b)));
  function options(el, value) { return [...el.options].filter(o => !o.disabled && o.value && same(o.textContent, value)); }
  function label(el) {
    const td = el.closest('td');
    const copy = td?.cloneNode(true);
    copy?.querySelectorAll('input,select,textarea,button,script,.bootstrap-select').forEach(n => n.remove());
    return clean(copy?.textContent).slice(0, 160) || el.getAttribute('data-bv-notempty-message') || el.name || el.id;
  }
  function describe(root, resume) {
    const rows = [], consumed = new Set(), offline = root.nodeType === 11;
    for (const el of root.querySelectorAll('input[way-data],select[way-data],textarea[way-data],#a0205,#a0202,#used_language,#used_database,#a0209,#myZdbs')) {
      if (consumed.has(el)) continue;
      const bind = binding(el), spec = specs[bind?.prefix], extra = direct[el.id];
      const key = extra?.[0] || spec?.fields[bind?.field];
      if (!key) continue; // Internal record identifiers are not applicant fields.
      const slot = spec?.collection ? ordinal(el, bind, root) : 0;
      const source = spec?.collection ? entries(bind.prefix, resume)[slot] : { data: resume.base || {}, index: 0 };
      const index = source?.index ?? slot;
      const path = spec?.collection ? `${source?.collection || spec.collection}[${index}].${key}` : `base.${key}`;
      let value = String(source?.data?.[key] ?? '');
      let els = [el], kind = 'field';
      // The hidden bound input is the model value for its visible, cascading selects.
      if (el.tagName === 'INPUT' && hidden(el) && el.closest('td')?.querySelector('select.dwAreaChange,select.dwSecondChange')) {
        els = [...el.closest('td').querySelectorAll('select.dwAreaChange,select.dwSecondChange')];
        kind = 'cascade'; els.forEach(n => consumed.add(n));
        if (bind?.field === 'xw') value = [source?.data?.degreeCategory, source?.data?.academicDegree].filter(has).join('/');
      } else if (!offline && hidden(el) && !el.matches('select.selectpicker')) continue;
      if (!offline && hidden(els[0]?.closest('td') || els[0]?.parentElement)) continue;
      if (!offline && els.some(n => !visible(n.tagName === 'SELECT' ? n.closest('.bootstrap-select') || n : n))) continue;
      const before = els.map(read), required = els.some(n => n.required || n.hasAttribute('data-bv-notempty-message'));
      const row = { el, els, bind, spec, slot, key, kind, value, before, modelBefore: kind === 'cascade' ? el.value : undefined, section: extra ? (el.id === 'myZdbs' ? '其他重要信息' : extra[1]) : spec.title,
        label: extra?.[1] || label(el), index, path, source: `${spec?.collection ? `${spec.title} / 简历第 ${index + 1} 条` : '基础信息'} / ${extra?.[1] || label(el)}`,
        required, existing: before.length > 0 && before.every(has), partial: before.some(has) && !before.every(has), dataStatus: has(value) ? 'present' : 'missing', capability: 'ready', reason: '按官网字段标识对应，写入后校验' };
      if (kind === 'cascade' || els.some(n => n.tagName === 'SELECT')) { row.capability = 'dynamic'; row.reason = '按已加载字典精确选择，联动项须等下一级加载'; }
      if (els.some(n => n.disabled || n.readOnly)) { row.capability = 'dynamic'; row.reason = '此项由前置选择启用，禁用时跳过'; }
      if (offline && hidden(el)) { row.capability = 'dynamic'; row.reason = '模板中的条件字段，需在实际页面出现／启用后才能填写'; }
      const invalid = reason => { row.dataStatus = 'invalid'; row.reason = reason; };
      if (has(value) && /Date$|^date$/.test(key)) {
        const date = new Date(value + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('本页要求完整有效年月日，不能自动补造日期');
      }
      if (has(value) && key === 'expectedAnnualSalaryWan' && !/^\d+(\.\d{1,2})?$/.test(value)) invalid('请填写税前年薪万元数值，不直接使用月薪或薪资区间');
      if (has(value) && key === 'idCard' && /身份证/.test(resume.base?.idType || '') && !/^\d{17}[\dXx]$/.test(value)) invalid('身份证号码格式不正确');
      if (key === 'highestEducation' && (resume.collections?.education || []).filter(e => e.highestEducation === '是').length > 1) invalid('只能有一条最高学历，请修正重复标记');
      if (has(value) && kind === 'cascade' && value.split(/[\/／>]/).filter(has).length !== els.length) invalid(`请按 ${els.length} 级填写并用 / 分隔；学位需同时补充学位类别`);
      for (const n of els) {
        const limit = n.maxLength > 0 ? n.maxLength : Number(n.getAttribute('data-bv-regexp-message')?.match(/不能超过(\d+)个字符/)?.[1] || 0);
        if (limit && value.length > limit) invalid(`内容超过 ${limit} 字限制，请在简历中精简`);
      }
      rows.push(row);
    }
    // Protect the entire existing record if its identifying value belongs to a different entry.
    for (const row of rows) {
      if (!row.spec?.collection) continue;
      const manual = reason => { row.capability = 'manual'; row.reason = row.dataStatus === 'invalid' ? row.reason + '；' + reason : reason; };
      const ids = rows.filter(r => r.bind?.prefix === row.bind.prefix && r.slot === row.slot && r.key === row.spec.identity);
      const names = ids.flatMap(r => r.before).filter(v => has(v) && !/^其他$/.test(v));
      const expected = entries(row.bind.prefix, resume)[row.slot]?.data?.[row.spec.identity];
      if (names.length && (!has(expected) || names.some(v => !same(v, expected)))) manual('网页已有经历与此条简历名称不一致，请核对顺序，整条保留');
      if (row.bind.prefix === 'jyjl') {
        const degree = entries('jyjl', resume)[row.slot]?.data?.degree;
        if (rows.some(r => r.bind?.prefix === 'jyjl' && r.slot === row.slot && r.key === 'degree' && r.before.some(v => has(v) && !same(v, degree)))) manual('网页已有学历与简历顺序不一致，整条保留；请先核对高中及后续学历顺序');
      }
      if (row.bind.prefix === 'jyjl' && !(resume.collections?.education || []).some(e => clean(e.degree) === '高中')) manual('中信要求从高中开始，请先在简历中补充高中经历');
      if (row.bind.prefix === 'gzjl' && resume.base?.firstEmployment === '是') manual('已声明初次就业，请核对是否应该填写正式工作经历');
    }
    return rows;
  }
  function pack(rows, shellOnly = false) {
    return { adapter: '中信银行 / 校园招聘', total: rows.length, canGuaranteeComplete: false,
      limitation: shellOnly ? '当前为外层页面，实际简历在 myFram 内；请使用插件检查实际页面。' : '已对照官网公开模板。字典、条件字段、服务器保存及附件需在登录页核验；不会点击保存或提交。',
      counts: { missing: rows.filter(r => r.dataStatus === 'missing').length, invalid: rows.filter(r => r.dataStatus === 'invalid').length, dynamic: rows.filter(r => r.capability === 'dynamic').length, manual: rows.filter(r => r.capability === 'manual').length, unmapped: rows.filter(r => r.capability === 'unmapped').length }, rows };
  }
  function scan(root, resume = {}) {
    if (shell(root)) return pack([{ section: '中信银行', label: '实际简历位于内嵌页面', index: 0, path: '', source: '', dataStatus: 'unknown', capability: 'dynamic', reason: '请刷新页面后打开插件，自动定位校园简历内嵌页面；此处的登录、密码和验证码不是简历字段。', required: false, existing: false }], true);
    const rows = describe(root, resume).map(({ el, els, bind, spec, slot, key, kind, value, before, modelBefore, ...row }) => row);
    if (!(resume.collections?.education || []).some(e => clean(e.degree) === '高中')) rows.push({ section: '教育经历', label: '高中经历缺失', index: resume.collections?.education?.length || 0, path: `education[${resume.collections?.education?.length || 0}].degree`, source: '教育经历 / 新增高中条目', required: true, existing: false, dataStatus: 'missing', capability: 'dynamic', reason: '先在简历中补充真实高中学校及起止日期；本页按高中到最高学历的顺序填写' });
    let familyIndex = resume.collections?.familyMember?.length || 0;
    for (const [relation, names] of [['父亲', ['父亲','父']], ['母亲', ['母亲','母']]]) if (!(resume.collections?.familyMember || []).some(e => names.includes(clean(e.relation)))) {
      rows.push({ section: '家庭关系', label: `${relation}资料待补充`, index: familyIndex, path: `familyMember[${familyIndex}].relation`, source: '家庭关系 / 新增成员', required: true, existing: false, dataStatus: 'missing', capability: 'dynamic', reason: '官网要求父母均填写；如有配偶和子女也需如实登记，不自动推测家庭情况' }); familyIndex++;
    }
    const mapped = new Set(describe(root, resume).flatMap(r => [r.el, ...r.els]));
    for (const el of root.querySelectorAll('form input,form select,form textarea')) {
      if (mapped.has(el) || hidden(el) || /^(hidden|file|button|submit|reset|password)$/.test(el.type) || el.closest('.bs-searchbox,.bootstrap-select') && !el.matches('select') || /\.(id|recordId)$/.test(el.getAttribute('way-data') || '')) continue;
      rows.push({ section: '未映射字段', label: label(el), index: 0, path: '', source: '', required: el.required, existing: has(read(el)), dataStatus: 'unknown', capability: 'unmapped', reason: '当前控件未建立准确映射，请核对，未自动填写' });
    }
    for (const el of root.querySelectorAll('input[type="file"]')) if (!hidden(el.closest('form') || el.parentElement)) rows.push({ section: '附件', label: el.id === 'myFile' ? '个人照片' : '简历附件', index: 0, path: '', source: '', required: el.id === 'myFile', existing: !!el.files?.length, dataStatus: 'unknown', capability: 'manual', reason: '请本人选择并核对上传文件' });
    for (const [prefix, spec] of Object.entries(specs)) {
      if (!spec.collection) continue;
      const actual = count(root, prefix), desired = entries(prefix, resume).length;
      if (desired > actual) rows.push({ section: spec.title, label: '待新增经历', index: 0, path: '', source: '', required: false, existing: false, dataStatus: 'unknown', capability: 'dynamic', reason: `网页现有 ${actual} 条，简历 ${desired} 条；填写时按已验证添加按钮补足` });
    }
    return pack(rows);
  }
  function count(root, prefix) {
    const slots = new Set();
    for (const el of root.querySelectorAll('input[way-data],select[way-data],textarea[way-data]')) {
      const b = binding(el);
      if (b?.prefix !== prefix || !specs[prefix].fields[b.field] || hidden(el.closest('td') || el.parentElement)) continue;
      const host = el.tagName === 'SELECT' ? el.closest('.bootstrap-select') || el : el;
      if (root.nodeType !== 11 && !visible(host)) continue;
      slots.add(ordinal(el, b, root));
    }
    return slots.size;
  }
  async function until(predicate, milliseconds = 1400) { const end = Date.now() + milliseconds; do { if (predicate()) return true; await pause(60); } while (Date.now() < end); return false; }
  const issue = (report, row, reason) => report.issues.push({ label: `${row.section} / 第 ${row.index + 1} 条 / ${row.label}`, reason });
  async function expand(resume, report) {
    for (const [prefix, spec] of Object.entries(specs)) {
      if (!spec.collection) continue;
      const desired = entries(prefix, resume).length;
      if (prefix === 'jyjl' && !(resume.collections?.education || []).some(e => clean(e.degree) === '高中')) continue;
      if (describe(document, resume).some(r => r.bind?.prefix === prefix && r.capability === 'manual')) continue;
      while (count(document, prefix) < Math.min(desired, 30)) {
        const buttons = [...document.querySelectorAll(`[way-action-push="${prefix}"]`)].filter(visible);
        if (buttons.length !== 1) break;
        const before = count(document, prefix);
        buttons[0].click();
        if (!await until(() => count(document, prefix) > before)) { report.issues.push({ label: spec.title, reason: '新增未生成可识别的条目，请完成当前条目后重试；已停止继续点击' }); break; }
        report.created++;
      }
    }
  }
  function setValue(el, value) {
    const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  async function select(el, value) {
    if (has(read(el))) return same(read(el), value) ? '' : '已有选项不同，保留原内容';
    if (el.disabled) return '选项仍未启用';
    if (!await until(() => options(el, value).length > 0)) return '字典中没有唯一匹配项或尚未加载，请在页面核对';
    const matches = options(el, value);
    if (matches.length !== 1) return '字典中存在多个同名选项，请手动确认';
    if (has(read(el))) return '等待期间内容已变化，未覆盖';
    setValue(el, matches[0].value);
    await pause(80);
    return same(read(el), value) ? '' : '选择未被页面接受';
  }
  async function write(row) {
    if (row.dataStatus !== 'present') return row.dataStatus === 'missing' ? '简历缺少此项真实资料，请先补充' : row.reason;
    if (row.capability === 'manual') return row.reason;
    if (row.els.some(n => !n.isConnected)) return '页面已重建，请重新填写';
    if (row.els.some((n, i) => read(n) !== row.before[i])) return '扫描后内容已变化，未覆盖';
    if (row.kind === 'cascade') {
      const parts = row.value.split(/[\/／>]/).map(s => s.trim());
      for (let i = 0; i < row.els.length; i++) { const error = await select(row.els[i], parts[i]); if (error) return error; }
      if (!await until(() => has(row.el.value) && row.el.value !== row.modelBefore)) return '联动选项已选，但绑定值尚未同步，请核对后重试';
      return '';
    }
    const el = row.els[0];
    if (el.disabled || el.readOnly) return '前置选择未启用此字段';
    if (el.tagName === 'SELECT') {
      if (el.multiple) {
        const values = row.value.split(/[;；]/).map(s => s.trim()).filter(Boolean);
        const chosen = values.map(v => options(el, v));
        if (!values.length || chosen.some(g => g.length !== 1)) return '多选字典未完整匹配，请按网页选项补充';
        for (const option of el.options) option.selected = chosen.some(g => g[0] === option);
        el.dispatchEvent(new Event('change', { bubbles: true })); return '';
      }
      return select(el, row.value);
    }
    el.focus(); setValue(el, row.value); el.blur();
    return '';
  }
  function verify(row) {
    if (row.els.some(el => !el.isConnected)) return '控件被重建，需要重新核对';
    if (row.kind === 'cascade' && (!row.el.isConnected || !has(row.el.value) || row.el.value === row.modelBefore)) return '联动选项的绑定值未同步或已被清空';
    const expected = row.kind === 'cascade' ? row.value.split(/[\/／>]/).map(s => s.trim()) : [row.value];
    if (row.els.some((el, i) => el.multiple ? JSON.stringify(read(el).split('；').map(clean).sort()) !== JSON.stringify(expected[i].split(/[;；]/).map(clean).sort()) : !same(read(el), expected[i]))) return '写入未保留或被后续联动修改';
    if (row.els.some(el => el.getAttribute('aria-invalid') === 'true' || el.closest('.has-error') || [...(el.closest('td')?.querySelectorAll('.help-block[data-bv-result="INVALID"]') || [])].some(visible))) return '页面校验未通过';
    return '';
  }
  let busy = false;
  async function run(mode, resume = {}, highlight = () => {}) {
    if (shell(document)) return { ok: false, error: '这是中信外层门户。请在插件目标页面选择校园简历内嵌页面，不要在登录窗口填写简历。' };
    if (busy) return { ok: false, error: '正在填写，请等待本次完成' };
    if (!['FILL', 'PREVIEW'].includes(mode)) return { ok: false, error: '不支持的操作' };
    busy = true;
    try {
      const report = { ok: true, mode, adapter: 'citic', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' };
      if (mode === 'FILL') await expand(resume, report);
      // Resolve afresh after each dependency change, rather than retaining a stale disabled-state snapshot.
      const initial = describe(document, resume), queued = new Set(initial.map(r => r.el)), written = [];
      for (const old of initial) {
        const row = describe(document, resume).find(r => r.el === old.el);
        if (!row) continue;
        report.matched++;
        if (mode === 'PREVIEW') { highlight(row.els[0], { label: row.source }); continue; }
        if (row.existing) { report.skipped++; continue; }
        const error = await write(row);
        if (error) { issue(report, row, error); if (row.dataStatus === 'present' && row.capability !== 'manual' && row.els.some(el => el.tagName === 'SELECT')) report.dropdownFailed++; }
        else written.push(row);
        for (const next of describe(document, resume)) if (!queued.has(next.el) && initial.length < 1000) { queued.add(next.el); initial.push(next); }
      }
      if (mode === 'FILL') {
        await pause(200);
        for (const row of written) { const error = verify(row); if (error) issue(report, row, error); else { report.filled++; highlight(row.els[0], { label: row.source }); } }
      }
      report.audit = scan(document, resume);
      report.requiredMissing = report.audit.rows.filter(r => r.required && !r.existing).length;
      report.pendingCount = report.audit.rows.filter(r => !r.existing && r.dataStatus !== 'notApplicable').length;
      report.notice = '已按中信模板处理；请打开预检报告核对待填项，并手动点击各区块保存。未提交申请。';
      return report;
    } finally { busy = false; }
  }
  (globalThis.ResumeSiteAdapters ||= []).push({ id: 'citic', name: '中信银行校园简历', schema, match, shell, scan, run, describe, entries });
})();
