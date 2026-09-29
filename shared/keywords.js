/**
 * 简历助手 —— 第一层：关键词/规则匹配字典
 *
 * 这一层完全在本地运行，不调用任何 LLM，零 token 成本。
 * 原理：从页面控件抠出"提示文本"（label/name/id/placeholder/aria），
 * 规范化后与 KEYWORD_DICT 里的别名做包含匹配，命中即定位到某个简历字段。
 *
 * 命名空间：globalThis.ResumeShared（由 schema.js 先建立，此处合并）。
 */
(function () {
  'use strict';

  const APP = 'ResumeShared';

  // ---------------------------------------------------------------------------
  // 字段 -> 别名表
  // patterns 里的每一项都是一个"提示片段"，规范化后做包含匹配。
  // 中文正文通常会写"请输入您的手机号码"，我们只要命中"手机号/手机号码"即可。
  // ---------------------------------------------------------------------------
  const KEYWORD_DICT = [
    // ============== 基础字段 =================
    { key: 'name', label: '姓名', patterns: ['姓名', '真实姓名', '你的姓名', '请填写姓名', '名字', 'fullname', 'full name', 'your name', 'name'] },
    { key: 'englishName', label: '英文名', patterns: ['英文名', '英文姓名', 'english name', 'englishname', 'name en'] },
    { key: 'gender', label: '性别', patterns: ['性别', 'sex', 'gender'] },
    { key: 'phone', label: '手机号', patterns: ['手机号', '手机号码', '联系电话', '电话号码', '联系方式', '电话', '手机', 'mobile', 'phone', 'tel', 'telephone'] },
    { key: 'wechat', label: '微信号', patterns: ['微信号', '微信', 'wechat', 'weixin', 'wechat id'] },
    { key: 'qq', label: 'QQ号', patterns: ['qq号', 'qq号码', 'qq', 'qq number', 'q q'] },
    { key: 'email', label: '邮箱', patterns: ['邮箱', '电子邮箱', '邮件地址', '电子信箱', 'email', 'e-mail', 'mail address', 'email address'] },
    { key: 'birthDate', label: '出生日期', patterns: ['出生日期', '出生年月', '出生时间', '生日', 'birthday', 'birth date', 'date of birth', 'born'] },
    { key: 'idCard', label: '身份证号', patterns: ['身份证号', '身份证号码', '身份证', '证件号码', '证件号', 'id card', 'idcard', 'id number', 'identity card', '证件类型'] },
    { key: 'nationality', label: '民族', patterns: ['民族', 'ethnicity', 'nation', 'ethnic group'] },
    { key: 'household', label: '户籍', patterns: ['户籍', '户籍地', '户口', '户口所在地', 'household', 'registered residence', 'hukou'] },
    { key: 'origin', label: '籍贯', patterns: ['籍贯', '家乡', 'native place', 'birthplace', 'origin'] },
    { key: 'nativePlace', label: '居住地', patterns: ['居住地', '现居住地', '居住地址', 'current residence', 'residence'] },
    { key: 'currentCity', label: '现居城市', patterns: ['现居城市', '所在城市', '现居住城市', '当前城市', 'current city', 'city of residence'] },
    { key: 'address', label: '家庭住址', patterns: ['家庭住址', '住址', '通讯地址', '联系地址', '家庭地址', '详细地址', 'address', 'postal address'] },
    { key: 'postalCode', label: '邮政编码', patterns: ['邮政编码', '邮编', 'zip code', 'postal code', 'zip', 'postcode'] },
    { key: 'height', label: '身高', patterns: ['身高', 'height', 'body height'] },
    { key: 'weight', label: '体重', patterns: ['体重', 'weight', 'body weight'] },
    { key: 'bloodType', label: '血型', patterns: ['血型', 'blood type', 'bloodtype'] },
    { key: 'maritalStatus', label: '婚姻状况', patterns: ['婚姻状况', '婚姻', '婚否', 'marital status', 'marriage'] },
    { key: 'politicalStatus', label: '政治面貌', patterns: ['政治面貌', '政治身份', '政治', 'political status', 'party', '党员', '团员'] },
    { key: 'health', label: '健康状况', patterns: ['健康状况', '健康状况', '健康', 'health condition', 'health'] },
    { key: 'specialty', label: '特长', patterns: ['个人特长', '我的特长', '特长', '专长', 'specialty', 'special skill', 'expertise'] },
    { key: 'hobby', label: '兴趣爱好', patterns: ['兴趣爱好', '爱好', '兴趣', 'hobby', 'interests', 'personal interest'] },
    { key: 'educationDegree', label: '最高学历', patterns: ['最高学历', '最高学位', '最终学历', '学历', '学位', 'degree', 'education level', '最后学历'] },
    { key: 'school', label: '毕业院校', patterns: ['毕业院校', '毕业学校', '院校', '学校名称', '学校', '毕业院校名称', 'school', 'university', 'college', 'graduate school'] },
    { key: 'major', label: '专业', patterns: ['所学专业', '专业名称', '专业', '主修专业', '专业类别', 'major', 'specialty'] },
    { key: 'graduationDate', label: '毕业时间', patterns: ['毕业时间', '毕业日期', '毕业年月', 'graduation date', 'graduate date'] },
    { key: 'enrollmentDate', label: '入学时间', patterns: ['入学时间', '入学日期', '入学年月', '开学时间', 'enrollment date'] },
    { key: 'language', label: '外语语种', patterns: ['外语语种', '外语水平', '语种', '外语', '语言', 'language', 'foreign language'] },
    { key: 'languageLevel', label: '外语等级', patterns: ['外语等级', '英语等级', '语言等级', '英语水平', 'cet', '四级', '六级', '专四', '专八', 'level'] },
    { key: 'techSkills', label: '计算机技能', patterns: ['计算机技能', '计算机能力', '专业技能', '专业能力', '专业特长', '技术能力', '技术特长', 'it skill', 'tech skills', '专业技术'] },
    { key: 'selfEval', label: '自我评价', patterns: ['自我评价', '自我推荐', '个人简介', '自我介绍', '个人评价', '自我描述', '个人陈述', 'self evaluation', 'self-assessment', 'about me'] },
    { key: 'jobIntention', label: '求职意向', patterns: ['求职意向', '意向岗位', '应聘岗位', '期望职位', '求职岗位', '应聘职位', '意向职位', 'job intention', 'desired position', 'expected position'] },
    { key: 'availableTime', label: '到岗时间', patterns: ['到岗时间', '可到岗时间', '入职时间', '到职时间', 'available time'] },
    { key: 'expectedSalary', label: '期望薪资', patterns: ['期望薪资', '期望月薪', '期望待遇', '薪资要求', 'salary expectation', 'expected salary'] },
    { key: 'personalSite', label: '个人主页', patterns: ['个人主页', '个人网站', '个人网页', '个人博客', '博客', 'website', 'homepage', 'blog'] },
    { key: 'honorList', label: '荣誉/获奖成果', patterns: ['获奖情况', '获奖记录', '荣誉成果', '所获荣誉', '所获奖励', '奖学金', '获奖', '荣誉', '奖项', 'honor', 'award', 'prize', 'accomplishment'] },
    { key: 'competitionResults', label: '竞赛成果', patterns: ['竞赛成果', '竞赛获奖', '比赛获奖', '参赛经历', '竞赛', '比赛', 'competition'] },
    { key: 'campusExperience', label: '校园经历', patterns: ['校园经历', '在校经历', '学生工作', '学生干部', '校园活动', '在校表现', '校内经历', 'campus'] },
    { key: 'paper', label: '论文/科研成果', patterns: ['论文', '科研成果', '发表论文', '学术论文', '期刊', 'paper', 'publication', '学术成果'] },
    { key: 'family', label: '家庭情况', patterns: ['家庭情况', '家庭成员', '家庭信息', '亲属', '家人', 'family'] },

    // ============== 教育经历 =================
    { key: 'education.school', label: '教育-学校', patterns: ['学校名称', '毕业院校', '毕业学校', '学校', '院校', 'school', 'university', 'college'] },
    { key: 'education.major', label: '教育-专业', patterns: ['所学专业', '专业名称', '专业', 'major', 'specialty'] },
    { key: 'education.degree', label: '教育-学历', patterns: ['学历', '学位', 'degree', '教育类型', '最高学历'] },
    { key: 'education.startDate', label: '教育-开始时间', patterns: ['开始时间', '入学时间', '入学日期', '开始日期', '入学年月', '在校时间', 'start date', 'enrollment date'] },
    { key: 'education.endDate', label: '教育-结束时间', patterns: ['结束时间', '毕业时间', '结束日期', '毕业日期', '毕业年月', 'end date', 'graduation date'] },
    { key: 'education.gpa', label: '教育-成绩', patterns: ['gpa', '平均学分绩点', '绩点', '平均成绩', '学分', '平均分'] },
    { key: 'education.rank', label: '教育-排名', patterns: ['排名', '专业排名', '年级排名', 'rank'] },
    { key: 'education.description', label: '教育-经历描述', patterns: ['在校经历', '在校表现', '在校情况', '描述', '备注', '经历描述', 'description', '获奖情况'] },

    // ============== 工作经历 =================
    { key: 'work.company', label: '工作-公司', patterns: ['公司名称', '公司', '工作单位', '单位名称', '雇主', 'employer', 'company name', 'company'] },
    { key: 'work.position', label: '工作-职位', patterns: ['职位', '岗位', '职务', 'position', 'title', 'post', 'job title'] },
    { key: 'work.department', label: '工作-部门', patterns: ['部门', '所在部门', 'department'] },
    { key: 'work.startDate', label: '工作-开始时间', patterns: ['开始时间', '入职时间', '开始日期', '在职开始', 'start date'] },
    { key: 'work.endDate', label: '工作-结束时间', patterns: ['结束时间', '离职时间', '结束日期', '在职结束', 'end date'] },
    { key: 'work.description', label: '工作-内容', patterns: ['工作内容', '工作描述', '职责', '岗位职责', '工作业绩', 'description', 'responsibilities'] },

    // ============== 实习经历 =================
    { key: 'internship.company', label: '实习-公司', patterns: ['公司名称', '实习单位', '公司', '单位名称', 'company'] },
    { key: 'internship.position', label: '实习-职位', patterns: ['职位', '岗位', '实习岗位', '职务', 'position'] },
    { key: 'internship.startDate', label: '实习-开始时间', patterns: ['开始时间', '入职时间', '开始日期', 'start date'] },
    { key: 'internship.endDate', label: '实习-结束时间', patterns: ['结束时间', '离职时间', '结束日期', 'end date'] },
    { key: 'internship.description', label: '实习-内容', patterns: ['实习内容', '工作任务', '实习描述', '工作内容', 'description'] },

    // ============== 项目经历 =================
    { key: 'project.name', label: '项目-名称', patterns: ['项目名称', '项目', 'project name', 'project'] },
    { key: 'project.role', label: '项目-角色', patterns: ['担任角色', '项目角色', '职责', '承担工作', 'role', 'project role'] },
    { key: 'project.startDate', label: '项目-开始时间', patterns: ['开始时间', '项目开始', '开始日期', 'start date'] },
    { key: 'project.endDate', label: '项目-结束时间', patterns: ['结束时间', '项目结束', '结束日期', 'end date'] },
    { key: 'project.link', label: '项目-链接', patterns: ['项目链接', '链接', '网址', 'link', 'url', 'project url'] },
    { key: 'project.description', label: '项目-描述', patterns: ['项目描述', '项目简介', '项目内容', '描述', 'description', '项目成果'] },

    // ============== 获奖/荣誉 =================
    { key: 'award.name', label: '获奖-名称', patterns: ['奖项名称', '获奖名称', '荣誉名称', 'award', 'honor', '获奖'] },
    { key: 'award.level', label: '获奖-级别', patterns: ['级别', '奖项级别', '获奖级别', '等级', 'level'] },
    { key: 'award.date', label: '获奖-时间', patterns: ['获奖时间', '时间', '获奖日期', 'date'] },
    { key: 'award.description', label: '获奖-说明', patterns: ['奖项说明', '获奖说明', '简述', '简介', '说明', '描述', 'description'] },

    // ============== 荣誉称号 =================
    { key: 'honor.name', label: '荣誉-名称', patterns: ['荣誉名称', '荣誉称号', '所获荣誉', 'honor name'] },
    { key: 'honor.level', label: '荣誉-级别', patterns: ['荣誉级别', '级别', '等级', 'level'] },
    { key: 'honor.date', label: '荣誉-时间', patterns: ['获得时间', '获得日期', '取得时间', 'date'] },
    { key: 'honor.organization', label: '荣誉-机构', patterns: ['颁发机构', '授予单位', '授予机构', '发证机构', 'organization'] },
    { key: 'honor.description', label: '荣誉-说明', patterns: ['荣誉说明', '说明', '描述', 'description'] },

    // ============== 证书 =================
    { key: 'certificate.name', label: '证书-名称', patterns: ['证书名称', '证书', '资格证', 'certificate', '资质'] },
    { key: 'certificate.authority', label: '证书-机构', patterns: ['发证机构', '颁发机构', '发证单位', '机构', 'authority', 'issuer'] },
    { key: 'certificate.date', label: '证书-时间', patterns: ['取得时间', '获得时间', '发证时间', 'date'] },

    // ============== 干部任职 =================
    { key: 'cadre.organization', label: '干部-组织/学院', patterns: ['学院', '组织', '学院名称', '任职学院', 'organization', '学院或组织'] },
    { key: 'cadre.role', label: '干部-职务', patterns: ['担任职务', '职务', '任职', '在校职务', 'role', 'position', '校内职务'] },
    { key: 'cadre.startDate', label: '干部-开始时间', patterns: ['开始时间', '任职开始', '任职时间', 'start date'] },
    { key: 'cadre.endDate', label: '干部-结束时间', patterns: ['结束时间', '任职结束', 'end date'] },
    { key: 'cadre.description', label: '干部-工作内容', patterns: ['工作内容', '职责', '主要职责', 'description'] },

    // ============== 技能 =================
    { key: 'skill.name', label: '技能-名称', patterns: ['技能名称', '技能', '专业能力', 'skill'] },
    { key: 'skill.level', label: '技能-程度', patterns: ['熟练程度', '技能等级', '掌握程度', '水平', '程度', 'level'] },

    // ============== 语言能力 =================
    { key: 'language.name', label: '语言-名称', patterns: ['语言', '语种', '外语语种', 'language'] },
    { key: 'language.level', label: '语言-等级', patterns: ['等级', '水平', '语言等级', 'level'] },
    { key: 'language.certificate', label: '语言-证书', patterns: ['证书', 'certificate'] },
  ];

  // ---------------------------------------------------------------------------
  // 区块（section）提示：用于判断控件属于哪个集合，从而限定候选字段，避免跨区误填。
  // ---------------------------------------------------------------------------
  const SECTION_HINTS = {
    education: ['教育经历', '教育背景', '学习经历', '在校经历', 'education', '教育'],
    cadre: ['干部任职', '在校职务', '学生工作', '干部经历', '班干部', '担任职务', '任职经历'],
    work: ['工作经历', '职业经历', '工作经验', '工作', 'work experience'],
    internship: ['实习经历', '实习经验', '实习', 'internship'],
    project: ['项目经历', '项目经验', '参与的', '项目', 'project'],
    honor: ['荣誉称号', '所获荣誉', '荣誉'],
    award: ['获奖', '奖项', '竞赛获奖', '获奖经历', '所获奖励', '表彰', '表彰与奖励', '奖励', '竞赛', 'award', 'honor'],
    certificate: ['证书', '资格证', '资质', '资格证书', 'certificate'],
    skill: ['技能特长', '专业技能', '技能证书', '技能', '能力', 'skill'],
    language: ['语言能力', '外语能力', '语言', 'language'],
  };

  // 区块关键词对应的 class/id/publicId 片段（识别 SPA 常见命名）
  const SECTION_CLASS_HINTS = {
    education: ['edu', 'school'],
    cadre: ['cadre', 'duty', 'student', 'position', 'office'],
    work: ['work', 'career', 'job'],
    internship: ['intern', 'practice'],
    project: ['project'],
    honor: ['honor', 'title', 'glory', 'trophy'],
    award: ['award', 'honor', 'prize'],
    certificate: ['cert', 'qualif'],
    skill: ['skill', 'ability'],
    language: ['language', 'lang'],
  };

  /**
   * 规范化文本：小写、去空白、去常见中英文标点。
   */
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\s\u3000\u00a0，。；：、（）()\-_\/\\.,:;'"“”‘’·*~!！?？\[\]【】<>《》+]/g, '');
  }

  /**
   * 在给定 hint 中匹配字段。
   * @param {string} hint 控件的提示文本
   * @param {Set<string>|null} scope 仅考虑这些 key；null 表示全部
   * @param {string} [preferPrefix] 命中的 key 若以此开头则加权（用于"区块内优先集合字段"）
   * @returns {{entry, score, matched, hint}|null}
   */
  function matchField(hint, scope, preferPrefix) {
    const h = normalize(hint);
    if (!h) return null;
    let best = null;
    let bestScore = 0;
    let bestMatched = '';
    for (const entry of KEYWORD_DICT) {
      if (scope && !scope.has(entry.key)) continue;
      let score = 0;
      let matched = '';
      for (const p of entry.patterns) {
        const np = normalize(p);
        if (!np) continue;
        if (h === np) {
          score = Math.max(score, 100 + np.length);
          if (score >= 100 + np.length) matched = np;
        } else if (h.includes(np)) {
          const s = np.length;
          if (s > score) { score = s; matched = np; }
        }
      }
      if (score > 0 && preferPrefix && entry.key.indexOf(preferPrefix) === 0) score += 30; // 仅在确实命中后再加权（作为同分优先），避免零匹配被硬选
      if (score > bestScore) {
        bestScore = score;
        best = entry;
        bestMatched = matched;
      }
    }
    if (!best || bestScore < 2) return null; // 至少一个长度>=2的片段命中，避免单个字符误配
    return { entry: best, score: bestScore, matched: bestMatched, hint };
  }

  /**
   * 从一段文本中识别它属于哪个集合区块。
   * @param {string} text 区块标题/上下文文本
   * @returns {string|null} 集合 key
   */
  function detectSection(text) {
    const t = normalize(text);
    if (!t) return null;
    let best = null;
    let bestScore = 0;
    for (const key in SECTION_HINTS) {
      let score = 0;
      for (const p of SECTION_HINTS[key]) {
        const np = normalize(p);
        if (t.includes(np)) score = Math.max(score, np.length);
      }
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return bestScore >= 2 ? best : null;
  }

  /**
   * 从元素的 class/id 中识别区块（辅助 detectSection）。
   */
  function detectSectionFromClass(idOrClass) {
    const t = normalize(idOrClass || '');
    if (!t) return null;
    for (const key in SECTION_CLASS_HINTS) {
      for (const frag of SECTION_CLASS_HINTS[key]) {
        if (t.includes(normalize(frag))) return key;
      }
    }
    return null;
  }

  globalThis[APP] = Object.assign(globalThis[APP] || {}, {
    KEYWORD_DICT,
    SECTION_HINTS,
    normalize,
    matchField,
    detectSection,
    detectSectionFromClass,
  });
})();
