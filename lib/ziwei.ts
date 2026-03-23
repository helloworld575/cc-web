// Zi Wei Dou Shu (紫微斗数) utilities

import { BRANCHES } from './bazi';

// 纳音五行 (Nayin elements) indexed by sexagenary cycle position (0-59)
// Each pair shares the same 纳音 element
const NAYIN_ELEMENTS: string[] = [
  '金','金','火','火','木','木','土','土','金','金', // 0-9
  '火','火','水','水','土','土','日月','日月','金','金', // 10-19 (壁上土 etc.)
  '木','木','水','水','火','火','土','土','木','木', // 20-29
  '金','金','土','土','火','火','水','水','木','木', // 30-39
  '金','金','火','火','木','木','土','土','金','金', // 40-49
  '火','火','木','木','水','水','土','土','金','金', // 50-59
];

// Proper 纳音 names by sexagenary index
const NAYIN_NAMES: string[] = [
  '海中金','海中金','炉中火','炉中火','大林木','大林木','路旁土','路旁土','剑锋金','剑锋金',
  '山头火','山头火','涧下水','涧下水','城头土','城头土','白蜡金','白蜡金','杨柳木','杨柳木',
  '泉中水','泉中水','屋上土','屋上土','霹雳火','霹雳火','松柏木','松柏木','长流水','长流水',
  '沙中金','沙中金','山下火','山下火','平地木','平地木','壁上土','壁上土','金箔金','金箔金',
  '覆灯火','覆灯火','天河水','天河水','大驿土','大驿土','钗钏金','钗钏金','桑柘木','桑柘木',
  '大溪水','大溪水','沙中土','沙中土','天上火','天上火','石榴木','石榴木','大海水','大海水',
];

// 五行局 (Wuxing Ju) — determines 紫微星 starting position
export interface WuxingJu {
  name: string;  // e.g. 水二局
  num: number;   // 2/3/4/5/6
  element: string;
}

const JU_BY_NAYIN: Record<string, WuxingJu> = {
  '水': { name: '水二局', num: 2, element: '水' },
  '木': { name: '木三局', num: 3, element: '木' },
  '金': { name: '金四局', num: 4, element: '金' },
  '土': { name: '土五局', num: 5, element: '土' },
  '火': { name: '火六局', num: 6, element: '火' },
  '日月': { name: '火六局', num: 6, element: '火' }, // 日月 → 火六局
};

// 12 palaces starting from 命宫 position, going clockwise
export const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];

// 安命宫: 以寅宫为起点，逆数月份，顺数时支
// Formula: mingGong = ((14 - solarMonth - hourBranchIdx) % 12 + 12) % 12
// where position 0=寅, 1=卯, 2=辰, ..., 11=丑

// Hour branch index (0-11): 子=0, 丑=1, 寅=2, ..., 亥=11
function hourToBranchIdx(hour: number): number {
  if (hour >= 23 || hour < 1) return 0; // 子
  return Math.floor((hour + 1) / 2);
}

export interface ZiweiResult {
  mingGongBranch: string;   // 命宫地支
  shenGongBranch: string;   // 身宫地支
  mingGongIdx: number;      // 0-11 (寅=0)
  shenGongIdx: number;
  wuxingJu: WuxingJu;
  nayinName: string;
  palaces: { name: string; branch: string }[];  // 12 palaces with their branches
  sexagenaryIdx: number;    // for reference
}

export function calcZiwei(
  year: number, month: number, day: number, hour: number,
  stemIdx: number, branchIdx: number  // year pillar indices from bazi
): ZiweiResult {
  const hourBranchIdx = hourToBranchIdx(hour);

  // 命宫 position (0=寅, going 子丑寅卯..., so 寅=2 in子丑寅序)
  // Standard formula: 以寅月为正月，逆布十二支，然后顺数时支
  // mingGongPos (0=寅): (2 - solarMonth + hourBranchIdx + 12) % 12
  // But we map to branch index (0=子): add 2 for 寅 offset
  const mingGongPos = ((2 - month + hourBranchIdx) % 12 + 12) % 12; // 0=寅
  const mingGongBranchIdx = (mingGongPos + 2) % 12; // 0=子
  const mingGongBranch = BRANCHES[mingGongBranchIdx];

  // 身宫 formula: opposite direction
  const shenGongPos = ((2 + month + hourBranchIdx) % 12 + 12) % 12;
  const shenGongBranchIdx = (shenGongPos + 2) % 12;
  const shenGongBranch = BRANCHES[shenGongBranchIdx];

  // 纳音 from year pillar sexagenary index
  const sexagenaryIdx = (stemIdx * 12 + branchIdx) % 60;
  // Actually: sexagenary cycle = (stemIdx % 10 as stem, branchIdx % 12 as branch)
  // combined index = stem*6 + branch/2 roughly; simpler: use (y-4) mapping
  const nayinIdx = (((year - 4) % 60) + 60) % 60;
  const nayinElement = NAYIN_ELEMENTS[nayinIdx];
  const nayinName = NAYIN_NAMES[nayinIdx];
  const wuxingJu = JU_BY_NAYIN[nayinElement] ?? { name: '火六局', num: 6, element: '火' };

  // 12 palaces: start from 命宫, go through 兄弟/夫妻/... in branch order
  const palaces = PALACE_NAMES.map((name, i) => {
    const branchPos = (mingGongBranchIdx + i) % 12;
    return { name, branch: BRANCHES[branchPos] };
  });

  return {
    mingGongBranch,
    shenGongBranch,
    mingGongIdx: mingGongBranchIdx,
    shenGongIdx: shenGongBranchIdx,
    wuxingJu,
    nayinName,
    palaces,
    sexagenaryIdx: nayinIdx,
  };
}

export function formatZiweiDesc(result: ZiweiResult): string {
  return `命宫：${result.mingGongBranch}宫 | 身宫：${result.shenGongBranch}宫 | 纳音：${result.nayinName} | ${result.wuxingJu.name}`;
}
