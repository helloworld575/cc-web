#!/usr/bin/env node
// 紫微斗数 calculation — pure CommonJS, no deps
// Usage: node calc.js <year> <month> <day> <hour>

const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];

const NAYIN_NAMES = [
  '海中金','海中金','炉中火','炉中火','大林木','大林木','路旁土','路旁土','剑锋金','剑锋金',
  '山头火','山头火','涧下水','涧下水','城头土','城头土','白蜡金','白蜡金','杨柳木','杨柳木',
  '泉中水','泉中水','屋上土','屋上土','霹雳火','霹雳火','松柏木','松柏木','长流水','长流水',
  '沙中金','沙中金','山下火','山下火','平地木','平地木','壁上土','壁上土','金箔金','金箔金',
  '覆灯火','覆灯火','天河水','天河水','大驿土','大驿土','钗钏金','钗钏金','桑柘木','桑柘木',
  '大溪水','大溪水','沙中土','沙中土','天上火','天上火','石榴木','石榴木','大海水','大海水',
];

const NAYIN_ELEMENTS = [
  '金','金','火','火','木','木','土','土','金','金',
  '火','火','水','水','土','土','金','金','木','木',
  '水','水','土','土','火','火','木','木','水','水',
  '金','金','火','火','木','木','土','土','金','金',
  '火','火','水','水','土','土','金','金','木','木',
  '水','水','土','土','火','火','木','木','水','水',
];

const JU_BY_NAYIN = {
  '水': { name: '水二局', num: 2 },
  '木': { name: '木三局', num: 3 },
  '金': { name: '金四局', num: 4 },
  '土': { name: '土五局', num: 5 },
  '火': { name: '火六局', num: 6 },
};

const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];

function hourToBranchIdx(hour) {
  if (hour >= 23 || hour < 1) return 0;
  return Math.floor((hour + 1) / 2);
}

// Simple bazi year pillar calc for nayinIdx
function calcYearStemBranch(year, month, day) {
  let y = year;
  if (month < 2 || (month === 2 && day < 4)) y = year - 1;
  const stemIdx = ((y - 4) % 10 + 10) % 10;
  const branchIdx = ((y - 4) % 12 + 12) % 12;
  return { stemIdx, branchIdx };
}

function calcZiwei(year, month, day, hour) {
  const hourBranchIdx = hourToBranchIdx(hour);
  const { stemIdx, branchIdx } = calcYearStemBranch(year, month, day);

  // 命宫: position 0=寅, shift by month and hour
  const mingGongPos = ((2 - month + hourBranchIdx) % 12 + 12) % 12; // 0=寅
  const mingGongBranchIdx = (mingGongPos + 2) % 12; // 0=子
  const mingGongBranch = BRANCHES[mingGongBranchIdx];

  // 身宫
  const shenGongPos = ((2 + month + hourBranchIdx) % 12 + 12) % 12;
  const shenGongBranchIdx = (shenGongPos + 2) % 12;
  const shenGongBranch = BRANCHES[shenGongBranchIdx];

  // 纳音 from year sexagenary
  const nayinIdx = (((year - 4) % 60) + 60) % 60;
  const nayinElement = NAYIN_ELEMENTS[nayinIdx];
  const nayinName = NAYIN_NAMES[nayinIdx];
  const wuxingJu = JU_BY_NAYIN[nayinElement] || { name: '火六局', num: 6 };

  // 12 palaces
  const palaces = PALACE_NAMES.map((name, i) => ({
    name,
    branch: BRANCHES[(mingGongBranchIdx + i) % 12],
  }));

  return {
    yearStem: STEMS[stemIdx],
    yearBranch: BRANCHES[branchIdx],
    mingGongBranch,
    shenGongBranch,
    nayinName,
    nayinElement,
    wuxingJu,
    palaces,
  };
}

const [,, year, month, day, hour] = process.argv;
if (!year) { console.error('Usage: node calc.js <year> <month> <day> <hour>'); process.exit(1); }
const result = calcZiwei(Number(year), Number(month), Number(day), Number(hour));
console.log(JSON.stringify(result, null, 2));
