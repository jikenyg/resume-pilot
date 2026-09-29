/* PipeChina HCM/Angular. Declaration only: no page or storage access on load. */
(function () {
  'use strict';
  const field = (key, label, type = 'text') => ({ key, label, type, ...(type === 'select' ? { options: ['是', '否'] } : {}) });
  const schema = {
    base: [field('otherOrigin', '其他籍贯'), field('overseasStudent', '是否留学生', 'select'),
      field('householdType', '户口性质'), field('otherHousehold', '其他户口所在地'),
      field('studentOrigin', '生源地（高考生源地）'), field('applicantCategory', '应聘者类别'),
      field('beijingResident', '是否京籍京户', 'select')],
    collections: [{ key: 'pipeExperience', label: '管网：实习/工作/项目经历（按投递顺序整理）', entryLabel: '经历', fields: [
      field('company', '工作单位名称'), field('startDate', '起始时间', 'date'), field('endDate', '结束时间', 'date'),
      field('country', '国家（地区）'), field('province', '省（地区）'), field('city', '城市'),
      field('position', '职位'), field('industry', '所属行业'), field('description', '实习/工作描述', 'textarea'),
      field('socialInsuranceNote', '工作经历及社保信息补充说明', 'textarea'),
    ] }],
    extendCollections: {
      education: [field('country', '学校国家（地区）'), field('province', '学校所在省（地区）'), field('city', '学校所在城市'),
        field('educationType', '教育类型'), field('discipline', '学科门类'), field('qualificationDate', '学历授予日期', 'date'),
        field('diplomaNumber', '学历证书编号'), field('highestEducation', '所有教育类型最高学历标识', 'select'),
        field('highestOfType', '本教育类型最高学历标识', 'select'), field('firstEducation', '是否第一学历', 'select'),
        field('degreeDate', '学位授予日期', 'date'), field('degreeNumber', '学位证书编号'),
        field('highestDegree', '所有教育类型最高学位标识', 'select'), field('highestDegreeOfType', '本教育类型最高学位标识', 'select'),
        field('majorDirection', '专业方向'), field('researchDirection', '研究方向'), field('rankPercent', '专业成绩排名（百分比数字）')],
      familyMember: [field('birthDate', '家庭成员出生日期', 'date'), field('pipechinaEmployee', '是否属于管网集团', 'select')],
      language: [field('firstLanguage', '是否第一外语', 'select')],
      award: [field('otherName', '其他获奖名称'), field('authority', '奖励批准单位')],
      certificate: [field('description', '所获证书说明', 'textarea')],
    },
  };
  // Native HCM keys observed in the snapshot; labels disambiguate changed site schemas.
  const maps = {
    '基本信息': { collection: null, fields: {
      name: ['name', '姓名'], birth: ['birthDate', '出生日期'], gender: ['gender', '性别'], u_Ethnicity: ['nationality', '民族'],
      u_birthplace_id: ['origin', '籍贯'], u_birthplace_other_id: ['otherOrigin', '其他籍贯'], u_Marital_status: ['maritalStatus', '婚姻状况'],
      u_Political_Appearance: ['politicalStatus', '政治面貌'], u_is_international: ['overseasStudent', '是否留学生'],
      u_common_basic: ['householdType', '户口性质'], u_Hukou_location: ['household', '户口所在地'], u_other_Hukou_location: ['otherHousehold', '其他户口所在地'],
      u_origin_place: ['studentOrigin', '生源地（高考生源地）'], u_home_address: ['homeCity', '家庭所在地'], id_type: ['idType', '证件类型'],
      id_number: ['idCard', '证件号码'], height: ['height', '身高(cm)'], weight: ['weight', '体重(kg)'], u_speciality: ['hobby', '爱好特长'],
      u_category: ['applicantCategory', '应聘者类别'], u_health_condition: ['health', '健康状况'], mobile: ['phone', '手机'], email: ['email', '电子邮件'],
      u_obey_transfer: ['acceptAdjustment', '是否服从调剂'], u_is_beijing: ['beijingResident', '是否京籍京户'],
    } },
    '教育经历': { collection: 'education', fields: {
      school: ['school', '学校名称'], begin_date: ['startDate', '入学日期'], end_date: ['endDate', '毕业/预计毕业日期'], u_country: ['country', '国家（地区）'],
      u_province: ['province', '学校所在省（地区）'], u_city: ['city', '学校所在城市'], u_Type_Education: ['educationType', '教育类型'],
      u_Academic_discipline: ['discipline', '学科门类'], u_major: ['major', '专业'], u_Academic_Degree: ['degree', '学历'],
      u_qualification_date: ['qualificationDate', '学历授予日期'], u_Academic_Certificate_Number: ['diplomaNumber', '学历证书编号'],
      is_highest_edu_level: ['highestEducation', '所有教育类型最高学历标识'], u_is_highest_this: ['highestOfType', '本教育类型最高学历标识'],
      is_first_edu_level: ['firstEducation', '是否第一学历'], u_Degree: ['academicDegree', '学位'], u_degree_date: ['degreeDate', '学位授予日期'],
      u_Degree_Certificate_Number: ['degreeNumber', '学位证书编号'], is_highest_degree: ['highestDegree', '所有教育类型最高学位标识'],
      u_is_highest_deg_this: ['highestDegreeOfType', '本教育类型最高学位标识'], major_cate: ['majorDirection', '专业方向'],
      u_research: ['researchDirection', '研究方向'], u_Credit_Grade_Points: ['gpa', '学分绩点'], u_Ranking_Professional: ['rankPercent', '专业成绩排名(%)'], u_Remarks: ['description', '教育背景备注'],
    } },
    '实习/工作/项目经历': { collection: 'pipeExperience', fields: {
      company: ['company', '工作单位名称'], begin_date: ['startDate', '起始时间'], end_date: ['endDate', '结束时间'],
      u_Country: ['country', '国家（地区）'], u_Province: ['province', '省（地区）'], u_City: ['city', '城市'], job: ['position', '职位'],
      u_Industry: ['industry', '所属行业'], work_content: ['description', '实习/工作描述'], u_description_work_experience: ['socialInsuranceNote', '工作经历及社保信息补充说明'],
    } },
    '家庭成员信息': { collection: 'familyMember', fields: { u_appellation: ['relation', '家庭成员称谓'], name: ['name', '家庭成员姓名'],
      u_family_birth_date: ['birthDate', '家庭成员出生日期'], u_political_status: ['politicalStatus', '家庭成员政治面貌'], company: ['company', '家庭成员工作单位'],
      job_title: ['position', '家庭成员职务'], u_is_guanwang: ['pipechinaEmployee', '是否属于管网集团'] } },
    '外语水平': { collection: 'language', fields: { u_Foreign_Language: ['name', '外语语种'], u_Foreign_language_level: ['level', '外语水平'], u_Achievement: ['score', '成绩'], u_first_foreign_Language: ['firstLanguage', '是否第一外语'] } },
    '获奖信息': { collection: 'award', fields: { u_prize_name_campus: ['name', '奖项名称'], u_award_name: ['otherName', '其他获奖名称'], prize_time: ['date', '获奖时间'], u_level: ['level', '奖励级别'], u_Award_Approval_Unit: ['authority', '奖励批准单位'] } },
    '其他资格': { collection: 'certificate', fields: { cert_name: ['name', '证书名称'], cert_time: ['date', '获取证书时间'], cert_unit: ['authority', '资格证书审批单位'], cert_explain: ['description', '所获证书说明'] } },
  };
  const clean = s => String(s || '').replace(/[\s*＊]/g, '');
  const hidden = el => {
    for (let n = el; n?.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.classList.contains('ng-hide') || n.classList.contains('tt-resume-hidden') || n.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.getAttribute('style') || '')) return true;
    }
    return false;
  };
  const match = root => !!root.querySelector('.rec-candidate-resume-pc .rec-resume-detail-child') &&
    (!!root.querySelector('.my-resume-resume [key="u_is_beijing"]') || /国家.*管网/.test(root.querySelector('title')?.textContent || ''));
  const controls = node => [...node.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]),textarea,select')].filter(n => !hidden(n));
  function read(node, els) {
    if (els.length) return els.map(n => {
      if (n.type === 'file') return n.files?.length ? 'uploaded' : '';
      if (['radio', 'checkbox'].includes(n.type)) return n.checked ? n.closest('label')?.textContent.trim() || n.value : '';
      if (n.tagName === 'SELECT') return n.value ? n.selectedOptions[0]?.textContent.trim() : '';
      return n.value || '';
    }).filter(Boolean).join(' / ');
    if (node.matches('.table-header-cell')) return '';
    const text = node.querySelector('.hc-form-control .text')?.textContent.trim() || '';
    return /^(无|--|未填写)$/.test(text) ? '' : text;
  }
  function describe(node, section, index, resume) {
    const key = node.getAttribute('key') || node.getAttribute('col-key');
    const label = clean(node.querySelector('.hc-form-label [ng-bind-html],.hc-form-label,.head-label')?.textContent || key);
    const spec = maps[section], mapped = spec?.fields[key];
    const validMap = mapped && clean(mapped[1]) === label;
    const path = validMap ? (spec.collection ? `${spec.collection}[${index}].${mapped[0]}` : `base.${mapped[0]}`) : '';
    const value = String(validMap ? (spec.collection ? resume.collections?.[spec.collection]?.[index]?.[mapped[0]] : resume.base?.[mapped[0]]) ?? '' : '');
    const els = controls(node);
    const before = read(node, els);
    const required = els.some(n => n.required || n.getAttribute('aria-required') === 'true') || [...node.querySelectorAll('.required')].some(n => !hidden(n));
    let capability = 'ready', reason = '已映射原生控件，填写后会读回验证';
    if (/扫描件|附件|照片/.test(label) || els.some(n => ['file', 'password', 'checkbox'].includes(n.type))) {
      capability = 'manual'; reason = '附件、证件扫描件等需本人上传核对';
    } else if (!path) { capability = 'unmapped'; reason = '字段键或标签与已验证结构不符'; }
    else if (!els.length || node.matches('.table-header-cell')) { capability = 'dynamic'; reason = '展示字段/表头，须打开修改或新增条目后重新检查；必填条件尚不可知'; }
    else if (els.some(n => n.disabled)) { capability = 'manual'; reason = '控件已禁用'; }
    else if (els.some(n => n.readOnly || /请选择/.test(n.placeholder || '') || n.closest('hc-select,hc-date,hc-date-picker,hc-area,[role="combobox"]')) || els.length > 1 && !els.every(n => n.type === 'radio')) {
      capability = 'dynamic'; reason = 'Angular 选择、日期或联动组件需人工选择，缺少编辑态证据';
    }
    let dataStatus = value.trim() ? 'present' : 'missing';
    if (!path) dataStatus = 'unknown';
    if (path === 'base.idCard' && value && (!resume.base?.idType || /身份证/.test(resume.base.idType)) && !/^\d{17}[\dXx]$/.test(value)) { dataStatus = 'invalid'; reason = '身份证号码格式不正确，请核对真实号码'; }
    if (value && /Date$/.test(path)) {
      const parts = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
      const parsed = parts && new Date(`${parts[1]}-${parts[2]}-${parts[3] || '01'}T00:00:00Z`);
      if (!parts || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== `${parts[1]}-${parts[2]}-${parts[3] || '01'}` || path.endsWith('.birthDate') && !parts[3]) {
        dataStatus = 'invalid'; reason = '请核对真实日期；出生日期需完整年月日，其他日期至少需有效年月';
      }
    }
    if (value && /\.(score|rankPercent)$/.test(path) && (!/^\d+(\.\d+)?$/.test(value) || path.endsWith('.rankPercent') && Number(value) > 100)) { dataStatus = 'invalid'; reason = '请填写独立数字成绩/排名百分比，不推断或换算'; }
    if (value && els.some(n => n.maxLength > 0 && value.length > n.maxLength)) { dataStatus = 'invalid'; reason = '内容超过页面字数上限'; }
    return { node, els, value, before, section, label, index, required, path,
      source: path ? `${spec.collection ? globalThis.ResumeShared?.COLLECTION_DEFS.find(c => c.key === spec.collection)?.label || section : '基础信息'} / ${mapped[1]}` : '',
      dataStatus, capability, reason, existing: !!before, partial: false };
  }
  function rowsFor(root, resume) {
    const rows = [];
    for (const sectionNode of root.querySelectorAll('.rec-resume-detail-child')) {
      if (hidden(sectionNode)) continue;
      const section = sectionNode.querySelector('.rec-profile-block-title')?.textContent.trim() || '';
      // Headers describe the empty collection, never count them as an extra
      // record when actual fields are present in the same section.
      const fields = [...sectionNode.querySelectorAll('.hc-form-field[key]')].filter(n => !hidden(n));
      const nodes = fields.length ? fields : [...sectionNode.querySelectorAll('.table-header-cell[col-key]')].filter(n => !hidden(n) && !/^hcm_/.test(n.getAttribute('col-key') || ''));
      const occurrences = new Map();
      for (const node of nodes) {
        const key = node.getAttribute('key') || node.getAttribute('col-key');
        const index = occurrences.get(key) || 0; occurrences.set(key, index + 1);
        rows.push(describe(node, section, index, resume));
      }
      if (!nodes.length) rows.push({ node: sectionNode, els: [], section, label: section === '附件' ? '附件上传' : '尚未展开的条目', index: 0, required: false, path: '', source: '', dataStatus: 'unknown', capability: section === '附件' ? 'manual' : 'dynamic', reason: '须在真实页面打开此区块核对要求', existing: false, partial: false });
    }
    // Preserve whole-record identity, not just individual existing inputs.
    for (const anchor of rows.filter(r => /^(education|pipeExperience|familyMember|language|award|certificate)\[\d+\]\.(name|school|company)$/.test(r.path) && r.before && r.value && clean(r.before) !== clean(r.value))) {
      const prefix = anchor.path.slice(0, anchor.path.indexOf('.') + 1);
      for (const row of rows.filter(r => r.path.startsWith(prefix))) {
        row.capability = 'manual'; row.reason = '此条学校/单位/成员等标识与简历条目不一致，请核对顺序；不混填另一段经历';
      }
    }
    return rows;
  }
  function scan(root, resume) {
    const rows = rowsFor(root, resume).map(({ node, els, value, before, ...row }) => row);
    return { adapter: 'pipechina', total: rows.length, canGuaranteeComplete: false,
      limitation: '管网快照是展示态，表头仅代表第 1 条资料待备，不表示条目已创建。隐藏字段、修改/新增弹窗、必填规则、字典选项和服务器保存结果须在实际页面核对。',
      counts: { missing: rows.filter(r => r.dataStatus === 'missing').length, invalid: rows.filter(r => r.dataStatus === 'invalid').length,
        dynamic: rows.filter(r => r.capability === 'dynamic').length, manual: rows.filter(r => r.capability === 'manual').length, unmapped: rows.filter(r => r.capability === 'unmapped').length }, rows };
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let busy = false;
  async function run(mode, resume, highlight = () => {}) {
    if (busy) return { ok: false, error: '正在填写，请等待完成' };
    if (!['PREVIEW', 'FILL'].includes(mode)) return { ok: false, error: '不支持的操作' };
    if (!match(document)) return { ok: false, error: '当前页面不是已识别的管网表单' };
    busy = true;
    try {
      const report = { mode, adapter: 'pipechina', matched: 0, filled: 0, skipped: 0, dropdownFailed: 0, created: 0, issues: [], aiStatus: 'none' };
      const written = [];
      const verify = row => !row.node.isConnected || row.els.some(n => !n.isConnected) ? '页面重建了字段，请重新检查' :
        read(row.node, row.els) !== row.value ? '读回不一致或被联动清空' : row.els.some(n => n.validity && !n.validity.valid || n.getAttribute('aria-invalid') === 'true') ? '页面字段校验未通过' : '';
      for (const row of rowsFor(document, resume)) {
        if (row.path) report.matched++;
        if (mode === 'PREVIEW') { if (row.path) highlight(row.els[0] || row.node, { label: row.label }); continue; }
        if (row.existing) { report.skipped++; continue; }
        let error = row.capability !== 'ready' || row.dataStatus !== 'present' ? (row.dataStatus === 'missing' ? '简历缺少真实资料；' : '') + row.reason : '';
        if (!error && (!row.node.isConnected || row.els.some(n => !n.isConnected))) error = '页面重建了字段，请重新检查';
        if (!error && read(row.node, row.els)) error = '内容已变化，保留页面新值';
        if (!error) {
          const el = row.els[0];
          if (row.els.every(n => n.type === 'radio')) {
            const candidates = row.els.filter(n => clean(n.closest('label')?.textContent) === clean(row.value));
            if (candidates.length !== 1) error = '单选没有唯一匹配项'; else candidates[0].click();
          } else if (el.tagName === 'SELECT') {
            const candidates = [...el.options].filter(o => !o.disabled && o.text.trim() === row.value);
            if (candidates.length !== 1) error = '下拉没有唯一匹配项';
            else { el.value = candidates[0].value; el.dispatchEvent(new Event('change', { bubbles: true })); }
          } else if (['INPUT', 'TEXTAREA'].includes(el.tagName) && !['file', 'password', 'checkbox'].includes(el.type)) {
            Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, row.value);
            el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
          } else error = '特殊控件需人工处理';
          await pause(50);
          error ||= verify(row);
        }
        if (error) report.issues.push({ label: `${row.section} / 第 ${row.index + 1} 条 / ${row.label}`, reason: error });
        else written.push(row);
      }
      if (mode === 'FILL') {
        await pause(250);
        for (const row of written) { const error = verify(row); if (error) report.issues.push({ label: row.label, reason: error }); else { report.filled++; highlight(row.els[0], { label: row.label }); } }
        const audit = scan(document, resume); report.pendingCount = audit.rows.filter(r => !r.existing).length;
        report.requiredMissing = audit.rows.filter(r => r.required && !r.existing).length;
      }
      return report;
    } finally { busy = false; }
  }
  const registry = globalThis.ResumeSiteAdapters ||= [];
  if (!registry.some(a => a.id === 'pipechina')) registry.push({ id: 'pipechina', name: '国家管网 / HCM Angular', schema, match, scan, run });
})();
