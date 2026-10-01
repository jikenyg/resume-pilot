/* China Life's Phoenix template. Exact local labels; declarations stay independent. */
(function () {
  'use strict';
  const f = (key, label, type = 'text') => ({ key, label, type });
  const yn = (key, label) => ({ key, label, type: 'select', options: ['是', '否'] });
  const declarations = {
    chinaLifeCountyWork: '是否愿意去县级公司工作',
    chinaLifeRelativeEmployment: '是否有亲属现在中国人寿或广发银行工作',
    chinaLifeRelativeRetirement: '近三年是否有亲属在中国人寿或广发银行退休',
    chinaLifeScholarship: '是否获得过奖学金',
    chinaLifeStudentCadre: '是否为学生干部',
    chinaLifeDisciplinaryHistory: '是否曾有违规、违纪、违法、犯罪、涉黑、涉恶等受到处理的情况',
    chinaLifeForeignResident: '本人是否为外国公民或者香港、澳门、台湾地区居民',
    chinaLifeOverseasResidence: '本人是否获得外国国籍、国（境）外永久居留权、长期居留许可',
    chinaLifeOverseasTalentPlan: '本人是否已获批境外地区引进人才就业、定居的各类计划',
  };
  const normalize = s => s.replace(/（/g, '(').replace(/）/g, ')');
  const declarationFields = Object.fromEntries(Object.entries(declarations).map(([key, label]) => [normalize(label), key]));
  const relativeFields = Object.fromEntries(Object.entries(declarationFields).filter(([, key]) => /Relative/.test(key)));
  const schema = {
    base: [f('partyJoinDate', '加入党派时间', 'date'), f('chinaLifeExpectedAnnualSalaryWan', '中国人寿：期望待遇（万元/年）', 'number'),
      f('strengthsAndWeaknesses', '优势与不足', 'textarea'), f('selfEvaluationAndGoals', '自我评价及求职目标（合并栏）', 'textarea'),
      ...Object.entries(declarations).map(([key, label]) => yn(key, '中国人寿：' + label))],
    extendCollections: {
      education: [yn('fullTime', '是否全日制'), yn('highestFullTimeEducation', '是否最高全日制学历'), yn('primaryMajor', '是否主修')],
      internship: [f('employmentType', '用工形式')],
      award: [f('role', '获奖时担当角色')], honor: [f('role', '获奖时担当角色')],
      publication: [f('role', '论著担任角色（按网页选项）'), f('description', '内容摘要', 'textarea')],
      project: [f('level', '项目级别（按网页选项）')],
      certificate: [f('chinaLifeQualification', '中国人寿：具有资格证书（按网页选项）')],
      familyMember: [f('birthDate', '家庭成员出生日期', 'date')],
    },
  };
  const specs = {
    '个人基本信息': { fields: { 姓名: 'name', 民族: 'nationality', 证件号码: 'idCard', 性别: 'gender', 出生年月: 'birthDate', '身高(CM)': 'height', '体重(公斤)': 'weight', 党派: 'politicalStatus', 加入党派时间: 'partyJoinDate', 婚姻状况: 'maritalStatus', 国籍: 'country', 籍贯: 'origin', '生源地(高考时户口所在地)': 'studentOrigin', 现居住地: 'nativePlace', 通信地址: 'address', 电子邮箱: 'email', 移动电话: 'phone', 紧急联系人: 'emergencyName', 健康状况: 'health', 紧急联系方式: 'emergencyPhone', 是否服从调剂: 'acceptAdjustment', 期望工作城市: 'expectedCity', '期望待遇(万元/年)': 'chinaLifeExpectedAnnualSalaryWan', ...declarationFields } },
    '教育经历': { collection: 'education', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 学校: 'school', 专业名称: 'major', 第二专业: 'secondMajor', 学历: 'degree', 学位: 'academicDegree', 是否全日制: 'fullTime', 是否最高全日制学历: 'highestFullTimeEducation', 是否主修: 'primaryMajor' } },
    '计算机技能': { collection: 'skill', fields: { 技能类别: 'name' } },
    '工作/实习经历': { collection: 'work', collections: ['work', 'internship'], fields: { 开始时间: 'startDate', 结束时间: 'endDate', 单位名称: 'company', 所在部门: 'department', 职位名称: 'position', 用工形式: 'employmentType', 工作描述: 'description' } },
    '学习/工作获奖情况': { collection: 'award', collections: ['award', 'honor'], fields: { 获奖时间: 'date', 奖项名称: 'name', 获奖级别: 'level', 颁奖单位: 'organization', 其他补充: 'description', 担当角色: 'role' } },
    '违规、违纪、违法、犯罪、涉黑、涉恶等受到处理的情况': { fields: declarationFields },
    '专业论著': { collection: 'publication', fields: { 日期: 'date', '文章名、书名': 'name', '刊物、出版社': 'journal', 担任角色: 'role', 内容摘要: 'description' } },
    '语言能力': { collection: 'language', fields: { 外语语种: 'name', 语言等级: 'level', 得分: 'score' } },
    '参与科研项目': { collection: 'project', fields: { 开始时间: 'startDate', 结束时间: 'endDate', 项目名称: 'name', 项目级别: 'level', 担当角色: 'role', 主要工作内容: 'description' } },
    '专业资格': { collection: 'certificate', fields: { 具有资格证书: 'chinaLifeQualification', 证书名称: 'name', 获得时间: 'date' } },
    '家庭成员及重要社会关系': { collection: 'familyMember', fields: { 称谓: 'relation', 姓名: 'name', 出生日期: 'birthDate', 工作单位: 'company', 所属职务: 'position' } },
    '附加信息': { fields: relativeFields },
    '其他信息': { fields: { 爱好及特长: 'hobbiesAndSpecialties', 优势与不足: 'strengthsAndWeaknesses', 自我评价及求职目标: 'selfEvaluationAndGoals', 其他: 'additionalInfo', ...declarationFields } },
    '简历附件': { fields: {} },
    '本人承诺': { fields: {}, manual: { 本人承诺: '请本人阅读网页承诺后选择', 填表人签名: '请本人核对并签名', 填表日期: '请本人签名时填写日期' } },
  };
  ResumeBeisenFactory({
    id: 'chinalife', name: '中国人寿 / 北森 Phoenix', schema, specs, sortEducation: false, refreshRows: true,
    match: blocks => blocks.some(b => b.title === '个人基本信息' && b.block.querySelector('.form-item--phoenix') && b.block.textContent.includes(declarations.chinaLifeRelativeEmployment)) && blocks.some(b => b.title === '工作/实习经历'),
    entries(title, list) {
      list = list.filter(e => Object.values(e.data).some(v => v !== undefined && v !== null && String(v).trim() !== ''));
      if (title === '计算机技能') list = list.filter(e => e.data.section !== '其他技能');
      return list;
    },
    value(key, value) {
      // This page labels the same explicit adjustment choice “接受 / 不接受”.
      return key === 'acceptAdjustment' ? ({ 是: '接受', 否: '不接受' }[value] || value) : value;
    },
    validate(row) {
      if (row.key === 'chinaLifeExpectedAnnualSalaryWan' && row.value && !/^\d+(\.\d+)?$/.test(row.value)) return '请填写以万元/年为单位的独立数字，不换算月薪';
      if (Object.hasOwn(declarations, row.key) && row.value && !['是', '否'].includes(row.value)) return '声明需要本人明确填写是或否';
      return '';
    },
  });
})();
