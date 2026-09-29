/**
 * 简历助手 —— 简历数据模型与默认值
 *
 * 本文件以"经典脚本"方式挂载到 globalThis.ResumeShared。
 * 它既被 content script（隔离环境）引入，也被 popup/options 页面引入，
 * 因此不使用 ES module 的 import/export，而是通过全局命名空间共享。
 *
 * 数据结构：
 *   resume = {
 *     base: { [fieldKey]: value },        // 单值基础字段（姓名、手机、学历…）
 *     collections: { [collKey]: [entry] },// 多值集合（教育、工作、项目、获奖…）
 *     selection: { collection, index },    // 当前"正在编辑/正在填"的集合条目
 *   }
 *
 * 填充时通过 buildFillMap() 把上面这两层拍平成一个 { fillKey: value } 字典，
 * filler 只需要对着这个字典匹配填值，不用关心字段来自 base 还是某个集合条目。
 */
(function () {
  'use strict';

  const APP = 'ResumeShared';

  // ---------------------------------------------------------------------------
  // 基础字段定义（用于 options 编辑器渲染 + popup 展示）
  // type: text | number | date | select | textarea
  // options: select 专用的候选项
  // ---------------------------------------------------------------------------
  const BASE_FIELD_DEFS = [
    { key: 'name',           label: '姓名',        type: 'text' },
    { key: 'englishName',    label: '英文名',      type: 'text' },
    { key: 'gender',         label: '性别',        type: 'select', options: ['男', '女'] },
    { key: 'phone',          label: '手机号',      type: 'text' },
    { key: 'wechat',         label: '微信号',      type: 'text' },
    { key: 'qq',             label: 'QQ号',        type: 'text' },
    { key: 'email',          label: '邮箱',        type: 'text' },
    { key: 'birthDate',      label: '出生日期',    type: 'date' },
    { key: 'idCard',         label: '身份证号',    type: 'text' },
    { key: 'nationality',    label: '民族',        type: 'text' },
    { key: 'household',      label: '户籍',        type: 'text' },
    { key: 'origin',         label: '籍贯',        type: 'text' },
    { key: 'nativePlace',    label: '居住地',      type: 'text' },
    { key: 'currentCity',    label: '现居城市',    type: 'text' },
    { key: 'address',        label: '家庭住址',    type: 'text' },
    { key: 'postalCode',     label: '邮政编码',    type: 'text' },
    { key: 'height',         label: '身高(cm)',    type: 'number' },
    { key: 'weight',         label: '体重(kg)',    type: 'number' },
    { key: 'bloodType',      label: '血型',        type: 'select', options: ['A型', 'B型', 'AB型', 'O型', '其他'] },
    { key: 'maritalStatus',  label: '婚姻状况',    type: 'select', options: ['未婚', '已婚', '离异'] },
    { key: 'politicalStatus',label: '政治面貌',    type: 'select', options: ['中共党员', '共青团员', '群众', '民主党派'] },
    { key: 'health',         label: '健康状况',    type: 'text' },
    { key: 'hobby',          label: '兴趣爱好',    type: 'text' },
    { key: 'specialty',      label: '特长',        type: 'text' },
    { key: 'educationDegree',label: '最高学历',    type: 'select', options: ['高中', '大专', '本科', '硕士', '博士'] },
    { key: 'school',         label: '毕业院校',    type: 'text' },
    { key: 'major',          label: '专业',        type: 'text' },
    { key: 'graduationDate', label: '毕业时间',    type: 'date' },
    { key: 'enrollmentDate', label: '入学时间',    type: 'date' },
    { key: 'language',       label: '外语语种',    type: 'text' },
    { key: 'languageLevel',  label: '外语等级',    type: 'select', options: ['四级', '六级', '专四', '专八', '雅思', '托福'] },
    { key: 'techSkills',     label: '计算机技能',  type: 'textarea' },
    { key: 'selfEval',       label: '自我评价',    type: 'textarea' },
    { key: 'jobIntention',   label: '求职意向',    type: 'text' },
    { key: 'availableTime',  label: '到岗时间',    type: 'text' },
    { key: 'expectedSalary', label: '期望薪资',    type: 'text' },
    { key: 'personalSite',   label: '个人主页',    type: 'text' },
    { key: 'honorList',        label: '荣誉/获奖成果', type: 'textarea' },
    { key: 'competitionResults',label: '竞赛成果',     type: 'textarea' },
    { key: 'campusExperience', label: '校园经历',     type: 'textarea' },
    { key: 'paper',          label: '论文/科研成果', type: 'textarea' },
    { key: 'family',         label: '家庭情况',      type: 'textarea' },
    { key: 'country', label: '国籍/地区', type: 'text' },
    { key: 'idType', label: '证件类型', type: 'text' },
    { key: 'academicDegree', label: '最高学位（与学历分开）', type: 'text' },
    { key: 'acceptAdjustment', label: '接受调剂', type: 'select', options: ['是', '否'] },
    { key: 'interviewCity', label: '期望面试城市', type: 'text' },
    { key: 'homeCity', label: '家庭所在城市（省/市）', type: 'text' },
    { key: 'expectedCity', label: '期望工作地点', type: 'text' },
    { key: 'expectedFunction', label: '期望职能', type: 'text' },
    { key: 'scholarships', label: '校内外奖金/奖学金', type: 'textarea' },
    { key: 'studentWork', label: '学生工作', type: 'textarea' },
    { key: 'otherLanguages', label: '其他语言能力', type: 'textarea' },
    { key: 'fundQualification', label: '是否通过基金从业资格考试', type: 'select', options: ['是', '否'] },
    { key: 'securitiesQualification', label: '是否通过证券从业资格考试', type: 'select', options: ['是', '否'] },
    { key: 'regulatorExperience', label: '本人是否具有证监会系统从业经历', type: 'select', options: ['是', '否'] },
    { key: 'familyRegulatorExperience', label: '家庭关系中是否有证监会系统工作经历者', type: 'select', options: ['是', '否'] },
  ];

  // ---------------------------------------------------------------------------
  // 集合定义
  // 每个集合由若干条目组成，每个条目是一组字段。
  // ---------------------------------------------------------------------------
  const COLLECTION_DEFS = [
    {
      key: 'education', label: '教育经历', entryLabel: '学校',
      fields: [
        { key: 'school',       label: '学校名称',  type: 'text' },
        { key: 'major',        label: '专业',      type: 'text' },
        { key: 'degree',       label: '学历',      type: 'select', options: ['高中', '大专', '本科', '硕士', '博士'] },
        { key: 'startDate',    label: '开始时间',  type: 'date' },
        { key: 'endDate',      label: '结束时间',  type: 'date' },
        { key: 'gpa',          label: 'GPA/成绩',  type: 'text' },
        { key: 'academicDegree', label: '学位', type: 'text' },
        { key: 'rank',         label: '排名',      type: 'text' },
        { key: 'description',  label: '在校经历',  type: 'textarea' },
      ],
    },
    {
      key: 'cadre', label: '干部任职经历（在校职务）', entryLabel: '职务',
      fields: [
        { key: 'organization', label: '组织/学院',  type: 'text' },
        { key: 'role',         label: '职务',       type: 'text' },
        { key: 'startDate',    label: '开始时间',   type: 'date' },
        { key: 'endDate',      label: '结束时间',   type: 'date' },
        { key: 'description',  label: '工作内容',   type: 'textarea' },
      ],
    },
    {
      key: 'work', label: '工作经历', entryLabel: '公司',
      fields: [
        { key: 'company',     label: '公司名称',  type: 'text' },
        { key: 'position',    label: '职位',      type: 'text' },
        { key: 'department',  label: '部门',      type: 'text' },
        { key: 'startDate',   label: '开始时间',  type: 'date' },
        { key: 'endDate',     label: '结束时间',  type: 'date' },
        { key: 'description', label: '工作内容',  type: 'textarea' },
      ],
    },
    {
      key: 'internship', label: '实习经历', entryLabel: '公司',
      fields: [
        { key: 'company',     label: '公司名称',  type: 'text' },
        { key: 'position',    label: '职位',      type: 'text' },
        { key: 'startDate',   label: '开始时间',  type: 'date' },
        { key: 'endDate',     label: '结束时间',  type: 'date' },
        { key: 'description', label: '实习内容',  type: 'textarea' },
      ],
    },
    {
      key: 'project', label: '项目经历', entryLabel: '项目',
      fields: [
        { key: 'name',        label: '项目名称',  type: 'text' },
        { key: 'role',        label: '担任角色',  type: 'text' },
        { key: 'startDate',   label: '开始时间',  type: 'date' },
        { key: 'endDate',     label: '结束时间',  type: 'date' },
        { key: 'link',        label: '项目链接',  type: 'text' },
        { key: 'responsibilities', label: '项目职责', type: 'textarea' },
        { key: 'description', label: '项目描述',  type: 'textarea' },
      ],
    },
    {
      key: 'award', label: '竞赛获奖', entryLabel: '奖项',
      fields: [
        { key: 'name',        label: '奖项名称',  type: 'text' },
        { key: 'level',       label: '级别',      type: 'text' },
        { key: 'date',        label: '获奖时间',  type: 'date' },
        { key: 'description', label: '奖项描述',  type: 'textarea' },
      ],
    },
    {
      key: 'honor', label: '荣誉称号', entryLabel: '荣誉',
      fields: [
        { key: 'name',         label: '荣誉名称',   type: 'text' },
        { key: 'level',        label: '级别',       type: 'text' },
        { key: 'date',         label: '获得时间',   type: 'date' },
        { key: 'organization', label: '颁发机构',   type: 'text' },
        { key: 'description',  label: '奖项描述',   type: 'textarea' },
      ],
    },
    {
      key: 'certificate', label: '证书', entryLabel: '证书',
      fields: [
        { key: 'name',      label: '证书名称',  type: 'text' },
        { key: 'authority', label: '发证机构',  type: 'text' },
        { key: 'date',      label: '取得时间',  type: 'date' },
      ],
    },
    {
      key: 'skill', label: '技能特长', entryLabel: '技能',
      fields: [
        { key: 'name',  label: '技能名称',  type: 'text' },
        { key: 'level', label: '熟练程度',  type: 'text' },
      ],
    },
    {
      key: 'language', label: '语言能力', entryLabel: '语言',
      fields: [
        { key: 'name',        label: '语言',    type: 'text' },
        { key: 'level',       label: '等级',    type: 'text' },
        { key: 'certificate', label: '证书',    type: 'text' },
        { key: 'score', label: '考试成绩（分数）', type: 'text' },
        { key: 'date', label: '获得时间', type: 'date' },
      ],
    },
    {
      key: 'familyMember', label: '家庭关系（逐位成员）', entryLabel: '成员',
      fields: [
        { key: 'name', label: '姓名', type: 'text' },
        { key: 'relation', label: '关系', type: 'text' },
        { key: 'company', label: '工作单位', type: 'text' },
        { key: 'politicalStatus', label: '政治面貌', type: 'text' },
        { key: 'position', label: '职位', type: 'text' },
      ],
    },
  ];

  // Site modules declare schema before this script. Merge definitions only; never
  // migrate, replace or infer any saved personal values during registration.
  function mergeFields(target, additions) {
    for (const field of additions || []) {
      const old = target.find(f => f.key === field.key);
      if (!old) target.push({ ...field, ...(field.options ? { options: [...field.options] } : {}) });
      else if (old.type === 'select' && field.type === 'select') old.options = [...new Set([...(old.options || []), ...(field.options || [])])];
      else if (old.type === 'text' && field.type === 'textarea') old.type = 'textarea';
    }
  }
  function installSiteSchemas() {
    for (const adapter of globalThis.ResumeSiteAdapters || []) {
      const schema = adapter.schema || {};
      mergeFields(BASE_FIELD_DEFS, schema.base);
      for (const collection of schema.collections || []) {
        const old = COLLECTION_DEFS.find(c => c.key === collection.key);
        if (old) mergeFields(old.fields, collection.fields);
        else COLLECTION_DEFS.push({ ...collection, fields: collection.fields.map(f => ({ ...f })) });
      }
      for (const [key, fields] of Object.entries(schema.extendCollections || {})) {
        const collection = COLLECTION_DEFS.find(c => c.key === key);
        if (collection) mergeFields(collection.fields, fields);
      }
    }
  }
  installSiteSchemas();

  // ---------------------------------------------------------------------------
  // 默认简历（全空，用户到 options 里填写）
  // ---------------------------------------------------------------------------
  function emptyResume() {
    const base = {};
    BASE_FIELD_DEFS.forEach((d) => { base[d.key] = ''; });

    const collections = {};
    COLLECTION_DEFS.forEach((c) => { collections[c.key] = []; });

    return {
      base,
      collections,
      selection: { collection: null, index: 0 },
    };
  }

  /** 空白模板：只创建字段和空条目，不包含个人资料。 */
  function sampleResume() {
    const r = emptyResume();
    for (const definition of COLLECTION_DEFS) {
      r.collections[definition.key] = [Object.fromEntries(definition.fields.map(field => [field.key, '']))];
    }
    r.custom = [];
    return r;
  }

  // ---------------------------------------------------------------------------
  // 把 resume 拍平成 { fillKey: value } 字典
  // fillKey 规则：
  //   base 字段直接用 key
  //   集合条目字段用 `${collection}.${fieldKey}`
  //   例如 education.school，award.name
  // 这样 filler / matcher 能统一按 fillKey 查找。
  // ---------------------------------------------------------------------------
  function buildFillMap(resume, selection) {
    const map = {};
    const r = resume || emptyResume();

    Object.keys(r.base || {}).forEach((k) => { map[k] = r.base[k]; });

    // 处理当前选中的集合条目：把它的字段并入顶层，方便"教育一列"直接匹配
    const sel = selection || r.selection || { collection: null, index: 0 };
    const collKey = sel.collection;
    const idx = sel.index || 0;

    if (collKey && r.collections[collKey] && r.collections[collKey][idx]) {
      const entry = r.collections[collKey][idx];
      Object.keys(entry).forEach((k) => {
        map[`${collKey}.${k}`] = entry[k];
      });
    }

    return map;
  }

  /** 所有可能的 fillKey 及其说明，用于调试/展示 */
  function possibleFillKeys() {
    const keys = [];
    BASE_FIELD_DEFS.forEach((d) => keys.push({ key: d.key, label: d.label }));
    COLLECTION_DEFS.forEach((c) => {
      c.fields.forEach((f) => keys.push({ key: `${c.key}.${f.key}`, label: `${c.label}-${f.label}` }));
    });
    return keys;
  }

  globalThis[APP] = {
    BASE_FIELD_DEFS,
    COLLECTION_DEFS,
    emptyResume,
    sampleResume,
    buildFillMap,
    possibleFillKeys,
    installSiteSchemas,
  };
})();
