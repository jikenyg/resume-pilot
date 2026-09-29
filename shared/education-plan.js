/* Preparation checklist, not a claim about unseen website controls. No saved data is mutated. */
(function () {
  'use strict';
  const levels = { '高中': 0, '大专': 1, '专科': 1, '本科': 2, '硕士': 3, '硕士研究生': 3, '博士': 4, '博士研究生': 4 };
  const fields = { school: '学校名称', degree: '学历', startDate: '入学日期', endDate: '毕业／预计毕业日期', city: '学校所在城市' };
  const text = value => String(value ?? '').trim();
  function check(resume, site = 'datang') {
    const entries = resume.collections?.education || [];
    const issues = [];
    const add = (index, field, reason) => issues.push({ index, path: `education[${index}].${field}`, label: fields[field] || '是否最高学历', reason });
    entries.forEach((entry, index) => {
      for (const [field, label] of Object.entries(fields)) if (!text(entry[field])) add(index, field, `请补充${label}`);
      if (text(entry.degree) && levels[text(entry.degree)] === undefined) add(index, 'degree', '请确认具体学历层次，不能仅写“研究生”');
      for (const field of ['startDate', 'endDate']) {
        const value = text(entry[field]);
        if (!value) continue;
        const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
        const date = match && new Date(+match[1], +match[2] - 1, +(match[3] || 1));
        if (!match || date.getFullYear() !== +match[1] || date.getMonth() + 1 !== +match[2] || date.getDate() !== +(match[3] || 1)) add(index, field, '请填写有效年月或日期');
      }
      if (/^\d{4}-\d{2}/.test(text(entry.startDate)) && /^\d{4}-\d{2}/.test(text(entry.endDate)) && text(entry.startDate).slice(0, 7) > text(entry.endDate).slice(0, 7)) add(index, 'endDate', '毕业日期不能早于入学日期');
    });
    const highSchoolMissing = !entries.some(e => text(e.degree) === '高中');
    const highest = entries.map((e, i) => text(e.highestEducation) === '是' ? i : -1).filter(i => i >= 0);
    if (highest.length > 1) highest.forEach(index => add(index, 'highestEducation', '有多条标为最高学历，请只保留一条'));
    const order = entries.map((e, index) => ({ index, degree: text(e.degree), level: levels[text(e.degree)] }));
    const priority = e => site === 'citic' ? -(e.level ?? 99) : e.level === 0 ? 99 : (e.level ?? -1);
    order.sort((a, b) => priority(b) - priority(a) || a.index - b.index);
    const max = Math.max(-1, ...order.map(e => e.level ?? -1));
    for (const index of highest) if (levels[text(entries[index].degree)] < max) add(index, 'highestEducation', '此条并非资料中的最高学历，请核对');
    return { order, issues, highSchoolMissing, highestUnset: highest.length === 0, complete: !highSchoolMissing && !issues.length && highest.length === 1 };
  }
  function isDatangURL(value) {
    try { const url = new URL(value); return url.hostname === 'zhaopin.china-cdt.com' && /^\/resume\/resume\/showAdd\/?$/.test(url.pathname); } catch (_) { return false; }
  }
  function shell(root) {
    return [...root.querySelectorAll('iframe[src]')].some(frame => isDatangURL(frame.getAttribute('src')));
  }
  globalThis.ResumeEducationPlan = { check, shell, isDatangURL };
})();
