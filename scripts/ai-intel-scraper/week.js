// ISO 8601 周次标签 'YYYY-Www'。纯函数，无依赖。
// 用"最近的周四"确定 ISO 周年（跨年边界周归属由周四决定）。
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 周一=0 … 周日=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // 移到本周周四
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4)); // 1月4日必在第1周
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

module.exports = { isoWeek };
